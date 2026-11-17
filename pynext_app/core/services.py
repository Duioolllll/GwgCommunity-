# 이 파일은 여러 화면이 함께 쓰는 업무 규칙을 모아 둔다.
# 업무 규칙: 초대 발급·사용, 거래 예약, 분실물 유사도 점수를 처리한다.
# 구현 미반영: Finder 이미지 특징 비교와 매칭 알림 발송은 없다.
# 현재 점수는 분류·색상·대략적 장소·날짜만 비교한다. 이미지 검증·저장은 이미지 유사도 분석이 아니다.
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


# 처리할 수 없는 요청을 알릴 때 사용하는 오류 종류다.
class DomainError(Exception):
    pass


# 공개 고유 번호(UUID)를 우선 사용하고 이전 화면의 정수 식별자도 제한적으로 조회한다.
# 공개용 고유 번호로 찾고, 예전 화면의 짧은 숫자 번호도 읽을 수 있게 한다.
def by_public_id(queryset, value):
    """Resolve a stable UUID or an internal integer used by older Django previews."""
    # 먼저 공개용 고유 번호로 찾아본다. 번호 형식이 맞지 않으면 예전 숫자 번호인지 확인한다.
    try:
        return queryset.filter(public_id=uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        text = str(value)
        # 번호가 18자리 이하의 숫자라면 예전 방식의 내부 번호로도 찾아본다.
        if text.isdecimal() and len(text) <= 18:
            return queryset.filter(pk=int(text))
        return queryset.none()


# 초대 코드를 비밀키 기반 원문을 숨긴 확인값(HMAC)으로 변환하여 원문 대신 비교한다.
# 초대 코드 원문 대신 비밀키로 만든 확인용 값을 사용한다.
def _digest(code):
    return hmac.new(settings.INVITATION_SECRET.encode(), code.strip().encode(), hashlib.sha256).hexdigest()


# 자격 있는 관리자가 7일 유효 초대 코드를 발급하고 관리 작업 기록을 남긴다.
# 인증된 관리자가 한 번만 쓸 수 있는 7일짜리 초대 코드를 만든다.
def issue_invitation(actor):
    # 이용 가능한 관리자 계정이고 이메일·학생 인증도 끝났는지 확인한다. 하나라도 부족하면 초대 코드를 발급하지 않는다.
    if not actor.is_active or not actor.is_superuser or not actor.email_verified or not actor.student_active:
        raise DomainError('권한이 없습니다.')
    code = secrets.token_hex(16)
    with transaction.atomic():
        invite = Invitation.objects.create(code_hash=_digest(code), issued_by=actor, expires_at=timezone.now() + timedelta(days=7))
        AuditLog.objects.create(actor=actor, action='invitation.issued', entity_type='invitation', entity_id=str(invite.pk))
    return invite, code


# 계정 및 초대 행을 잠그고 시도 횟수, 유효기간과 인증 상태를 검사한 뒤 학생 인증을 처리한다.
# 시도 횟수·계정·코드 만료 여부를 확인한 뒤 학생 인증을 완료한다.
def redeem_invitation(user, code):
    now = timezone.now()
    with transaction.atomic():
        locked = User.objects.select_for_update().get(pk=user.pk)
        attempts, _ = InvitationAttempts.objects.get_or_create(user=locked, defaults={'window_start': now})
        # 횟수를 세기 시작한 뒤 15분이 지났으면 입력 횟수를 0으로 되돌린다.
        if attempts.window_start <= now - timedelta(minutes=15):
            attempts.window_start, attempts.count = now, 0
        # 15분 안에 이미 5번 입력했다면 추가 시도를 막는다.
        if attempts.count >= 5:
            return False, '시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.'
        attempts.count += 1
        attempts.save()
        # 정지된 계정, 이메일 인증을 안 한 계정, 이미 학생 인증을 마친 계정은 코드를 사용할 수 없다.
        if not locked.is_active or not locked.email_verified or locked.student_active:
            return False, '초대 코드를 사용할 수 없는 계정입니다.'
        invite = Invitation.objects.select_for_update().filter(code_hash=_digest(code), redeemed_at__isnull=True, revoked_at__isnull=True, expires_at__gt=now).first()
        # 사용하지 않았고 폐기·만료되지 않은 코드가 없으면 인증을 거절한다.
        if invite is None:
            return False, '유효하지 않은 초대 코드입니다.'
        updated = Invitation.objects.filter(pk=invite.pk, redeemed_at__isnull=True, revoked_at__isnull=True, expires_at__gt=now).update(redeemed_at=now, redeemed_by=locked)
        # 다른 요청이 먼저 처리해 데이터가 바뀌지 않았다면 중복 작업으로 보고 거절한다.
        if not updated:
            return False, '유효하지 않은 초대 코드입니다.'
        locked.student_active = True
        locked.save(update_fields=['student_active'])
        AuditLog.objects.create(actor=locked, action='invitation.redeemed', entity_type='invitation', entity_id=str(invite.pk))
        return True, '학생 인증이 완료되었습니다.'


# 게시물을 잠그고 자격과 판매 상태를 확인하여 중복 예약을 방지한다.
# 같은 글을 동시에 예약하지 못하게 확인한 뒤 예약을 저장한다.
def reserve(post_id, requester):
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().get(pk=post_id)
        # 인증하지 않은 계정, 자기 글, 판매 중이 아닌 글에는 예약할 수 없다.
        if not requester.is_active or not requester.student_active or not requester.email_verified or post.owner_id == requester.pk or post.status != MarketPost.Status.AVAILABLE:
            raise DomainError('예약할 수 없는 게시물입니다.')
        updated = MarketPost.objects.filter(pk=post.pk, status=MarketPost.Status.AVAILABLE).update(status=MarketPost.Status.RESERVED)
        # 다른 요청이 먼저 처리해 데이터가 바뀌지 않았다면 중복 작업으로 보고 거절한다.
        if not updated:
            raise DomainError('이미 예약된 게시물입니다.')
        Reservation.objects.create(post=post, requester=requester)


# 분류·색상·장소·날짜의 유사도 점수를 계산하며 소유권을 증명하지는 않는다.
# 분류·색상·장소·날짜가 얼마나 비슷한지 항목별 점수를 계산한다.
def score_breakdown(a, b):
    # 글자 표기와 대소문자·공백을 맞춰 같은 내용을 다르게 보지 않게 한다.
    def norm(value):
        return ' '.join(unicodedata.normalize('NFKC', value or '').lower().split())
    # 분류가 비어 있지 않고 서로 같으면 40점, 아니면 0점이다.
    category = 40 if norm(a.category) and norm(a.category) == norm(b.category) else 0
    # 색상이 비어 있지 않고 서로 같으면 25점, 아니면 0점이다.
    color = 25 if norm(a.color) and norm(a.color) == norm(b.color) else 0
    left, right = norm(a.general_location), norm(b.general_location)
    # 장소가 비어 있지 않고 같으면 20점, 한쪽 이름이 다른 쪽에 포함되면 10점, 그 외에는 0점이다.
    place = 20 if left and left == right else 10 if left and right and (left in right or right in left) else 0
    # 양쪽 날짜가 있으면 날짜 차이를 구한다. 하나라도 없으면 날짜 점수를 줄 수 없도록 무한대 차이로 둔다.
    days = abs((a.occurred_at - b.occurred_at).days) if a.occurred_at and b.occurred_at else float('inf')
    # 날짜가 같으면 15점, 차이가 3일 이하면 10점, 7일 이하면 5점, 그 밖에는 0점이다.
    date = 15 if days == 0 else 10 if days <= 3 else 5 if days <= 7 else 0
    return {"category": category, "color": color, "location": place, "date": date, "total": category + color + place + date}


# 항목별 분실물 유사도 점수의 합계를 반환한다.
# 항목별 점수를 더한 최종 점수를 돌려준다.
def score_match(a, b):
    return score_breakdown(a, b)["total"]
