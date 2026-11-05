"""JSON endpoints for the Django app; unsafe requests still require Django CSRF tokens."""
import json
import uuid
from functools import wraps
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .forms import MarketForm, FinderForm
from .models import Application, Club, ClubMember, FinderPost, MarketPost, Recruitment, Reservation
from .services import DomainError, by_public_id, redeem_invitation, reserve, score_match


def error(code, message, status):
    return JsonResponse({'code': code, 'message': message, 'requestId': uuid.uuid4().hex}, status=status)


def body(request):
    if request.content_type != 'application/json':
        raise ValueError('content type')
    if len(request.body) > 16384:
        raise ValueError('body too large')
    data = json.loads(request.body)
    if not isinstance(data, dict):
        raise ValueError('not an object')
    return data


def endpoint(methods, auth=False, admin=False):
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                return error('METHOD_NOT_ALLOWED', '지원하지 않는 요청입니다.', 405)
            if auth:
                if not request.user.is_authenticated:
                    return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
                if not (request.user.is_active and request.user.email_verified and request.user.student_active):
                    return error('FORBIDDEN', '학생 인증이 필요합니다.', 403)
                if admin and not request.user.is_superuser:
                    return error('FORBIDDEN', '관리자 권한이 필요합니다.', 403)
            try:
                return view(request, *args, **kwargs)
            except (ValueError, TypeError, json.JSONDecodeError, ValidationError):
                return error('INVALID_INPUT', '입력값을 확인해 주세요.', 400)
        return wrapped
    return decorator


def student(request):
    u = request.user
    return u.is_authenticated and u.is_active and u.email_verified and u.student_active


def auth_error(request):
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    if not student(request):
        return error('FORBIDDEN', '학생 인증이 필요합니다.', 403)


def market_data(post):
    return {'id': str(post.pk), 'title': post.title, 'description': post.description, 'price': post.price, 'category': post.category, 'status': post.status, 'createdAt': post.created_at.isoformat()}


def finder_data(post):
    return {'id': str(post.pk), 'kind': post.kind, 'title': post.title, 'category': post.category, 'color': post.color, 'generalLocation': post.general_location, 'occurredAt': post.occurred_at.isoformat(), 'status': post.status}


def finder_form_data(data):
    return {'kind': data.get('kind'), 'title': data.get('title'), 'category': data.get('category'), 'color': data.get('color'), 'general_location': data.get('generalLocation', data.get('general_location')), 'occurred_at': data.get('occurredAt', data.get('occurred_at'))}


def page_number(request):
    value = request.GET.get('page', '1')
    return min(int(value), 10000) if value.isdecimal() and len(value) <= 5 and int(value) > 0 else 1


@endpoint(['GET'])
def me(request):
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    u = request.user
    response = JsonResponse({'user': {'id': u.legacy_auth_id or str(u.pk), 'name': u.first_name or u.username, 'nickname': u.first_name or u.username, 'email': u.email, 'emailVerified': u.email_verified, 'studentActive': u.student_active, 'role': 'admin' if u.is_superuser else 'student', 'status': 'ACTIVE_STUDENT' if u.student_active else 'VERIFIED_PENDING_INVITE' if u.email_verified else 'UNVERIFIED_EMAIL'}})
    response['Cache-Control'] = 'no-store'
    return response


@endpoint(['POST'])
def redeem(request):
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    code = body(request).get('code', '')
    if not isinstance(code, str) or len(code) > 128:
        raise ValueError('code')
    ok, message = redeem_invitation(request.user, code)
    return JsonResponse({'ok': True}) if ok else error('INVALID_INVITATION', message, 400)


@endpoint(['GET', 'POST'])
def market_collection(request):
    if request.method == 'POST':
        denied = auth_error(request)
        if denied is not None: return denied
        data = body(request)
        form = MarketForm(data)
        if not form.is_valid(): return error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            attach_images(request.user, post, data.get('imageIds', []))
        return JsonResponse({'post': market_data(post)}, status=201)
    query = MarketPost.objects.all()
    q = request.GET.get('q', '')[:120]
    if q: query = query.filter(title__icontains=q)
    if request.GET.get('category'): query = query.filter(category=request.GET['category'][:50])
    if request.GET.get('status') in MarketPost.Status.values: query = query.filter(status=request.GET['status'])
    for name, lookup in [('minPrice', 'price__gte'), ('maxPrice', 'price__lte')]:
        value = request.GET.get(name, '')
        if value.isdecimal() and len(value) <= 9: query = query.filter(**{lookup: int(value)})
    page = page_number(request)
    posts = list(query.order_by('-created_at', '-pk')[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'posts': [{k: v for k, v in market_data(post).items() if k != 'description'} for post in posts[:20]], 'hasNext': len(posts) > 20, 'page': page})


@endpoint(['GET', 'PATCH', 'DELETE'])
def market_item(request, pk):
    if request.method == 'GET':
        post = MarketPost.objects.filter(pk=pk).first()
        if not post:
            return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        data = market_data(post)
        if not student(request):
            data.pop('description', None)
        return JsonResponse({'post': data})
    denied = auth_error(request)
    if denied is not None: return denied
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().filter(pk=pk).first()
        if post is None: return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        if post.owner_id != request.user.pk: return error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)
        if post.status != 'AVAILABLE': return error('CONFLICT', '판매 중인 상품만 변경할 수 있습니다.', 409)
        if request.method == 'DELETE':
            post.delete()
            return JsonResponse({'ok': True})
        form = MarketForm(body(request), instance=post)
        if not form.is_valid(): return error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)
        form.save()
        return JsonResponse({'post': market_data(post)})


@endpoint(['POST'], auth=True)
def market_reserve(request, pk):
    if not MarketPost.objects.filter(pk=pk).exists(): return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
    try:
        reserve(pk, request.user)
    except DomainError:
        return error('CONFLICT', '예약할 수 없습니다.', 409)
    return JsonResponse({'ok': True}, status=201)


@endpoint(['PATCH'], auth=True)
def market_status(request, pk):
    action = body(request).get('action')
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().filter(pk=pk).first()
        if post is None: return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        active = post.reservations.filter(status='ACTIVE').first()
        if not active or post.status != 'RESERVED': return error('CONFLICT', '변경할 예약이 없습니다.', 409)
        if action == 'complete' and post.owner_id == request.user.pk:
            post.status, active.status = 'COMPLETED', 'COMPLETED'
        elif action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id):
            post.status, active.status = 'AVAILABLE', 'CANCELLED'
        else:
            return error('FORBIDDEN', '권한이 없습니다.', 403)
        post.save(update_fields=['status'])
        active.save(update_fields=['status'])
    return JsonResponse({'post': market_data(post)})


@endpoint(['GET', 'POST'])
def finder_collection(request):
    if request.method == 'POST':
        denied = auth_error(request)
        if denied is not None: return denied
        data = body(request)
        form = FinderForm(finder_form_data(data))
        if not form.is_valid(): return error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            attach_images(request.user, post, data.get('imageIds', []))
        return JsonResponse({'post': finder_data(post)}, status=201)
    allowed = Q(public_approval='APPROVED')
    if student(request): allowed |= Q(owner=request.user)
    query = FinderPost.objects.filter(allowed, status='ACTIVE')
    for field in ('kind', 'category', 'color'):
        value = request.GET.get(field, '')[:50]
        if value: query = query.filter(**{field: value})
    q = request.GET.get('q', '')[:120]
    if q: query = query.filter(Q(title__icontains=q) | Q(category__icontains=q))
    page = page_number(request)
    posts = list(query.order_by('-created_at', '-pk')[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'posts': [finder_data(post) for post in posts[:20]], 'hasNext': len(posts) > 20, 'page': page})


@endpoint(['GET', 'PATCH', 'DELETE'])
def finder_item(request, pk):
    if request.method == 'GET':
        allowed = Q(public_approval='APPROVED', status='ACTIVE')
        if student(request): allowed |= Q(owner=request.user)
        post = FinderPost.objects.filter(allowed, pk=pk).first()
        return JsonResponse({'post': finder_data(post)}) if post else error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
    denied = auth_error(request)
    if denied is not None: return denied
    with transaction.atomic():
        post = FinderPost.objects.select_for_update().filter(pk=pk).first()
        if not post: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
        if post.owner_id != request.user.pk: return error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)
        if request.method == 'DELETE':
            post.delete()
            return JsonResponse({'ok': True})
        data = body(request)
        if post.status != 'ACTIVE': return error('CONFLICT', '종료된 게시물입니다.', 409)
        if data == {'action': 'close'}:
            post.status = 'CLOSED'
            post.save(update_fields=['status'])
            return JsonResponse({'ok': True})
        form = FinderForm(finder_form_data(data), instance=post)
        if not form.is_valid(): return error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)
        changed = form.save(commit=False)
        changed.public_approval = 'PENDING'
        changed.save()
        return JsonResponse({'post': finder_data(changed)})


@endpoint(['GET'], auth=True)
def finder_matches(request, pk):
    source = FinderPost.objects.filter(pk=pk, owner=request.user, status='ACTIVE').first()
    if not source: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
    candidates = FinderPost.objects.filter(Q(public_approval='APPROVED') | Q(owner=request.user), status='ACTIVE').exclude(kind=source.kind).exclude(pk=pk)
    matches = sorted(((score_match(source, item), item) for item in candidates), key=lambda item: (-item[0], str(item[1].pk)))
    return JsonResponse({'matches': [{'score': score, 'post': finder_data(post)} for score, post in matches if score >= 70][:20]})


@endpoint(['GET'])
def club_collection(request):
    clubs = Club.objects.filter(is_public=True).order_by('name', 'pk')
    page = page_number(request)
    rows = list(clubs[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'clubs': [{'id': str(c.pk), 'slug': c.slug, 'name': c.name, 'category': c.category, 'introduction': c.introduction} for c in rows[:20]], 'hasNext': len(rows) > 20, 'page': page})


@endpoint(['GET', 'POST', 'PATCH'], auth=True)
def club_applications(request, pk):
    club = lookup_club(pk)
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    if not club.is_public and not _club_manage(request.user, club):
        return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    if request.method == 'GET':
        if request.GET.get('mine') == '1':
            apps = Application.objects.filter(recruitment__club=club, applicant=request.user).select_related('recruitment')
            return JsonResponse({'applications': [{'recruitmentId': str(a.recruitment.public_id), 'status': a.status} for a in apps]})
        if not request.user.is_superuser and not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists():
            return error('FORBIDDEN', '권한이 없습니다.', 403)
        apps = Application.objects.filter(recruitment__club=club).select_related('applicant', 'recruitment')[:100]
        return JsonResponse({'applications': [{'id': str(a.public_id), 'recruitmentId': str(a.recruitment.public_id), 'recruitmentTitle': a.recruitment.title, 'applicantName': a.applicant.first_name or a.applicant.username, 'answers': a.answers, 'status': a.status, 'createdAt': a.created_at.isoformat()} for a in apps]})
    data = body(request)
    if request.method == 'PATCH':
        from .models import AuditLog
        if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
        status = data.get('status')
        if status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED'):
            return error('INVALID_INPUT', '지원 상태를 확인해 주세요.', 400)
        with transaction.atomic():
            app = by_public_id(Application.objects.select_for_update().filter(recruitment__club=club), data.get('applicationId')).first()
            if not app: return error('NOT_FOUND', '지원서를 찾을 수 없습니다.', 404)
            if app.status in ('CANCELLED', 'ACCEPTED', 'REJECTED'): return error('CONFLICT', '종료된 지원입니다.', 409)
            app.status = status
            app.save(update_fields=['status'])
            AuditLog.objects.create(actor=request.user, action='application.' + status.lower(), entity_type='application', entity_id=str(app.pk))
        return JsonResponse({'ok': True})
    now = timezone.now()
    recruitment = by_public_id(Recruitment.objects.filter(club=club, club__is_public=True, is_open=True, opens_at__lte=now, closes_at__gt=now), data.get('recruitmentId')).first()
    answer = data.get('answer', '')
    if not recruitment or not isinstance(answer, str) or not answer.strip() or len(answer) > 3000:
        return error('INVALID_INPUT', '지원 내용을 확인해 주세요.', 400)
    try:
        with transaction.atomic():
            app = Application.objects.create(recruitment=recruitment, applicant=request.user, answers={'answer': answer.strip()})
    except IntegrityError:
        return error('CONFLICT', '이미 지원한 모집입니다.', 409)
    return JsonResponse({'ok': True, 'application': {'id': str(app.public_id), 'status': app.status}}, status=201)


@endpoint(['GET'], auth=True, admin=True)
def admin_reports(request):
    from .models import Report
    rows = Report.objects.order_by('-created_at')[:100]
    return JsonResponse({'reports': [{'id': str(r.public_id), 'targetType': r.target_type, 'targetId': r.target_id, 'reason': r.reason, 'status': r.status, 'createdAt': r.created_at.isoformat()} for r in rows]})


@endpoint(['PATCH'], auth=True, admin=True)
def admin_report(request, pk):
    from .models import AuditLog, Report
    data = body(request)
    new_status = data.get('to', data.get('status'))
    previous = data.get('from')
    if new_status not in ('REVIEWED', 'RESOLVED'):
        return error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)
    if previous is not None and previous not in ('OPEN', 'REVIEWED'):
        return error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)
    with transaction.atomic():
        report = by_public_id(Report.objects.select_for_update(), pk).first()
        if not report: return error('NOT_FOUND', '신고를 찾을 수 없습니다.', 404)
        if report.status == 'RESOLVED' or report.status == new_status or (previous is not None and report.status != previous):
            return error('CONFLICT', '신고 상태가 변경되었습니다.', 409)
        report.status = new_status
        report.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='report.' + new_status.lower(), entity_type='report', entity_id=str(report.public_id))
    return JsonResponse({'status': report.status, 'report': {'id': str(report.public_id)}})


@endpoint(['POST'], auth=True, admin=True)
def admin_invites(request):
    from .services import issue_invitation
    invite, code = issue_invitation(request.user)
    response = JsonResponse({'invitation': {'id': str(invite.pk), 'expiresAt': invite.expires_at.isoformat()}, 'code': code}, status=201)
    response['Cache-Control'] = 'no-store'
    return response


@endpoint(['POST'], auth=True, admin=True)
def admin_revoke(request, pk):
    from .models import Invitation, AuditLog
    with transaction.atomic():
        invite = Invitation.objects.select_for_update().filter(pk=pk).first()
        if not invite: return error('NOT_FOUND', '초대 코드를 찾을 수 없습니다.', 404)
        if invite.redeemed_at or invite.revoked_at: return error('CONFLICT', '폐기할 수 없는 코드입니다.', 409)
        invite.revoked_at = timezone.now()
        invite.save(update_fields=['revoked_at'])
        AuditLog.objects.create(actor=request.user, action='invitation.revoked', entity_type='invitation', entity_id=str(pk))
    return JsonResponse({'ok': True})


@endpoint(['POST'], auth=True)
def reports(request):
    from .forms import ReportForm
    from .models import AuditLog, ClubPost
    data = body(request)
    form = ReportForm({'target_type': data.get('targetType'), 'target_id': data.get('targetId'), 'reason': data.get('reason')})
    if not form.is_valid(): return error('INVALID_INPUT', '신고 내용을 확인해 주세요.', 400)
    target_type, target_id = form.cleaned_data['target_type'], form.cleaned_data['target_id']
    try:
        if target_type == 'market':
            target = MarketPost.objects.filter(pk=target_id).first()
            owner = target.owner_id if target else None
        elif target_type == 'finder':
            target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()
            owner = target.owner_id if target else None
        else:
            target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()
            owner = target.author_id if target else None
    except (ValueError, ValidationError):
        owner = None
    if owner is None: return error('NOT_FOUND', '대상을 찾을 수 없습니다.', 404)
    if owner == request.user.pk: return error('FORBIDDEN', '자신의 글은 신고할 수 없습니다.', 403)
    if target_type == 'club_post':
        form.cleaned_data['target_id'] = str(target.public_id)
        form.instance.target_id = str(target.public_id)
    with transaction.atomic():
        report = form.save(commit=False)
        report.reporter = request.user
        report.save()
        AuditLog.objects.create(actor=request.user, action='report.created', entity_type='report', entity_id=str(report.pk))
    return JsonResponse({'id': str(report.public_id), 'report': {'id': str(report.public_id)}}, status=201)


from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
@endpoint(['GET'])
def csrf(request):
    return JsonResponse({'ok': True})


@endpoint(['POST'])
def sign_in(request):
    from django.contrib.auth import login
    from .forms import EmailLoginForm
    data = body(request)
    form = EmailLoginForm(request, data={'username': data.get('email', ''), 'password': data.get('password', '')})
    if not form.is_valid(): return error('INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해 주세요.', 401)
    login(request, form.get_user())
    return JsonResponse({'ok': True})


@endpoint(['POST'])
def sign_out(request):
    from django.contrib.auth import logout
    logout(request)
    return JsonResponse({'ok': True})


@endpoint(['POST'])
def sign_up(request):
    from django.core import signing
    from django.core.mail import send_mail
    from django.urls import reverse
    from .forms import RegisterForm
    data = body(request)
    form = RegisterForm({'username': data.get('name'), 'email': data.get('email'), 'password1': data.get('password'), 'password2': data.get('password')})
    if not form.is_valid(): return error('INVALID_INPUT', '가입 정보를 확인해 주세요.', 400)
    try:
        with transaction.atomic():
            user = form.save()
    except IntegrityError:
        return error('INVALID_INPUT', '가입 정보를 사용할 수 없습니다.', 400)
    token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
    send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {request.build_absolute_uri(reverse("verify-email", args=[token]))}', None, [user.email])
    return JsonResponse({'ok': True}, status=201)


def _club_manage(user, club):
    return user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()


def lookup_club(identifier):
    try:
        return Club.objects.filter(Q(pk=uuid.UUID(str(identifier))) | Q(slug=identifier)).first()
    except ValueError:
        return Club.objects.filter(slug=identifier).first()


@endpoint(['GET', 'PATCH'])
def club_item(request, pk):
    from .forms import ClubForm
    from .models import AuditLog
    club = lookup_club(pk)
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    if request.method == 'GET':
        if not club.is_public: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
        return JsonResponse({'club': {'id': str(club.pk), 'slug': club.slug, 'name': club.name, 'category': club.category, 'introduction': club.introduction, 'isPublic': club.is_public, 'posts': [{'id': str(p.public_id), 'title': p.title, 'content': p.content, 'createdAt': p.created_at.isoformat()} for p in club.posts.filter(is_public=True)[:100]], 'recruitments': [{'id': str(r.public_id), 'title': r.title, 'description': r.description, 'opensAt': r.opens_at.isoformat(), 'closesAt': r.closes_at.isoformat(), 'isOpen': r.is_open} for r in club.recruitments.order_by('opens_at')[:100]]}})
    denied = auth_error(request)
    if denied is not None: return denied
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    form = ClubForm({'slug': club.slug, 'name': data.get('name'), 'category': data.get('category'), 'introduction': data.get('introduction'), 'is_public': data.get('isPublic', False)}, instance=club)
    if not form.is_valid(): return error('INVALID_INPUT', '동아리 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        form.save()
        AuditLog.objects.create(actor=request.user, action='club.updated', entity_type='club', entity_id=str(club.pk))
    return JsonResponse({'ok': True})


@endpoint(['POST'], auth=True)
def club_post(request, pk):
    from .forms import ClubPostForm
    from .models import AuditLog
    club = lookup_club(pk)
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    form = ClubPostForm({'title': data.get('title'), 'content': data.get('content'), 'is_public': data.get('isPublic', False)})
    if not form.is_valid(): return error('INVALID_INPUT', '게시물을 확인해 주세요.', 400)
    post = form.save(commit=False)
    post.club, post.author = club, request.user
    with transaction.atomic():
        post.save()
        AuditLog.objects.create(actor=request.user, action='club.post.created', entity_type='club_post', entity_id=str(post.pk))
    return JsonResponse({'post': {'id': str(post.public_id)}}, status=201)


@endpoint(['POST', 'PATCH'], auth=True)
def club_recruitments(request, pk):
    from .forms import RecruitmentForm
    from .models import AuditLog
    club = lookup_club(pk)
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    instance = None
    if request.method == 'PATCH':
        instance = by_public_id(Recruitment.objects.filter(club=club), data.get('id')).first()
        if not instance: return error('NOT_FOUND', '모집 공고를 찾을 수 없습니다.', 404)
    form = RecruitmentForm({'title': data.get('title'), 'description': data.get('description'), 'opens_at': data.get('opensAt'), 'closes_at': data.get('closesAt'), 'is_open': data.get('isOpen', False)}, instance=instance)
    if not form.is_valid(): return error('INVALID_INPUT', '모집 정보를 확인해 주세요.', 400)
    recruitment = form.save(commit=False)
    recruitment.club = club
    with transaction.atomic():
        recruitment.save()
        AuditLog.objects.create(actor=request.user, action='club.recruitment.updated' if instance else 'club.recruitment.created', entity_type='recruitment', entity_id=str(recruitment.pk))
    return JsonResponse({'ok': True, 'recruitment': {'id': str(recruitment.public_id)}}, status=201 if request.method == 'POST' else 200)


@endpoint(['GET'], auth=True, admin=True)
def admin_finder_list(request):
    from .views import finder_review_token
    posts = FinderPost.objects.filter(public_approval='PENDING', status='ACTIVE').order_by('-created_at')[:100]
    return JsonResponse({'posts': [dict(finder_data(p), reviewToken=finder_review_token(p)) for p in posts]})


@endpoint(['PATCH'], auth=True, admin=True)
def admin_finder_item(request, pk):
    from hmac import compare_digest
    from .models import AuditLog
    from .views import finder_review_token
    data = body(request)
    decision, token = data.get('decision'), data.get('reviewToken')
    if decision not in ('APPROVED', 'REJECTED') or not isinstance(token, str):
        return error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        post = FinderPost.objects.select_for_update().filter(pk=pk).first()
        if not post: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
        if post.status != 'ACTIVE' or post.public_approval != 'PENDING' or not compare_digest(token, finder_review_token(post)):
            return error('CONFLICT', '게시물이 변경되었습니다. 다시 확인해 주세요.', 409)
        post.public_approval = decision
        post.save(update_fields=['public_approval'])
        AuditLog.objects.create(actor=request.user, action='finder.' + decision.lower(), entity_type='finder', entity_id=str(pk))
    return JsonResponse({'ok': True})


@endpoint(['GET'], auth=True, admin=True)
def admin_media_list(request):
    from .models import MediaAsset
    assets = MediaAsset.objects.filter(moderation='PENDING').order_by('-created_at')[:100]
    return JsonResponse({'media': [{'id': str(a.pk), 'contentType': a.content_type, 'size': a.size, 'marketPostId': str(a.market_post_id) if a.market_post_id else None, 'finderPostId': str(a.finder_post_id) if a.finder_post_id else None} for a in assets]})


@endpoint(['PATCH'], auth=True, admin=True)
def admin_media_item(request, pk):
    from .models import AuditLog, MediaAsset
    decision = body(request).get('decision')
    if decision not in ('APPROVED', 'REJECTED'): return error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        asset = MediaAsset.objects.select_for_update().filter(pk=pk).first()
        if not asset: return error('NOT_FOUND', '사진을 찾을 수 없습니다.', 404)
        if asset.moderation != 'PENDING': return error('CONFLICT', '이미 검토된 사진입니다.', 409)
        asset.moderation = decision
        asset.save(update_fields=['moderation'])
        AuditLog.objects.create(actor=request.user, action='media.' + decision.lower(), entity_type='media', entity_id=str(pk))
    return JsonResponse({'ok': True})


@endpoint(['POST'], auth=True, admin=True)
def admin_user_status(request, pk):
    from .models import AuditLog, User
    action = body(request).get('action')
    if action not in ('suspend', 'unsuspend'): return error('FORBIDDEN', '요청할 수 없습니다.', 403)
    with transaction.atomic():
        users = User.objects.select_for_update()
        user = users.filter(legacy_auth_id=str(pk)).first()
        if user is None and str(pk).isdecimal() and len(str(pk)) <= 18:
            user = users.filter(pk=int(pk)).first()
        if not user: return error('NOT_FOUND', '회원을 찾을 수 없습니다.', 404)
        if user.pk == request.user.pk: return error('FORBIDDEN', '자신의 계정은 정지할 수 없습니다.', 403)
        if (action == 'suspend') == (not user.is_active): return error('CONFLICT', '이미 요청한 상태입니다.', 409)
        user.is_active = action == 'unsuspend'
        user.session_version += 1
        user.save(update_fields=['is_active', 'session_version'])
        AuditLog.objects.create(actor=request.user, action='user.' + action, entity_type='user', entity_id=user.legacy_auth_id or str(user.pk))
    return JsonResponse({'ok': True})


def attach_images(owner, post, ids):
    from .models import MediaAsset
    if not isinstance(ids, list) or len(ids) > 4:
        raise ValidationError('invalid images')
    try:
        keys = [uuid.UUID(str(item)) for item in ids]
    except (ValueError, TypeError, AttributeError):
        raise ValidationError('invalid images')
    if len(set(keys)) != len(keys):
        raise ValidationError('duplicate images')
    assets = list(MediaAsset.objects.select_for_update().filter(pk__in=keys, owner=owner, market_post__isnull=True, finder_post__isnull=True).order_by('pk'))
    if len(assets) != len(keys):
        raise ValidationError('images not available')
    for asset in assets:
        if isinstance(post, MarketPost):
            asset.market_post = post
            asset.save(update_fields=['market_post'])
        else:
            asset.finder_post = post
            asset.save(update_fields=['finder_post'])


@endpoint(['POST'], auth=True)
def media_upload(request):
    import logging
    from . import media
    from .models import MediaAsset
    if request.content_type != 'multipart/form-data' or len(request.FILES) != 1:
        return error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)
    upload = request.FILES.get('file')
    if upload is None: return error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)
    data, content_type = media.sanitize(upload)
    key = media.put(data, content_type)
    try:
        asset = MediaAsset.objects.create(owner=request.user, storage_key=key, content_type=content_type, size=len(data))
    except Exception:
        try:
            media.delete(key)
        except Exception:
            logging.getLogger(__name__).exception('Failed to clean up uncommitted image')
        raise
    return JsonResponse({'media': {'id': str(asset.pk), 'contentType': asset.content_type, 'size': asset.size}}, status=201)
