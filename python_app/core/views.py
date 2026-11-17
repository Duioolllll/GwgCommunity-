

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


# 인증을 마친 학생만 해당 기능을 쓰게 한다.
def student_required(view):


    # 실제 처리를 시작하기 전에 계정과 요청이 허용되는지 확인한다.
    @login_required
    @wraps(view)
    def wrapped(request, *args, **kwargs):


        # 정지되지 않았고 이메일·학생 인증도 끝난 계정만 이 기능을 이용할 수 있다.
        if not request.user.is_active or not request.user.email_verified or not request.user.student_active:
            return HttpResponseForbidden('이메일과 학생 인증이 필요합니다.')
        return view(request, *args, **kwargs)
    return wrapped


# 첫 화면을 보여 준다.
def home(request):
    return render(request, 'home.html')


# 가입 정보를 확인하고 이메일 확인 링크를 보낸다.
def register(request):


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = RegisterForm(request.POST or None)


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():


        # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
        try:
            with transaction.atomic():
                user = form.save()


        # 이 종류의 오류가 나면 입력 양식에 잘못된 부분을 표시한다.
        except IntegrityError:
            form.add_error(None, '가입 정보를 사용할 수 없습니다.')
            return render(request, 'form.html', {'title': '회원가입', 'form': form}, status=400)
        token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
        url = request.build_absolute_uri(reverse('verify-email', args=[token]))
        send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {url}', None, [user.email])
        return render(request, 'message.html', {'title': '이메일을 확인해 주세요', 'message': '발송된 확인 링크를 열어 주세요.'})
    return render(request, 'form.html', {'title': '회원가입', 'form': form})


# 확인 링크가 유효하면 이메일 확인을 완료한다.
def verify_email(request, token):


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
    try:
        data = signing.loads(token, salt='email-verification', max_age=86400)
        user = User.objects.get(pk=data['user'], email=data['email'], is_active=True)


    # 이 종류의 오류가 나면 현재 상태에 맞는 화면을 보여 준다.
    except (signing.BadSignature, User.DoesNotExist, KeyError):
        return render(request, 'message.html', {'title': '확인 실패', 'message': '링크가 만료되었거나 유효하지 않습니다.'}, status=400)
    user.email_verified = True
    user.save(update_fields=['email_verified'])
    return render(request, 'message.html', {'title': '이메일 확인 완료', 'message': '로그인한 후 초대 코드를 입력해 주세요.'})


# 사용자가 제출한 초대 코드로 학생 인증을 시도한다.
@login_required
def invite(request):


    # 저장 요청이면 입력 내용을 검사하고 새 데이터를 만든다. 다른 요청은 아래의 조회 처리로 이어진다.
    if request.method == 'POST':
        code = request.POST.get('code', '')[:128]
        ok, message = redeem_invitation(request.user, code)


        # 성공했으면 성공 안내를, 실패했으면 오류 안내를 선택한다.
        messages.success(request, message) if ok else messages.error(request, message)


        # 초대 코드로 학생 인증에 성공했으면 마이페이지로 이동한다.
        if ok:
            return redirect('me')
    return render(request, 'invite.html')


# 내 글·예약·지원 내역과 관리 중인 동아리를 모아 보여 준다.
@login_required
def me(request):
    return render(request, 'me.html', {'market_posts': MarketPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'reservations': Reservation.objects.filter(requester=request.user).select_related('post').order_by('-created_at')[:20], 'finder_posts': FinderPost.objects.filter(owner=request.user).order_by('-created_at')[:20], 'applications': Application.objects.filter(applicant=request.user).select_related('recruitment__club')[:20], 'managed_clubs': ClubMember.objects.filter(user=request.user, role__in=['owner', 'manager']).select_related('club')})


# 검색 조건을 적용한 거래 목록을 페이지별로 보여 준다.
def market(request):
    q = request.GET.get('q', '')[:120]
    category, status = request.GET.get('category', '')[:50], request.GET.get('status', '')[:20]
    posts = MarketPost.objects.filter(title__icontains=q)


    # 분류를 골랐다면 해당 분류의 자료만 고른다.
    if category:
        posts = posts.filter(category=category)


    # 올바른 거래 상태를 골랐을 때만 그 상태의 글로 검색 범위를 좁힌다.
    if status in MarketPost.Status.values:
        posts = posts.filter(status=status)


    # 최소 가격과 최대 가격을 각각 확인해 검색 조건에 넣는다.
    for name, lookup in (('min_price', 'price__gte'), ('max_price', 'price__lte')):
        value = request.GET.get(name, '')


        # 가격이 9자리 이하의 숫자로 입력되었을 때만 가격 검색 조건에 넣는다.
        if value.isdecimal() and len(value) <= 9:
            posts = posts.filter(**{lookup: int(value)})
    page = Paginator(posts.prefetch_related('images').order_by('-created_at', '-pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'market.html', {'posts': page, 'page': page, 'q': q, 'categories': MarketPost.objects.order_by('category').values_list('category', flat=True).distinct()})


# 입력한 내용을 검사한 뒤 새 거래 글을 저장한다.
@student_required
def market_new(request):


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = MarketForm(request.POST or None)


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():


        # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
        try:
            post = save_post_with_images(form, request)


        # 이 종류의 오류가 나면 입력 양식에 잘못된 부분을 표시한다.
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            return redirect('market-detail', pk=post.pk)
    return render(request, 'form.html', {'title': '물품 등록', 'form': form})


# 거래 글과 현재 예약 상태를 보여 준다.
def market_detail(request, pk):
    post = get_object_or_404(MarketPost, pk=pk)


    # 로그인한 사용자에게만 현재 예약 정보를 조회하고, 비회원에게는 조회하지 않는다.
    active = post.reservations.filter(status='ACTIVE').first() if request.user.is_authenticated else None


    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    may_cancel = bool(active and request.user.pk in (post.owner_id, active.requester_id))
    return render(request, 'market_detail.html', {'post': post, 'may_cancel': may_cancel})


# 작성자가 판매 중인 거래 글을 수정한다.
@student_required
def market_edit(request, pk):


    # 저장 요청이면 입력 내용을 검사하고 새 데이터를 만든다. 다른 요청은 아래의 조회 처리로 이어진다.
    if request.method == 'POST':
        with transaction.atomic():
            post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk, owner=request.user)


            # 판매 중인 글인지 확인한다. 예약 중이거나 완료된 글에는 이 작업을 허용하지 않는다.
            if post.status != MarketPost.Status.AVAILABLE:
                return HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')
            form = MarketForm(request.POST, instance=post)


            # 수정한 내용이 올바르면 저장하고, 잘못되었으면 폼에 오류를 보여 준다.
            if form.is_valid():
                form.save()
                return redirect('market-detail', pk=post.pk)
        return render(request, 'form.html', {'title': '물품 수정', 'form': form})
    post = get_object_or_404(MarketPost, pk=pk, owner=request.user)


    # 판매 중인 글인지 확인한다. 예약 중이거나 완료된 글에는 이 작업을 허용하지 않는다.
    if post.status != MarketPost.Status.AVAILABLE:
        return HttpResponseForbidden('판매 중인 게시물만 수정할 수 있습니다.')
    form = MarketForm(instance=post)
    return render(request, 'form.html', {'title': '물품 수정', 'form': form})


# 다른 학생의 판매 중인 글에 거래를 신청한다.
@student_required
@require_POST
def market_reserve(request, pk):
    get_object_or_404(MarketPost, pk=pk)


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
    try:
        reserve(pk, request.user)
        messages.success(request, '예약이 완료되었습니다.')


    # 이 종류의 오류가 나면 처리 결과를 화면 안내로 남긴다.
    except DomainError as exc:
        messages.error(request, str(exc))
    return redirect('market-detail', pk=pk)


# 거래 당사자가 예약을 취소하거나 거래를 완료하게 한다.
@student_required
@require_POST
def market_status(request, pk):
    with transaction.atomic():
        post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk)
        active = post.reservations.filter(status='ACTIVE').first()
        action = request.POST.get('action')


        # 진행 중인 예약이 없거나 글이 예약 중이 아니면 상태 변경을 막는다.
        if not active or post.status != MarketPost.Status.RESERVED:
            return HttpResponseForbidden('변경할 예약이 없습니다.')


        # 거래 완료는 글 작성자만 처리할 수 있다.
        if action == 'complete' and post.owner_id == request.user.pk:
            post.status, active.status = 'COMPLETED', 'COMPLETED'


        # 예약 취소는 글 작성자 또는 예약 당사자만 할 수 있다.
        elif action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id):
            post.status, active.status = 'AVAILABLE', 'CANCELLED'
        else:
            return HttpResponseForbidden('권한이 없습니다.')
        post.save(update_fields=['status'])
        active.save(update_fields=['status'])
    return redirect('market-detail', pk=pk)


# 동아리를 검색어·분류·모집 여부로 찾아 보여 준다.
def clubs(request):
    q = request.GET.get('q', '')[:120]
    category = request.GET.get('category', '')[:50]
    clubs = Club.objects.filter(is_public=True).filter(Q(name__icontains=q) | Q(introduction__icontains=q))


    # 분류를 골랐다면 해당 분류의 자료만 고른다.
    if category:
        clubs = clubs.filter(category=category)


    # 모집 중만 보기를 골랐으면 현재 지원 가능한 모집이 있는 동아리만 보여 준다.
    if request.GET.get('recruiting') == '1':
        now = timezone.now()
        clubs = clubs.filter(recruitments__is_open=True, recruitments__opens_at__lte=now, recruitments__closes_at__gte=now).distinct()
    page = Paginator(clubs.order_by('name', 'pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'clubs.html', {'clubs': page, 'page': page, 'q': q, 'categories': Club.objects.filter(is_public=True).order_by('category').values_list('category', flat=True).distinct()})


# 공개 권한에 맞춰 동아리 소개·활동·모집을 보여 준다.
def club_detail(request, slug):
    club = get_object_or_404(Club, slug=slug, is_public=True)
    now = timezone.now()


    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    can_manage = request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified and club_can_manage(request.user, club)
    return render(request, 'club_detail.html', {'club': club, 'can_manage': can_manage, 'posts': club.posts.filter(is_public=True), 'recruitments': club.recruitments.filter(is_open=True, opens_at__lte=now, closes_at__gte=now)})


# 모집 중인 동아리에 지원 답변을 제출한다.
@student_required
@require_POST
def club_apply(request, pk):
    now = timezone.now()
    recruitment = get_object_or_404(Recruitment, pk=pk, club__is_public=True, is_open=True, opens_at__lte=now, closes_at__gte=now)
    answer = request.POST.get('answer', '').strip()


    # 지원 답변이 비어 있거나 3000자를 넘으면 접수하지 않는다.
    if not answer or len(answer) > 3000:
        messages.error(request, '지원 내용을 1~3000자로 입력해 주세요.')
    else:


        # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
        try:
            with transaction.atomic():
                Application.objects.create(recruitment=recruitment, applicant=request.user, answers={'answer': answer})
            messages.success(request, '지원서가 제출되었습니다.')


        # 이 종류의 오류가 나면 처리 결과를 화면 안내로 남긴다.
        except IntegrityError:
            messages.error(request, '이미 지원한 모집입니다.')
    return redirect('club-detail', slug=recruitment.club.slug)


# 지원서를 제출하거나 본인·운영자에게 허용된 지원 내역을 조회한다.
@student_required
def club_applications(request, slug):
    club = get_object_or_404(Club, slug=slug)


    # 전체 관리자도 아니고 해당 동아리 운영자도 아니면 지원서를 열람·관리할 수 없다.
    if not request.user.is_superuser and not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists():
        return HttpResponseForbidden('권한이 없습니다.')
    applications = Application.objects.filter(recruitment__club=club).select_related('applicant', 'recruitment')
    return render(request, 'applications.html', {'club': club, 'applications': applications})


# 분실·습득 글을 검색 조건에 맞춰 보여 준다.
def finder(request):
    visibility = Q(public_approval='APPROVED')


    # 로그인했고 정지되지 않았으며 이메일·학생 인증도 마쳤다면 학생에게 허용된 정보까지 보여 준다.
    if request.user.is_authenticated and request.user.is_active and request.user.student_active and request.user.email_verified:
        visibility |= Q(owner=request.user)
    posts = FinderPost.objects.filter(visibility, status='ACTIVE')
    q = request.GET.get('q', '')[:120]
    posts = posts.filter(Q(title__icontains=q) | Q(category__icontains=q))


    # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
    for field in ('kind', 'category', 'color'):
        value = request.GET.get(field, '')[:50]


        # 검색값이 있고 올바른 종류를 골랐을 때만 그 검색 조건을 적용한다.
        if value and (field != 'kind' or value in ('lost', 'found')):
            posts = posts.filter(**{field: value})
    page = Paginator(posts.prefetch_related('images').order_by('-created_at', '-pk'), 20).get_page(request.GET.get('page'))
    return render(request, 'finder.html', {'posts': page, 'page': page, 'q': q})


# 공개 권한에 맞는 분실물 글을 보여 준다.
def finder_detail(request, pk):
    visibility = Q(public_approval='APPROVED', status='ACTIVE')


    # 모든 인증을 마친 학생에게는 학생용 조회 범위를 적용한다.
    if request.user.is_authenticated and request.user.is_active and request.user.email_verified and request.user.student_active:
        visibility |= Q(owner=request.user)
    post = get_object_or_404(FinderPost.objects.filter(visibility), pk=pk)
    return render(request, 'finder_detail.html', {'post': post})


# 새 분실·습득 글을 저장하고 공개 심사를 기다리게 한다.
@student_required
def finder_new(request):


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = FinderForm(request.POST or None)


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():


        # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
        try:
            save_post_with_images(form, request)


        # 이 종류의 오류가 나면 입력 양식에 잘못된 부분을 표시한다.
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            return redirect('finder')
    return render(request, 'form.html', {'title': '분실·습득물 등록', 'form': form})


# 반대 종류의 분실·습득 글을 비교해 비슷한 후보를 보여 준다.
@student_required
def finder_matches(request, pk):
    post = get_object_or_404(FinderPost, pk=pk, owner=request.user, status='ACTIVE')
    candidates = FinderPost.objects.filter(Q(public_approval='APPROVED') | Q(owner=request.user), status='ACTIVE').exclude(kind=post.kind).exclude(pk=post.pk)


    # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
    matches = sorted(((score_match(post, candidate), candidate) for candidate in candidates), key=lambda item: (-item[0], str(item[1].pk)))


    # 유사도 점수가 70점 이상인 후보만 결과에 넣는다.
    return render(request, 'matches.html', {'matches': [item for item in matches if item[0] >= 70][:20]})


# 작성자가 판매 중인 거래 글을 삭제한다.
@student_required
@require_POST
def market_delete(request, pk):
    with transaction.atomic():
        post = get_object_or_404(MarketPost.objects.select_for_update(), pk=pk, owner=request.user)


        # 판매 중인 글인지 확인한다. 예약 중이거나 완료된 글에는 이 작업을 허용하지 않는다.
        if post.status != MarketPost.Status.AVAILABLE:
            return HttpResponseForbidden('판매 중인 게시물만 삭제할 수 있습니다.')
        post.delete()
    return redirect('market')


# 작성자가 진행 중인 글을 수정하고 다시 공개 심사를 받게 한다.
@student_required
def finder_edit(request, pk):


    # 저장 요청이면 입력 내용을 검사하고 새 데이터를 만든다. 다른 요청은 아래의 조회 처리로 이어진다.
    if request.method == 'POST':
        with transaction.atomic():
            post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk, owner=request.user)


            # 진행 중인 분실물 글만 바꿀 수 있다. 이미 종료된 글에는 이 작업을 허용하지 않는다.
            if post.status != 'ACTIVE':
                return HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')
            form = FinderForm(request.POST, instance=post)


            # 수정한 내용이 올바르면 저장하고, 잘못되었으면 폼에 오류를 보여 준다.
            if form.is_valid():
                post = form.save(commit=False)
                post.public_approval = 'PENDING'
                post.save()
                return redirect('finder')
        return render(request, 'form.html', {'title': '분실·습득물 수정', 'form': form})
    post = get_object_or_404(FinderPost, pk=pk, owner=request.user)


    # 진행 중인 분실물 글만 바꿀 수 있다. 이미 종료된 글에는 이 작업을 허용하지 않는다.
    if post.status != 'ACTIVE':
        return HttpResponseForbidden('종료된 게시물은 수정할 수 없습니다.')
    form = FinderForm(instance=post)
    return render(request, 'form.html', {'title': '분실·습득물 수정', 'form': form})


# 작성자가 진행 중인 분실물 글을 삭제한다.
@student_required
@require_POST
def finder_delete(request, pk):
    get_object_or_404(FinderPost, pk=pk, owner=request.user).delete()
    return redirect('finder')


# 작성자가 분실물 글을 종료 상태로 바꾼다.
@student_required
@require_POST
def finder_close(request, pk):
    with transaction.atomic():
        post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk, owner=request.user)


        # 진행 중인 분실물 글만 바꿀 수 있다. 이미 종료된 글에는 이 작업을 허용하지 않는다.
        if post.status != 'ACTIVE':
            return HttpResponseForbidden('이미 종료된 게시물입니다.')
        post.status = 'CLOSED'
        post.save(update_fields=['status'])
    return redirect('me')


# 계정·이메일·학생 인증을 마친 관리자만 기능을 쓰게 한다.
def admin_required(view):


    # 실제 처리를 시작하기 전에 계정과 요청이 허용되는지 확인한다.
    @login_required
    @wraps(view)
    def wrapped(request, *args, **kwargs):


        # 정지되지 않았고 모든 인증을 마친 관리자만 관리 기능을 이용할 수 있다.
        if not (request.user.is_superuser and request.user.is_active and request.user.email_verified and request.user.student_active):
            return HttpResponseForbidden('관리자 권한이 필요합니다.')
        return view(request, *args, **kwargs)
    return wrapped


# 관리자에게 회원·초대·심사·신고 현황을 보여 준다.
@admin_required
def management(request):
    from .models import Invitation, Report
    pending_posts = list(FinderPost.objects.filter(public_approval='PENDING', status='ACTIVE')[:100])


    # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
    for post in pending_posts:
        post.review_token = finder_review_token(post)
    return render(request, 'management.html', {'invitations': Invitation.objects.order_by('-expires_at')[:100], 'pending_posts': pending_posts, 'reports': Report.objects.filter(status__in=['OPEN', 'REVIEWED'])[:100], 'pending_media': MediaAsset.objects.filter(moderation='PENDING')[:100], 'accounts': User.objects.order_by('-date_joined')[:100], 'clubs': Club.objects.order_by('name')[:100]})


# 관리자가 새 초대 코드를 발급하게 한다.
@admin_required
@require_POST
def admin_issue_invite(request):
    from .services import issue_invitation
    _, code = issue_invitation(request.user)
    response = render(request, 'issued_invitation.html', {'code': code})
    response['Cache-Control'] = 'no-store'
    return response


# 관리자가 미사용 초대 코드를 폐기하게 한다.
@admin_required
@require_POST
def admin_revoke_invite(request, pk):
    from .models import AuditLog, Invitation
    with transaction.atomic():
        invitation = get_object_or_404(Invitation.objects.select_for_update(), pk=pk)


        # 아직 쓰지도 폐기하지도 않은 코드만 폐기한다.
        if not invitation.redeemed_at and not invitation.revoked_at:
            invitation.revoked_at = timezone.now()
            invitation.save(update_fields=['revoked_at'])
            AuditLog.objects.create(actor=request.user, action='invitation.revoked', entity_type='invitation', entity_id=str(pk))
    return redirect('management')


# 글이 심사 대기 상태인지 다시 확인한 뒤 공개 여부를 결정한다.
@admin_required
@require_POST
def admin_review_finder(request, pk):
    from .models import AuditLog
    decision = request.POST.get('decision')


    # 사진이나 글의 심사 결과는 승인 또는 거절만 허용한다.
    if decision not in ('APPROVED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        post = get_object_or_404(FinderPost.objects.select_for_update(), pk=pk)


        # 관리자가 확인한 내용이 심사 전에 바뀌었으면 결정을 적용하지 않는다. 심사 대기 중인 최신 글인지 확인한다. 내용이 바뀌었거나 이미 종료·심사되었다면 다시 확인하도록 한다.
        if post.public_approval != 'PENDING' or post.status != 'ACTIVE' or not compare_digest(request.POST.get('review_token', ''), finder_review_token(post)):
            return HttpResponse('게시물이 변경되었습니다. 다시 확인해 주세요.', status=409)
        post.public_approval = decision
        post.save(update_fields=['public_approval'])
        AuditLog.objects.create(actor=request.user, action='finder.' + decision.lower(), entity_type='finder', entity_id=str(pk))
    return redirect('management')


# 관리자가 본 글과 실제 처리할 글이 같은지 확인할 값을 만든다.
def finder_review_token(post):
    import hashlib
    import json
    values = [str(post.pk), post.kind, post.title, post.category, post.color, post.general_location, post.occurred_at.isoformat()]
    return hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


# 사용자가 해당 동아리의 대표·운영자 또는 전체 관리자인지 확인한다.
def club_can_manage(user, club):


    # 앞쪽 값이 비어 있으면 다음 후보를 사용한다. 값이 있으면 뒤쪽은 확인하지 않는다.
    return user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()


# 관리자가 새 동아리를 등록한다.
@admin_required
def admin_club_new(request):
    from .forms import ClubForm
    from .models import AuditLog


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = ClubForm(request.POST or None)


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            club = form.save()
            AuditLog.objects.create(actor=request.user, action='club.created', entity_type='club', entity_id=str(club.pk))
        return redirect('management')
    return render(request, 'form.html', {'title': '동아리 만들기', 'form': form})


# 운영자가 동아리 소개와 활동·모집을 관리하게 한다.
@student_required
def club_manage(request, slug):
    from .forms import ClubForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)


    # 이 동아리를 관리할 권한이 없으면 관리 화면이나 저장 기능을 이용할 수 없다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = ClubForm(request.POST or None, instance=club)


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            club = form.save()
            AuditLog.objects.create(actor=request.user, action='club.updated', entity_type='club', entity_id=str(club.pk))
        return redirect('club-manage', slug=club.slug)
    return render(request, 'club_manage.html', {'club': club, 'form': form})


# 운영자가 활동 글 또는 모집 공고를 추가한다.
@student_required
def club_add_content(request, slug, kind):
    from .forms import ClubPostForm, RecruitmentForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)


    # 이 동아리를 관리할 권한이 없으면 관리 화면이나 저장 기능을 이용할 수 없다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    form_class = {'post': ClubPostForm, 'recruitment': RecruitmentForm}.get(kind)


    # 지원하지 않는 종류의 동아리 콘텐츠는 만들지 못하게 한다.
    if form_class is None:
        return HttpResponseForbidden('잘못된 요청입니다.')


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = form_class(request.POST or None)


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():
        with transaction.atomic():
            item = form.save(commit=False)
            item.club = club


            # 활동 글을 만드는 경우 활동 글 입력을 저장한다. 다른 경우는 모집 공고를 만든다.
            if kind == 'post':
                item.author = request.user
            item.save()
            AuditLog.objects.create(actor=request.user, action='club.' + kind + '.created', entity_type=kind, entity_id=str(item.pk))
        return redirect('club-manage', slug=club.slug)
    return render(request, 'form.html', {'title': '활동 또는 모집 등록', 'form': form})


# 동아리 운영자가 지원서를 검토·합격·불합격 상태로 바꾼다.
@student_required
@require_POST
def club_application_status(request, slug, pk):
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)


    # 이 동아리를 관리할 권한이 없으면 관리 화면이나 저장 기능을 이용할 수 없다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    status = request.POST.get('status')


    # 지원서 상태는 검토 중·합격·거절 중 하나로만 바꿀 수 있다.
    if status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 상태입니다.')
    with transaction.atomic():
        application = get_object_or_404(Application.objects.select_for_update(), pk=pk, recruitment__club=club)


        # 처리가 끝난 지원서의 상태를 다시 바꾸지 못하게 한다.
        if application.status in ('CANCELLED', 'ACCEPTED', 'REJECTED'):
            return HttpResponseForbidden('종료된 지원입니다.')
        application.status = status
        application.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='application.' + status.lower(), entity_type='application', entity_id=str(pk))
    return redirect('club-applications', slug=slug)


# 본인 글이 아닌 게시글에 대한 신고를 저장한다.
@student_required
def report_create(request):
    from .forms import ReportForm
    from .models import AuditLog, ClubPost


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = ReportForm(request.POST or None, initial={'target_type': request.GET.get('target_type', ''), 'target_id': request.GET.get('target_id', '')})


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():
        target_type, target_id = form.cleaned_data['target_type'], form.cleaned_data['target_id']


        # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
        try:


            # 신고 대상이 거래 글이면 거래 글에서 작성자와 공개 범위를 확인한다.
            if target_type == 'market':
                target = MarketPost.objects.filter(pk=target_id).first()


                # 대상 글이 있으면 작성자 정보를 읽고, 없으면 작성자가 없는 것으로 처리한다.
                owner_id = target.owner_id if target else None


            # 신고 대상이 분실물 글이면 해당 글에서 작성자와 공개 범위를 확인한다.
            elif target_type == 'finder':
                target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()


                # 대상 글이 있으면 작성자 정보를 읽고, 없으면 작성자가 없는 것으로 처리한다.
                owner_id = target.owner_id if target else None
            else:
                target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()


                # 대상 글이 있으면 작성자 정보를 읽고, 없으면 작성자가 없는 것으로 처리한다.
                owner_id = target.author_id if target else None


        # 이 종류의 오류가 나면 필요한 값을 정한 뒤 아래 처리를 계속한다.
        except (ValueError, ValidationError):
            owner_id = None


        # 신고 대상이 없거나 자기 글이면 신고를 받지 않는다.
        if owner_id is None or owner_id == request.user.pk:
            form.add_error('target_id', '신고할 수 없는 대상입니다.')
            return render(request, 'form.html', {'title': '신고하기', 'form': form}, status=400)
        with transaction.atomic():
            report = form.save(commit=False)


            # 동아리 활동 글을 신고하는 경우 그 글의 작성자를 확인한다.
            if target_type == 'club_post':
                report.target_id = str(target.public_id)
            report.reporter = request.user
            report.save()
            AuditLog.objects.create(actor=request.user, action='report.created', entity_type='report', entity_id=str(report.pk))
        return render(request, 'message.html', {'title': '신고가 접수되었습니다', 'message': '관리자가 확인합니다.'})
    return render(request, 'form.html', {'title': '신고하기', 'form': form})


# 관리자가 신고의 검토·처리 상태를 바꾼다.
@admin_required
@require_POST
def admin_report_status(request, pk):
    from .models import AuditLog, Report
    status = request.POST.get('status')


    # 신고는 검토 완료나 처리 완료 상태로만 바꿀 수 있다.
    if status not in ('REVIEWED', 'RESOLVED'):
        return HttpResponseForbidden('잘못된 상태입니다.')
    with transaction.atomic():
        report = get_object_or_404(Report.objects.select_for_update(), pk=pk)
        report.status = status
        report.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='report.' + status.lower(), entity_type='report', entity_id=str(pk))
    return redirect('management')


# 글과 첨부 이미지 정보를 함께 저장한다.
def save_post_with_images(form, request):
    from . import media
    import logging
    uploads = request.FILES.getlist('images')


    # 한 글에 사진을 4장보다 많이 올리면 저장하지 않는다.
    if len(uploads) > 4:
        raise ValidationError('이미지는 최대 4장까지 등록할 수 있습니다.')


    # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
    sanitized = [media.sanitize(upload) for upload in uploads]
    stored = []


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
    try:
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()


            # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
            for data, content_type in sanitized:
                key = media.put(data, content_type)
                stored.append(key)


                # 거래 글이면 거래 글 연결 항목을, 분실물 글이면 분실물 연결 항목을 사용한다.
                MediaAsset.objects.create(owner=request.user, storage_key=key, content_type=content_type, size=len(data), **({'market_post': post} if isinstance(post, MarketPost) else {'finder_post': post}))
        return post


    # 이 종류의 오류가 나면 이 경우에 필요한 아래 처리를 실행한다.
    except Exception:


        # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
        for key in stored:


            # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
            try:
                media.delete(key)


            # 이 종류의 오류가 나면 필요한 저장·안내 작업을 실행한다.
            except Exception:
                logging.getLogger(__name__).exception('Failed to clean up uncommitted image')
        raise


# 사진 주인·관리자 또는 공개 승인 조건을 만족하는 사람에게 이미지를 보여 준다.
def image_read(request, pk):
    from . import media
    asset = get_object_or_404(MediaAsset.objects.select_related('market_post', 'finder_post'), pk=pk)
    user = request.user


    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    # 앞쪽 값이 비어 있으면 다음 후보를 사용한다. 값이 있으면 뒤쪽은 확인하지 않는다.
    owner_or_admin = user.is_authenticated and user.is_active and user.email_verified and user.student_active and (user.pk == asset.owner_id or user.is_superuser)


    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    public_market = asset.market_post_id and asset.market_post.owner_id == asset.owner_id


    # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
    public_finder = asset.finder_post_id and asset.finder_post.owner_id == asset.owner_id and asset.finder_post.public_approval == 'APPROVED' and asset.finder_post.status == 'ACTIVE'


    # 작성자·관리자가 아니라면 승인된 사진이 공개 글에 연결되어 있을 때만 보여 준다.
    if not owner_or_admin and not (asset.moderation == 'APPROVED' and (public_market or public_finder)):
        from django.http import Http404
        raise Http404
    response = HttpResponse(media.get(asset.storage_key), content_type=asset.content_type)
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


# 관리자가 대기 중인 사진의 공개를 승인하거나 거절한다.
@admin_required
@require_POST
def admin_review_media(request, pk):
    from .models import AuditLog
    decision = request.POST.get('decision')


    # 사진이나 글의 심사 결과는 승인 또는 거절만 허용한다.
    if decision not in ('APPROVED', 'REJECTED'):
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        asset = get_object_or_404(MediaAsset.objects.select_for_update(), pk=pk, moderation='PENDING')
        asset.moderation = decision
        asset.save(update_fields=['moderation'])
        AuditLog.objects.create(actor=request.user, action='media.' + decision.lower(), entity_type='media', entity_id=str(pk))
    return redirect('management')


# 이메일 확인을 아직 못 한 사용자에게 확인 링크를 다시 보낸다.
def resend_verification(request):
    from .forms import EmailOnlyForm


    # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
    form = EmailOnlyForm(request.POST or None)


    # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
    if request.method == 'POST' and form.is_valid():
        user = User.objects.filter(email__iexact=form.cleaned_data['email'], email_verified=False, is_active=True).first()


        # 사용자를 찾았을 때만 인증 메일을 다시 보낸다. 화면 안내는 계정 존재 여부를 드러내지 않게 한다.
        if user:
            token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
            url = request.build_absolute_uri(reverse('verify-email', args=[token]))
            send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {url}', None, [user.email])
        return render(request, 'message.html', {'title': '이메일을 확인해 주세요', 'message': '해당 계정이 있다면 확인 메일을 보냈습니다.'})
    return render(request, 'form.html', {'title': '인증 메일 다시 받기', 'form': form})


# 관리자가 다른 사용자의 계정을 정지하거나 다시 사용할 수 있게 한다.
@admin_required
@require_POST
def admin_user_status(request, pk):
    from .models import AuditLog
    action = request.POST.get('action')


    # 정지·해제 이외의 요청과 자기 계정을 정지하려는 요청은 막는다.
    if action not in ('suspend', 'unsuspend') or request.user.pk == pk:
        return HttpResponseForbidden('잘못된 요청입니다.')
    with transaction.atomic():
        user = get_object_or_404(User.objects.select_for_update(), pk=pk)


        # 요청한 정지 상태가 이미 적용돼 있으면 같은 작업을 다시 하지 않는다.
        if (action == 'suspend') == (not user.is_active):
            return HttpResponseForbidden('이미 해당 상태입니다.')
        user.is_active = action == 'unsuspend'
        user.session_version += 1
        user.save(update_fields=['is_active', 'session_version'])
        AuditLog.objects.create(actor=request.user, action='user.' + action, entity_type='user', entity_id=str(pk))
    return redirect('management')


# 관리자가 동아리 회원의 역할을 지정한다.
@admin_required
@require_POST
def admin_club_member(request, slug):
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)
    username = request.POST.get('username', '')[:150]
    role = request.POST.get('role')


    # 동아리 역할은 대표·운영자·회원 중 하나로만 지정할 수 있다.
    if role not in ('owner', 'manager', 'member'):
        return HttpResponseForbidden('잘못된 역할입니다.')
    member = get_object_or_404(User, username=username, is_active=True, email_verified=True, student_active=True)
    with transaction.atomic():
        ClubMember.objects.update_or_create(club=club, user=member, defaults={'role': role})
        AuditLog.objects.create(actor=request.user, action='club.member_role_changed', entity_type='club', entity_id=str(club.pk))
    return redirect('club-manage', slug=slug)


# 동아리 운영자가 모집 공고를 수정한다.
@student_required
def club_edit_recruitment(request, slug, pk):
    from .forms import RecruitmentForm
    from .models import AuditLog
    club = get_object_or_404(Club, slug=slug)


    # 이 동아리를 관리할 권한이 없으면 관리 화면이나 저장 기능을 이용할 수 없다.
    if not club_can_manage(request.user, club):
        return HttpResponseForbidden('권한이 없습니다.')
    with transaction.atomic():
        item = get_object_or_404(Recruitment.objects.select_for_update(), pk=pk, club=club)


        # 제출한 입력값이 있으면 검사에 사용하고, 없으면 빈 입력 화면을 준비한다.
        form = RecruitmentForm(request.POST or None, instance=item)


        # 사용자가 저장을 요청했고 입력 내용도 올바를 때만 데이터베이스에 저장한다.
        if request.method == 'POST' and form.is_valid():
            form.save()
            AuditLog.objects.create(actor=request.user, action='recruitment.updated', entity_type='recruitment', entity_id=str(item.pk))
            return redirect('club-manage', slug=club.slug)
    return render(request, 'form.html', {'title': '모집 공고 수정', 'form': form})


# 서버와 데이터베이스 연결이 정상인지 확인한다.
def health(request):
    from django.db import connection, DatabaseError
    from django.http import JsonResponse


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')


    # 이 종류의 오류가 나면 상황에 맞는 결과를 돌려주고 현재 함수를 끝낸다.
    except DatabaseError:
        return JsonResponse({'status': 'unavailable'}, status=503)
    return JsonResponse({'status': 'ok'})
