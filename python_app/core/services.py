# 구현 미반영: Finder 이미지 특징 비교와 매칭 알림 발송은 없다.


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


# 업무 규칙을 어겼을 때 구분해서 처리할 오류를 정한다.
class DomainError(Exception):
    pass


# 공개용 번호로 먼저 찾고, 예전 숫자 번호도 함께 지원한다.
def by_public_id(queryset, value):
    """Resolve a stable UUID or an internal integer used by older Django previews."""


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
    try:
        return queryset.filter(public_id=uuid.UUID(str(value)))


    # 이 종류의 오류가 나면 필요한 값을 정한 뒤 아래 처리를 계속한다.
    except (ValueError, TypeError, AttributeError):
        text = str(value)


        # 번호가 18자리 이하의 숫자라면 예전 방식의 내부 번호로도 찾아본다.
        if text.isdecimal() and len(text) <= 18:
            return queryset.filter(pk=int(text))
        return queryset.none()


# 초대 코드 원문을 저장하지 않도록 비밀키로 비교용 값을 만든다.
def _digest(code):
    return hmac.new(settings.INVITATION_SECRET.encode(), code.strip().encode(), hashlib.sha256).hexdigest()


# 자격을 갖춘 관리자가 7일 동안 한 번 쓸 수 있는 초대 코드를 만든다.
def issue_invitation(actor):


    # 이용 가능한 관리자 계정이고 이메일·학생 인증도 끝났는지 확인한다. 하나라도 부족하면 초대 코드를 발급하지 않는다.
    if not actor.is_active or not actor.is_superuser or not actor.email_verified or not actor.student_active:
        raise DomainError('권한이 없습니다.')
    code = secrets.token_hex(16)
    with transaction.atomic():
        invite = Invitation.objects.create(code_hash=_digest(code), issued_by=actor, expires_at=timezone.now() + timedelta(days=7))
        AuditLog.objects.create(actor=actor, action='invitation.issued', entity_type='invitation', entity_id=str(invite.pk))
    return invite, code


# 초대 코드의 만료·사용 여부와 계정 자격을 확인해 학생 인증을 완료한다.
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


# 동시에 신청해도 한 사람만 예약되도록 확인과 저장을 함께 처리한다.
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


# 두 물건의 분류·색상·장소·날짜를 비교해 항목별 점수를 계산한다.
def score_breakdown(a, b):


    # 띄어쓰기와 영문 대소문자 차이를 줄여 같은 내용끼리 비교하게 한다.
    def norm(value):


        # 값이 비어 있으면 빈 문자열로 바꿔 안전하게 비교한다.
        return ' '.join(unicodedata.normalize('NFKC', value or '').lower().split())


    # 분류가 비어 있지 않고 서로 같으면 40점, 아니면 0점을 준다.
    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    category = 40 if norm(a.category) and norm(a.category) == norm(b.category) else 0


    # 색상이 비어 있지 않고 서로 같으면 25점, 아니면 0점을 준다.
    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    color = 25 if norm(a.color) and norm(a.color) == norm(b.color) else 0
    left, right = norm(a.general_location), norm(b.general_location)


    # 장소가 비어 있지 않고 완전히 같으면 20점을 준다. 다르면 아래의 부분 일치 조건을 확인한다.
    # 두 장소가 있고 한쪽 이름에 다른 쪽 이름이 들어 있으면 부분 일치로 10점, 아니면 0점을 준다.
    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    # 앞쪽 값이 비어 있으면 다음 후보를 사용한다. 값이 있으면 뒤쪽은 확인하지 않는다.
    place = 20 if left and left == right else 10 if left and right and (left in right or right in left) else 0


    # 두 글에 날짜가 모두 있으면 날짜 차이를 구한다. 하나라도 없으면 날짜 점수를 주지 않도록 처리한다.
    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    days = abs((a.occurred_at - b.occurred_at).days) if a.occurred_at and b.occurred_at else float('inf')


    # 같은 날짜면 15점, 3일 이내면 10점, 7일 이내면 5점, 그보다 멀면 0점을 준다.
    # 같은 날짜는 아니지만 차이가 3일 이내면 10점이다. 그보다 멀면 7일 이내인지 확인한다.
    # 날짜 차이가 7일 이내면 5점, 아니면 0점이다.
    date = 15 if days == 0 else 10 if days <= 3 else 5 if days <= 7 else 0
    return {"category": category, "color": color, "location": place, "date": date, "total": category + color + place + date}


# 항목별 점수를 모두 더해 두 물건의 유사도 점수를 구한다.
def score_match(a, b):
    return score_breakdown(a, b)["total"]
