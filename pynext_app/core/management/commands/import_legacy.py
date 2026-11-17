# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
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


# 기본적으로 원본을 읽기만 하며 별도 빈 PostgreSQL 대상으로의 복사와 건수 검증을 제공한다.
class Command(BaseCommand):
    help = 'Inspect or import the legacy Next.js database into an empty separate Django DB.'

    # 명령을 실행할 때 받을 옵션을 정한다.
    def add_arguments(self, parser):
        parser.add_argument('--verify', action='store_true', help='Read-only comparison of source and destination row counts.')
        parser.add_argument('--apply', action='store_true', help='Perform the copy; default is read-only inspection.')

    # 읽기 전용 원본 스냅샷과 대상 DB를 확인하고 적용 시 대상 함께 성공하거나 함께 취소되는 저장 작업 및 자문 잠금을 사용한다.
    # 관리 명령의 입력을 확인하고 요청한 작업을 실행한다.
    def handle(self, *args, **options):
        # 데이터를 옮기는 옵션과 결과만 확인하는 옵션을 동시에 켤 수 없다.
        if options['apply'] and options['verify']:
            raise CommandError('--apply and --verify are mutually exclusive.')
        source_url = os.environ.get('GWG_LEGACY_DATABASE_URL')
        # 예전 데이터베이스 주소가 없으면 어디서 읽어야 할지 모르므로 중단한다.
        if not source_url:
            raise CommandError('Set GWG_LEGACY_DATABASE_URL; do not pass credentials on the command line.')
        # 이 가져오기 명령의 대상 DB는 PostgreSQL만 허용한다.
        if connection.vendor != 'postgresql':
            raise CommandError('The destination must be a separate empty PostgreSQL database.')
        # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
        try:
            with psycopg.connect(source_url, row_factory=dict_row) as source:
                # 원본 DB에는 쓰지 않고 한 함께 성공하거나 함께 취소되는 저장 작업의 일관된 읽기 스냅샷을 사용한다.
                source.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                src_db = source.execute('SELECT current_database() AS name').fetchone()['name']
                with connection.cursor() as target:
                    target.execute('SELECT current_database()')
                    dst_db = target.fetchone()[0]
                # 원본 DB와 대상 DB가 같으면 자료를 덮어쓸 수 있으므로 실행하지 않는다.
                if src_db == dst_db:
                    raise CommandError('Source and destination database names must differ.')
                counts = {name: source.execute('SELECT count(*) AS n FROM "' + name + '"').fetchone()['n'] for name in TABLES}
                self.stdout.write('Legacy row counts: ' + ', '.join(f'{k}={v}' for k, v in counts.items()))
                # 확인 옵션을 골랐다면 데이터를 추가하지 않고 원본과 옮긴 자료를 비교한다.
                if options['verify']:
                    models = [User, Invitation, InvitationAttempts, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, None, Report, AuditLog]
                    differences = []
                    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                    for table, model in zip(TABLES, models):
                        # 원본 자료에 있는 항목 이름과 새 모델 유무에 맞춰 읽을 값을 고른다.
                        actual = model.objects.count() if model else MediaAsset.objects.filter(Q(market_post__isnull=False) | Q(finder_post__isnull=False)).count()
                        self.stdout.write(f'{table}: source={counts[table]} destination={actual}')
                        # 원본과 대상의 자료 개수가 다르면 확인 실패로 처리한다.
                        if counts[table] != actual: differences.append(table)
                    # 원본과 다른 항목이 있으면 옮기기가 완전히 일치하지 않는다고 알려 준다.
                    if differences:
                        raise CommandError('Count mismatch: ' + ', '.join(differences))
                    self.stdout.write('Row counts match. Verify relationships, identities, SMTP and R2 separately before cutover.')
                    return
                # 실제 적용 옵션이 없으면 계획만 보여 주고 저장 작업은 하지 않는다.
                if not options['apply']:
                    self.stdout.write('Read-only inspection only. No data copied.')
                    return
                with transaction.atomic():
                    with connection.cursor() as target:
                        target.execute('SELECT pg_advisory_xact_lock(1797720219)')
                    # 대상에 데이터가 있으면 부분 덮어쓰기 대신 전체 가져오기를 거부한다.
                    # 대상 DB에 자료가 이미 있으면 기존 자료와 섞이지 않도록 가져오기를 막는다.
                    if any(model.objects.exists() for model in MODELS):
                        raise CommandError('Destination is not empty; refusing to import.')
                    self.import_rows(source)
                self.stdout.write(self.style.SUCCESS('Copy complete. Old sessions and passwords were not imported; verify counts and send reset instructions separately.'))
        except (psycopg.Error, KeyError, ValueError, TypeError) as exc:
            raise CommandError(f'Import failed ({type(exc).__name__}); the destination transaction was rolled back.') from exc

    # 사용자·게시물·미디어 등 관계를 재구성하며 기존 비밀번호와 로그인 상태은 가져오지 않는다.
    # 예전 데이터의 연결 관계를 맞추어 새 데이터베이스로 옮긴다.
    def import_rows(self, source):
        # 비교하거나 옮길 데이터를 하나씩 읽는다.
        def rows(table):
            return source.execute('SELECT * FROM "' + table + '"').fetchall()
        # 옛 데이터에 기록된 시각을 유지한다.
        def preserve_time(obj, row, *fields):
            # 목록에서 필요한 조건에 맞는 항목만 골라 결과에 넣는다.
            changes = {field: row[field] for field in fields if row.get(field) is not None}
            # 옮기기 전에 필요한 스키마 변경이 남아 있으면 먼저 변경을 끝내도록 한다.
            if changes:
                type(obj).objects.filter(pk=obj.pk).update(**changes)
        # 옛 번호를 새 자료와 연결할 때 쓸 이름으로 맞춘다.
        def key(value):
            return str(value)
        users, clubs, recruitments, posts = {}, {}, {}, {}
        invitation_rows = rows('invitations')
        # 목록에서 필요한 조건에 맞는 항목만 골라 결과에 넣는다.
        redeemed = {row['redeemed_by'] for row in invitation_rows if row['redeemed_by']}
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('user'):
            email = row['email'].strip().lower()
            # 이메일이 비었거나 이미 같은 주소가 있으면 안전하게 계정을 옮길 수 없으므로 중단한다.
            if not email or User.objects.filter(email__iexact=email).exists():
                raise CommandError('Legacy users contain missing or duplicate case-insensitive email addresses.')
            username = 'legacy_' + uuid.uuid5(uuid.NAMESPACE_URL, row['id']).hex
            user = User(username=username, legacy_auth_id=row['id'], first_name=(row['name'] or '')[:150], email=email, email_verified=row['email_verified'], student_active=row['status'] == 'ACTIVE_STUDENT' or (row['status'] == 'SUSPENDED' and (row['id'] in redeemed or row['role'] == 'admin')), is_active=row['status'] != 'SUSPENDED', is_superuser=row['role'] == 'admin', is_staff=row['role'] == 'admin')
            # 이전 암호를 복사하지 않으므로 사용자는 별도로 암호를 재설정해야 한다.
            user.set_password(secrets.token_urlsafe(48))
            user.save()
            User.objects.filter(pk=user.pk).update(date_joined=row['created_at'])
            users[row['id']] = user
        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
        for row in invitation_rows:
            obj = Invitation.objects.create(id=row['id'], code_hash=row['code_hash'], issued_by=users[row['issued_by']], expires_at=row['expires_at'], redeemed_at=row['redeemed_at'], redeemed_by=users.get(row['redeemed_by']), revoked_at=row['revoked_at'])
            preserve_time(obj, row, 'created_at')
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('invitation_attempts'):
            InvitationAttempts.objects.create(user=users[row['user_id']], count=row['count'], window_start=row['window_start'])
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('market_posts'):
            obj = MarketPost.objects.create(id=row['id'], owner=users[row['owner_id']], title=row['title'], description=row['description'], price=row['price'], category=row['category'], status=row['status'])
            preserve_time(obj, row, 'created_at', 'updated_at')
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('market_reservations'):
            obj = Reservation.objects.create(public_id=row['id'], post_id=row['post_id'], requester=users[row['requester_id']], status=row['status'])
            preserve_time(obj, row, 'created_at')
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('clubs'):
            clubs[key(row['id'])] = Club.objects.create(id=row['id'], slug=row['slug'], name=row['name'], category=row['category'], introduction=row['introduction'], is_public=row['is_public'])
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('club_members'):
            ClubMember.objects.create(club_id=row['club_id'], user=users[row['user_id']], role=row['role'])
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('club_posts'):
            obj = ClubPost.objects.create(public_id=row['id'], club_id=row['club_id'], author=users[row['author_id']], title=row['title'], content=row['content'], is_public=row['is_public'])
            posts[key(row['id'])] = obj
            preserve_time(obj, row, 'created_at')
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('club_recruitments'):
            recruitments[key(row['id'])] = Recruitment.objects.create(public_id=row['id'], club_id=row['club_id'], title=row['title'], description=row['description'], opens_at=row['opens_at'], closes_at=row['closes_at'], is_open=row['is_open'])
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('club_applications'):
            obj = Application.objects.create(public_id=row['id'], recruitment=recruitments[key(row['recruitment_id'])], applicant=users[row['applicant_id']], answers=row['answers'], status=row['status'])
            preserve_time(obj, row, 'created_at')
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('finder_posts'):
            obj = FinderPost.objects.create(id=row['id'], owner=users[row['owner_id']], kind=row['kind'], title=row['title'], category=row['category'], color=row['color'], general_location=row['general_location'], occurred_at=row['occurred_at'], status=row['status'], public_approval=row['public_approval'])
            preserve_time(obj, row, 'created_at')
        links = {key(row['media_id']): row for row in rows('post_media')}
        # 선택한 사진을 하나씩 확인하며 글과 연결한다.
        for row in rows('media_assets'):
            link = links.get(key(row['id']), {})
            # 원본 자료에 있는 항목 이름과 새 모델 유무에 맞춰 읽을 값을 고른다.
            obj = MediaAsset.objects.create(id=row['id'], owner=users[row['owner_id']], storage_key=row['storage_key'], content_type=row['content_type'], size=row['size'], moderation=row['moderation_status'] if 'moderation_status' in row else row['moderation'], market_post_id=link.get('market_post_id'), finder_post_id=link.get('finder_post_id'))
            preserve_time(obj, row, 'created_at')
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('reports'):
            target_id = row['target_id']
            # 신고 대상이 동아리 활동 글이면 바뀐 글 번호에 맞게 신고 대상 번호도 연결한다.
            if row['target_type'] == 'club_post':
                # 신고가 가리키는 글이 없으면 잘못된 연결을 만들지 않도록 중단한다.
                if target_id not in posts:
                    raise CommandError('A club post report references a missing legacy post.')
                target_id = str(posts[target_id].public_id)
            obj = Report.objects.create(public_id=row['id'], reporter=users[row['reporter_id']], target_type=row['target_type'], target_id=target_id, reason=row['reason'], status=row['status'])
            preserve_time(obj, row, 'created_at')
        # 옛 데이터베이스의 자료를 한 건씩 읽어 새 저장 형식으로 옮긴다.
        for row in rows('audit_logs'):
            obj = AuditLog.objects.create(actor=users.get(row['actor_id']), action=row['action'], entity_type=row['entity_type'], entity_id=row['entity_id'])
            preserve_time(obj, row, 'created_at')
