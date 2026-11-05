from datetime import timedelta
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from .models import Application, Club, ClubMember, FinderPost, Invitation, MarketPost, Recruitment, Reservation, User
from .services import DomainError, issue_invitation, redeem_invitation, reserve, score_match


@override_settings(INVITATION_SECRET='x' * 40)
class ServiceTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin', password='test-password', email='admin@example.com', email_verified=True, student_active=True, is_superuser=True)
        self.pending = User.objects.create_user(username='pending', password='test-password', email='pending@example.com', email_verified=True)
        self.student = User.objects.create_user(username='student', password='test-password', email='student@example.com', email_verified=True, student_active=True)

    def test_invitation_is_hashed_single_use_and_activates_only_verified_user(self):
        invite, code = issue_invitation(self.admin)
        self.assertNotEqual(invite.code_hash, code)
        self.assertTrue(redeem_invitation(self.pending, code)[0])
        self.pending.refresh_from_db()
        self.assertTrue(self.pending.student_active)
        other = User.objects.create_user(username='other', email='other@example.com', email_verified=True)
        self.assertFalse(redeem_invitation(other, code)[0])

    def test_invalid_expired_and_revoked_invites_rejected(self):
        invite, code = issue_invitation(self.admin)
        invite.expires_at = timezone.now() - timedelta(seconds=1)
        invite.save()
        self.assertFalse(redeem_invitation(self.pending, code)[0])
        invite.expires_at = timezone.now() + timedelta(days=1)
        invite.revoked_at = timezone.now()
        invite.save()
        self.assertFalse(redeem_invitation(self.pending, code)[0])

    def test_invite_attempt_limit_is_persisted(self):
        for _ in range(5):
            self.assertFalse(redeem_invitation(self.pending, 'wrong')[0])
        _, code = issue_invitation(self.admin)
        self.assertFalse(redeem_invitation(self.pending, code)[0])
        self.pending.refresh_from_db()
        self.assertFalse(self.pending.student_active)

    def test_reservation_rejects_self_and_duplicate(self):
        post = MarketPost.objects.create(owner=self.student, title='책', description='설명', price=1000, category='책')
        with self.assertRaises(DomainError):
            reserve(post.pk, self.student)
        other = User.objects.create_user(username='buyer', email='buyer@example.com', email_verified=True, student_active=True)
        reserve(post.pk, other)
        with self.assertRaises(DomainError):
            reserve(post.pk, self.admin)
        self.assertEqual(Reservation.objects.filter(post=post, status='ACTIVE').count(), 1)

    def test_match_score(self):
        a = FinderPost(owner=self.student, kind='lost', category='책', color='검정', general_location='도서관', occurred_at=timezone.localdate())
        b = FinderPost(owner=self.admin, kind='found', category='책', color='검정', general_location='도서관', occurred_at=timezone.localdate())
        self.assertEqual(score_match(a, b), 100)
        b.category, b.general_location = '가방', ''
        self.assertEqual(score_match(a, b), 40)

    def test_public_and_club_permissions(self):
        club = Club.objects.create(slug='test', name='동아리', category='기타', introduction='소개', is_public=True)
        now = timezone.now()
        recruitment = Recruitment.objects.create(club=club, title='모집', description='설명', opens_at=now-timedelta(days=1), closes_at=now+timedelta(days=1), is_open=True)
        Application.objects.create(recruitment=recruitment, applicant=self.pending, answers={'answer': '비공개 답변'})
        response = self.client.get(reverse('club-detail', args=[club.slug]))
        self.assertNotContains(response, '비공개 답변')
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(reverse('club-applications', args=[club.slug])).status_code, 403)
        ClubMember.objects.create(club=club, user=self.student, role='manager')
        self.assertContains(self.client.get(reverse('club-applications', args=[club.slug])), '비공개 답변')

    def test_pending_finder_is_private_and_owner_is_only_editor(self):
        post = FinderPost.objects.create(owner=self.student, kind='lost', title='가방', category='가방', color='검정', general_location='복도', occurred_at=timezone.localdate())
        self.assertNotContains(self.client.get(reverse('finder')), '가방')
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(reverse('finder-edit', args=[post.pk])).status_code, 404)
        self.client.force_login(self.student)
        self.assertContains(self.client.get(reverse('finder')), '가방')

    def test_student_mutation_requires_verification(self):
        self.client.force_login(self.pending)
        self.assertEqual(self.client.get(reverse('market-new')).status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get(reverse('market-new')).status_code, 302)

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections, connections
from django.test import TransactionTestCase, skipUnlessDBFeature


@override_settings(INVITATION_SECRET='x' * 40)
@skipUnlessDBFeature('has_select_for_update')
class ConcurrencyTests(TransactionTestCase):
    def test_only_one_account_can_redeem_one_invitation(self):
        admin = User.objects.create_user(username='admin', email='admin@example.com', email_verified=True, student_active=True, is_superuser=True)
        users = [User.objects.create_user(username=f'u{i}', email=f'u{i}@example.com', email_verified=True) for i in range(2)]
        _, code = issue_invitation(admin)
        barrier = Barrier(2)
        def attempt(pk):
            close_old_connections()
            try:
                user = User.objects.get(pk=pk)
                barrier.wait(timeout=10)
                return redeem_invitation(user, code)[0]
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(attempt, [user.pk for user in users]))
        self.assertEqual(sorted(outcomes), [False, True])
        self.assertEqual(User.objects.filter(pk__in=[user.pk for user in users], student_active=True).count(), 1)

    def test_only_one_simultaneous_reservation_succeeds(self):
        owner = User.objects.create_user(username='owner', email='owner@example.com', email_verified=True, student_active=True)
        users = [User.objects.create_user(username=f'b{i}', email=f'b{i}@example.com', email_verified=True, student_active=True) for i in range(2)]
        post = MarketPost.objects.create(owner=owner, title='책', description='설명', price=1000, category='책')
        barrier = Barrier(2)
        def attempt(pk):
            close_old_connections()
            try:
                user = User.objects.get(pk=pk)
                barrier.wait(timeout=10)
                try:
                    reserve(post.pk, user)
                    return True
                except DomainError:
                    return False
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(attempt, [user.pk for user in users]))
        self.assertEqual(sorted(outcomes), [False, True])
        self.assertEqual(Reservation.objects.filter(post=post, status='ACTIVE').count(), 1)


class AuthenticationTests(TestCase):
    def test_email_verification_required_before_login(self):
        user = User.objects.create_user(username='nickname', email='student@example.com', password='test-password')
        response = self.client.post(reverse('login'), {'username': 'student@example.com', 'password': 'test-password'})
        self.assertContains(response, '이메일을 먼저 확인')
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        response = self.client.post(reverse('login'), {'username': 'student@example.com', 'password': 'test-password'})
        self.assertEqual(response.status_code, 302)

    def test_unknown_email_does_not_authenticate_a_matching_username(self):
        User.objects.create_user(username='not-an-email@example.com', email='real@example.com', password='test-password', email_verified=True)
        response = self.client.post(reverse('login'), {'username': 'not-an-email@example.com', 'password': 'test-password'})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('_auth_user_id', self.client.session)

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
    def test_account_limit_applies_across_ips_and_login_routes(self):
        import json
        for attempt in range(15):
            ip = f'198.51.100.{attempt + 1}'
            if attempt % 2:
                response = self.client.post('/api/auth/sign-in/email', data=json.dumps({'email': 'student@example.com', 'password': 'wrong'}), content_type='application/json', REMOTE_ADDR=ip)
            else:
                response = self.client.post(reverse('login'), {'username': 'student@example.com', 'password': 'wrong'}, REMOTE_ADDR=ip)
            self.assertNotEqual(response.status_code, 429)
        response = self.client.post(reverse('login'), {'username': 'student@example.com', 'password': 'wrong'}, REMOTE_ADDR='198.51.100.100')
        self.assertEqual(response.status_code, 429)


class ImageAndSecurityTests(TestCase):
    def setUp(self):
        import tempfile
        from pathlib import Path
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.settings_override = override_settings(BASE_DIR=Path(self.tmp.name), INVITATION_SECRET='x' * 40, DEBUG=True)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.owner = User.objects.create_user(username='owner', email='o@example.com', password='pass', email_verified=True, student_active=True)
        self.admin = User.objects.create_user(username='admin', email='a@example.com', password='pass', email_verified=True, student_active=True, is_superuser=True)

    def image_upload(self):
        import io
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        output = io.BytesIO()
        Image.new('RGB', (2, 2), 'red').save(output, format='JPEG', exif=b'Exif\x00\x00private metadata')
        return SimpleUploadedFile('test.jpg', output.getvalue(), content_type='image/jpeg')

    def test_media_is_private_until_moderated(self):
        from .models import MediaAsset
        self.client.force_login(self.owner)
        response = self.client.post(reverse('market-new'), {'title': '책', 'description': '설명', 'price': '100', 'category': '책', 'images': self.image_upload()})
        self.assertEqual(response.status_code, 302)
        asset = MediaAsset.objects.get()
        self.assertEqual(self.client.get(reverse('image-read', args=[asset.pk])).status_code, 200)
        self.client.logout()
        self.assertEqual(self.client.get(reverse('image-read', args=[asset.pk])).status_code, 404)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(reverse('admin-review-media', args=[asset.pk]), {'decision': 'APPROVED'}).status_code, 302)
        self.client.logout()
        public = self.client.get(reverse('image-read', args=[asset.pk]))
        self.assertEqual(public.status_code, 200)
        self.assertNotIn(b'private metadata', public.content)
        self.assertEqual(public['Cache-Control'], 'private, no-store')

    def test_file_type_spoof_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from .models import MediaAsset
        self.client.force_login(self.owner)
        bad = SimpleUploadedFile('bad.jpg', b'not an image', content_type='image/jpeg')
        response = self.client.post(reverse('market-new'), {'title': '책', 'description': '설명', 'price': '100', 'category': '책', 'images': bad})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(MediaAsset.objects.count(), 0)
        self.assertEqual(MarketPost.objects.count(), 0)

    def test_stale_finder_approval_is_rejected(self):
        from .views import finder_review_token
        post = FinderPost.objects.create(owner=self.owner, kind='lost', title='이전 글', category='책', color='검정', general_location='복도', occurred_at=timezone.localdate())
        token = finder_review_token(post)
        post.title = '수정된 글'
        post.save()
        self.client.force_login(self.admin)
        response = self.client.post(reverse('admin-review-finder', args=[post.pk]), {'decision': 'APPROVED', 'review_token': token})
        self.assertEqual(response.status_code, 409)
        post.refresh_from_db()
        self.assertEqual(post.public_approval, 'PENDING')

    def test_suspension_invalidates_existing_session_after_unsuspend(self):
        other = self.client_class()
        other.force_login(self.owner)
        self.client.force_login(self.admin)
        self.client.post(reverse('admin-user-status', args=[self.owner.pk]), {'action': 'suspend'})
        self.client.post(reverse('admin-user-status', args=[self.owner.pk]), {'action': 'unsuspend'})
        self.assertEqual(other.get(reverse('me')).status_code, 302)

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
    def test_authentication_rate_limit_uses_database(self):
        for attempt in range(30):
            self.assertNotEqual(self.client.post(reverse('login'), {'username': f'unknown{attempt}@example.com', 'password': 'wrong'}).status_code, 429)
        self.assertEqual(self.client.post(reverse('login'), {'username': 'another@example.com', 'password': 'wrong'}).status_code, 429)

    def test_csrf_required_for_authenticated_mutations(self):
        client = self.client_class(enforce_csrf_checks=True)
        client.force_login(self.owner)
        self.assertEqual(client.post(reverse('market-new'), {'title': 'x'}).status_code, 403)


class ApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', email='owner@example.com', password='pass', email_verified=True, student_active=True)
        self.other = User.objects.create_user(username='other', email='other@example.com', password='pass', email_verified=True, student_active=True)
        self.post = MarketPost.objects.create(owner=self.owner, title='책', description='긴 설명', price=100, category='책')

    def test_public_list_omits_private_fields_and_protected_post_requires_auth(self):
        response = self.client.get('/api/market')
        self.assertEqual(response.status_code, 200)
        post = response.json()['posts'][0]
        self.assertNotIn('description', post)
        self.assertNotIn('email', post)
        self.assertNotIn('description', self.client.get(f'/api/market/{self.post.pk}').json()['post'])
        self.assertEqual(self.client.post('/api/market', data='{}', content_type='application/json').status_code, 401)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(f'/api/market/{self.post.pk}').json()['post']['description'], '긴 설명')

    def test_other_users_cannot_edit_or_delete_market_post(self):
        self.client.force_login(self.other)
        url = f'/api/market/{self.post.pk}'
        self.assertEqual(self.client.patch(url, data='{}', content_type='application/json').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.assertTrue(MarketPost.objects.filter(pk=self.post.pk).exists())

    def test_private_finder_is_not_returned(self):
        post = FinderPost.objects.create(owner=self.owner, kind='lost', title='가방', category='가방', color='검정', general_location='복도', occurred_at=timezone.localdate())
        self.assertEqual(self.client.get(f'/api/finder/{post.pk}').status_code, 404)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(f'/api/finder/{post.pk}').status_code, 200)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/finder/{post.pk}').status_code, 404)

    def test_csrf_protects_api_post(self):
        client = self.client_class(enforce_csrf_checks=True)
        client.force_login(self.owner)
        self.assertEqual(client.post('/api/market', data='{}', content_type='application/json').status_code, 403)
        csrf = client.get('/api/csrf').cookies['csrftoken'].value
        data = '{"title":"공책","description":"설명","price":100,"category":"책"}'
        self.assertEqual(client.post('/api/market', data=data, content_type='application/json', HTTP_X_CSRFTOKEN=csrf).status_code, 201)

    def test_admin_api_rejects_students(self):
        self.client.force_login(self.other)
        self.assertEqual(self.client.post('/api/admin/invitations').status_code, 403)


class ApiImageTests(TestCase):
    setUp = ImageAndSecurityTests.setUp
    image_upload = ImageAndSecurityTests.image_upload

    def test_unattached_image_cannot_be_attached_by_other_user(self):
        import json
        from .models import MediaAsset
        self.client.force_login(self.owner)
        response = self.client.post('/api/media', {'file': self.image_upload()})
        self.assertEqual(response.status_code, 201)
        image_id = response.json()['media']['id']
        self.client.force_login(self.admin)
        payload = {'title': '책', 'description': '내용', 'category': '책', 'price': 1, 'imageIds': [image_id]}
        response = self.client.post('/api/market', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(MarketPost.objects.count(), 0)
        self.assertIsNone(MediaAsset.objects.get().market_post)
        self.client.force_login(self.owner)
        response = self.client.post('/api/market', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(MediaAsset.objects.get().market_post)


class ClubApiTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(username='student', email='student@example.com', password='pass', email_verified=True, student_active=True)
        self.manager = User.objects.create_user(username='manager', email='manager@example.com', password='pass', email_verified=True, student_active=True)
        self.club = Club.objects.create(slug='music', name='음악', category='예술', introduction='소개', is_public=True)
        ClubMember.objects.create(club=self.club, user=self.manager, role='manager')
        now = timezone.now()
        self.recruitment = Recruitment.objects.create(club=self.club, title='모집', description='내용', opens_at=now-timedelta(days=1), closes_at=now+timedelta(days=1), is_open=True)
        self.application = Application.objects.create(recruitment=self.recruitment, applicant=self.student, answers={'answer': 'private'})

    def test_student_sees_only_own_status_and_manager_sees_answers(self):
        self.client.force_login(self.student)
        mine = self.client.get('/api/clubs/music/applications?mine=1')
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(mine.json()['applications'][0]['status'], 'SUBMITTED')
        self.assertNotContains(mine, 'private')
        self.assertEqual(self.client.get('/api/clubs/music/applications').status_code, 403)
        self.client.force_login(self.manager)
        self.assertContains(self.client.get('/api/clubs/music/applications'), 'private')


class R2StorageTests(TestCase):
    def test_r2_put_get_delete_uses_private_keys_and_configured_bucket(self):
        import io
        import os
        import uuid
        from unittest.mock import patch
        import boto3
        from botocore.response import StreamingBody
        from botocore.stub import Stubber
        from . import media
        client = boto3.client('s3', region_name='auto', endpoint_url='https://test.r2.cloudflarestorage.com', aws_access_key_id='test', aws_secret_access_key='test')
        key = 'private/' + uuid.UUID(int=1).hex
        stub = Stubber(client)
        stub.add_response('put_object', {}, {'Bucket': 'test-bucket', 'Key': key, 'Body': b'picture', 'ContentType': 'image/png'})
        stub.add_response('get_object', {'Body': StreamingBody(io.BytesIO(b'picture'), 7)}, {'Bucket': 'test-bucket', 'Key': key})
        stub.add_response('delete_object', {}, {'Bucket': 'test-bucket', 'Key': key})
        with patch.dict(os.environ, {'R2_BUCKET_NAME': 'test-bucket'}), patch('core.media._client', return_value=client), patch('core.media.uuid.uuid4', return_value=uuid.UUID(int=1)), stub:
            self.assertEqual(media.put(b'picture', 'image/png'), key)
            self.assertEqual(media.get(key), b'picture')
            media.delete(key)
        stub.assert_no_pending_responses()
