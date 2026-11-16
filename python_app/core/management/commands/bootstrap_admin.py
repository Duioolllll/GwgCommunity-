# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from core.models import AuditLog, User


# 기능 `Command`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Command(BaseCommand):
    help = 'Grant the first administrator role to an existing, email-verified account.'

    # 기능 `add_arguments`: 먼저 `parser.add_argument('--username', required=True)`를 실행한다.
    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--confirm-bootstrap', action='store_true')

    # 명시적 확인과 기존 관리자 부재를 검사하고 트랜잭션 안에서 권한과 감사 기록을 저장한다.
    # 기능 `handle`: If 구문으로 이어지는 내부 처리를 실행한다.
    def handle(self, *args, **options):
        # 조건 분기 `not options['confirm_bootstrap']`: 참이면 CommandError('Pass --confirm-bootstrap after verifying the account owner.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not options['confirm_bootstrap']:
            raise CommandError('Pass --confirm-bootstrap after verifying the account owner.')
        with transaction.atomic():
            # 조건 분기 `connection.vendor == 'postgresql'`: 참이면 With 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if connection.vendor == 'postgresql':
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_xact_lock(1797720220)')
            # 조건 분기 `User.objects.filter(is_superuser=True).exists()`: 참이면 CommandError('An administrator already exists; bootstrap is unavailable.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if User.objects.filter(is_superuser=True).exists():
                raise CommandError('An administrator already exists; bootstrap is unavailable.')
            # 활성화되고 이메일이 확인된 계정만 잠가 승격하며 세션 버전도 변경한다.
            user = User.objects.select_for_update().filter(username=options['username'], is_active=True, email_verified=True).first()
            # 조건 분기 `not user`: 참이면 CommandError('An active, email-verified account is required.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if not user:
                raise CommandError('An active, email-verified account is required.')
            user.is_superuser = user.is_staff = user.student_active = True
            user.session_version += 1
            user.save(update_fields=['is_superuser', 'is_staff', 'student_active', 'session_version'])
            AuditLog.objects.create(actor=user, action='admin.bootstrap', entity_type='user', entity_id=str(user.pk))
        self.stdout.write(self.style.SUCCESS('First administrator granted. Existing sessions require a new login.'))
