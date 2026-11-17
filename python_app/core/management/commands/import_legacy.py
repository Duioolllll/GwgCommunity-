

"""Copy the legacy database to an empty Django PostgreSQL database.

Never writes to the legacy database. Passwords are replaced by random values;
users must reset them via verified email. Old sessions are not imported.
"""
import os
import secrets
import uuid

import psycopg
from psycopg.rows import dict_row
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models import Q
from core.models import User, Invitation, InvitationAttempts, AuditLog, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, Report, RequestLimit

TABLES = ['user', 'invitations', 'invitation_attempts', 'market_posts', 'market_reservations', 'clubs', 'club_members', 'club_posts', 'club_recruitments', 'club_applications', 'finder_posts', 'media_assets', 'post_media', 'reports', 'audit_logs']
MODELS = [User, Invitation, InvitationAttempts, AuditLog, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, Report, RequestLimit]


# 명령줄에서 실행할 관리 작업을 정의한다.
class Command(BaseCommand):
    help = 'Inspect or import the legacy Next.js database into an empty separate Django DB.'


    # 관리 명령에서 받을 옵션을 정한다.
    def add_arguments(self, parser):
        parser.add_argument('--verify', action='store_true', help='Read-only comparison of source and destination row counts.')
        parser.add_argument('--apply', action='store_true', help='Perform the copy; default is read-only inspection.')


    # 명령줄에서 받은 옵션에 따라 관리 작업을 실행한다.
    def handle(self, *args, **options):


        # 실제 이전과 확인만 하기를 동시에 요청했을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if options['apply'] and options['verify']:
            raise CommandError('--apply and --verify are mutually exclusive.')
        source_url = os.environ.get('GWG_LEGACY_DATABASE_URL')


        # 읽어 올 이전 데이터베이스 주소가 없을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if not source_url:
            raise CommandError('Set GWG_LEGACY_DATABASE_URL; do not pass credentials on the command line.')


        # 이전 대상 데이터베이스가 PostgreSQL이 아닐 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if connection.vendor != 'postgresql':
            raise CommandError('The destination must be a separate empty PostgreSQL database.')


        # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
        try:
            with psycopg.connect(source_url, row_factory=dict_row) as source:
                source.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                src_db = source.execute('SELECT current_database() AS name').fetchone()['name']
                with connection.cursor() as target:
                    target.execute('SELECT current_database()')
                    dst_db = target.fetchone()[0]


                # 읽어 올 DB와 저장할 DB가 같을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                if src_db == dst_db:
                    raise CommandError('Source and destination database names must differ.')


                # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
                counts = {name: source.execute('SELECT count(*) AS n FROM "' + name + '"').fetchone()['n'] for name in TABLES}


                # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
                self.stdout.write('Legacy row counts: ' + ', '.join(f'{k}={v}' for k, v in counts.items()))


                # 이전 결과를 비교하는 확인 모드일 때 필요한 값을 정한 뒤 아래 처리를 계속한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                if options['verify']:
                    models = [User, Invitation, InvitationAttempts, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, None, Report, AuditLog]
                    differences = []


                    # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
                    for table, model in zip(TABLES, models):


                        # 옮길 모델이 정해져 있으면 그 모델을 사용하고, 없으면 기본 처리로 넘긴다.
                        actual = model.objects.count() if model else MediaAsset.objects.filter(Q(market_post__isnull=False) | Q(finder_post__isnull=False)).count()
                        self.stdout.write(f'{table}: source={counts[table]} destination={actual}')


                        # 옮겨진 행 수가 예상한 행 수와 다를 때 필요한 저장·안내 작업을 실행한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                        if counts[table] != actual: differences.append(table)


                    # 이전 전후 데이터를 비교해 다른 값이 발견됐을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                    if differences:
                        raise CommandError('Count mismatch: ' + ', '.join(differences))
                    self.stdout.write('Row counts match. Verify relationships, identities, SMTP and R2 separately before cutover.')
                    return


                # 실제 저장 옵션을 주지 않았을 때 필요한 저장·안내 작업을 실행한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                if not options['apply']:
                    self.stdout.write('Read-only inspection only. No data copied.')
                    return

                with transaction.atomic():
                    with connection.cursor() as target:
                        target.execute('SELECT pg_advisory_xact_lock(1797720219)')


                    # 이전 대상 테이블에 데이터가 이미 들어 있을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                    # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
                    if any(model.objects.exists() for model in MODELS):
                        raise CommandError('Destination is not empty; refusing to import.')
                    self.import_rows(source)
                self.stdout.write(self.style.SUCCESS('Copy complete. Old sessions and passwords were not imported; verify counts and send reset instructions separately.'))


        # 이 종류의 오류가 나면 잘못된 요청이나 설정임을 알리고 처리를 중단한다.
        except (psycopg.Error, KeyError, ValueError, TypeError) as exc:
            raise CommandError(f'Import failed ({type(exc).__name__}); the destination transaction was rolled back.') from exc


    # 예전 데이터의 관계를 맞춰 새 데이터베이스로 옮긴다.
    def import_rows(self, source):


        # 예전 테이블의 행을 차례대로 읽는다.
        def rows(table):
            return source.execute('SELECT * FROM "' + table + '"').fetchall()


        # 이전 데이터가 만들어진 시각을 새 데이터에도 유지한다.
        def preserve_time(obj, row, *fields):


            # 목록의 각 항목을 살펴보고 뒤에 적힌 조건을 통과한 항목만 모은다.
            changes = {field: row[field] for field in fields if row.get(field) is not None}


            # 옮긴 뒤 다시 맞춰야 할 값이 있을 때 필요한 저장·안내 작업을 실행한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if changes:
                type(obj).objects.filter(pk=obj.pk).update(**changes)


        # 이전 번호와 새 번호를 연결할 기준값을 만든다.
        def key(value):
            return str(value)
        users, clubs, recruitments, posts = {}, {}, {}, {}
        invitation_rows = rows('invitations')


        # 목록의 각 항목을 살펴보고 뒤에 적힌 조건을 통과한 항목만 모은다.
        redeemed = {row['redeemed_by'] for row in invitation_rows if row['redeemed_by']}


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('user'):
            email = row['email'].strip().lower()


            # 이메일이 비어 있거나 같은 이메일이 이미 있을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if not email or User.objects.filter(email__iexact=email).exists():
                raise CommandError('Legacy users contain missing or duplicate case-insensitive email addresses.')

            username = 'legacy_' + uuid.uuid5(uuid.NAMESPACE_URL, row['id']).hex


            # 앞쪽 값이 비어 있으면 다음 후보를 사용한다. 값이 있으면 뒤쪽은 확인하지 않는다.
            # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
            user = User(username=username, legacy_auth_id=row['id'], first_name=(row['name'] or '')[:150], email=email, email_verified=row['email_verified'], student_active=row['status'] == 'ACTIVE_STUDENT' or (row['status'] == 'SUSPENDED' and (row['id'] in redeemed or row['role'] == 'admin')), is_active=row['status'] != 'SUSPENDED', is_superuser=row['role'] == 'admin', is_staff=row['role'] == 'admin')
            user.set_password(secrets.token_urlsafe(48))
            user.save()
            User.objects.filter(pk=user.pk).update(date_joined=row['created_at'])
            users[row['id']] = user


        # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
        for row in invitation_rows:
            obj = Invitation.objects.create(id=row['id'], code_hash=row['code_hash'], issued_by=users[row['issued_by']], expires_at=row['expires_at'], redeemed_at=row['redeemed_at'], redeemed_by=users.get(row['redeemed_by']), revoked_at=row['revoked_at'])
            preserve_time(obj, row, 'created_at')


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('invitation_attempts'):
            InvitationAttempts.objects.create(user=users[row['user_id']], count=row['count'], window_start=row['window_start'])


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('market_posts'):
            obj = MarketPost.objects.create(id=row['id'], owner=users[row['owner_id']], title=row['title'], description=row['description'], price=row['price'], category=row['category'], status=row['status'])
            preserve_time(obj, row, 'created_at', 'updated_at')


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('market_reservations'):
            obj = Reservation.objects.create(public_id=row['id'], post_id=row['post_id'], requester=users[row['requester_id']], status=row['status'])
            preserve_time(obj, row, 'created_at')


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('clubs'):
            clubs[key(row['id'])] = Club.objects.create(id=row['id'], slug=row['slug'], name=row['name'], category=row['category'], introduction=row['introduction'], is_public=row['is_public'])


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('club_members'):
            ClubMember.objects.create(club_id=row['club_id'], user=users[row['user_id']], role=row['role'])


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('club_posts'):
            obj = ClubPost.objects.create(public_id=row['id'], club_id=row['club_id'], author=users[row['author_id']], title=row['title'], content=row['content'], is_public=row['is_public'])
            posts[key(row['id'])] = obj
            preserve_time(obj, row, 'created_at')


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('club_recruitments'):
            recruitments[key(row['id'])] = Recruitment.objects.create(public_id=row['id'], club_id=row['club_id'], title=row['title'], description=row['description'], opens_at=row['opens_at'], closes_at=row['closes_at'], is_open=row['is_open'])


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('club_applications'):
            obj = Application.objects.create(public_id=row['id'], recruitment=recruitments[key(row['recruitment_id'])], applicant=users[row['applicant_id']], answers=row['answers'], status=row['status'])
            preserve_time(obj, row, 'created_at')


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('finder_posts'):
            obj = FinderPost.objects.create(id=row['id'], owner=users[row['owner_id']], kind=row['kind'], title=row['title'], category=row['category'], color=row['color'], general_location=row['general_location'], occurred_at=row['occurred_at'], status=row['status'], public_approval=row['public_approval'])
            preserve_time(obj, row, 'created_at')


        # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
        links = {key(row['media_id']): row for row in rows('post_media')}


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('media_assets'):
            link = links.get(key(row['id']), {})


            # 예전 데이터에 사진 심사 상태가 있으면 유지하고, 없으면 기본 상태로 옮긴다.
            obj = MediaAsset.objects.create(id=row['id'], owner=users[row['owner_id']], storage_key=row['storage_key'], content_type=row['content_type'], size=row['size'], moderation=row['moderation_status'] if 'moderation_status' in row else row['moderation'], market_post_id=link.get('market_post_id'), finder_post_id=link.get('finder_post_id'))
            preserve_time(obj, row, 'created_at')


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('reports'):
            target_id = row['target_id']


            # 이전할 신고가 동아리 활동 글을 가리킬 때 아래의 세부 조건을 한 번 더 확인한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if row['target_type'] == 'club_post':


                # 신고가 가리키는 글을 이전 목록에서 찾지 못했을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
                if target_id not in posts:
                    raise CommandError('A club post report references a missing legacy post.')
                target_id = str(posts[target_id].public_id)
            obj = Report.objects.create(public_id=row['id'], reporter=users[row['reporter_id']], target_type=row['target_type'], target_id=target_id, reason=row['reason'], status=row['status'])
            preserve_time(obj, row, 'created_at')


        # 이전 데이터베이스의 행을 하나씩 읽어 아래 작업을 적용한다.
        for row in rows('audit_logs'):
            obj = AuditLog.objects.create(actor=users.get(row['actor_id']), action=row['action'], entity_type=row['entity_type'], entity_id=row['entity_id'])
            preserve_time(obj, row, 'created_at')
