from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from core.models import AuditLog, User


class Command(BaseCommand):
    help = 'Grant the first administrator role to an existing, email-verified account.'

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--confirm-bootstrap', action='store_true')

    def handle(self, *args, **options):
        if not options['confirm_bootstrap']:
            raise CommandError('Pass --confirm-bootstrap after verifying the account owner.')
        with transaction.atomic():
            if connection.vendor == 'postgresql':
                with connection.cursor() as cursor:
                    cursor.execute('SELECT pg_advisory_xact_lock(1797720220)')
            if User.objects.filter(is_superuser=True).exists():
                raise CommandError('An administrator already exists; bootstrap is unavailable.')
            user = User.objects.select_for_update().filter(username=options['username'], is_active=True, email_verified=True).first()
            if not user:
                raise CommandError('An active, email-verified account is required.')
            user.is_superuser = user.is_staff = user.student_active = True
            user.session_version += 1
            user.save(update_fields=['is_superuser', 'is_staff', 'student_active', 'session_version'])
            AuditLog.objects.create(actor=user, action='admin.bootstrap', entity_type='user', entity_id=str(user.pk))
        self.stdout.write(self.style.SUCCESS('First administrator granted. Existing sessions require a new login.'))
