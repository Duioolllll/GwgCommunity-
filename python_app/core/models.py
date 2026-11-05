import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q


class User(AbstractUser):
    email = models.EmailField(unique=True)
    legacy_auth_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    email_verified = models.BooleanField(default=False)
    student_active = models.BooleanField(default=False)
    session_version = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(models.functions.Lower('email'), name='unique_email_case_insensitive')]

    def _get_session_auth_hash(self, secret=None):
        from django.utils.crypto import salted_hmac
        value = f'{self.password}:{self.session_version}'
        return salted_hmac('core.User.session', value, secret=secret, algorithm='sha256').hexdigest()


class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code_hash = models.CharField(max_length=64, unique=True)
    issued_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='issued_invitations')
    expires_at = models.DateTimeField()
    redeemed_at = models.DateTimeField(null=True, blank=True)
    redeemed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.PROTECT, related_name='redeemed_invitations')
    revoked_at = models.DateTimeField(null=True, blank=True)


class InvitationAttempts(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    window_start = models.DateTimeField()


class AuditLog(models.Model):
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)


class MarketPost(models.Model):
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


class Reservation(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    post = models.ForeignKey(MarketPost, on_delete=models.CASCADE, related_name='reservations')
    requester = models.ForeignKey(User, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, default='ACTIVE', choices=[('ACTIVE', '활성'), ('CANCELLED', '취소'), ('COMPLETED', '완료')])
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['post'], condition=Q(status='ACTIVE'), name='one_active_reservation')]


class Club(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True, allow_unicode=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=50)
    introduction = models.TextField()
    is_public = models.BooleanField(default=False)


class ClubMember(models.Model):
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=[('owner', '대표'), ('manager', '운영자'), ('member', '회원')])
    class Meta:
        constraints = [models.UniqueConstraint(fields=['club', 'user'], name='unique_club_member')]


class ClubPost(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(User, on_delete=models.PROTECT)
    title = models.CharField(max_length=120)
    content = models.TextField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class Recruitment(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='recruitments')
    title = models.CharField(max_length=120)
    description = models.TextField()
    opens_at = models.DateTimeField()
    closes_at = models.DateTimeField()
    is_open = models.BooleanField(default=False)
    class Meta:
        constraints = [models.CheckConstraint(condition=Q(closes_at__gt=models.F('opens_at')), name='recruitment_dates_valid')]


class Application(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    recruitment = models.ForeignKey(Recruitment, on_delete=models.CASCADE, related_name='applications')
    applicant = models.ForeignKey(User, on_delete=models.PROTECT)
    answers = models.JSONField()
    status = models.CharField(max_length=20, default='SUBMITTED', choices=[('SUBMITTED', '제출'), ('IN_REVIEW', '검토 중'), ('ACCEPTED', '승인'), ('REJECTED', '거절'), ('CANCELLED', '취소')])
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['recruitment', 'applicant'], name='one_application_per_recruitment')]


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


class Report(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    reporter = models.ForeignKey(User, on_delete=models.PROTECT)
    target_type = models.CharField(max_length=40)
    target_id = models.CharField(max_length=100)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=[('OPEN', '접수'), ('REVIEWED', '검토'), ('RESOLVED', '처리')], default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)


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
    class Meta:
        constraints = [models.CheckConstraint(condition=~(Q(market_post__isnull=False) & Q(finder_post__isnull=False)), name='media_at_most_one_post')]


class RequestLimit(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    count = models.PositiveIntegerField(default=0)
    window_start = models.DateTimeField()
