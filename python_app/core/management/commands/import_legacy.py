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
from core.models import User, Invitation, InvitationAttempts, AuditLog, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, Report, RequestLimit

TABLES = ['user', 'invitations', 'invitation_attempts', 'market_posts', 'market_reservations', 'clubs', 'club_members', 'club_posts', 'club_recruitments', 'club_applications', 'finder_posts', 'media_assets', 'post_media', 'reports', 'audit_logs']
MODELS = [User, Invitation, InvitationAttempts, AuditLog, MarketPost, Reservation, Club, ClubMember, ClubPost, Recruitment, Application, FinderPost, MediaAsset, Report, RequestLimit]


class Command(BaseCommand):
    help = 'Inspect or import the legacy Next.js database into an empty separate Django DB.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Perform the copy; default is read-only inspection.')

    def handle(self, *args, **options):
        source_url = os.environ.get('GWG_LEGACY_DATABASE_URL')
        if not source_url:
            raise CommandError('Set GWG_LEGACY_DATABASE_URL; do not pass credentials on the command line.')
        if connection.vendor != 'postgresql':
            raise CommandError('The destination must be a separate empty PostgreSQL database.')
        try:
            with psycopg.connect(source_url, row_factory=dict_row) as source:
                source.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                src_db = source.execute('SELECT current_database() AS name').fetchone()['name']
                with connection.cursor() as target:
                    target.execute('SELECT current_database()')
                    dst_db = target.fetchone()[0]
                if src_db == dst_db:
                    raise CommandError('Source and destination database names must differ.')
                counts = {name: source.execute('SELECT count(*) AS n FROM "' + name + '"').fetchone()['n'] for name in TABLES}
                self.stdout.write('Legacy row counts: ' + ', '.join(f'{k}={v}' for k, v in counts.items()))
                if not options['apply']:
                    self.stdout.write('Read-only inspection only. No data copied.')
                    return
                with transaction.atomic():
                    with connection.cursor() as target:
                        target.execute('SELECT pg_advisory_xact_lock(1797720219)')
                    if any(model.objects.exists() for model in MODELS):
                        raise CommandError('Destination is not empty; refusing to import.')
                    self.import_rows(source)
                self.stdout.write(self.style.SUCCESS('Copy complete. Old sessions and passwords were not imported; verify counts and send reset instructions separately.'))
        except (psycopg.Error, KeyError, ValueError, TypeError) as exc:
            raise CommandError(f'Import failed ({type(exc).__name__}); the destination transaction was rolled back.') from exc

    def import_rows(self, source):
        def rows(table):
            return source.execute('SELECT * FROM "' + table + '"').fetchall()
        def preserve_time(obj, row, *fields):
            changes = {field: row[field] for field in fields if row.get(field) is not None}
            if changes:
                type(obj).objects.filter(pk=obj.pk).update(**changes)
        def key(value):
            return str(value)
        users, clubs, recruitments, posts = {}, {}, {}, {}
        invitation_rows = rows('invitations')
        redeemed = {row['redeemed_by'] for row in invitation_rows if row['redeemed_by']}
        for row in rows('user'):
            email = row['email'].strip().lower()
            if not email or User.objects.filter(email__iexact=email).exists():
                raise CommandError('Legacy users contain missing or duplicate case-insensitive email addresses.')
            # Stable unique login name; the source nickname is retained as first_name.
            username = 'legacy_' + uuid.uuid5(uuid.NAMESPACE_URL, row['id']).hex
            user = User(username=username, legacy_auth_id=row['id'], first_name=(row['name'] or '')[:150], email=email, email_verified=row['email_verified'], student_active=row['status'] == 'ACTIVE_STUDENT' or (row['status'] == 'SUSPENDED' and (row['id'] in redeemed or row['role'] == 'admin')), is_active=row['status'] != 'SUSPENDED', is_superuser=row['role'] == 'admin', is_staff=row['role'] == 'admin')
            user.set_password(secrets.token_urlsafe(48))
            user.save()
            User.objects.filter(pk=user.pk).update(date_joined=row['created_at'])
            users[row['id']] = user
        for row in invitation_rows:
            Invitation.objects.create(id=row['id'], code_hash=row['code_hash'], issued_by=users[row['issued_by']], expires_at=row['expires_at'], redeemed_at=row['redeemed_at'], redeemed_by=users.get(row['redeemed_by']), revoked_at=row['revoked_at'])
        for row in rows('invitation_attempts'):
            InvitationAttempts.objects.create(user=users[row['user_id']], count=row['count'], window_start=row['window_start'])
        for row in rows('market_posts'):
            obj = MarketPost.objects.create(id=row['id'], owner=users[row['owner_id']], title=row['title'], description=row['description'], price=row['price'], category=row['category'], status=row['status'])
            preserve_time(obj, row, 'created_at', 'updated_at')
        for row in rows('market_reservations'):
            obj = Reservation.objects.create(public_id=row['id'], post_id=row['post_id'], requester=users[row['requester_id']], status=row['status'])
            preserve_time(obj, row, 'created_at')
        for row in rows('clubs'):
            clubs[key(row['id'])] = Club.objects.create(id=row['id'], slug=row['slug'], name=row['name'], category=row['category'], introduction=row['introduction'], is_public=row['is_public'])
        for row in rows('club_members'):
            ClubMember.objects.create(club_id=row['club_id'], user=users[row['user_id']], role=row['role'])
        for row in rows('club_posts'):
            obj = ClubPost.objects.create(public_id=row['id'], club_id=row['club_id'], author=users[row['author_id']], title=row['title'], content=row['content'], is_public=row['is_public'])
            posts[key(row['id'])] = obj
            preserve_time(obj, row, 'created_at')
        for row in rows('club_recruitments'):
            recruitments[key(row['id'])] = Recruitment.objects.create(public_id=row['id'], club_id=row['club_id'], title=row['title'], description=row['description'], opens_at=row['opens_at'], closes_at=row['closes_at'], is_open=row['is_open'])
        for row in rows('club_applications'):
            obj = Application.objects.create(public_id=row['id'], recruitment=recruitments[key(row['recruitment_id'])], applicant=users[row['applicant_id']], answers=row['answers'], status=row['status'])
            preserve_time(obj, row, 'created_at')
        for row in rows('finder_posts'):
            obj = FinderPost.objects.create(id=row['id'], owner=users[row['owner_id']], kind=row['kind'], title=row['title'], category=row['category'], color=row['color'], general_location=row['general_location'], occurred_at=row['occurred_at'], status=row['status'], public_approval=row['public_approval'])
            preserve_time(obj, row, 'created_at')
        links = {key(row['media_id']): row for row in rows('post_media')}
        for row in rows('media_assets'):
            link = links.get(key(row['id']), {})
            obj = MediaAsset.objects.create(id=row['id'], owner=users[row['owner_id']], storage_key=row['storage_key'], content_type=row['content_type'], size=row['size'], moderation=row['moderation_status'] if 'moderation_status' in row else row['moderation'], market_post_id=link.get('market_post_id'), finder_post_id=link.get('finder_post_id'))
            preserve_time(obj, row, 'created_at')
        for row in rows('reports'):
            target_id = row['target_id']
            if row['target_type'] == 'club_post':
                if target_id not in posts:
                    raise CommandError('A club post report references a missing legacy post.')
                target_id = str(posts[target_id].public_id)
            obj = Report.objects.create(public_id=row['id'], reporter=users[row['reporter_id']], target_type=row['target_type'], target_id=target_id, reason=row['reason'], status=row['status'])
            preserve_time(obj, row, 'created_at')
        for row in rows('audit_logs'):
            obj = AuditLog.objects.create(actor=users.get(row['actor_id']), action=row['action'], entity_type=row['entity_type'], entity_id=row['entity_id'])
            preserve_time(obj, row, 'created_at')
