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


# 이메일과 학생 인증 상태를 보관하며 이메일은 대소문자 구분 없이 유일하다.
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

    # 비밀번호와 세션 버전을 함께 해시해 버전 변경 시 기존 세션을 무효화한다.
    # 기능 `_get_session_auth_hash`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
    def _get_session_auth_hash(self, secret=None):
        from django.utils.crypto import salted_hmac
        value = f'{self.password}:{self.session_version}'
        return salted_hmac('core.User.session', value, secret=secret, algorithm='sha256').hexdigest()


# 초대 원문 대신 해시와 발급·만료·사용·폐기 정보를 보관한다.
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


# 사용자별 초대 코드 시도 횟수와 시간 창을 보관한다.
# 기능 `InvitationAttempts`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class InvitationAttempts(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    window_start = models.DateTimeField()


# 행위자와 대상 식별자를 기록하며 사용자 삭제 시 행위자는 비워진다.
# 기능 `AuditLog`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class AuditLog(models.Model):
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)


# 거래 게시물의 소유자와 판매·예약·완료 상태를 보관한다.
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


# 게시물당 활성 예약이 하나뿐이도록 조건부 유일 제약을 둔다.
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


# 고유 슬러그와 공개 여부를 가진 동아리다.
# 기능 `Club`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Club(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, allow_unicode=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=50)
    introduction = models.TextField()
    is_public = models.BooleanField(default=False)


# 동아리별 사용자 역할을 저장하며 중복 회원을 제한한다.
# 기능 `ClubMember`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class ClubMember(models.Model):
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=[('owner', '대표'), ('manager', '운영자'), ('member', '회원')])
    # 기능 `Meta`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
    class Meta:
        constraints = [models.UniqueConstraint(fields=['club', 'user'], name='unique_club_member')]


# 동아리 활동 글과 공개 여부를 보관한다.
# 기능 `ClubPost`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class ClubPost(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(User, on_delete=models.PROTECT)
    title = models.CharField(max_length=120)
    content = models.TextField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


# 모집 시작·종료 시각과 공개 모집 상태를 저장하며 종료는 시작 이후여야 한다.
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


# 모집별 지원 답변과 처리 상태를 저장하며 사용자당 중복 지원을 제한한다.
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


# 분실·습득 정보와 진행 상태, 별도의 공개 심사 상태를 보관한다.
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


# 신고 대상 식별자와 사유, 처리 상태를 보관한다.
# 기능 `Report`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Report(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    reporter = models.ForeignKey(User, on_delete=models.PROTECT)
    target_type = models.CharField(max_length=40)
    target_id = models.CharField(max_length=100)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=[('OPEN', '접수'), ('REVIEWED', '검토'), ('RESOLVED', '처리')], default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)


# 비공개 저장 키와 심사 상태를 기록하고 한 이미지의 게시물 연결을 최대 하나로 제한한다.
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


# 해시된 제한 키별 횟수와 시간 창을 저장한다.
# 기능 `RequestLimit`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class RequestLimit(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    window_start = models.DateTimeField()
