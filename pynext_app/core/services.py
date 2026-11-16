# 업무 규칙: 초대 발급·사용, 거래 예약, 분실물 유사도 점수를 처리한다.
# 구현 미반영: Finder 이미지 특징 비교와 매칭 알림 발송은 없다.
# 현재 점수는 분류·색상·대략적 장소·날짜만 비교한다. 이미지 검증·저장은 이미지 유사도 분석이 아니다.
# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `not actor.is_active or not actor.is_superuser or (not actor.email_verified) or (not actor.student_active)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `norm(a.category) and norm(a.category) == norm(b.category)`: 참일 때 `40`, 거짓일 때 `0`를 선택한다.
# - 조건식 `norm(a.color) and norm(a.color) == norm(b.color)`: 참일 때 `25`, 거짓일 때 `0`를 선택한다.
# - 조건식 `left and left == right`: 참일 때 `20`, 거짓일 때 `10 if left and right and (left in right or right in left) else 0`를 선택한다.
# - 조건식 `a.occurred_at and b.occurred_at`: 참일 때 `abs((a.occurred_at - b.occurred_at).days)`, 거짓일 때 `float('inf')`를 선택한다.
# - 조건식 `days == 0`: 참일 때 `15`, 거짓일 때 `10 if days <= 3 else 5 if days <= 7 else 0`를 선택한다.
# - 단락 평가 `not locked.is_active or not locked.email_verified or locked.student_active`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not requester.is_active or not requester.student_active or (not requester.email_verified) or (post.owner_id == requester.pk) or (post.status != MarketPost.Status.AVAILABLE)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `norm(a.category) and norm(a.category) == norm(b.category)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `norm(a.color) and norm(a.color) == norm(b.color)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `left and left == right`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `left and right and (left in right or right in left)`: 참일 때 `10`, 거짓일 때 `0`를 선택한다.
# - 단락 평가 `a.occurred_at and b.occurred_at`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `days <= 3`: 참일 때 `10`, 거짓일 때 `5 if days <= 7 else 0`를 선택한다.
# - 단락 평가 `text.isdecimal() and len(text) <= 18`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `left and right and (left in right or right in left)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `days <= 7`: 참일 때 `5`, 거짓일 때 `0`를 선택한다.
# - 단락 평가 `left in right or right in left`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `value or ''`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
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


# 기능 `DomainError`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class DomainError(Exception):
    pass


# 공개 UUID를 우선 사용하고 이전 화면의 정수 식별자도 제한적으로 조회한다.
# 기능 `by_public_id`: Resolve a stable UUID or an internal integer used by older Django previews..
def by_public_id(queryset, value):
    """Resolve a stable UUID or an internal integer used by older Django previews."""
    # 예외 경계: 본문을 시도하고 `(ValueError, TypeError, AttributeError)` 발생 시 먼저 `text = str(value)`로 상태 또는 조회 조건을 갱신한다.
    try:
        return queryset.filter(public_id=uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        text = str(value)
        # 조건 분기 `text.isdecimal() and len(text) <= 18`: 참이면 queryset.filter(pk=int(text))을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if text.isdecimal() and len(text) <= 18:
            return queryset.filter(pk=int(text))
        return queryset.none()


# 초대 코드를 비밀키 기반 HMAC으로 변환하여 원문 대신 비교한다.
# 기능 `_digest`: hmac.new(settings.INVITATION_SECRET.encode(), code.strip().encode(), hashlib.sha256).hexdigest()을 반환한다.
def _digest(code):
    return hmac.new(settings.INVITATION_SECRET.encode(), code.strip().encode(), hashlib.sha256).hexdigest()


# 자격 있는 관리자가 7일 유효 초대 코드를 발급하고 감사 기록을 남긴다.
# 기능 `issue_invitation`: If 구문으로 이어지는 내부 처리를 실행한다.
def issue_invitation(actor):
    # 조건 분기 `not actor.is_active or not actor.is_superuser or (not actor.email_verified) or (not actor.student_active)`: 참이면 DomainError('권한이 없습니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not actor.is_active or not actor.is_superuser or not actor.email_verified or not actor.student_active:
        raise DomainError('권한이 없습니다.')
    code = secrets.token_hex(16)
    with transaction.atomic():
        invite = Invitation.objects.create(code_hash=_digest(code), issued_by=actor, expires_at=timezone.now() + timedelta(days=7))
        AuditLog.objects.create(actor=actor, action='invitation.issued', entity_type='invitation', entity_id=str(invite.pk))
    return invite, code


# 계정 및 초대 행을 잠그고 시도 횟수, 유효기간과 인증 상태를 검사한 뒤 학생 인증을 처리한다.
# 기능 `redeem_invitation`: 먼저 `now = timezone.now()`로 상태 또는 조회 조건을 갱신한다.
def redeem_invitation(user, code):
    now = timezone.now()
    with transaction.atomic():
        # Lock the user first: concurrent submissions from one account share a limit.
        locked = User.objects.select_for_update().get(pk=user.pk)
        attempts, _ = InvitationAttempts.objects.get_or_create(user=locked, defaults={'window_start': now})
        # 조건 분기 `attempts.window_start <= now - timedelta(minutes=15)`: 참이면 먼저 `attempts.window_start, attempts.count = (now, 0)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if attempts.window_start <= now - timedelta(minutes=15):
            attempts.window_start, attempts.count = now, 0
        # 조건 분기 `attempts.count >= 5`: 참이면 (False, '시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if attempts.count >= 5:
            return False, '시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.'
        attempts.count += 1
        attempts.save()
        # 조건 분기 `not locked.is_active or not locked.email_verified or locked.student_active`: 참이면 (False, '초대 코드를 사용할 수 없는 계정입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not locked.is_active or not locked.email_verified or locked.student_active:
            return False, '초대 코드를 사용할 수 없는 계정입니다.'
        invite = Invitation.objects.select_for_update().filter(code_hash=_digest(code), redeemed_at__isnull=True, revoked_at__isnull=True, expires_at__gt=now).first()
        # 조건 분기 `invite is None`: 참이면 (False, '유효하지 않은 초대 코드입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if invite is None:
            return False, '유효하지 않은 초대 코드입니다.'
        updated = Invitation.objects.filter(pk=invite.pk, redeemed_at__isnull=True, revoked_at__isnull=True, expires_at__gt=now).update(redeemed_at=now, redeemed_by=locked)
        # 조건 분기 `not updated`: 참이면 (False, '유효하지 않은 초대 코드입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not updated:
            return False, '유효하지 않은 초대 코드입니다.'
        locked.student_active = True
        locked.save(update_fields=['student_active'])
        AuditLog.objects.create(actor=locked, action='invitation.redeemed', entity_type='invitation', entity_id=str(invite.pk))
        return True, '학생 인증이 완료되었습니다.'


# 게시물을 잠그고 자격과 판매 상태를 확인하여 중복 예약을 방지한다.
# 기능 `reserve`: With 구문으로 이어지는 내부 처리를 실행한다.
def reserve(post_id, requester):
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().get(pk=post_id)
        # 조건 분기 `not requester.is_active or not requester.student_active or (not requester.email_verified) or (post.owner_id == requester.pk) or (post.status != MarketPost.Status.AVAILABLE)`: 참이면 DomainError('예약할 수 없는 게시물입니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not requester.is_active or not requester.student_active or not requester.email_verified or post.owner_id == requester.pk or post.status != MarketPost.Status.AVAILABLE:
            raise DomainError('예약할 수 없는 게시물입니다.')
        updated = MarketPost.objects.filter(pk=post.pk, status=MarketPost.Status.AVAILABLE).update(status=MarketPost.Status.RESERVED)
        # 조건 분기 `not updated`: 참이면 DomainError('이미 예약된 게시물입니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not updated:
            raise DomainError('이미 예약된 게시물입니다.')
        Reservation.objects.create(post=post, requester=requester)


# 분류·색상·장소·날짜의 유사도 점수를 계산하며 소유권을 증명하지는 않는다.
# 기능 `score_breakdown`: FunctionDef 구문으로 이어지는 내부 처리를 실행한다.
def score_breakdown(a, b):
    # 기능 `norm`: ' '.join(unicodedata.normalize('NFKC', value or '').lower().split())을 반환한다.
    def norm(value):
        return ' '.join(unicodedata.normalize('NFKC', value or '').lower().split())
    category = 40 if norm(a.category) and norm(a.category) == norm(b.category) else 0
    color = 25 if norm(a.color) and norm(a.color) == norm(b.color) else 0
    left, right = norm(a.general_location), norm(b.general_location)
    place = 20 if left and left == right else 10 if left and right and (left in right or right in left) else 0
    days = abs((a.occurred_at - b.occurred_at).days) if a.occurred_at and b.occurred_at else float('inf')
    date = 15 if days == 0 else 10 if days <= 3 else 5 if days <= 7 else 0
    return {"category": category, "color": color, "location": place, "date": date, "total": category + color + place + date}


# 항목별 분실물 유사도 점수의 합계를 반환한다.
# 기능 `score_match`: score_breakdown(a, b)['total']을 반환한다.
def score_match(a, b):
    return score_breakdown(a, b)["total"]
