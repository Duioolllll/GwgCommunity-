# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `options['apply'] and options['verify']`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `invitation_rows`의 각 `row`를 순회한다. `row['redeemed_by']`가 참인 항목만 포함한다.
# - 단락 평가 `not email or User.objects.filter(email__iexact=email).exists()`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `rows('post_media')`의 각 `row`를 순회한다.
# - 컴프리헨션: `fields`의 각 `field`를 순회한다. `row.get(field) is not None`가 참인 항목만 포함한다.
# - 컴프리헨션: `TABLES`의 각 `name`를 순회한다.
# - 단락 평가 `row['status'] == 'ACTIVE_STUDENT' or (row['status'] == 'SUSPENDED' and (row['id'] in redeemed or row['role'] == 'admin'))`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `'moderation_status' in row`: 참일 때 `row['moderation_status']`, 거짓일 때 `row['moderation']`를 선택한다.
# - 조건식 `model`: 참일 때 `model.objects.count()`, 거짓일 때 `MediaAsset.objects.filter(Q(market_post__isnull=False) | Q(finder_post__isnull=False)).count()`를 선택한다.
# - 단락 평가 `row['name'] or ''`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `row['status'] == 'SUSPENDED' and (row['id'] in redeemed or row['role'] == 'admin')`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `MODELS`의 각 `model`를 순회한다.
# - 단락 평가 `row['id'] in redeemed or row['role'] == 'admin'`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `counts.items()`의 각 `(k, v)`를 순회한다.
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


# 기능 `Command`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Command(BaseCommand):
    help = 'Inspect or import the legacy Next.js database into an empty separate Django DB.'

    # 기능 `add_arguments`: 먼저 `parser.add_argument('--verify', action='store_true', help='Read-only comparison of source and destination row counts.')`를 실행한다.
    def add_arguments(self, parser):
        parser.add_argument('--verify', action='store_true', help='Read-only comparison of source and destination row counts.')
        parser.add_argument('--apply', action='store_true', help='Perform the copy; default is read-only inspection.')

    # 기본 동작은 읽기 전용 점검이며 실제 복사는 별도 --apply가 필요하다.
    # 기능 `handle`: If 구문으로 이어지는 내부 처리를 실행한다.
    def handle(self, *args, **options):
        # 조건 분기 `options['apply'] and options['verify']`: 참이면 CommandError('--apply and --verify are mutually exclusive.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if options['apply'] and options['verify']:
            raise CommandError('--apply and --verify are mutually exclusive.')
        source_url = os.environ.get('GWG_LEGACY_DATABASE_URL')
        # 조건 분기 `not source_url`: 참이면 CommandError('Set GWG_LEGACY_DATABASE_URL; do not pass credentials on the command line.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not source_url:
            raise CommandError('Set GWG_LEGACY_DATABASE_URL; do not pass credentials on the command line.')
        # 조건 분기 `connection.vendor != 'postgresql'`: 참이면 CommandError('The destination must be a separate empty PostgreSQL database.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if connection.vendor != 'postgresql':
            raise CommandError('The destination must be a separate empty PostgreSQL database.')
        # 예외 경계: 본문을 시도하고 `(psycopg.Error, KeyError, ValueError, TypeError)` 발생 시 CommandError(f'Import failed ({type(exc).__name__}); the destination transaction was rolled back.') 예외를 발생시킨다.
        try:
            with psycopg.connect(source_url, row_factory=dict_row) as source:
                source.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                src_db = source.execute('SELECT current_database() AS name').fetchone()['name']
                with connection.cursor() as target:
                    target.execute('SELECT current_database()')
                    dst_db = target.fetchone()[0]
                # 조건 분기 `src_db == dst_db`: 참이면 CommandError('Source and destination database names must differ.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if src_db == dst_db:
                    raise CommandError('Source and destination database names must differ.')
                counts = {name: source.execute('SELECT count(*) AS n FROM "' + name + '"').fetchone()['n'] for name in TABLES}
                self.stdout.write('Legacy row counts: ' + ', '.join(f'{k}={v}' for k, v in counts.items()))
                # 조건 분기 `options['verify']`: 참이면 먼저 `models = [User, Invitation, InvitationAttempts, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, None, Report, AuditLog]`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if options['verify']:
                    models = [User, Invitation, InvitationAttempts, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, None, Report, AuditLog]
                    differences = []
                    # 반복 `zip(TABLES, models)`: 각 항목을 `(table, model)`에 담아 먼저 `actual = model.objects.count() if model else MediaAsset.objects.filter(Q(market_post__isnull=False) | Q(finder_post__isnull=False)).count()`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
                    for table, model in zip(TABLES, models):
                        actual = model.objects.count() if model else MediaAsset.objects.filter(Q(market_post__isnull=False) | Q(finder_post__isnull=False)).count()
                        self.stdout.write(f'{table}: source={counts[table]} destination={actual}')
                        # 조건 분기 `counts[table] != actual`: 참이면 먼저 `differences.append(table)`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                        if counts[table] != actual: differences.append(table)
                    # 조건 분기 `differences`: 참이면 CommandError('Count mismatch: ' + ', '.join(differences)) 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                    if differences:
                        raise CommandError('Count mismatch: ' + ', '.join(differences))
                    self.stdout.write('Row counts match. Verify relationships, identities, SMTP and R2 separately before cutover.')
                    return
                # 조건 분기 `not options['apply']`: 참이면 먼저 `self.stdout.write('Read-only inspection only. No data copied.')`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if not options['apply']:
                    self.stdout.write('Read-only inspection only. No data copied.')
                    return
                # 대상 DB의 비어 있음 검사와 복사를 하나의 트랜잭션으로 묶는다.
                with transaction.atomic():
                    with connection.cursor() as target:
                        target.execute('SELECT pg_advisory_xact_lock(1797720219)')
                    # 조건 분기 `any((model.objects.exists() for model in MODELS))`: 참이면 CommandError('Destination is not empty; refusing to import.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                    if any(model.objects.exists() for model in MODELS):
                        raise CommandError('Destination is not empty; refusing to import.')
                    self.import_rows(source)
                self.stdout.write(self.style.SUCCESS('Copy complete. Old sessions and passwords were not imported; verify counts and send reset instructions separately.'))
        except (psycopg.Error, KeyError, ValueError, TypeError) as exc:
            raise CommandError(f'Import failed ({type(exc).__name__}); the destination transaction was rolled back.') from exc

    # 원본 ID와 참조를 매핑하되 암호는 임의 값으로 교체하고 기존 세션은 복사하지 않는다.
    # 기능 `import_rows`: FunctionDef 구문으로 이어지는 내부 처리를 실행한다.
    def import_rows(self, source):
        # 기능 `rows`: source.execute('SELECT * FROM "' + table + '"').fetchall()을 반환한다.
        def rows(table):
            return source.execute('SELECT * FROM "' + table + '"').fetchall()
        # 기능 `preserve_time`: 먼저 `changes = {field: row[field] for field in fields if row.get(field) is not None}`로 상태 또는 조회 조건을 갱신한다.
        def preserve_time(obj, row, *fields):
            changes = {field: row[field] for field in fields if row.get(field) is not None}
            # 조건 분기 `changes`: 참이면 먼저 `type(obj).objects.filter(pk=obj.pk).update(**changes)`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if changes:
                type(obj).objects.filter(pk=obj.pk).update(**changes)
        # 기능 `key`: str(value)을 반환한다.
        def key(value):
            return str(value)
        users, clubs, recruitments, posts = {}, {}, {}, {}
        invitation_rows = rows('invitations')
        redeemed = {row['redeemed_by'] for row in invitation_rows if row['redeemed_by']}
        # 반복 `rows('user')`: 각 항목을 `row`에 담아 먼저 `email = row['email'].strip().lower()`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('user'):
            email = row['email'].strip().lower()
            # 조건 분기 `not email or User.objects.filter(email__iexact=email).exists()`: 참이면 CommandError('Legacy users contain missing or duplicate case-insensitive email addresses.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if not email or User.objects.filter(email__iexact=email).exists():
                raise CommandError('Legacy users contain missing or duplicate case-insensitive email addresses.')
            # Stable unique login name; the source nickname is retained as first_name.
            username = 'legacy_' + uuid.uuid5(uuid.NAMESPACE_URL, row['id']).hex
            user = User(username=username, legacy_auth_id=row['id'], first_name=(row['name'] or '')[:150], email=email, email_verified=row['email_verified'], student_active=row['status'] == 'ACTIVE_STUDENT' or (row['status'] == 'SUSPENDED' and (row['id'] in redeemed or row['role'] == 'admin')), is_active=row['status'] != 'SUSPENDED', is_superuser=row['role'] == 'admin', is_staff=row['role'] == 'admin')
            user.set_password(secrets.token_urlsafe(48))
            user.save()
            User.objects.filter(pk=user.pk).update(date_joined=row['created_at'])
            users[row['id']] = user
        # 반복 `invitation_rows`: 각 항목을 `row`에 담아 먼저 `obj = Invitation.objects.create(id=row['id'], code_hash=row['code_hash'], issued_by=users[row['issued_by']], expires_at=row['expires_at'], redeemed_at=row['redeemed_at'], redeemed_by=users.get(row['redeemed_by']), revoked_at=row['revoked_at'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in invitation_rows:
            obj = Invitation.objects.create(id=row['id'], code_hash=row['code_hash'], issued_by=users[row['issued_by']], expires_at=row['expires_at'], redeemed_at=row['redeemed_at'], redeemed_by=users.get(row['redeemed_by']), revoked_at=row['revoked_at'])
            preserve_time(obj, row, 'created_at')
        # 반복 `rows('invitation_attempts')`: 각 항목을 `row`에 담아 먼저 `InvitationAttempts.objects.create(user=users[row['user_id']], count=row['count'], window_start=row['window_start'])`를 실행한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('invitation_attempts'):
            InvitationAttempts.objects.create(user=users[row['user_id']], count=row['count'], window_start=row['window_start'])
        # 반복 `rows('market_posts')`: 각 항목을 `row`에 담아 먼저 `obj = MarketPost.objects.create(id=row['id'], owner=users[row['owner_id']], title=row['title'], description=row['description'], price=row['price'], category=row['category'], status=row['status'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('market_posts'):
            obj = MarketPost.objects.create(id=row['id'], owner=users[row['owner_id']], title=row['title'], description=row['description'], price=row['price'], category=row['category'], status=row['status'])
            preserve_time(obj, row, 'created_at', 'updated_at')
        # 반복 `rows('market_reservations')`: 각 항목을 `row`에 담아 먼저 `obj = Reservation.objects.create(public_id=row['id'], post_id=row['post_id'], requester=users[row['requester_id']], status=row['status'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('market_reservations'):
            obj = Reservation.objects.create(public_id=row['id'], post_id=row['post_id'], requester=users[row['requester_id']], status=row['status'])
            preserve_time(obj, row, 'created_at')
        # 반복 `rows('clubs')`: 각 항목을 `row`에 담아 먼저 `clubs[key(row['id'])] = Club.objects.create(id=row['id'], slug=row['slug'], name=row['name'], category=row['category'], introduction=row['introduction'], is_public=row['is_public'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('clubs'):
            clubs[key(row['id'])] = Club.objects.create(id=row['id'], slug=row['slug'], name=row['name'], category=row['category'], introduction=row['introduction'], is_public=row['is_public'])
        # 반복 `rows('club_members')`: 각 항목을 `row`에 담아 먼저 `ClubMember.objects.create(club_id=row['club_id'], user=users[row['user_id']], role=row['role'])`를 실행한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('club_members'):
            ClubMember.objects.create(club_id=row['club_id'], user=users[row['user_id']], role=row['role'])
        # 반복 `rows('club_posts')`: 각 항목을 `row`에 담아 먼저 `obj = ClubPost.objects.create(public_id=row['id'], club_id=row['club_id'], author=users[row['author_id']], title=row['title'], content=row['content'], is_public=row['is_public'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('club_posts'):
            obj = ClubPost.objects.create(public_id=row['id'], club_id=row['club_id'], author=users[row['author_id']], title=row['title'], content=row['content'], is_public=row['is_public'])
            posts[key(row['id'])] = obj
            preserve_time(obj, row, 'created_at')
        # 반복 `rows('club_recruitments')`: 각 항목을 `row`에 담아 먼저 `recruitments[key(row['id'])] = Recruitment.objects.create(public_id=row['id'], club_id=row['club_id'], title=row['title'], description=row['description'], opens_at=row['opens_at'], closes_at=row['closes_at'], is_open=row['is_open'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('club_recruitments'):
            recruitments[key(row['id'])] = Recruitment.objects.create(public_id=row['id'], club_id=row['club_id'], title=row['title'], description=row['description'], opens_at=row['opens_at'], closes_at=row['closes_at'], is_open=row['is_open'])
        # 반복 `rows('club_applications')`: 각 항목을 `row`에 담아 먼저 `obj = Application.objects.create(public_id=row['id'], recruitment=recruitments[key(row['recruitment_id'])], applicant=users[row['applicant_id']], answers=row['answers'], status=row['status'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('club_applications'):
            obj = Application.objects.create(public_id=row['id'], recruitment=recruitments[key(row['recruitment_id'])], applicant=users[row['applicant_id']], answers=row['answers'], status=row['status'])
            preserve_time(obj, row, 'created_at')
        # 반복 `rows('finder_posts')`: 각 항목을 `row`에 담아 먼저 `obj = FinderPost.objects.create(id=row['id'], owner=users[row['owner_id']], kind=row['kind'], title=row['title'], category=row['category'], color=row['color'], general_location=row['general_location'], occurred_at=row['occurred_at'], status=row['status'], public_approval=row['public_approval'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('finder_posts'):
            obj = FinderPost.objects.create(id=row['id'], owner=users[row['owner_id']], kind=row['kind'], title=row['title'], category=row['category'], color=row['color'], general_location=row['general_location'], occurred_at=row['occurred_at'], status=row['status'], public_approval=row['public_approval'])
            preserve_time(obj, row, 'created_at')
        links = {key(row['media_id']): row for row in rows('post_media')}
        # 반복 `rows('media_assets')`: 각 항목을 `row`에 담아 먼저 `link = links.get(key(row['id']), {})`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('media_assets'):
            link = links.get(key(row['id']), {})
            obj = MediaAsset.objects.create(id=row['id'], owner=users[row['owner_id']], storage_key=row['storage_key'], content_type=row['content_type'], size=row['size'], moderation=row['moderation_status'] if 'moderation_status' in row else row['moderation'], market_post_id=link.get('market_post_id'), finder_post_id=link.get('finder_post_id'))
            preserve_time(obj, row, 'created_at')
        # 반복 `rows('reports')`: 각 항목을 `row`에 담아 먼저 `target_id = row['target_id']`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('reports'):
            target_id = row['target_id']
            # 조건 분기 `row['target_type'] == 'club_post'`: 참이면 If 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if row['target_type'] == 'club_post':
                # 조건 분기 `target_id not in posts`: 참이면 CommandError('A club post report references a missing legacy post.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if target_id not in posts:
                    raise CommandError('A club post report references a missing legacy post.')
                target_id = str(posts[target_id].public_id)
            obj = Report.objects.create(public_id=row['id'], reporter=users[row['reporter_id']], target_type=row['target_type'], target_id=target_id, reason=row['reason'], status=row['status'])
            preserve_time(obj, row, 'created_at')
        # 반복 `rows('audit_logs')`: 각 항목을 `row`에 담아 먼저 `obj = AuditLog.objects.create(actor=users.get(row['actor_id']), action=row['action'], entity_type=row['entity_type'], entity_id=row['entity_id'])`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for row in rows('audit_logs'):
            obj = AuditLog.objects.create(actor=users.get(row['actor_id']), action=row['action'], entity_type=row['entity_type'], entity_id=row['entity_id'])
            preserve_time(obj, row, 'created_at')
