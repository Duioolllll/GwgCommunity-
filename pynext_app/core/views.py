# HTML 화면: 로그인·학생·운영자 권한에 따라 조회 범위를 제한하고 폼 저장·상태 전환 후 렌더링 또는 리다이렉트한다.
# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `request.user.is_authenticated`: 참일 때 `post.reservations.filter(status='ACTIVE').first()`, 거짓일 때 `None`를 선택한다.
# - 단락 평가 `request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified and club_can_manage(request.user, club)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not answer or len(answer) > 3000`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not request.user.is_superuser and (not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists())`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.user.is_authenticated and request.user.is_active and request.user.email_verified and request.user.student_active`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `user.is_authenticated and user.is_active and user.email_verified and user.student_active and (user.pk == asset.owner_id or user.is_superuser)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `asset.market_post_id and asset.market_post.owner_id == asset.owner_id`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `asset.finder_post_id and asset.finder_post.owner_id == asset.owner_id and (asset.finder_post.public_approval == 'APPROVED') and (asset.finder_post.status == 'ACTIVE')`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not owner_or_admin and (not (asset.moderation == 'APPROVED' and (public_market or public_finder)))`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `action not in ('suspend', 'unsuspend') or request.user.pk == pk`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not request.user.is_active or not request.user.email_verified or (not request.user.student_active)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `ok`: 참일 때 `messages.success(request, message)`, 거짓일 때 `messages.error(request, message)`를 선택한다.
# - 단락 평가 `value.isdecimal() and len(value) <= 9`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `active and request.user.pk in (post.owner_id, active.requester_id)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not active or post.status != MarketPost.Status.RESERVED`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `action == 'complete' and post.owner_id == request.user.pk`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `value and (field != 'kind' or value in ('lost', 'found'))`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not invitation.redeemed_at and (not invitation.revoked_at)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `post.public_approval != 'PENDING' or post.status != 'ACTIVE' or (not compare_digest(request.POST.get('review_token', ''), finder_review_token(post)))`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `owner_id is None or owner_id == request.user.pk`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `uploads`의 각 `upload`를 순회한다.
# - 단락 평가 `user.pk == asset.owner_id or user.is_superuser`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.method == 'POST' and form.is_valid()`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `field != 'kind' or value in ('lost', 'found')`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `candidates`의 각 `candidate`를 순회한다.
# - 단락 평가 `request.user.is_superuser and request.user.is_active and request.user.email_verified and request.user.student_active`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `asset.moderation == 'APPROVED' and (public_market or public_finder)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.POST or None`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `target`: 참일 때 `target.owner_id`, 거짓일 때 `None`를 선택한다.
# - 단락 평가 `public_market or public_finder`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `matches`의 각 `item`를 순회한다. `item[0] >= 70`가 참인 항목만 포함한다.
# - 조건식 `target`: 참일 때 `target.owner_id`, 거짓일 때 `None`를 선택한다.
# - 조건식 `target`: 참일 때 `target.author_id`, 거짓일 때 `None`를 선택한다.
# - 조건식 `isinstance(post, MarketPost)`: 참일 때 `{'market_post': post}`, 거짓일 때 `{'finder_post': post}`를 선택한다.
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


# 로그인과 활성 계정, 이메일 및 학생 인증을 요구하는 뷰 데코레이터다.
# 기능 `student_required`: FunctionDef 구문으로 이어지는 내부 처리를 실행한다.
def student_required(view):
    # 기능 `wrapped`: If 구문으로 이어지는 내부 처리를 실행한다.
    @login_required
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        # 조건 분기 `not request.user.is_active or not request.user.email_verified or (not request.user.student_active)`: 참이면 HttpResponseForbidden('이메일과 학생 인증이 필요합니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not request.user.is_active or not request.user.email_verified or not request.user.student_active:
            return HttpResponseForbidden('이메일과 학생 인증이 필요합니다.')
        return view(request, *args, **kwargs)
    return wrapped


# 기능 `home`: render(request, 'home.html')을 반환한다.
def home(request):
    return render(request, 'home.html')


# 가입 양식을 검증하고 사용자 생성 후 이메일 확인 링크를 발송한다.
# 기능 `register`: 먼저 `form = RegisterForm(request.POST or None)`로 상태 또는 조회 조건을 갱신한다.
def register(request):
    form = RegisterForm(request.POST or None)
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 Try 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        # 예외 경계: 본문을 시도하고 `IntegrityError` 발생 시 먼저 `form.add_error(None, '가입 정보를 사용할 수 없습니다.')`를 실행한다.
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


# 서명된 확인 토큰과 만료 시간을 검증한 뒤 이메일 인증 상태를 갱신한다.
# 기능 `verify_email`: Try 구문으로 이어지는 내부 처리를 실행한다.
def verify_email(request, token):
    # 예외 경계: 본문을 시도하고 `(signing.BadSignature, User.DoesNotExist, KeyError)` 발생 시 render(request, 'message.html', {'title': '확인 실패', 'message': '링크가 만료되었거나 유효하지 않습니다.'}, status=400)을 반환한다.
    try:
        data = signing.loads(token, salt='email-verification', max_age=86400)
        user = User.objects.get(pk=data['user'], email=data['email'], is_active=True)
    except (signing.BadSignature, User.DoesNotExist, KeyError):
        return render(request, 'message.html', {'title': '확인 실패', 'message': '링크가 만료되었거나 유효하지 않습니다.'}, status=400)
    user.email_verified = True
    user.save(update_fields=['email_verified'])
    return render(request, 'message.html', {'title': '이메일 확인 완료', 'message': '로그인한 후 초대 코드를 입력해 주세요.'})


# 로그인 사용자가 초대 코드를 제출하면 서비스에서 학생 인증을 시도한다.
# 기능 `invite`: If 구문으로 이어지는 내부 처리를 실행한다.
@login_required
def invite(request):
    # 조건 분기 `request.method == 'POST'`: 참이면 먼저 `code = request.POST.get('code', '')[:128]`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST':
        code = request.POST.get('code', '')[:128]
        ok, message = redeem_invitation(request.user, code)
        messages.success(request, message) if ok else messages.error(request, message)
        # 조건 분기 `ok`: 참이면 redirect('me')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if ok:
            return redirect('me')
    return render(request, 'invite.html')


# 내 게시물, 예약, 신청 및 관리 동아리를 모아 보여준다.
# 기능 `me`: render(request, 'me.html', {'market_posts': MarketPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'reservations': Reservation.objects.filter(requester=request.user).select_related('post').order_by('-created_at')[:20], 'finder_posts': FinderPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'applications': Application.objects.filter(applicant=request.user).select_related('recruitment__club')[:20], 'managed_clubs': ClubMember.objects.filter(user=request.user, role__in=['owner', 'manager']).select_related('club')})을 반환한다.
@login_required
def me(request):
    return render(request, 'me.html', {'market_posts': MarketPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'reservations': Reservation.objects.filter(requester=request.user).select_related('post').order_by('-created_at')[:20], 'finder_posts': FinderPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'applications': Application.objects.filter(applicant=request.user).select_related('recruitment__club')[:20], 'managed_clubs': ClubMember.objects.filter(user=request.user, role__in=['owner', 'manager']).select_related('club')})


# 검색어·분류·상태·가격 조건을 적용하고 중고 게시물을 페이지 단위로 보여준다.
# 기능 `market`: 먼저 `q = request.GET.get('q', '')[:120]`로 상태 또는 조회 조건을 갱신한다.
def market(request):
    q = request.GET.get('q', '')[:120]
    category, status = request.GET.get('category', '')[:50], request.GET.get('status', '')[:20]
    posts = MarketPost.objects.filter(title__icontains=q)
    # 조건 분기 `category`: 참이면 먼저 `posts = posts.filter(category=category)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if category:
        posts = posts.filter(category=category)
    # 조건 분기 `status in MarketPost.Status.values`: 참이면 먼저 `posts = posts.filter(status=status)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if status in MarketPost.Status.values:
        posts = posts.filter(status=status)
    # 반복 `(('min_price', 'price__gte'), ('max_price', 'price__lte'))`: 각 항목을 `(name, lookup)`에 담아 먼저 `value = request.GET.get(name, '')`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for name, lookup in (('min_price', 'price__gte'), ('max_price', 'price__lte')):
        value = request.GET.get(name, '')
        # 조건 분기 `value.isdecimal() and len(value) <= 9`: 참이면 먼저 `posts = posts.filter(**{lookup: int(value)})`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if value.isdecimal() and len(value) <= 9:
            posts = posts.filter(**{lookup: int(value)})
    page = Paginator(posts.prefetch_related('images').order_by('-created_at', '-pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'market.html', {'posts': page, 'page': page, 'q': q, 'categories': MarketPost.objects.order_by('category').values_list('category', flat=True).distinct()})


# 새 중고 게시물 작성과 이미지 저장을 처리한다.
# 기능 `market_new`: 먼저 `form = MarketForm(request.POST or None)`로 상태 또는 조회 조건을 갱신한다.
@student_required
def market_new(request):
    form = MarketForm(request.POST or None)
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 Try 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        # 예외 경계: 본문을 시도하고 `ValidationError` 발생 시 먼저 `form.add_error(None, exc)`를 실행한다. 예외가 없으면 redirect('market-detail', pk=post.pk)을 반환한다.
        try:
            post = save_post_with_images(form, request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            return redirect('market-detail', pk=post.pk)
    return render(request, 'form.html', {'title': '물품 등록', 'form': form})


# 중고 게시물 상세 화면을 처리한다.
# 기능 `market_detail`: 먼저 `post = get_object_or_404(MarketPost, pk=pk)`로 상태 또는 조회 조건을 갱신한다.
def market_detail(request, pk):
    post = get_object_or_404(MarketPost, pk=pk)
    active = post.reservations.filter(status='ACTIVE').first() if request.user.is_authenticated else None
    may_cancel = bool(active and request.user.pk in (post.owner_id, active.requester_id))
    return render(request, 'market_detail.html', {'post': post, 'may_cancel': may_cancel})


# 중고 게시물 수정 요청을 처리한다.
# 기능 `market_edit`: If 구문으로 이어지는 내부 처리를 실행한다.
@student_required
def market_edit(request, pk):
    # 조건 분기 `request.method == 'POST'`: 참이면 With 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST':
        with transaction.atomic():
            post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk, owner=request.user)
            # 조건 분기 `post.status != MarketPost.Status.AVAILABLE`: 참이면 HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if post.status != MarketPost.Status.AVAILABLE:
                return HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')
            form = MarketForm(request.POST, instance=post)
            # 조건 분기 `form.is_valid()`: 참이면 먼저 `form.save()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if form.is_valid():
                form.save()
                return redirect('market-detail', pk=post.pk)
        return render(request, 'form.html', {'title': '물품 수정', 'form': form})
    post = get_object_or_404(MarketPost, pk=pk, owner=request.user)
    # 조건 분기 `post.status != MarketPost.Status.AVAILABLE`: 참이면 HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if post.status != MarketPost.Status.AVAILABLE:
        return HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')
    form = MarketForm(instance=post)
    return render(request, 'form.html', {'title': '물품 수정', 'form': form})


# 중고 게시물 예약 요청을 처리한다.
# 기능 `market_reserve`: 먼저 `get_object_or_404(MarketPost, pk=pk)`를 실행한다.
@student_required
@require_POST
def market_reserve(request, pk):
    get_object_or_404(MarketPost, pk=pk)
    # 예외 경계: 본문을 시도하고 `DomainError` 발생 시 먼저 `messages.error(request, str(exc))`를 실행한다.
    try:
        reserve(pk, request.user)
        messages.success(request, '예약이 완료되었습니다.')
    except DomainError as exc:
        messages.error(request, str(exc))
    return redirect('market-detail', pk=pk)


# 중고 게시물의 거래 상태 변경 요청을 처리한다.
# 기능 `market_status`: With 구문으로 이어지는 내부 처리를 실행한다.
@student_required
@require_POST
def market_status(request, pk):
    with transaction.atomic():
        # 게시물 행을 잠근 상태에서 활성 예약과 게시물 상태를 함께 변경한다.
        post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk)
        active = post.reservations.filter(status='ACTIVE').first()
        action = request.POST.get('action')
        # 조건 분기 `not active or post.status != MarketPost.Status.RESERVED`: 참이면 HttpResponseForbidden('변경할 예약이 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not active or post.status != MarketPost.Status.RESERVED:
            return HttpResponseForbidden('변경할 예약이 없습니다.')
        # 조건 분기 `action == 'complete' and post.owner_id == request.user.pk`: 참이면 먼저 `post.status, active.status = ('COMPLETED', 'COMPLETED')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 If 구문으로 이어지는 내부 처리를 실행한다.
        if action == 'complete' and post.owner_id == request.user.pk:
            post.status, active.status = 'COMPLETED', 'COMPLETED'
        # 조건 분기 `action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id)`: 참이면 먼저 `post.status, active.status = ('AVAILABLE', 'CANCELLED')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 HttpResponseForbidden('권한이 없습니다.')을 반환한다.
        elif action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id):
            post.status, active.status = 'AVAILABLE', 'CANCELLED'
        else:
            return HttpResponseForbidden('권한이 없습니다.')
        post.save(update_fields=['status'])
        active.save(update_fields=['status'])
    return redirect('market-detail', pk=pk)


# 동아리 목록 화면을 처리한다.
# 기능 `clubs`: 먼저 `q = request.GET.get('q', '')[:120]`로 상태 또는 조회 조건을 갱신한다.
def clubs(request):
    q = request.GET.get('q', '')[:120]
    category = request.GET.get('category', '')[:50]
    clubs = Club.objects.filter(is_public=True).filter(Q(name__icontains=q) | Q(introduction__icontains=q))
    # 조건 분기 `category`: 참이면 먼저 `clubs = clubs.filter(category=category)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if category:
        clubs = clubs.filter(category=category)
    # 조건 분기 `request.GET.get('recruiting') == '1'`: 참이면 먼저 `now = timezone.now()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.GET.get('recruiting') == '1':
        now = timezone.now()
        clubs = clubs.filter(recruitments__is_open=True, recruitments__opens_at__lte=now, recruitments__closes_at__gte=now).distinct()
    page = Paginator(clubs.order_by('name', 'pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'clubs.html', {'clubs': page, 'page': page, 'q': q, 'categories': Club.objects.filter(is_public=True).order_by('category').values_list('category', flat=True).distinct()})


# 동아리 상세 화면을 처리한다.
# 기능 `club_detail`: 먼저 `club = get_object_or_404(Club, slug=slug, is_public=True)`로 상태 또는 조회 조건을 갱신한다.
def club_detail(request, slug):
    club = get_object_or_404(Club, slug=slug, is_public=True)
    now = timezone.now()
    can_manage = request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified and club_can_manage(request.user, club)
    return render(request, 'club_detail.html', {'club': club, 'can_manage': can_manage, 'posts': club.posts.filter(is_public=True), 'recruitments': club.recruitments.filter(is_open=True, opens_at__lte=now, closes_at__gte=now)})


# 동아리 모집에 대한 지원 요청을 처리한다.
# 기능 `club_apply`: 먼저 `now = timezone.now()`로 상태 또는 조회 조건을 갱신한다.
@student_required
@require_POST
def club_apply(request, pk):
    now = timezone.now()
    recruitment = get_object_or_404(Recruitment, pk=pk, club__is_public=True, is_open=True, opens_at__lte=now, closes_at__gte=now)
    answer = request.POST.get('answer', '').strip()
    # 조건 분기 `not answer or len(answer) > 3000`: 참이면 먼저 `messages.error(request, '지원 내용을 1~3000자로 입력해 주세요.')`를 실행한다. 거짓이면 Try 구문으로 이어지는 내부 처리를 실행한다.
    if not answer or len(answer) > 3000:
        messages.error(request, '지원 내용을 1~3000자로 입력해 주세요.')
    else:
        # 예외 경계: 본문을 시도하고 `IntegrityError` 발생 시 먼저 `messages.error(request, '이미 지원한 모집입니다.')`를 실행한다.
        try:
            with transaction.atomic():
                Application.objects.create(recruitment=recruitment, applicant=request.user, answers={'answer': answer})
            messages.success(request, '지원서가 제출되었습니다.')
        except IntegrityError:
            messages.error(request, '이미 지원한 모집입니다.')
    return redirect('club-detail', slug=recruitment.club.slug)


# 동아리 지원 목록 화면을 처리한다.
# 기능 `club_applications`: 먼저 `club = get_object_or_404(Club, slug=slug)`로 상태 또는 조회 조건을 갱신한다.
@student_required
def club_applications(request, slug):
    club = get_object_or_404(Club, slug=slug)
    # 조건 분기 `not request.user.is_superuser and (not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists())`: 참이면 HttpResponseForbidden('권한이 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not request.user.is_superuser and not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists():
        return HttpResponseForbidden('권한이 없습니다.')
    applications = Application.objects.filter(recruitment__club=club).select_related('applicant', 'recruitment')
    return render(request, 'applications.html', {'club': club, 'applications': applications})


# 분실물·습득물 목록 화면을 처리한다.
# 기능 `finder`: 먼저 `visibility = Q(public_approval='APPROVED')`로 상태 또는 조회 조건을 갱신한다.
def finder(request):
    visibility = Q(public_approval='APPROVED')
    # 조건 분기 `request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified`: 참이면 먼저 `visibility |= Q(owner=request.user)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified:
        visibility |= Q(owner=request.user)
    posts = FinderPost.objects.filter(visibility, status='ACTIVE')
    q = request.GET.get('q', '')[:120]
    posts = posts.filter(Q(title__icontains=q) | Q(category__icontains=q))
    # 반복 `('kind', 'category', 'color')`: 각 항목을 `field`에 담아 먼저 `value = request.GET.get(field, '')[:50]`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for field in ('kind', 'category', 'color'):
        value = request.GET.get(field, '')[:50]
        # 조건 분기 `value and (field != 'kind' or value in ('lost', 'found'))`: 참이면 먼저 `posts = posts.filter(**{field: value})`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if value and (field != 'kind' or value in ('lost', 'found')):
            posts = posts.filter(**{field: value})
    page = Paginator(posts.prefetch_related('images').order_by('-created_at', '-pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'finder.html', {'posts': page, 'page': page, 'q': q})


# 분실물·습득물 상세 화면을 처리한다.
# 기능 `finder_detail`: 먼저 `visibility = Q(public_approval='APPROVED', status='ACTIVE')`로 상태 또는 조회 조건을 갱신한다.
def finder_detail(request, pk):
    visibility = Q(public_approval='APPROVED', status='ACTIVE')
    # 조건 분기 `request.user.is_authenticated and request.user.is_active and request.user.email_verified and request.user.student_active`: 참이면 먼저 `visibility |= Q(owner=request.user)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.user.is_authenticated and request.user.is_active and request.user.email_verified and request.user.student_active:
        visibility |= Q(owner=request.user)
    post = get_object_or_404(FinderPost.objects.filter(visibility), pk=pk)
    return render(request, 'finder_detail.html', {'post': post})


# 분실물·습득물 작성 요청을 처리한다.
# 기능 `finder_new`: 먼저 `form = FinderForm(request.POST or None)`로 상태 또는 조회 조건을 갱신한다.
@student_required
def finder_new(request):
    form = FinderForm(request.POST or None)
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 Try 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        # 예외 경계: 본문을 시도하고 `ValidationError` 발생 시 먼저 `form.add_error(None, exc)`를 실행한다. 예외가 없으면 redirect('finder')을 반환한다.
        try:
            save_post_with_images(form, request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            return redirect('finder')
    return render(request, 'form.html', {'title': '분실·습득물 등록', 'form': form})


# 분실물과 습득물 사이의 후보 일치 결과를 처리한다.
# 기능 `finder_matches`: 먼저 `post = get_object_or_404(FinderPost, pk=pk, owner=request.user, status='ACTIVE')`로 상태 또는 조회 조건을 갱신한다.
@student_required
def finder_matches(request, pk):
    post = get_object_or_404(FinderPost, pk=pk, owner=request.user, status='ACTIVE')
    candidates = FinderPost.objects.filter(Q(public_approval='APPROVED') | Q(owner=request.user), status='ACTIVE').exclude(kind=post.kind).exclude(pk=post.pk)
    matches = sorted(((score_match(post, candidate), candidate) for candidate in candidates), key=lambda item: (-item[0], str(item[1].pk)))
    return render(request, 'matches.html', {'matches': [item for item in matches if item[0] >= 70][:20]})


# 중고 게시물 삭제 요청을 처리한다.
# 기능 `market_delete`: With 구문으로 이어지는 내부 처리를 실행한다.
@student_required
@require_POST
def market_delete(request, pk):
    with transaction.atomic():
        post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk, owner=request.user)
        # 조건 분기 `post.status != MarketPost.Status.AVAILABLE`: 참이면 HttpResponseForbidden('판매 중인 게시물만 삭제할 수 있습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.status != MarketPost.Status.AVAILABLE:
            return HttpResponseForbidden('판매 중인 게시물만 삭제할 수 있습니다.')
        post.delete()
    return redirect('market')


# 분실물·습득물 수정 요청을 처리한다.
# 기능 `finder_edit`: If 구문으로 이어지는 내부 처리를 실행한다.
@student_required
def finder_edit(request, pk):
    # 조건 분기 `request.method == 'POST'`: 참이면 With 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST':
        with transaction.atomic():
            post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk, owner=request.user)
            # 조건 분기 `post.status != 'ACTIVE'`: 참이면 HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if post.status != 'ACTIVE':
                return HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')
            form = FinderForm(request.POST, instance=post)
            # 조건 분기 `form.is_valid()`: 참이면 먼저 `post = form.save(commit=False)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if form.is_valid():
                post = form.save(commit=False)
                # 게시물 내용이 바뀌면 이전 공개 승인을 재사용하지 않는다.
                post.public_approval = 'PENDING'
                post.save()
                return redirect('finder')
        return render(request, 'form.html', {'title': '분실·습득물 수정', 'form': form})
    post = get_object_or_404(FinderPost, pk=pk, owner=request.user)
    # 조건 분기 `post.status != 'ACTIVE'`: 참이면 HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if post.status != 'ACTIVE':
        return HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')
    form = FinderForm(instance=post)
    return render(request, 'form.html', {'title': '분실·습득물 수정', 'form': form})


# 분실물·습득물 삭제 요청을 처리한다.
# 기능 `finder_delete`: 먼저 `get_object_or_404(FinderPost, pk=pk, owner=request.user).delete()`를 실행한다.
@student_required
@require_POST
def finder_delete(request, pk):
    get_object_or_404(FinderPost, pk=pk, owner=request.user).delete()
    return redirect('finder')


# 분실물·습득물 게시물 종료 요청을 처리한다.
# 기능 `finder_close`: With 구문으로 이어지는 내부 처리를 실행한다.
@student_required
@require_POST
def finder_close(request, pk):
    with transaction.atomic():
        post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk, owner=request.user)
        # 조건 분기 `post.status != 'ACTIVE'`: 참이면 HttpResponseForbidden('이미 종료된 게시물입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.status != 'ACTIVE':
            return HttpResponseForbidden('이미 종료된 게시물입니다.')
        post.status = 'CLOSED'
        post.save(update_fields=['status'])
    return redirect('me')


# 관리 권한 확인이 필요한 뷰에 적용하는 데코레이터다.
# 기능 `admin_required`: FunctionDef 구문으로 이어지는 내부 처리를 실행한다.
def admin_required(view):
    # 기능 `wrapped`: If 구문으로 이어지는 내부 처리를 실행한다.
    @login_required
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        # 조건 분기 `not (request.user.is_superuser and request.user.is_active and request.user.email_verified and request.user.student_active)`: 참이면 HttpResponseForbidden('관리자 권한이 필요합니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not (request.user.is_superuser and request.user.is_active and request.user.email_verified and request.user.student_active):
            return HttpResponseForbidden('관리자 권한이 필요합니다.')
        return view(request, *args, **kwargs)
    return wrapped


# 관리 화면을 처리한다.
# 기능 `management`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
def management(request):
    from .models import Invitation, Report
    pending_posts = list(FinderPost.objects.filter(public_approval='PENDING', status='ACTIVE')[:100])
    # 반복 `pending_posts`: 각 항목을 `post`에 담아 먼저 `post.review_token = finder_review_token(post)`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for post in pending_posts:
        post.review_token = finder_review_token(post)
    return render(request, 'management.html', {'invitations': Invitation.objects.order_by('-expires_at')[:100], 'pending_posts': pending_posts, 'reports': Report.objects.filter(status__in=['OPEN', 'REVIEWED'])[:100], 'pending_media': MediaAsset.objects.filter(moderation='PENDING')[:100], 'accounts': User.objects.order_by('-date_joined')[:100], 'clubs': Club.objects.order_by('name')[:100]})


# 관리자의 초대 코드 발급 요청을 처리한다.
# 기능 `admin_issue_invite`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
@require_POST
def admin_issue_invite(request):
    from .services import issue_invitation
    _, code = issue_invitation(request.user)
    response = render(request, 'issued_invitation.html', {'code': code})
    response['Cache-Control'] = 'no-store'
    return response


# 관리자의 초대 코드 철회 요청을 처리한다.
# 기능 `admin_revoke_invite`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
@require_POST
def admin_revoke_invite(request, pk):
    from .models import AuditLog, Invitation
    with transaction.atomic():
        invitation = get_object_or_404(Invitation.objects.select_for_update(), pk=pk)
        # 조건 분기 `not invitation.redeemed_at and (not invitation.revoked_at)`: 참이면 먼저 `invitation.revoked_at = timezone.now()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not invitation.redeemed_at and not invitation.revoked_at:
            invitation.revoked_at = timezone.now()
            invitation.save(update_fields=['revoked_at'])
            AuditLog.objects.create(actor=request.user, action='invitation.revoked', entity_type='invitation', entity_id=str(pk))
    return redirect('management')


# 관리자의 분실물 공개 심사 요청을 처리한다.
# 기능 `admin_review_finder`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
@require_POST
def admin_review_finder(request, pk):
    from .models import AuditLog
    decision = request.POST.get('decision')
    # 조건 분기 `decision not in ('APPROVED', 'REJECTED')`: 참이면 HttpResponseForbidden('잘못된 요청입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if decision not in ('APPROVED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk)
        # 관리자가 확인한 내용이 심사 전에 바뀌었으면 결정을 적용하지 않는다.
        # 조건 분기 `post.public_approval != 'PENDING' or post.status != 'ACTIVE' or (not compare_digest(request.POST.get('review_token', ''), finder_review_token(post)))`: 참이면 HttpResponse('게시물이 변경되었습니다. 다시 확인해 주세요.', status=409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.public_approval != 'PENDING' or post.status != 'ACTIVE' or not compare_digest(request.POST.get('review_token', ''), finder_review_token(post)):
            return HttpResponse('게시물이 변경되었습니다. 다시 확인해 주세요.', status=409)
        post.public_approval = decision
        post.save(update_fields=['public_approval'])
        AuditLog.objects.create(actor=request.user, action='finder.' + decision.lower(), entity_type='finder', entity_id=str(pk))
    return redirect('management')


# 심사 대상 분실물의 검토 토큰을 만든다.
# 기능 `finder_review_token`: Import 구문으로 이어지는 내부 처리를 실행한다.
def finder_review_token(post):
    import hashlib
    import json
    values = [str(post.pk), post.kind, post.title, post.category, post.color, post.general_location, post.occurred_at.isoformat()]
    return hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


# 사용자가 동아리를 관리할 수 있는지 확인한다.
# 기능 `club_can_manage`: user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()을 반환한다.
def club_can_manage(user, club):
    return user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()


# 관리자의 동아리 생성 요청을 처리한다.
# 기능 `admin_club_new`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
def admin_club_new(request):
    from .forms import ClubForm
    from .models import AuditLog
    form = ClubForm(request.POST or None)
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 With 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            club = form.save()
            AuditLog.objects.create(actor=request.user, action='club.created', entity_type='club', entity_id=str(club.pk))
        return redirect('management')
    return render(request, 'form.html', {'title': '동아리 만들기', 'form': form})


# 동아리 관리 화면을 처리한다.
# 기능 `club_manage`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@student_required
def club_manage(request, slug):
    from .forms import ClubForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    # 조건 분기 `not club_can_manage(request.user, club)`: 참이면 HttpResponseForbidden('권한이 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    form = ClubForm(request.POST or None, instance=club)
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 With 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            club = form.save()
            AuditLog.objects.create(actor=request.user, action='club.updated', entity_type='club', entity_id=str(club.pk))
        return redirect('club-manage', slug=club.slug)
    return render(request, 'club_manage.html', {'club': club, 'form': form})


# 동아리 콘텐츠 추가 요청을 처리한다.
# 기능 `club_add_content`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@student_required
def club_add_content(request, slug, kind):
    from .forms import ClubPostForm, RecruitmentForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    # 조건 분기 `not club_can_manage(request.user, club)`: 참이면 HttpResponseForbidden('권한이 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    form_class = {'post': ClubPostForm, 'recruitment': RecruitmentForm}.get(kind)
    # 조건 분기 `form_class is None`: 참이면 HttpResponseForbidden('잘못된 요청입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if form_class is None:
        return HttpResponseForbidden('잘못된 요청입니다.')
    form = form_class(request.POST or None)
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 With 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            item = form.save(commit=False)
            item.club = club
            # 조건 분기 `kind == 'post'`: 참이면 먼저 `item.author = request.user`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if kind == 'post':
                item.author = request.user
            item.save()
            AuditLog.objects.create(actor=request.user, action='club.' + kind + '.created', entity_type=kind, entity_id=str(item.pk))
        return redirect('club-manage', slug=club.slug)
    return render(request, 'form.html', {'title': '활동 또는 모집 등록', 'form': form})


# 동아리 지원 상태 변경 요청을 처리한다.
# 기능 `club_application_status`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@student_required
@require_POST
def club_application_status(request, slug, pk):
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    # 조건 분기 `not club_can_manage(request.user, club)`: 참이면 HttpResponseForbidden('권한이 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    status = request.POST.get('status')
    # 조건 분기 `status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED')`: 참이면 HttpResponseForbidden('잘못된 상태입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 상태입니다.')
    with transaction.atomic():
        application = get_object_or_404(Application.objects.select_for_update(), pk=pk, recruitment__club=club)
        # 조건 분기 `application.status in ('CANCELLED', 'ACCEPTED', 'REJECTED')`: 참이면 HttpResponseForbidden('종료된 지원입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if application.status in ('CANCELLED', 'ACCEPTED', 'REJECTED'):
            return HttpResponseForbidden('종료된 지원입니다.')
        application.status = status
        application.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='application.' + status.lower(), entity_type='application', entity_id=str(pk))
    return redirect('club-applications', slug=slug)


# 신고 작성 요청을 처리한다.
# 기능 `report_create`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@student_required
def report_create(request):
    from .forms import ReportForm
    from .models import AuditLog, ClubPost
    form = ReportForm(request.POST or None, initial={'target_type': request.GET.get('target_type', ''), 'target_id': request.GET.get('target_id', '')})
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 먼저 `target_type, target_id = (form.cleaned_data['target_type'], form.cleaned_data['target_id'])`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        target_type, target_id = form.cleaned_data['target_type'], form.cleaned_data['target_id']
        # 예외 경계: 본문을 시도하고 `(ValueError, ValidationError)` 발생 시 먼저 `owner_id = None`로 상태 또는 조회 조건을 갱신한다.
        try:
            # 조건 분기 `target_type == 'market'`: 참이면 먼저 `target = MarketPost.objects.filter(pk=target_id).first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 If 구문으로 이어지는 내부 처리를 실행한다.
            if target_type == 'market':
                target = MarketPost.objects.filter(pk=target_id).first()
                owner_id = target.owner_id if target else None
            # 조건 분기 `target_type == 'finder'`: 참이면 먼저 `target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 먼저 `target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()`로 상태 또는 조회 조건을 갱신한다.
            elif target_type == 'finder':
                target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()
                owner_id = target.owner_id if target else None
            else:
                target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()
                owner_id = target.author_id if target else None
        except (ValueError, ValidationError):
            owner_id = None
        # 조건 분기 `owner_id is None or owner_id == request.user.pk`: 참이면 먼저 `form.add_error('target_id', '신고할 수 없는 대상입니다.')`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if owner_id is None or owner_id == request.user.pk:
            form.add_error('target_id', '신고할 수 없는 대상입니다.')
            return render(request, 'form.html', {'title': '신고하기', 'form': form}, status=400)
        with transaction.atomic():
            report = form.save(commit=False)
            # 조건 분기 `target_type == 'club_post'`: 참이면 먼저 `report.target_id = str(target.public_id)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if target_type == 'club_post':
                report.target_id = str(target.public_id)
            report.reporter = request.user
            report.save()
            AuditLog.objects.create(actor=request.user, action='report.created', entity_type='report', entity_id=str(report.pk))
        return render(request, 'message.html', {'title': '신고가 접수되었습니다', 'message': '관리자가 확인합니다.'})
    return render(request, 'form.html', {'title': '신고하기', 'form': form})


# 관리자의 신고 상태 변경 요청을 처리한다.
# 기능 `admin_report_status`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
@require_POST
def admin_report_status(request, pk):
    from .models import AuditLog, Report
    status = request.POST.get('status')
    # 조건 분기 `status not in ('REVIEWED', 'RESOLVED')`: 참이면 HttpResponseForbidden('잘못된 상태입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if status not in ('REVIEWED', 'RESOLVED'):
        return HttpResponseForbidden('잘못된 상태입니다.')
    with transaction.atomic():
        report = get_object_or_404(Report.objects.select_for_update(), pk=pk)
        report.status = status
        report.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='report.' + status.lower(), entity_type='report', entity_id=str(pk))
    return redirect('management')


# 게시물 양식과 연결할 이미지를 저장한다.
# 기능 `save_post_with_images`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
def save_post_with_images(form, request):
    from . import media
    import logging
    uploads = request.FILES.getlist('images')
    # 조건 분기 `len(uploads) > 4`: 참이면 ValidationError('이미지는 최대 4장까지 등록할 수 있습니다.') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if len(uploads) > 4:
        raise ValidationError('이미지는 최대 4장까지 등록할 수 있습니다.')
    # 먼저 모든 업로드를 검증하고 실패 시 이미 저장한 객체도 별도로 정리한다.
    sanitized = [media.sanitize(upload) for upload in uploads]
    stored = []
    # 예외 경계: 본문을 시도하고 `Exception` 발생 시 For 구문으로 이어지는 내부 처리를 실행한다.
    try:
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            # 반복 `sanitized`: 각 항목을 `(data, content_type)`에 담아 먼저 `key = media.put(data, content_type)`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
            for data, content_type in sanitized:
                key = media.put(data, content_type)
                stored.append(key)
                MediaAsset.objects.create(owner=request.user, storage_key=key, content_type=content_type, size=len(data), **({'market_post': post} if isinstance(post, MarketPost) else {'finder_post': post}))
        return post
    except Exception:
        # 반복 `stored`: 각 항목을 `key`에 담아 Try 구문으로 이어지는 내부 처리를 실행한다. 항목이 없으면 본문을 건너뛴다.
        for key in stored:
            # 예외 경계: 본문을 시도하고 `Exception` 발생 시 먼저 `logging.getLogger(__name__).exception('Failed to clean up uncommitted image')`를 실행한다.
            try:
                media.delete(key)
            except Exception:
                logging.getLogger(__name__).exception('Failed to clean up uncommitted image')
        raise


# 이미지 접근 요청을 처리한다.
# 기능 `image_read`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
def image_read(request, pk):
    from . import media
    asset = get_object_or_404(MediaAsset.objects.select_related('market_post', 'finder_post'), pk=pk)
    user = request.user
    # 작성자·관리자는 별도 권한으로 보며 그 외에는 승인된 연결 이미지여야 한다.
    owner_or_admin = user.is_authenticated and user.is_active and user.email_verified and user.student_active and (user.pk == asset.owner_id or user.is_superuser)
    public_market = asset.market_post_id and asset.market_post.owner_id == asset.owner_id
    public_finder = asset.finder_post_id and asset.finder_post.owner_id == asset.owner_id and asset.finder_post.public_approval == 'APPROVED' and asset.finder_post.status == 'ACTIVE'
    # 조건 분기 `not owner_or_admin and (not (asset.moderation == 'APPROVED' and (public_market or public_finder)))`: 참이면 ImportFrom 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not owner_or_admin and not (asset.moderation == 'APPROVED' and (public_market or public_finder)):
        from django.http import Http404
        raise Http404
    response = HttpResponse(media.get(asset.storage_key), content_type=asset.content_type)
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


# 관리자의 이미지 심사 요청을 처리한다.
# 기능 `admin_review_media`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
@require_POST
def admin_review_media(request, pk):
    from .models import AuditLog
    decision = request.POST.get('decision')
    # 조건 분기 `decision not in ('APPROVED', 'REJECTED')`: 참이면 HttpResponseForbidden('잘못된 요청입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if decision not in ('APPROVED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        asset = get_object_or_404(MediaAsset.objects.select_for_update(), pk=pk, moderation='PENDING')
        asset.moderation = decision
        asset.save(update_fields=['moderation'])
        AuditLog.objects.create(actor=request.user, action='media.' + decision.lower(), entity_type='media', entity_id=str(pk))
    return redirect('management')


# 이메일 확인 링크 재발송 요청을 처리한다.
# 기능 `resend_verification`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
def resend_verification(request):
    from .forms import EmailOnlyForm
    form = EmailOnlyForm(request.POST or None)
    # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 먼저 `user = User.objects.filter(email__iexact=form.cleaned_data['email'], email_verified=False, is_active=True).first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST' and form.is_valid():
        user = User.objects.filter(email__iexact=form.cleaned_data['email'], email_verified=False, is_active=True).first()
        # 조건 분기 `user`: 참이면 먼저 `token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if user:
            token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
            url = request.build_absolute_uri(reverse('verify-email', args=[token]))
            send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {url}', None, [user.email])
        return render(request, 'message.html', {'title': '이메일을 확인해 주세요', 'message': '해당 계정이 있다면 확인 메일을 보냈습니다.'})
    return render(request, 'form.html', {'title': '인증 메일 다시 받기', 'form': form})


# 관리자의 사용자 상태 변경 요청을 처리한다.
# 기능 `admin_user_status`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
@require_POST
def admin_user_status(request, pk):
    from .models import AuditLog
    action = request.POST.get('action')
    # 조건 분기 `action not in ('suspend', 'unsuspend') or request.user.pk == pk`: 참이면 HttpResponseForbidden('잘못된 요청입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if action not in ('suspend', 'unsuspend') or request.user.pk == pk:
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        user = get_object_or_404(User.objects.select_for_update(), pk=pk)
        # 조건 분기 `(action == 'suspend') == (not user.is_active)`: 참이면 HttpResponseForbidden('이미 해당 상태입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if (action == 'suspend') == (not user.is_active):
            return HttpResponseForbidden('이미 해당 상태입니다.')
        user.is_active = action == 'unsuspend'
        user.session_version += 1
        user.save(update_fields=['is_active', 'session_version'])
        AuditLog.objects.create(actor=request.user, action='user.' + action, entity_type='user', entity_id=str(pk))
    return redirect('management')


# 관리자의 동아리 회원 변경 요청을 처리한다.
# 기능 `admin_club_member`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@admin_required
@require_POST
def admin_club_member(request, slug):
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    username = request.POST.get('username', '')[:150]
    role = request.POST.get('role')
    # 조건 분기 `role not in ('owner', 'manager', 'member')`: 참이면 HttpResponseForbidden('잘못된 역할입니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if role not in ('owner', 'manager', 'member'):
        return HttpResponseForbidden('잘못된 역할입니다.')
    member = get_object_or_404(User, username=username, is_active=True, email_verified=True, student_active=True)
    with transaction.atomic():
        ClubMember.objects.update_or_create(club=club, user=member, defaults={'role': role})
        AuditLog.objects.create(actor=request.user, action='club.member_role_changed', entity_type='club', entity_id=str(club.pk))
    return redirect('club-manage', slug=slug)


# 동아리 모집 정보 수정 요청을 처리한다.
# 기능 `club_edit_recruitment`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@student_required
def club_edit_recruitment(request, slug, pk):
    from .forms import RecruitmentForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    # 조건 분기 `not club_can_manage(request.user, club)`: 참이면 HttpResponseForbidden('권한이 없습니다.')을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    with transaction.atomic():
        item = get_object_or_404(Recruitment.objects.select_for_update(), pk=pk, club=club)
        form = RecruitmentForm(request.POST or None, instance=item)
        # 조건 분기 `request.method == 'POST' and form.is_valid()`: 참이면 먼저 `form.save()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if request.method == 'POST' and form.is_valid():
            form.save()
            AuditLog.objects.create(actor=request.user, action='recruitment.updated', entity_type='recruitment', entity_id=str(item.pk))
            return redirect('club-manage', slug=club.slug)
    return render(request, 'form.html', {'title': '모집 공고 수정', 'form': form})


# 애플리케이션 상태 확인 요청을 처리한다.
# 기능 `health`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
def health(request):
    from django.db import connection, DatabaseError
    from django.http import JsonResponse
    # 예외 경계: 본문을 시도하고 `DatabaseError` 발생 시 JsonResponse({'status': 'unavailable'}, status=503)을 반환한다.
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except DatabaseError:
        return JsonResponse({'status': 'unavailable'}, status=503)
    return JsonResponse({'status': 'ok'})
