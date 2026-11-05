from functools import wraps
from hmac import compare_digest
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.core import signing
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST
from .forms import RegisterForm, MarketForm, FinderForm
from .models import Application, Club, ClubMember, FinderPost, MarketPost, MediaAsset, Recruitment, Reservation, User
from .services import DomainError, by_public_id, redeem_invitation, reserve, score_match


def student_required(view):
    @login_required
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_active or not request.user.email_verified or not request.user.student_active:
            return HttpResponseForbidden('이메일과 학생 인증이 필요합니다.')
        return view(request, *args, **kwargs)
    return wrapped


def home(request):
    return render(request, 'home.html')


def register(request):
    form = RegisterForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        try:
            with transaction.atomic():
                user = form.save()
        except IntegrityError:
            form.add_error(None, '가입 정보를 사용할 수 없습니다.')
            return render(request, 'form.html', {'title': '회원가입', 'form': form}, status=400)
        token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
        url = request.build_absolute_uri(reverse('verify-email', args=[token]))
        send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {url}', None, [user.email])
        return render(request, 'message.html', {'title': '이메일을 확인해 주세요', 'message': '발송된 확인 링크를 열어 주세요.'})
    return render(request, 'form.html', {'title': '회원가입', 'form': form})


def verify_email(request, token):
    try:
        data = signing.loads(token, salt='email-verification', max_age=86400)
        user = User.objects.get(pk=data['user'], email=data['email'], is_active=True)
    except (signing.BadSignature, User.DoesNotExist, KeyError):
        return render(request, 'message.html', {'title': '확인 실패', 'message': '링크가 만료되었거나 유효하지 않습니다.'}, status=400)
    user.email_verified = True
    user.save(update_fields=['email_verified'])
    return render(request, 'message.html', {'title': '이메일 확인 완료', 'message': '로그인한 후 초대 코드를 입력해 주세요.'})


@login_required
def invite(request):
    if request.method == 'POST':
        code = request.POST.get('code', '')[:128]
        ok, message = redeem_invitation(request.user, code)
        messages.success(request, message) if ok else messages.error(request, message)
        if ok:
            return redirect('me')
    return render(request, 'invite.html')


@login_required
def me(request):
    return render(request, 'me.html', {'market_posts': MarketPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'reservations': Reservation.objects.filter(requester=request.user).select_related('post').order_by('-created_at')[:20], 'finder_posts': FinderPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'applications': Application.objects.filter(applicant=request.user).select_related('recruitment__club')[:20], 'managed_clubs': ClubMember.objects.filter(user=request.user, role__in=['owner', 'manager']).select_related('club')})


def market(request):
    q = request.GET.get('q', '')[:120]
    category, status = request.GET.get('category', '')[:50], request.GET.get('status', '')[:20]
    posts = MarketPost.objects.filter(title__icontains=q)
    if category:
        posts = posts.filter(category=category)
    if status in MarketPost.Status.values:
        posts = posts.filter(status=status)
    for name, lookup in (('min_price', 'price__gte'), ('max_price', 'price__lte')):
        value = request.GET.get(name, '')
        if value.isdecimal() and len(value) <= 9:
            posts = posts.filter(**{lookup: int(value)})
    page = Paginator(posts.prefetch_related('images').order_by('-created_at', '-pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'market.html', {'posts': page, 'page': page, 'q': q, 'categories': MarketPost.objects.order_by('category').values_list('category', flat=True).distinct()})


@student_required
def market_new(request):
    form = MarketForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        try:
            post = save_post_with_images(form, request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            return redirect('market-detail', pk=post.pk)
    return render(request, 'form.html', {'title': '물품 등록', 'form': form})


def market_detail(request, pk):
    post = get_object_or_404(MarketPost, pk=pk)
    active = post.reservations.filter(status='ACTIVE').first() if request.user.is_authenticated else None
    may_cancel = bool(active and request.user.pk in (post.owner_id, active.requester_id))
    return render(request, 'market_detail.html', {'post': post, 'may_cancel': may_cancel})


@student_required
def market_edit(request, pk):
    if request.method == 'POST':
        with transaction.atomic():
            post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk, owner=request.user)
            if post.status != MarketPost.Status.AVAILABLE:
                return HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')
            form = MarketForm(request.POST, instance=post)
            if form.is_valid():
                form.save()
                return redirect('market-detail', pk=post.pk)
        return render(request, 'form.html', {'title': '물품 수정', 'form': form})
    post = get_object_or_404(MarketPost, pk=pk, owner=request.user)
    if post.status != MarketPost.Status.AVAILABLE:
        return HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')
    form = MarketForm(instance=post)
    return render(request, 'form.html', {'title': '물품 수정', 'form': form})


@student_required
@require_POST
def market_reserve(request, pk):
    get_object_or_404(MarketPost, pk=pk)
    try:
        reserve(pk, request.user)
        messages.success(request, '예약이 완료되었습니다.')
    except DomainError as exc:
        messages.error(request, str(exc))
    return redirect('market-detail', pk=pk)


@student_required
@require_POST
def market_status(request, pk):
    with transaction.atomic():
        post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk)
        active = post.reservations.filter(status='ACTIVE').first()
        action = request.POST.get('action')
        if not active or post.status != MarketPost.Status.RESERVED:
            return HttpResponseForbidden('변경할 예약이 없습니다.')
        if action == 'complete' and post.owner_id == request.user.pk:
            post.status, active.status = 'COMPLETED', 'COMPLETED'
        elif action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id):
            post.status, active.status = 'AVAILABLE', 'CANCELLED'
        else:
            return HttpResponseForbidden('권한이 없습니다.')
        post.save(update_fields=['status'])
        active.save(update_fields=['status'])
    return redirect('market-detail', pk=pk)


def clubs(request):
    q = request.GET.get('q', '')[:120]
    category = request.GET.get('category', '')[:50]
    clubs = Club.objects.filter(is_public=True).filter(Q(name__icontains=q) | Q(introduction__icontains=q))
    if category:
        clubs = clubs.filter(category=category)
    if request.GET.get('recruiting') == '1':
        now = timezone.now()
        clubs = clubs.filter(recruitments__is_open=True, recruitments__opens_at__lte=now, recruitments__closes_at__gte=now).distinct()
    page = Paginator(clubs.order_by('name', 'pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'clubs.html', {'clubs': page, 'page': page, 'q': q, 'categories': Club.objects.filter(is_public=True).order_by('category').values_list('category', flat=True).distinct()})


def club_detail(request, slug):
    club = get_object_or_404(Club, slug=slug, is_public=True)
    now = timezone.now()
    can_manage = request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified and club_can_manage(request.user, club)
    return render(request, 'club_detail.html', {'club': club, 'can_manage': can_manage, 'posts': club.posts.filter(is_public=True), 'recruitments': club.recruitments.filter(is_open=True, opens_at__lte=now, closes_at__gte=now)})


@student_required
@require_POST
def club_apply(request, pk):
    now = timezone.now()
    recruitment = get_object_or_404(Recruitment, pk=pk, club__is_public=True, is_open=True, opens_at__lte=now, closes_at__gte=now)
    answer = request.POST.get('answer', '').strip()
    if not answer or len(answer) > 3000:
        messages.error(request, '지원 내용을 1~3000자로 입력해 주세요.')
    else:
        try:
            with transaction.atomic():
                Application.objects.create(recruitment=recruitment, applicant=request.user, answers={'answer': answer})
            messages.success(request, '지원서가 제출되었습니다.')
        except IntegrityError:
            messages.error(request, '이미 지원한 모집입니다.')
    return redirect('club-detail', slug=recruitment.club.slug)


@student_required
def club_applications(request, slug):
    club = get_object_or_404(Club, slug=slug)
    if not request.user.is_superuser and not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists():
        return HttpResponseForbidden('권한이 없습니다.')
    applications = Application.objects.filter(recruitment__club=club).select_related('applicant', 'recruitment')
    return render(request, 'applications.html', {'club': club, 'applications': applications})


def finder(request):
    visibility = Q(public_approval='APPROVED')
    if request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified:
        visibility |= Q(owner=request.user)
    posts = FinderPost.objects.filter(visibility, status='ACTIVE')
    q = request.GET.get('q', '')[:120]
    posts = posts.filter(Q(title__icontains=q) | Q(category__icontains=q))
    for field in ('kind', 'category', 'color'):
        value = request.GET.get(field, '')[:50]
        if value and (field != 'kind' or value in ('lost', 'found')):
            posts = posts.filter(**{field: value})
    page = Paginator(posts.prefetch_related('images').order_by('-created_at', '-pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'finder.html', {'posts': page, 'page': page, 'q': q})


def finder_detail(request, pk):
    visibility = Q(public_approval='APPROVED', status='ACTIVE')
    if request.user.is_authenticated and request.user.is_active and request.user.email_verified and request.user.student_active:
        visibility |= Q(owner=request.user)
    post = get_object_or_404(FinderPost.objects.filter(visibility), pk=pk)
    return render(request, 'finder_detail.html', {'post': post})


@student_required
def finder_new(request):
    form = FinderForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        try:
            save_post_with_images(form, request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            return redirect('finder')
    return render(request, 'form.html', {'title': '분실·습득물 등록', 'form': form})


@student_required
def finder_matches(request, pk):
    post = get_object_or_404(FinderPost, pk=pk, owner=request.user, status='ACTIVE')
    candidates = FinderPost.objects.filter(Q(public_approval='APPROVED') | Q(owner=request.user), status='ACTIVE').exclude(kind=post.kind).exclude(pk=post.pk)
    matches = sorted(((score_match(post, candidate), candidate) for candidate in candidates), key=lambda item: (-item[0], str(item[1].pk)))
    return render(request, 'matches.html', {'matches': [item for item in matches if item[0] >= 70][:20]})


@student_required
@require_POST
def market_delete(request, pk):
    with transaction.atomic():
        post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk, owner=request.user)
        if post.status != MarketPost.Status.AVAILABLE:
            return HttpResponseForbidden('판매 중인 게시물만 삭제할 수 있습니다.')
        post.delete()
    return redirect('market')


@student_required
def finder_edit(request, pk):
    if request.method == 'POST':
        with transaction.atomic():
            post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk, owner=request.user)
            if post.status != 'ACTIVE':
                return HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')
            form = FinderForm(request.POST, instance=post)
            if form.is_valid():
                post = form.save(commit=False)
                post.public_approval = 'PENDING'
                post.save()
                return redirect('finder')
        return render(request, 'form.html', {'title': '분실·습득물 수정', 'form': form})
    post = get_object_or_404(FinderPost, pk=pk, owner=request.user)
    if post.status != 'ACTIVE':
        return HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')
    form = FinderForm(instance=post)
    return render(request, 'form.html', {'title': '분실·습득물 수정', 'form': form})


@student_required
@require_POST
def finder_delete(request, pk):
    get_object_or_404(FinderPost, pk=pk, owner=request.user).delete()
    return redirect('finder')


@student_required
@require_POST
def finder_close(request, pk):
    with transaction.atomic():
        post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk, owner=request.user)
        if post.status != 'ACTIVE':
            return HttpResponseForbidden('이미 종료된 게시물입니다.')
        post.status = 'CLOSED'
        post.save(update_fields=['status'])
    return redirect('me')


def admin_required(view):
    @login_required
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not (request.user.is_superuser and request.user.is_active and request.user.email_verified and request.user.student_active):
            return HttpResponseForbidden('관리자 권한이 필요합니다.')
        return view(request, *args, **kwargs)
    return wrapped


@admin_required
def management(request):
    from .models import Invitation, Report
    pending_posts = list(FinderPost.objects.filter(public_approval='PENDING', status='ACTIVE')[:100])
    for post in pending_posts:
        post.review_token = finder_review_token(post)
    return render(request, 'management.html', {'invitations': Invitation.objects.order_by('-expires_at')[:100], 'pending_posts': pending_posts, 'reports': Report.objects.filter(status__in=['OPEN', 'REVIEWED'])[:100], 'pending_media': MediaAsset.objects.filter(moderation='PENDING')[:100], 'accounts': User.objects.order_by('-date_joined')[:100], 'clubs': Club.objects.order_by('name')[:100]})


@admin_required
@require_POST
def admin_issue_invite(request):
    from .services import issue_invitation
    _, code = issue_invitation(request.user)
    response = render(request, 'issued_invitation.html', {'code': code})
    response['Cache-Control'] = 'no-store'
    return response


@admin_required
@require_POST
def admin_revoke_invite(request, pk):
    from .models import AuditLog, Invitation
    with transaction.atomic():
        invitation = get_object_or_404(Invitation.objects.select_for_update(), pk=pk)
        if not invitation.redeemed_at and not invitation.revoked_at:
            invitation.revoked_at = timezone.now()
            invitation.save(update_fields=['revoked_at'])
            AuditLog.objects.create(actor=request.user, action='invitation.revoked', entity_type='invitation', entity_id=str(pk))
    return redirect('management')


@admin_required
@require_POST
def admin_review_finder(request, pk):
    from .models import AuditLog
    decision = request.POST.get('decision')
    if decision not in ('APPROVED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk)
        if post.public_approval != 'PENDING' or post.status != 'ACTIVE' or not compare_digest(request.POST.get('review_token', ''), finder_review_token(post)):
            return HttpResponse('게시물이 변경되었습니다. 다시 확인해 주세요.', status=409)
        post.public_approval = decision
        post.save(update_fields=['public_approval'])
        AuditLog.objects.create(actor=request.user, action='finder.' + decision.lower(), entity_type='finder', entity_id=str(pk))
    return redirect('management')


def finder_review_token(post):
    import hashlib
    import json
    values = [str(post.pk), post.kind, post.title, post.category, post.color, post.general_location, post.occurred_at.isoformat()]
    return hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def club_can_manage(user, club):
    return user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()


@admin_required
def admin_club_new(request):
    from .forms import ClubForm
    from .models import AuditLog
    form = ClubForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            club = form.save()
            AuditLog.objects.create(actor=request.user, action='club.created', entity_type='club', entity_id=str(club.pk))
        return redirect('management')
    return render(request, 'form.html', {'title': '동아리 만들기', 'form': form})


@student_required
def club_manage(request, slug):
    from .forms import ClubForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    form = ClubForm(request.POST or None, instance=club)
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            club = form.save()
            AuditLog.objects.create(actor=request.user, action='club.updated', entity_type='club', entity_id=str(club.pk))
        return redirect('club-manage', slug=club.slug)
    return render(request, 'club_manage.html', {'club': club, 'form': form})


@student_required
def club_add_content(request, slug, kind):
    from .forms import ClubPostForm, RecruitmentForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    form_class = {'post': ClubPostForm, 'recruitment': RecruitmentForm}.get(kind)
    if form_class is None:
        return HttpResponseForbidden('잘못된 요청입니다.')
    form = form_class(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            item = form.save(commit=False)
            item.club = club
            if kind == 'post':
                item.author = request.user
            item.save()
            AuditLog.objects.create(actor=request.user, action='club.' + kind + '.created', entity_type=kind, entity_id=str(item.pk))
        return redirect('club-manage', slug=club.slug)
    return render(request, 'form.html', {'title': '활동 또는 모집 등록', 'form': form})


@student_required
@require_POST
def club_application_status(request, slug, pk):
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    status = request.POST.get('status')
    if status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 상태입니다.')
    with transaction.atomic():
        application = get_object_or_404(Application.objects.select_for_update(), pk=pk, recruitment__club=club)
        if application.status in ('CANCELLED', 'ACCEPTED', 'REJECTED'):
            return HttpResponseForbidden('종료된 지원입니다.')
        application.status = status
        application.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='application.' + status.lower(), entity_type='application', entity_id=str(pk))
    return redirect('club-applications', slug=slug)


@student_required
def report_create(request):
    from .forms import ReportForm
    from .models import AuditLog, ClubPost
    form = ReportForm(request.POST or None, initial={'target_type': request.GET.get('target_type', ''), 'target_id': request.GET.get('target_id', '')})
    if request.method == 'POST' and form.is_valid():
        target_type, target_id = form.cleaned_data['target_type'], form.cleaned_data['target_id']
        try:
            if target_type == 'market':
                target = MarketPost.objects.filter(pk=target_id).first()
                owner_id = target.owner_id if target else None
            elif target_type == 'finder':
                target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()
                owner_id = target.owner_id if target else None
            else:
                target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()
                owner_id = target.author_id if target else None
        except (ValueError, ValidationError):
            owner_id = None
        if owner_id is None or owner_id == request.user.pk:
            form.add_error('target_id', '신고할 수 없는 대상입니다.')
            return render(request, 'form.html', {'title': '신고하기', 'form': form}, status=400)
        with transaction.atomic():
            report = form.save(commit=False)
            if target_type == 'club_post':
                report.target_id = str(target.public_id)
            report.reporter = request.user
            report.save()
            AuditLog.objects.create(actor=request.user, action='report.created', entity_type='report', entity_id=str(report.pk))
        return render(request, 'message.html', {'title': '신고가 접수되었습니다', 'message': '관리자가 확인합니다.'})
    return render(request, 'form.html', {'title': '신고하기', 'form': form})


@admin_required
@require_POST
def admin_report_status(request, pk):
    from .models import AuditLog, Report
    status = request.POST.get('status')
    if status not in ('REVIEWED', 'RESOLVED'):
        return HttpResponseForbidden('잘못된 상태입니다.')
    with transaction.atomic():
        report = get_object_or_404(Report.objects.select_for_update(), pk=pk)
        report.status = status
        report.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='report.' + status.lower(), entity_type='report', entity_id=str(pk))
    return redirect('management')


def save_post_with_images(form, request):
    from . import media
    import logging
    uploads = request.FILES.getlist('images')
    if len(uploads) > 4:
        raise ValidationError('이미지는 최대 4장까지 등록할 수 있습니다.')
    sanitized = [media.sanitize(upload) for upload in uploads]
    stored = []
    try:
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            for data, content_type in sanitized:
                key = media.put(data, content_type)
                stored.append(key)
                MediaAsset.objects.create(owner=request.user, storage_key=key, content_type=content_type, size=len(data), **({'market_post': post} if isinstance(post, MarketPost) else {'finder_post': post}))
        return post
    except Exception:
        for key in stored:
            try:
                media.delete(key)
            except Exception:
                logging.getLogger(__name__).exception('Failed to clean up uncommitted image')
        raise


def image_read(request, pk):
    from . import media
    asset = get_object_or_404(MediaAsset.objects.select_related('market_post', 'finder_post'), pk=pk)
    user = request.user
    owner_or_admin = user.is_authenticated and user.is_active and user.email_verified and user.student_active and (user.pk == asset.owner_id or user.is_superuser)
    public_market = asset.market_post_id and asset.market_post.owner_id == asset.owner_id
    public_finder = asset.finder_post_id and asset.finder_post.owner_id == asset.owner_id and asset.finder_post.public_approval == 'APPROVED' and asset.finder_post.status == 'ACTIVE'
    if not owner_or_admin and not (asset.moderation == 'APPROVED' and (public_market or public_finder)):
        from django.http import Http404
        raise Http404
    response = HttpResponse(media.get(asset.storage_key), content_type=asset.content_type)
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


@admin_required
@require_POST
def admin_review_media(request, pk):
    from .models import AuditLog
    decision = request.POST.get('decision')
    if decision not in ('APPROVED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        asset = get_object_or_404(MediaAsset.objects.select_for_update(), pk=pk, moderation='PENDING')
        asset.moderation = decision
        asset.save(update_fields=['moderation'])
        AuditLog.objects.create(actor=request.user, action='media.' + decision.lower(), entity_type='media', entity_id=str(pk))
    return redirect('management')


def resend_verification(request):
    from .forms import EmailOnlyForm
    form = EmailOnlyForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = User.objects.filter(email__iexact=form.cleaned_data['email'], email_verified=False, is_active=True).first()
        if user:
            token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
            url = request.build_absolute_uri(reverse('verify-email', args=[token]))
            send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {url}', None, [user.email])
        return render(request, 'message.html', {'title': '이메일을 확인해 주세요', 'message': '해당 계정이 있다면 확인 메일을 보냈습니다.'})
    return render(request, 'form.html', {'title': '인증 메일 다시 받기', 'form': form})


@admin_required
@require_POST
def admin_user_status(request, pk):
    from .models import AuditLog
    action = request.POST.get('action')
    if action not in ('suspend', 'unsuspend') or request.user.pk == pk:
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        user = get_object_or_404(User.objects.select_for_update(), pk=pk)
        if (action == 'suspend') == (not user.is_active):
            return HttpResponseForbidden('이미 해당 상태입니다.')
        user.is_active = action == 'unsuspend'
        user.session_version += 1
        user.save(update_fields=['is_active', 'session_version'])
        AuditLog.objects.create(actor=request.user, action='user.' + action, entity_type='user', entity_id=str(pk))
    return redirect('management')


@admin_required
@require_POST
def admin_club_member(request, slug):
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    username = request.POST.get('username', '')[:150]
    role = request.POST.get('role')
    if role not in ('owner', 'manager', 'member'):
        return HttpResponseForbidden('잘못된 역할입니다.')
    member = get_object_or_404(User, username=username, is_active=True, email_verified=True, student_active=True)
    with transaction.atomic():
        ClubMember.objects.update_or_create(club=club, user=member, defaults={'role': role})
        AuditLog.objects.create(actor=request.user, action='club.member_role_changed', entity_type='club', entity_id=str(club.pk))
    return redirect('club-manage', slug=slug)


@student_required
def club_edit_recruitment(request, slug, pk):
    from .forms import RecruitmentForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    with transaction.atomic():
        item = get_object_or_404(Recruitment.objects.select_for_update(), pk=pk, club=club)
        form = RecruitmentForm(request.POST or None, instance=item)
        if request.method == 'POST' and form.is_valid():
            form.save()
            AuditLog.objects.create(actor=request.user, action='recruitment.updated', entity_type='recruitment', entity_id=str(item.pk))
            return redirect('club-manage', slug=club.slug)
    return render(request, 'form.html', {'title': '모집 공고 수정', 'form': form})
