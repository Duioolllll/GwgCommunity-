
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from core.models import AuditLog, User


# 명령줄에서 실행할 관리 작업을 정의한다.
class Command(BaseCommand):
    help = 'Grant the first administrator role to an existing, email-verified account.'


    # 관리 명령에서 받을 옵션을 정한다.
    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--confirm-bootstrap', action='store_true')


    # 명령줄에서 받은 옵션에 따라 관리 작업을 실행한다.
    def handle(self, *args, **options):


        # 최초 관리자 생성 확인 옵션을 주지 않았을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if not options['confirm_bootstrap']:
            raise CommandError('Pass --confirm-bootstrap after verifying the account owner.')
        with transaction.atomic():


            # PostgreSQL 데이터베이스를 사용 중일 때 아래 작업을 묶어서 안전하게 처리한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if connection.vendor == 'postgresql':
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_xact_lock(1797720220)')


            # 관리자 계정이 이미 있을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if User.objects.filter(is_superuser=True).exists():
                raise CommandError('An administrator already exists; bootstrap is unavailable.')

            user = User.objects.select_for_update().filter(username=options['username'], is_active=True, email_verified=True).first()


            # 해당 사용자를 찾지 못했을 때 잘못된 요청이나 설정임을 알리고 처리를 중단한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
            if not user:
                raise CommandError('An active, email-verified account is required.')
            user.is_superuser = user.is_staff = user.student_active = True
            user.session_version += 1
            user.save(update_fields=['is_superuser', 'is_staff', 'student_active', 'session_version'])
            AuditLog.objects.create(actor=user, action='admin.bootstrap', entity_type='user', entity_id=str(user.pk))
        self.stdout.write(self.style.SUCCESS('First administrator granted. Existing sessions require a new login.'))
