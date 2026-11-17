# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from core.models import AuditLog, User


# 명시적 확인 후 첫 관리자만 지정하며 관리 작업 기록과 로그인 상태 버전 갱신을 수행한다.
class Command(BaseCommand):
    help = 'Grant the first administrator role to an existing, email-verified account.'

    # 명령을 실행할 때 받을 옵션을 정한다.
    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--confirm-bootstrap', action='store_true')

    # PostgreSQL에서는 함께 성공하거나 함께 취소되는 저장 작업 자문 잠금으로 동시 부트스트랩을 직렬화한다.
    # 관리 명령의 입력을 확인하고 요청한 작업을 실행한다.
    def handle(self, *args, **options):
        # 최초 관리자 생성임을 명시적으로 확인하지 않으면 계정 권한을 올리지 않는다.
        if not options['confirm_bootstrap']:
            raise CommandError('Pass --confirm-bootstrap after verifying the account owner.')
        with transaction.atomic():
            # PostgreSQL에서는 다른 관리자 생성 요청이 동시에 진행되지 못하도록 잠금을 건다.
            if connection.vendor == 'postgresql':
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_xact_lock(1797720220)')
            # 관리자가 이미 있다면 최초 관리자 생성 명령을 다시 사용하지 못하게 한다.
            if User.objects.filter(is_superuser=True).exists():
                raise CommandError('An administrator already exists; bootstrap is unavailable.')
            user = User.objects.select_for_update().filter(username=options['username'], is_active=True, email_verified=True).first()
            # 해당 사용자가 없으면 작업을 멈춘다.
            if not user:
                raise CommandError('An active, email-verified account is required.')
            user.is_superuser = user.is_staff = user.student_active = True
            user.session_version += 1
            user.save(update_fields=['is_superuser', 'is_staff', 'student_active', 'session_version'])
            AuditLog.objects.create(actor=user, action='admin.bootstrap', entity_type='user', entity_id=str(user.pk))
        self.stdout.write(self.style.SUCCESS('First administrator granted. Existing sessions require a new login.'))
