# 기능 범위: 계정·초대·거래·동아리·분실물·신고·이미지의 저장 형식과 DB 제약을 정의한다.
# 구현 미반영: Market의 사용자 간 메시지와 관심 목록은 모델·전송 API·화면이 없다.
# 구현 미반영: 모집의 지원 학년·관심 분야 전용 필드 및 해당 조건별 필터가 없다.
# 구현 미반영: 동아리 행사 체크인, 팀원 매칭, 확장 포트폴리오 전용 모델·처리 흐름이 없다.
# 구현 미반영: Finder의 수령자 확인·인계 이력은 저장하지 않는다. CLOSED는 글 종료 상태만 뜻한다.
# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q


# 이메일·학생 인증과 세션 버전을 포함하는 사용자 모델이다.
# 기능 `User`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class User(AbstractUser):
    email = models.EmailField(unique=True)
    legacy_auth_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    email_verified = models.BooleanField(default=False)
    student_active = models.BooleanField(default=False)
    session_version = models.PositiveIntegerField(default=0)

    # 기능 `Meta`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Meta:
        constraints = [models.UniqueConstraint(models.functions.Lower('email'), name='unique_email_case_insensitive')]

    # 기능 `_get_session_auth_hash`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
    def _get_session_auth_hash(self, secret=None):
        from django.utils.crypto import salted_hmac
        value = f'{self.password}:{self.session_version}'
        return salted_hmac('core.User.session', value, secret=secret, algorithm='sha256').hexdigest()


# 해시된 초대 코드와 발급·사용·폐기 이력을 저장한다.
# 기능 `Invitation`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    issued_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='issued_invitations')
    expires_at = models.DateTimeField()
    redeemed_at = models.DateTimeField(null=True, blank=True)
    redeemed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.PROTECT, related_name='redeemed_invitations')
    revoked_at = models.DateTimeField(null=True, blank=True)


# 계정별 초대 코드 시도 횟수와 시간 창을 저장한다.
# 기능 `InvitationAttempts`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class InvitationAttempts(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    window_start = models.DateTimeField()


# 운영 행위의 주체와 대상, 동작을 기록한다.
# 기능 `AuditLog`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class AuditLog(models.Model):
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)


# 거래 물품과 소유자 및 판매 상태를 저장한다.
# 기능 `MarketPost`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class MarketPost(models.Model):
    # 기능 `Status`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', '판매 중'
        RESERVED = 'RESERVED', '예약 중'
        COMPLETED = 'COMPLETED', '거래 완료'
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.PROTECT)
    title = models.CharField(max_length=120)
    description = models.TextField()
    price = models.PositiveIntegerField()
    category = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


# 거래 글의 예약자와 예약 상태를 연결한다.
# 기능 `Reservation`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Reservation(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    post = models.ForeignKey(MarketPost, on_delete=models.CASCADE, related_name='reservations')
    requester = models.ForeignKey(User, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, default='ACTIVE', choices=[('ACTIVE', '활성'), ('CANCELLED', '취소'), ('COMPLETED', '완료')])
    created_at = models.DateTimeField(auto_now_add=True)
    # 기능 `Meta`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Meta:
        constraints = [models.UniqueConstraint(fields=['post'], condition=Q(status='ACTIVE'), name='one_active_reservation')]


# 동아리의 소개와 공개 상태를 저장한다.
# 기능 `Club`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Club(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, allow_unicode=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=50)
    introduction = models.TextField()
    is_public = models.BooleanField(default=False)


# 동아리 구성원과 역할을 연결한다.
# 기능 `ClubMember`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class ClubMember(models.Model):
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=[('owner', '대표'), ('manager', '운영자'), ('member', '회원')])
    # 기능 `Meta`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Meta:
        constraints = [models.UniqueConstraint(fields=['club', 'user'], name='unique_club_member')]


# 동아리 활동 글과 공개 상태를 저장한다.
# 기능 `ClubPost`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class ClubPost(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(User, on_delete=models.PROTECT)
    title = models.CharField(max_length=120)
    content = models.TextField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


# 동아리 모집 공고와 모집 기간을 저장한다.
# 기능 `Recruitment`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Recruitment(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='recruitments')
    title = models.CharField(max_length=120)
    description = models.TextField()
    opens_at = models.DateTimeField()
    closes_at = models.DateTimeField()
    is_open = models.BooleanField(default=False)
    # 기능 `Meta`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Meta:
        constraints = [models.CheckConstraint(condition=Q(closes_at__gt=models.F('opens_at')), name='recruitment_dates_valid')]


# 모집별 지원자의 답변과 처리 상태를 저장한다.
# 기능 `Application`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Application(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    recruitment = models.ForeignKey(Recruitment, on_delete=models.CASCADE, related_name='applications')
    applicant = models.ForeignKey(User, on_delete=models.PROTECT)
    answers = models.JSONField()
    status = models.CharField(max_length=20, default='SUBMITTED', choices=[('SUBMITTED', '제출'), ('IN_REVIEW', '검토 중'), ('ACCEPTED', '승인'), ('REJECTED', '거절'), ('CANCELLED', '취소')])
    created_at = models.DateTimeField(auto_now_add=True)
    # 기능 `Meta`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Meta:
        constraints = [models.UniqueConstraint(fields=['recruitment', 'applicant'], name='one_application_per_recruitment')]


# 분실·습득물의 특징과 공개 심사 상태를 저장한다.
# 기능 `FinderPost`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class FinderPost(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.PROTECT)
    kind = models.CharField(max_length=10, choices=[('lost', '분실'), ('found', '습득')])
    title = models.CharField(max_length=120)
    category = models.CharField(max_length=50)
    color = models.CharField(max_length=50)
    general_location = models.CharField(max_length=120)
    occurred_at = models.DateField()
    status = models.CharField(max_length=10, choices=[('ACTIVE', '진행 중'), ('CLOSED', '종료')], default='ACTIVE')
    public_approval = models.CharField(max_length=10, choices=[('PENDING', '대기'), ('APPROVED', '승인'), ('REJECTED', '거부')], default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)


# 신고 대상과 사유 및 처리 상태를 저장한다.
# 기능 `Report`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Report(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    reporter = models.ForeignKey(User, on_delete=models.PROTECT)
    target_type = models.CharField(max_length=40)
    target_id = models.CharField(max_length=100)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=[('OPEN', '접수'), ('REVIEWED', '검토'), ('RESOLVED', '처리')], default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)


# 저장된 이미지와 게시물 연결 및 심사 상태를 저장한다.
# 기능 `MediaAsset`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class MediaAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.PROTECT)
    storage_key = models.CharField(max_length=200, unique=True)
    content_type = models.CharField(max_length=30)
    size = models.PositiveIntegerField()
    moderation = models.CharField(max_length=10, choices=[('PENDING', '대기'), ('APPROVED', '승인'), ('REJECTED', '거부')], default='PENDING')
    market_post = models.ForeignKey(MarketPost, null=True, blank=True, on_delete=models.SET_NULL, related_name='images')
    finder_post = models.ForeignKey(FinderPost, null=True, blank=True, on_delete=models.SET_NULL, related_name='images')
    created_at = models.DateTimeField(auto_now_add=True)
    # 기능 `Meta`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Meta:
        constraints = [models.CheckConstraint(condition=~(Q(market_post__isnull=False) & Q(finder_post__isnull=False)), name='media_at_most_one_post')]


# 요청 제한용 해시 키와 시간 창별 횟수를 저장한다.
# 기능 `RequestLimit`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class RequestLimit(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    window_start = models.DateTimeField()
