import hashlib
import hmac
import secrets
import unicodedata
import uuid
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import AuditLog, Invitation, InvitationAttempts, MarketPost, Reservation, User


class DomainError(Exception):
    pass


def by_public_id(queryset, value):
    """Resolve a stable UUID or an internal integer used by older Django previews."""
    try:
        return queryset.filter(public_id=uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        text = str(value)
        if text.isdecimal() and len(text) <= 18:
            return queryset.filter(pk=int(text))
        return queryset.none()


def _digest(code):
    return hmac.new(settings.INVITATION_SECRET.encode(), code.strip().encode(), hashlib.sha256).hexdigest()


def issue_invitation(actor):
    if not actor.is_active or not actor.is_superuser or not actor.email_verified or not actor.student_active:
        raise DomainError('권한이 없습니다.')
    code = secrets.token_hex(16)
    with transaction.atomic():
        invite = Invitation.objects.create(code_hash=_digest(code), issued_by=actor, expires_at=timezone.now() + timedelta(days=7))
        AuditLog.objects.create(actor=actor, action='invitation.issued', entity_type='invitation', entity_id=str(invite.pk))
    return invite, code


def redeem_invitation(user, code):
    now = timezone.now()
    with transaction.atomic():
        # Lock the user first: concurrent submissions from one account share a limit.
        locked = User.objects.select_for_update().get(pk=user.pk)
        attempts, _ = InvitationAttempts.objects.get_or_create(user=locked, defaults={'window_start': now})
        if attempts.window_start <= now - timedelta(minutes=15):
            attempts.window_start, attempts.count = now, 0
        if attempts.count >= 5:
            return False, '시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.'
        attempts.count += 1
        attempts.save()
        if not locked.is_active or not locked.email_verified or locked.student_active:
            return False, '초대 코드를 사용할 수 없는 계정입니다.'
        invite = Invitation.objects.select_for_update().filter(code_hash=_digest(code), redeemed_at__isnull=True, revoked_at__isnull=True, expires_at__gt=now).first()
        if invite is None:
            return False, '유효하지 않은 초대 코드입니다.'
        updated = Invitation.objects.filter(pk=invite.pk, redeemed_at__isnull=True, revoked_at__isnull=True, expires_at__gt=now).update(redeemed_at=now, redeemed_by=locked)
        if not updated:
            return False, '유효하지 않은 초대 코드입니다.'
        locked.student_active = True
        locked.save(update_fields=['student_active'])
        AuditLog.objects.create(actor=locked, action='invitation.redeemed', entity_type='invitation', entity_id=str(invite.pk))
        return True, '학생 인증이 완료되었습니다.'


def reserve(post_id, requester):
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().get(pk=post_id)
        if not requester.is_active or not requester.student_active or not requester.email_verified or post.owner_id == requester.pk or post.status != MarketPost.Status.AVAILABLE:
            raise DomainError('예약할 수 없는 게시물입니다.')
        updated = MarketPost.objects.filter(pk=post.pk, status=MarketPost.Status.AVAILABLE).update(status=MarketPost.Status.RESERVED)
        if not updated:
            raise DomainError('이미 예약된 게시물입니다.')
        Reservation.objects.create(post=post, requester=requester)


def score_match(a, b):
    def norm(value):
        return ' '.join(unicodedata.normalize('NFKC', value or '').lower().split())
    category = 40 if norm(a.category) and norm(a.category) == norm(b.category) else 0
    color = 25 if norm(a.color) and norm(a.color) == norm(b.color) else 0
    left, right = norm(a.general_location), norm(b.general_location)
    place = 20 if left and left == right else 10 if left and right and (left in right or right in left) else 0
    days = abs((a.occurred_at - b.occurred_at).days) if a.occurred_at and b.occurred_at else float('inf')
    date = 15 if days == 0 else 10 if days <= 3 else 5 if days <= 7 else 0
    return category + color + place + date
