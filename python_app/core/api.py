# HTTP 호환 API: 메서드·인증·CSRF·입력을 검사한 후 거래, 동아리, 분실물과 관리자 업무를 JSON 응답으로 제공한다.
# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `u.is_authenticated and u.is_active and u.email_verified and u.student_active`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `value.isdecimal() and len(value) <= 5 and (int(value) > 0)`: 참일 때 `min(int(value), 10000)`, 거짓일 때 `1`를 선택한다.
# - 단락 평가 `not isinstance(code, str) or len(code) > 128`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `ok`: 참일 때 `JsonResponse({'ok': True})`, 거짓일 때 `error('INVALID_INVITATION', message, 400)`를 선택한다.
# - 단락 평가 `not raw_page.isascii() or not raw_page.isdecimal() or len(raw_page) > 5 or (not 1 <= int(raw_page) <= 10000)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not club.is_public and (not _club_manage(request.user, club))`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not recruitment or not isinstance(answer, str) or (not answer.strip()) or (len(answer) > 3000)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `previous is not None and previous not in ('OPEN', 'REVIEWED')`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `decision not in ('APPROVED', 'REJECTED') or not isinstance(token, str)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not isinstance(ids, list) or len(ids) > 4`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.content_type != 'multipart/form-data' or set(request.FILES) != {'file'} or len(request.FILES.getlist('file')) != 1 or request.POST`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `value.isdecimal() and len(value) <= 5 and (int(value) > 0)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `value.isdecimal() and len(value) <= 9`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `not active or post.status != 'RESERVED'`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `action == 'complete' and post.owner_id == request.user.pk`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `len(value) > 50 or (field == 'kind' and value and (value not in ('lost', 'found')))`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `post`: 참일 때 `JsonResponse({'post': finder_data(post)})`, 거짓일 때 `error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)`를 선택한다.
# - 단락 평가 `not request.user.is_superuser and (not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists())`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `report.status == 'RESOLVED' or report.status == new_status or (previous is not None and report.status != previous)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `invite.redeemed_at or invite.revoked_at`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `post.status != 'ACTIVE' or post.public_approval != 'PENDING' or (not compare_digest(token, finder_review_token(post)))`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `user is None and str(pk).isdecimal() and (len(str(pk)) <= 18)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `field == 'kind' and value and (value not in ('lost', 'found'))`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `candidates`의 각 `item`를 순회한다.
# - 단락 평가 `previous is not None and report.status != previous`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `target`: 참일 때 `target.owner_id`, 거짓일 때 `None`를 선택한다.
# - 조건식 `request.method == 'POST'`: 참일 때 `201`, 거짓일 때 `200`를 선택한다.
# - 컴프리헨션: `ids`의 각 `item`를 순회한다.
# - 단락 평가 `admin and (not request.user.is_superuser)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `u.legacy_auth_id or str(u.pk)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `u.first_name or u.username`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `u.first_name or u.username`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `u.is_superuser`: 참일 때 `'admin'`, 거짓일 때 `'student'`를 선택한다.
# - 조건식 `u.student_active`: 참일 때 `'ACTIVE_STUDENT'`, 거짓일 때 `'VERIFIED_PENDING_INVITE' if u.email_verified else 'UNVERIFIED_EMAIL'`를 선택한다.
# - 컴프리헨션: `posts[:20]`의 각 `post`를 순회한다.
# - 컴프리헨션: `posts[:20]`의 각 `post`를 순회한다.
# - 컴프리헨션: `rows[:20]`의 각 `c`를 순회한다.
# - 컴프리헨션: `rows`의 각 `r`를 순회한다.
# - 조건식 `target`: 참일 때 `target.owner_id`, 거짓일 때 `None`를 선택한다.
# - 조건식 `target`: 참일 때 `target.author_id`, 거짓일 때 `None`를 선택한다.
# - 조건식 `instance`: 참일 때 `'club.recruitment.updated'`, 거짓일 때 `'club.recruitment.created'`를 선택한다.
# - 컴프리헨션: `posts`의 각 `p`를 순회한다.
# - 컴프리헨션: `assets`의 각 `a`를 순회한다.
# - 단락 평가 `user.legacy_auth_id or str(user.pk)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `request.user.is_active and request.user.email_verified and request.user.student_active`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `u.email_verified`: 참일 때 `'VERIFIED_PENDING_INVITE'`, 거짓일 때 `'UNVERIFIED_EMAIL'`를 선택한다.
# - 컴프리헨션: `market_data(post).items()`의 각 `(k, v)`를 순회한다. `k != 'description'`가 참인 항목만 포함한다.
# - 컴프리헨션: `matches`의 각 `(score, post)`를 순회한다. `score >= 70`가 참인 항목만 포함한다.
# - 컴프리헨션: `apps`의 각 `a`를 순회한다.
# - 컴프리헨션: `rows`의 각 `i`를 순회한다.
# - 조건식 `a.market_post_id`: 참일 때 `str(a.market_post_id)`, 거짓일 때 `None`를 선택한다.
# - 조건식 `a.finder_post_id`: 참일 때 `str(a.finder_post_id)`, 거짓일 때 `None`를 선택한다.
# - 조건식 `field == 'kind'`: 참일 때 `field`, 거짓일 때 `field + '__icontains'`를 선택한다.
# - 단락 평가 `student(request) and post.owner_id == request.user.pk`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `apps`의 각 `a`를 순회한다.
# - 단락 평가 `a.applicant.first_name or a.applicant.username`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `i.issued_by.legacy_auth_id or str(i.issued_by_id)`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `i.redeemed_at`: 참일 때 `i.redeemed_at.isoformat()`, 거짓일 때 `None`를 선택한다.
# - 조건식 `i.revoked_at`: 참일 때 `i.revoked_at.isoformat()`, 거짓일 때 `None`를 선택한다.
# - 컴프리헨션: `club.posts.filter(is_public=True)[:100]`의 각 `p`를 순회한다.
# - 컴프리헨션: `club.recruitments.order_by('opens_at')[:100]`의 각 `r`를 순회한다.
"""JSON endpoints for the Django app; unsafe requests still require Django CSRF tokens."""
import json
import uuid
from functools import wraps
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, Exists, OuterRef
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .forms import MarketForm, FinderForm
from .models import Application, Club, ClubMember, FinderPost, MarketPost, Recruitment, Reservation
from .services import DomainError, by_public_id, redeem_invitation, reserve, score_match, score_breakdown


# 오류 코드와 요청 식별자를 포함한 JSON 응답을 만든다.
# 기능 `error`: JsonResponse({'code': code, 'message': message, 'requestId': uuid.uuid4().hex}, status=status)을 반환한다.
def error(code, message, status):
    return JsonResponse({'code': code, 'message': message, 'requestId': uuid.uuid4().hex}, status=status)


# JSON 객체만 허용하며 요청 본문을 16KiB로 제한한다.
# 기능 `body`: If 구문으로 이어지는 내부 처리를 실행한다.
def body(request):
    # 조건 분기 `request.content_type != 'application/json'`: 참이면 ValueError('content type') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.content_type != 'application/json':
        raise ValueError('content type')
    # 조건 분기 `len(request.body) > 16384`: 참이면 ValueError('body too large') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if len(request.body) > 16384:
        raise ValueError('body too large')
    data = json.loads(request.body)
    # 조건 분기 `not isinstance(data, dict)`: 참이면 ValueError('not an object') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not isinstance(data, dict):
        raise ValueError('not an object')
    return data


# HTTP 메서드와 선택적 학생·관리자 권한을 확인하고 입력 오류를 400으로 변환한다.
# 기능 `endpoint`: FunctionDef 구문으로 이어지는 내부 처리를 실행한다.
def endpoint(methods, auth=False, admin=False):
    # 기능 `decorator`: FunctionDef 구문으로 이어지는 내부 처리를 실행한다.
    def decorator(view):
        # 기능 `wrapped`: If 구문으로 이어지는 내부 처리를 실행한다.
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            # 조건 분기 `request.method not in methods`: 참이면 error('METHOD_NOT_ALLOWED', '지원하지 않는 요청입니다.', 405)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if request.method not in methods:
                return error('METHOD_NOT_ALLOWED', '지원하지 않는 요청입니다.', 405)
            # 조건 분기 `auth`: 참이면 If 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if auth:
                # 조건 분기 `not request.user.is_authenticated`: 참이면 error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if not request.user.is_authenticated:
                    return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
                # 조건 분기 `not (request.user.is_active and request.user.email_verified and request.user.student_active)`: 참이면 error('FORBIDDEN', '학생 인증이 필요합니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if not (request.user.is_active and request.user.email_verified and request.user.student_active):
                    return error('FORBIDDEN', '학생 인증이 필요합니다.', 403)
                # 조건 분기 `admin and (not request.user.is_superuser)`: 참이면 error('FORBIDDEN', '관리자 권한이 필요합니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if admin and not request.user.is_superuser:
                    return error('FORBIDDEN', '관리자 권한이 필요합니다.', 403)
            # 예외 경계: 본문을 시도하고 `(ValueError, TypeError, json.JSONDecodeError, ValidationError)` 발생 시 error('INVALID_INPUT', '입력값을 확인해 주세요.', 400)을 반환한다.
            try:
                return view(request, *args, **kwargs)
            except (ValueError, TypeError, json.JSONDecodeError, ValidationError):
                return error('INVALID_INPUT', '입력값을 확인해 주세요.', 400)
        return wrapped
    return decorator


# 로그인, 활성화, 이메일 및 학생 인증 상태를 함께 확인한다.
# 기능 `student`: 먼저 `u = request.user`로 상태 또는 조회 조건을 갱신한다.
def student(request):
    u = request.user
    return u.is_authenticated and u.is_active and u.email_verified and u.student_active


# 미로그인과 학생 인증 부족을 구분해 API 오류를 반환한다.
# 기능 `auth_error`: If 구문으로 이어지는 내부 처리를 실행한다.
def auth_error(request):
    # 조건 분기 `not request.user.is_authenticated`: 참이면 error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    # 조건 분기 `not student(request)`: 참이면 error('FORBIDDEN', '학생 인증이 필요합니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not student(request):
        return error('FORBIDDEN', '학생 인증이 필요합니다.', 403)


# 거래 게시물을 API 응답 필드로 직렬화한다.
# 기능 `market_data`: {'id': str(post.pk), 'title': post.title, 'description': post.description, 'price': post.price, 'category': post.category, 'status': post.status, 'createdAt': post.created_at.isoformat()}을 반환한다.
def market_data(post):
    return {'id': str(post.pk), 'title': post.title, 'description': post.description, 'price': post.price, 'category': post.category, 'status': post.status, 'createdAt': post.created_at.isoformat()}


# 분실물 게시물을 API 응답 필드로 직렬화한다.
# 기능 `finder_data`: {'id': str(post.pk), 'kind': post.kind, 'title': post.title, 'category': post.category, 'color': post.color, 'generalLocation': post.general_location, 'occurredAt': post.occurred_at.isoformat(), 'status': post.status, 'createdAt': post.created_at.isoformat()}을 반환한다.
def finder_data(post):
    return {'id': str(post.pk), 'kind': post.kind, 'title': post.title, 'category': post.category, 'color': post.color, 'generalLocation': post.general_location, 'occurredAt': post.occurred_at.isoformat(), 'status': post.status, 'createdAt': post.created_at.isoformat()}


# API의 camelCase 입력을 Django 폼 필드 이름으로 변환한다.
# 기능 `finder_form_data`: {'kind': data.get('kind'), 'title': data.get('title'), 'category': data.get('category'), 'color': data.get('color'), 'general_location': data.get('generalLocation', data.get('general_location')), 'occurred_at': data.get('occurredAt', data.get('occurred_at'))}을 반환한다.
def finder_form_data(data):
    return {'kind': data.get('kind'), 'title': data.get('title'), 'category': data.get('category'), 'color': data.get('color'), 'general_location': data.get('generalLocation', data.get('general_location')), 'occurred_at': data.get('occurredAt', data.get('occurred_at'))}


# 페이지 번호를 양수 범위로 제한하고 잘못된 값은 첫 페이지로 처리한다.
# 기능 `page_number`: 먼저 `value = request.GET.get('page', '1')`로 상태 또는 조회 조건을 갱신한다.
def page_number(request):
    value = request.GET.get('page', '1')
    return min(int(value), 10000) if value.isdecimal() and len(value) <= 5 and int(value) > 0 else 1


# 현재 계정의 인증 상태와 역할을 캐시 방지 응답으로 반환한다.
# 기능 `me`: If 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET'])
def me(request):
    # 조건 분기 `not request.user.is_authenticated`: 참이면 error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    u = request.user
    response = JsonResponse({'user': {'id': u.legacy_auth_id or str(u.pk), 'name': u.first_name or u.username, 'nickname': u.first_name or u.username, 'email': u.email, 'emailVerified': u.email_verified, 'studentActive': u.student_active, 'role': 'admin' if u.is_superuser else 'student', 'status': 'ACTIVE_STUDENT' if u.student_active else 'VERIFIED_PENDING_INVITE' if u.email_verified else 'UNVERIFIED_EMAIL'}})
    response['Cache-Control'] = 'no-store'
    return response


# 로그인 계정의 초대 코드를 검증하고 학생 인증을 요청한다.
# 기능 `redeem`: If 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'])
def redeem(request):
    # 조건 분기 `not request.user.is_authenticated`: 참이면 error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    code = body(request).get('code', '')
    # 조건 분기 `not isinstance(code, str) or len(code) > 128`: 참이면 ValueError('code') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not isinstance(code, str) or len(code) > 128:
        raise ValueError('code')
    ok, message = redeem_invitation(request.user, code)
    return JsonResponse({'ok': True}) if ok else error('INVALID_INVITATION', message, 400)


# 거래 글을 검색·페이지 처리하거나 인증된 학생의 글과 사진을 함께 등록한다.
# 기능 `market_collection`: If 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET', 'POST'])
def market_collection(request):
    # 조건 분기 `request.method == 'POST'`: 참이면 먼저 `denied = auth_error(request)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST':
        denied = auth_error(request)
        # 조건 분기 `denied is not None`: 참이면 denied을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if denied is not None: return denied
        data = body(request)
        form = MarketForm(data)
        # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not form.is_valid(): return error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            attach_images(request.user, post, data.get('imageIds', []))
        return JsonResponse({'post': market_data(post)}, status=201)
    query = MarketPost.objects.all()
    q = request.GET.get('q', '')[:120]
    # 조건 분기 `q`: 참이면 먼저 `query = query.filter(title__icontains=q)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if q: query = query.filter(title__icontains=q)
    # 조건 분기 `request.GET.get('category')`: 참이면 먼저 `query = query.filter(category=request.GET['category'][:50])`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.GET.get('category'): query = query.filter(category=request.GET['category'][:50])
    # 조건 분기 `request.GET.get('status') in MarketPost.Status.values`: 참이면 먼저 `query = query.filter(status=request.GET['status'])`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.GET.get('status') in MarketPost.Status.values: query = query.filter(status=request.GET['status'])
    # 반복 `[('minPrice', 'price__gte'), ('maxPrice', 'price__lte')]`: 각 항목을 `(name, lookup)`에 담아 먼저 `value = request.GET.get(name, '')`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for name, lookup in [('minPrice', 'price__gte'), ('maxPrice', 'price__lte')]:
        value = request.GET.get(name, '')
        # 조건 분기 `value.isdecimal() and len(value) <= 9`: 참이면 먼저 `query = query.filter(**{lookup: int(value)})`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if value.isdecimal() and len(value) <= 9: query = query.filter(**{lookup: int(value)})
    page = page_number(request)
    posts = list(query.order_by('-created_at', '-pk')[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'posts': [{k: v for k, v in market_data(post).items() if k != 'description'} for post in posts[:20]], 'hasNext': len(posts) > 20, 'page': page})


# 상세 설명 공개 범위를 제한하고 판매 중인 글의 소유자 수정·삭제를 처리한다.
# 기능 `market_item`: If 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET', 'PATCH', 'DELETE'])
def market_item(request, pk):
    # 조건 분기 `request.method == 'GET'`: 참이면 먼저 `post = MarketPost.objects.filter(pk=pk).first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'GET':
        post = MarketPost.objects.filter(pk=pk).first()
        # 조건 분기 `not post`: 참이면 error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not post:
            return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        data = market_data(post)
        # 조건 분기 `not student(request)`: 참이면 먼저 `data.pop('description', None)`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not student(request):
            data.pop('description', None)
        return JsonResponse({'post': data})
    denied = auth_error(request)
    # 조건 분기 `denied is not None`: 참이면 denied을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if denied is not None: return denied
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().filter(pk=pk).first()
        # 조건 분기 `post is None`: 참이면 error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post is None: return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        # 조건 분기 `post.owner_id != request.user.pk`: 참이면 error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.owner_id != request.user.pk: return error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)
        # 조건 분기 `post.status != 'AVAILABLE'`: 참이면 error('CONFLICT', '판매 중인 상품만 변경할 수 있습니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.status != 'AVAILABLE': return error('CONFLICT', '판매 중인 상품만 변경할 수 있습니다.', 409)
        # 조건 분기 `request.method == 'DELETE'`: 참이면 먼저 `post.delete()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if request.method == 'DELETE':
            post.delete()
            return JsonResponse({'ok': True})
        form = MarketForm(body(request), instance=post)
        # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not form.is_valid(): return error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)
        form.save()
        return JsonResponse({'post': market_data(post)})


# 대상 존재 여부를 확인한 뒤 예약 서비스의 충돌을 응답으로 변환한다.
# 기능 `market_reserve`: If 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'], auth=True)
def market_reserve(request, pk):
    # 조건 분기 `not MarketPost.objects.filter(pk=pk).exists()`: 참이면 error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not MarketPost.objects.filter(pk=pk).exists(): return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
    # 예외 경계: 본문을 시도하고 `DomainError` 발생 시 error('CONFLICT', '예약할 수 없습니다.', 409)을 반환한다.
    try:
        reserve(pk, request.user)
    except DomainError:
        return error('CONFLICT', '예약할 수 없습니다.', 409)
    return JsonResponse({'ok': True}, status=201)


# 예약된 거래를 잠그고 권한에 따라 취소 또는 판매 완료로 전환한다.
# 기능 `market_status`: 먼저 `action = body(request).get('action')`로 상태 또는 조회 조건을 갱신한다.
@endpoint(['PATCH'], auth=True)
def market_status(request, pk):
    action = body(request).get('action')
    # 조건 분기 `action not in ('cancel', 'complete')`: 참이면 error('INVALID_INPUT', '거래 상태를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if action not in ('cancel', 'complete'):
        return error('INVALID_INPUT', '거래 상태를 확인해 주세요.', 400)
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().filter(pk=pk).first()
        # 조건 분기 `post is None`: 참이면 error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post is None: return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        active = post.reservations.filter(status='ACTIVE').first()
        # 조건 분기 `not active or post.status != 'RESERVED'`: 참이면 error('CONFLICT', '변경할 예약이 없습니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not active or post.status != 'RESERVED': return error('CONFLICT', '변경할 예약이 없습니다.', 409)
        # 조건 분기 `action == 'complete' and post.owner_id == request.user.pk`: 참이면 먼저 `post.status, active.status = ('COMPLETED', 'COMPLETED')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 If 구문으로 이어지는 내부 처리를 실행한다.
        if action == 'complete' and post.owner_id == request.user.pk:
            post.status, active.status = 'COMPLETED', 'COMPLETED'
        # 조건 분기 `action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id)`: 참이면 먼저 `post.status, active.status = ('AVAILABLE', 'CANCELLED')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 error('FORBIDDEN', '권한이 없습니다.', 403)을 반환한다.
        elif action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id):
            post.status, active.status = 'AVAILABLE', 'CANCELLED'
        else:
            return error('FORBIDDEN', '권한이 없습니다.', 403)
        post.save(update_fields=['status'])
        active.save(update_fields=['status'])
    return JsonResponse({'ok': True, 'post': market_data(post)})


# 승인된 활성 글과 본인 글을 검색하고 인증된 학생의 신규 글을 등록한다.
# 기능 `finder_collection`: If 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET', 'POST'])
def finder_collection(request):
    # 조건 분기 `request.method == 'POST'`: 참이면 먼저 `denied = auth_error(request)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'POST':
        denied = auth_error(request)
        # 조건 분기 `denied is not None`: 참이면 denied을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if denied is not None: return denied
        data = body(request)
        form = FinderForm(finder_form_data(data))
        # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not form.is_valid(): return error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            attach_images(request.user, post, data.get('imageIds', []))
        return JsonResponse({'post': finder_data(post)}, status=201)
    allowed = Q(public_approval='APPROVED')
    # 조건 분기 `student(request)`: 참이면 먼저 `allowed |= Q(owner=request.user)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if student(request): allowed |= Q(owner=request.user)
    query = FinderPost.objects.filter(allowed, status='ACTIVE')
    # 반복 `('kind', 'category', 'color')`: 각 항목을 `field`에 담아 먼저 `value = request.GET.get(field, '').strip()`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for field in ('kind', 'category', 'color'):
        value = request.GET.get(field, '').strip()
        # 조건 분기 `len(value) > 50 or (field == 'kind' and value and (value not in ('lost', 'found')))`: 참이면 ValueError('invalid finder filter') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if len(value) > 50 or (field == 'kind' and value and value not in ('lost', 'found')):
            raise ValueError('invalid finder filter')
        # 조건 분기 `value`: 참이면 먼저 `query = query.filter(**{field if field == 'kind' else field + '__icontains': value})`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if value: query = query.filter(**{field if field == 'kind' else field + '__icontains': value})
    q = request.GET.get('q', '').strip()
    # 조건 분기 `len(q) > 120`: 참이면 ValueError('invalid search') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if len(q) > 120: raise ValueError('invalid search')
    raw_page = request.GET.get('page', '1')
    # 조건 분기 `not raw_page.isascii() or not raw_page.isdecimal() or len(raw_page) > 5 or (not 1 <= int(raw_page) <= 10000)`: 참이면 ValueError('invalid page') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not raw_page.isascii() or not raw_page.isdecimal() or len(raw_page) > 5 or not 1 <= int(raw_page) <= 10000:
        raise ValueError('invalid page')
    # 조건 분기 `q`: 참이면 먼저 `query = query.filter(title__icontains=q)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if q: query = query.filter(title__icontains=q)
    page = page_number(request)
    posts = list(query.order_by('-created_at', '-pk')[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'posts': [dict(finder_data(post), isOwn=student(request) and post.owner_id == request.user.pk) for post in posts[:20]], 'hasMore': len(posts) > 20, 'hasNext': len(posts) > 20, 'page': page})


# 공개 범위를 적용해 조회하고 소유자의 수정·종료·삭제와 재심사를 처리한다.
# 기능 `finder_item`: If 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET', 'PATCH', 'DELETE'])
def finder_item(request, pk):
    # 조건 분기 `request.method == 'GET'`: 참이면 먼저 `allowed = Q(public_approval='APPROVED', status='ACTIVE')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'GET':
        allowed = Q(public_approval='APPROVED', status='ACTIVE')
        # 조건 분기 `student(request)`: 참이면 먼저 `allowed |= Q(owner=request.user)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if student(request): allowed |= Q(owner=request.user)
        post = FinderPost.objects.filter(allowed, pk=pk).first()
        return JsonResponse({'post': finder_data(post)}) if post else error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
    denied = auth_error(request)
    # 조건 분기 `denied is not None`: 참이면 denied을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if denied is not None: return denied
    with transaction.atomic():
        post = FinderPost.objects.select_for_update().filter(pk=pk).first()
        # 조건 분기 `not post`: 참이면 error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not post: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
        # 조건 분기 `post.owner_id != request.user.pk`: 참이면 error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.owner_id != request.user.pk: return error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)
        # 조건 분기 `request.method == 'DELETE'`: 참이면 먼저 `post.delete()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if request.method == 'DELETE':
            post.delete()
            return JsonResponse({'ok': True})
        data = body(request)
        # 조건 분기 `post.status != 'ACTIVE'`: 참이면 error('CONFLICT', '종료된 게시물입니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.status != 'ACTIVE': return error('CONFLICT', '종료된 게시물입니다.', 409)
        # 조건 분기 `data == {'action': 'close'}`: 참이면 먼저 `post.status = 'CLOSED'`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if data == {'action': 'close'}:
            post.status = 'CLOSED'
            post.save(update_fields=['status'])
            return JsonResponse({'ok': True})
        form = FinderForm(finder_form_data(data), instance=post)
        # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not form.is_valid(): return error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)
        changed = form.save(commit=False)
        changed.public_approval = 'PENDING'
        changed.save()
        return JsonResponse({'ok': True, 'post': finder_data(changed)})


# 본인 활성 글과 반대 유형의 열람 가능한 후보를 비교해 70점 이상 최대 20건을 반환한다.
# 기능 `finder_matches`: 먼저 `source = FinderPost.objects.filter(pk=pk, owner=request.user, status='ACTIVE').first()`로 상태 또는 조회 조건을 갱신한다.
@endpoint(['GET'], auth=True)
def finder_matches(request, pk):
    source = FinderPost.objects.filter(pk=pk, owner=request.user, status='ACTIVE').first()
    # 조건 분기 `not source`: 참이면 error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not source: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
    candidates = FinderPost.objects.filter(Q(public_approval='APPROVED') | Q(owner=request.user), status='ACTIVE').exclude(kind=source.kind).exclude(pk=pk)
    matches = sorted(((score_match(source, item), item) for item in candidates), key=lambda item: (-item[0], str(item[1].pk)))
    return JsonResponse({'matches': [{'score': score_breakdown(source, post), 'scoreTotal': score, 'post': finder_data(post)} for score, post in matches if score >= 70][:20]})


# 공개 동아리와 현재 모집 여부를 조회해 페이지 단위로 반환한다.
# 기능 `club_collection`: 먼저 `now = timezone.now()`로 상태 또는 조회 조건을 갱신한다.
@endpoint(['GET'])
def club_collection(request):
    now = timezone.now()
    recruiting = Recruitment.objects.filter(club_id=OuterRef('pk'), is_open=True, opens_at__lte=now, closes_at__gt=now)
    clubs = Club.objects.filter(is_public=True).annotate(recruiting=Exists(recruiting)).order_by('name', 'pk')
    page = page_number(request)
    rows = list(clubs[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'clubs': [{'id': str(c.pk), 'slug': c.slug, 'name': c.name, 'category': c.category, 'introduction': c.introduction, 'recruiting': c.recruiting} for c in rows[:20]], 'hasNext': len(rows) > 20, 'page': page})


# 본인 지원과 운영자용 목록을 구분하고 모집 지원 및 상태 변경을 처리한다.
# 기능 `club_applications`: 먼저 `club = lookup_club(pk)`로 상태 또는 조회 조건을 갱신한다.
@endpoint(['GET', 'POST', 'PATCH'], auth=True)
def club_applications(request, pk):
    club = lookup_club(pk)
    # 조건 분기 `not club`: 참이면 error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 조건 분기 `not club.is_public and (not _club_manage(request.user, club))`: 참이면 error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club.is_public and not _club_manage(request.user, club):
        return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 조건 분기 `request.method == 'GET'`: 참이면 If 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'GET':
        # 조건 분기 `request.GET.get('mine') == '1'`: 참이면 먼저 `apps = Application.objects.filter(recruitment__club=club, applicant=request.user).select_related('recruitment')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if request.GET.get('mine') == '1':
            apps = Application.objects.filter(recruitment__club=club, applicant=request.user).select_related('recruitment')
            return JsonResponse({'applications': [{'recruitmentId': str(a.recruitment.public_id), 'status': a.status} for a in apps]})
        # 조건 분기 `not request.user.is_superuser and (not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists())`: 참이면 error('FORBIDDEN', '권한이 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not request.user.is_superuser and not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists():
            return error('FORBIDDEN', '권한이 없습니다.', 403)
        apps = Application.objects.filter(recruitment__club=club).select_related('applicant', 'recruitment')[:100]
        return JsonResponse({'applications': [{'id': str(a.public_id), 'recruitmentId': str(a.recruitment.public_id), 'recruitmentTitle': a.recruitment.title, 'applicantName': a.applicant.first_name or a.applicant.username, 'answers': a.answers, 'status': a.status, 'createdAt': a.created_at.isoformat()} for a in apps]})
    data = body(request)
    # 조건 분기 `request.method == 'PATCH'`: 참이면 ImportFrom 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'PATCH':
        from .models import AuditLog
        # 조건 분기 `not _club_manage(request.user, club)`: 참이면 error('FORBIDDEN', '권한이 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
        status = data.get('status')
        # 조건 분기 `status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED')`: 참이면 error('INVALID_INPUT', '지원 상태를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED'):
            return error('INVALID_INPUT', '지원 상태를 확인해 주세요.', 400)
        with transaction.atomic():
            app = by_public_id(Application.objects.select_for_update().filter(recruitment__club=club), data.get('applicationId')).first()
            # 조건 분기 `not app`: 참이면 error('NOT_FOUND', '지원서를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if not app: return error('NOT_FOUND', '지원서를 찾을 수 없습니다.', 404)
            # 조건 분기 `app.status in ('CANCELLED', 'ACCEPTED', 'REJECTED')`: 참이면 error('CONFLICT', '종료된 지원입니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if app.status in ('CANCELLED', 'ACCEPTED', 'REJECTED'): return error('CONFLICT', '종료된 지원입니다.', 409)
            app.status = status
            app.save(update_fields=['status'])
            AuditLog.objects.create(actor=request.user, action='application.' + status.lower(), entity_type='application', entity_id=str(app.pk))
        return JsonResponse({'ok': True})
    now = timezone.now()
    recruitment = by_public_id(Recruitment.objects.filter(club=club, club__is_public=True, is_open=True, opens_at__lte=now, closes_at__gt=now), data.get('recruitmentId')).first()
    answer = data.get('answer', '')
    # 조건 분기 `not recruitment or not isinstance(answer, str) or (not answer.strip()) or (len(answer) > 3000)`: 참이면 error('INVALID_INPUT', '지원 내용을 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not recruitment or not isinstance(answer, str) or not answer.strip() or len(answer) > 3000:
        return error('INVALID_INPUT', '지원 내용을 확인해 주세요.', 400)
    # 예외 경계: 본문을 시도하고 `IntegrityError` 발생 시 error('CONFLICT', '이미 지원한 모집입니다.', 409)을 반환한다.
    try:
        with transaction.atomic():
            app = Application.objects.create(recruitment=recruitment, applicant=request.user, answers={'answer': answer.strip()})
    except IntegrityError:
        return error('CONFLICT', '이미 지원한 모집입니다.', 409)
    return JsonResponse({'ok': True, 'application': {'id': str(app.public_id), 'status': app.status}}, status=201)


# 관리자에게 최근 신고 최대 100건을 반환한다.
# 기능 `admin_reports`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET'], auth=True, admin=True)
def admin_reports(request):
    from .models import Report
    rows = Report.objects.order_by('-created_at')[:100]
    return JsonResponse({'reports': [{'id': str(r.public_id), 'targetType': r.target_type, 'targetId': r.target_id, 'reason': r.reason, 'status': r.status, 'createdAt': r.created_at.isoformat()} for r in rows]})


# 신고 상태와 선택적 이전 상태를 확인하고 처리 결과를 감사 기록에 남긴다.
# 기능 `admin_report`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['PATCH'], auth=True, admin=True)
def admin_report(request, pk):
    from .models import AuditLog, Report
    data = body(request)
    new_status = data.get('to', data.get('status'))
    previous = data.get('from')
    # 조건 분기 `new_status not in ('REVIEWED', 'RESOLVED')`: 참이면 error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if new_status not in ('REVIEWED', 'RESOLVED'):
        return error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)
    # 조건 분기 `previous is not None and previous not in ('OPEN', 'REVIEWED')`: 참이면 error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if previous is not None and previous not in ('OPEN', 'REVIEWED'):
        return error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)
    with transaction.atomic():
        report = by_public_id(Report.objects.select_for_update(), pk).first()
        # 조건 분기 `not report`: 참이면 error('NOT_FOUND', '신고를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not report: return error('NOT_FOUND', '신고를 찾을 수 없습니다.', 404)
        # 조건 분기 `report.status == 'RESOLVED' or report.status == new_status or (previous is not None and report.status != previous)`: 참이면 error('CONFLICT', '신고 상태가 변경되었습니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if report.status == 'RESOLVED' or report.status == new_status or (previous is not None and report.status != previous):
            return error('CONFLICT', '신고 상태가 변경되었습니다.', 409)
        report.status = new_status
        report.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='report.' + new_status.lower(), entity_type='report', entity_id=str(report.public_id))
    return JsonResponse({'status': report.status, 'report': {'id': str(report.public_id)}})


# 관리자가 초대 목록을 조회하거나 새 코드를 발급하며 코드 응답은 캐시하지 않는다.
# 기능 `admin_invites`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET', 'POST'], auth=True, admin=True)
def admin_invites(request):
    from .services import issue_invitation
    from .models import Invitation
    # 조건 분기 `request.method == 'GET'`: 참이면 먼저 `rows = Invitation.objects.select_related('issued_by').order_by('-created_at', '-pk')[:100]`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'GET':
        rows = Invitation.objects.select_related('issued_by').order_by('-created_at', '-pk')[:100]
        return JsonResponse({'invitations': [{'id': str(i.pk), 'issuedBy': i.issued_by.legacy_auth_id or str(i.issued_by_id), 'createdAt': i.created_at.isoformat(), 'expiresAt': i.expires_at.isoformat(), 'redeemedAt': i.redeemed_at.isoformat() if i.redeemed_at else None, 'revokedAt': i.revoked_at.isoformat() if i.revoked_at else None} for i in rows]})
    invite, code = issue_invitation(request.user)
    response = JsonResponse({'invitation': {'id': str(invite.pk), 'expiresAt': invite.expires_at.isoformat()}, 'code': code}, status=201)
    response['Cache-Control'] = 'no-store'
    return response


# 미사용·미폐기 초대만 잠금 후 폐기하고 감사 기록을 남긴다.
# 기능 `admin_revoke`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'], auth=True, admin=True)
def admin_revoke(request, pk):
    from .models import Invitation, AuditLog
    with transaction.atomic():
        invite = Invitation.objects.select_for_update().filter(pk=pk).first()
        # 조건 분기 `not invite`: 참이면 error('NOT_FOUND', '초대 코드를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not invite: return error('NOT_FOUND', '초대 코드를 찾을 수 없습니다.', 404)
        # 조건 분기 `invite.redeemed_at or invite.revoked_at`: 참이면 error('CONFLICT', '폐기할 수 없는 코드입니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if invite.redeemed_at or invite.revoked_at: return error('CONFLICT', '폐기할 수 없는 코드입니다.', 409)
        invite.revoked_at = timezone.now()
        invite.save(update_fields=['revoked_at'])
        AuditLog.objects.create(actor=request.user, action='invitation.revoked', entity_type='invitation', entity_id=str(pk))
    return JsonResponse({'ok': True})


# 신고 가능한 공개 대상과 작성자를 확인하고 자기 글 신고를 막은 뒤 기록한다.
# 기능 `reports`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'], auth=True)
def reports(request):
    from .forms import ReportForm
    from .models import AuditLog, ClubPost
    data = body(request)
    form = ReportForm({'target_type': data.get('targetType'), 'target_id': data.get('targetId'), 'reason': data.get('reason')})
    # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '신고 내용을 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not form.is_valid(): return error('INVALID_INPUT', '신고 내용을 확인해 주세요.', 400)
    target_type, target_id = form.cleaned_data['target_type'], form.cleaned_data['target_id']
    # 예외 경계: 본문을 시도하고 `(ValueError, ValidationError)` 발생 시 먼저 `owner = None`로 상태 또는 조회 조건을 갱신한다.
    try:
        # 조건 분기 `target_type == 'market'`: 참이면 먼저 `target = MarketPost.objects.filter(pk=target_id).first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 If 구문으로 이어지는 내부 처리를 실행한다.
        if target_type == 'market':
            target = MarketPost.objects.filter(pk=target_id).first()
            owner = target.owner_id if target else None
        # 조건 분기 `target_type == 'finder'`: 참이면 먼저 `target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 먼저 `target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()`로 상태 또는 조회 조건을 갱신한다.
        elif target_type == 'finder':
            target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()
            owner = target.owner_id if target else None
        else:
            target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()
            owner = target.author_id if target else None
    except (ValueError, ValidationError):
        owner = None
    # 조건 분기 `owner is None`: 참이면 error('NOT_FOUND', '대상을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if owner is None: return error('NOT_FOUND', '대상을 찾을 수 없습니다.', 404)
    # 조건 분기 `owner == request.user.pk`: 참이면 error('FORBIDDEN', '자신의 글은 신고할 수 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if owner == request.user.pk: return error('FORBIDDEN', '자신의 글은 신고할 수 없습니다.', 403)
    # 조건 분기 `target_type == 'club_post'`: 참이면 먼저 `form.cleaned_data['target_id'] = str(target.public_id)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
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


# 안전하지 않은 요청에 사용할 CSRF 쿠키를 설정한다.
# 기능 `csrf`: JsonResponse({'ok': True})을 반환한다.
@ensure_csrf_cookie
@endpoint(['GET'])
def csrf(request):
    return JsonResponse({'ok': True})


# 이메일 로그인 폼을 검증하고 Django 세션을 생성한다.
# 기능 `sign_in`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'])
def sign_in(request):
    from django.contrib.auth import login
    from .forms import EmailLoginForm
    data = body(request)
    form = EmailLoginForm(request, data={'username': data.get('email', ''), 'password': data.get('password', '')})
    # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해 주세요.', 401)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not form.is_valid(): return error('INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해 주세요.', 401)
    login(request, form.get_user())
    return JsonResponse({'ok': True})


# 현재 Django 인증 세션을 종료한다.
# 기능 `sign_out`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'])
def sign_out(request):
    from django.contrib.auth import logout
    logout(request)
    return JsonResponse({'ok': True})


# 가입 정보를 검증해 계정을 생성하고 서명된 이메일 인증 링크를 전송한다.
# 기능 `sign_up`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'])
def sign_up(request):
    from django.core import signing
    from django.core.mail import send_mail
    from django.urls import reverse
    from .forms import RegisterForm
    data = body(request)
    form = RegisterForm({'username': data.get('name'), 'email': data.get('email'), 'password1': data.get('password'), 'password2': data.get('password')})
    # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '가입 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not form.is_valid(): return error('INVALID_INPUT', '가입 정보를 확인해 주세요.', 400)
    # 예외 경계: 본문을 시도하고 `IntegrityError` 발생 시 error('INVALID_INPUT', '가입 정보를 사용할 수 없습니다.', 400)을 반환한다.
    try:
        with transaction.atomic():
            user = form.save()
    except IntegrityError:
        return error('INVALID_INPUT', '가입 정보를 사용할 수 없습니다.', 400)
    token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
    send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {request.build_absolute_uri(reverse("verify-email", args=[token]))}', None, [user.email])
    return JsonResponse({'ok': True}, status=201)


# 슈퍼유저 또는 동아리 대표·운영자인지 확인한다.
# 기능 `_club_manage`: user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()을 반환한다.
def _club_manage(user, club):
    return user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()


# 동아리 UUID 또는 슬러그로 대상을 찾는다.
# 기능 `lookup_club`: Try 구문으로 이어지는 내부 처리를 실행한다.
def lookup_club(identifier):
    # 예외 경계: 본문을 시도하고 `ValueError` 발생 시 Club.objects.filter(slug=identifier).first()을 반환한다.
    try:
        return Club.objects.filter(Q(pk=uuid.UUID(str(identifier))) | Q(slug=identifier)).first()
    except ValueError:
        return Club.objects.filter(slug=identifier).first()


# 공개 동아리 상세를 제공하고 운영자에게 정보 수정을 허용한다.
# 기능 `club_item`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET', 'PATCH'])
def club_item(request, pk):
    from .forms import ClubForm
    from .models import AuditLog
    club = lookup_club(pk)
    # 조건 분기 `not club`: 참이면 error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 조건 분기 `request.method == 'GET'`: 참이면 If 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'GET':
        # 조건 분기 `not club.is_public`: 참이면 error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not club.is_public: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
        return JsonResponse({'club': {'id': str(club.pk), 'slug': club.slug, 'name': club.name, 'category': club.category, 'introduction': club.introduction, 'isPublic': club.is_public, 'posts': [{'id': str(p.public_id), 'title': p.title, 'content': p.content, 'createdAt': p.created_at.isoformat()} for p in club.posts.filter(is_public=True)[:100]], 'recruitments': [{'id': str(r.public_id), 'title': r.title, 'description': r.description, 'opensAt': r.opens_at.isoformat(), 'closesAt': r.closes_at.isoformat(), 'isOpen': r.is_open} for r in club.recruitments.order_by('opens_at')[:100]]}})
    denied = auth_error(request)
    # 조건 분기 `denied is not None`: 참이면 denied을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if denied is not None: return denied
    # 조건 분기 `not _club_manage(request.user, club)`: 참이면 error('FORBIDDEN', '권한이 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    form = ClubForm({'slug': club.slug, 'name': data.get('name'), 'category': data.get('category'), 'introduction': data.get('introduction'), 'is_public': data.get('isPublic', False)}, instance=club)
    # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '동아리 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not form.is_valid(): return error('INVALID_INPUT', '동아리 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        form.save()
        AuditLog.objects.create(actor=request.user, action='club.updated', entity_type='club', entity_id=str(club.pk))
    return JsonResponse({'ok': True})


# 동아리 운영자가 활동 글을 만들고 감사 기록을 남긴다.
# 기능 `club_post`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'], auth=True)
def club_post(request, pk):
    from .forms import ClubPostForm
    from .models import AuditLog
    club = lookup_club(pk)
    # 조건 분기 `not club`: 참이면 error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 조건 분기 `not _club_manage(request.user, club)`: 참이면 error('FORBIDDEN', '권한이 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    form = ClubPostForm({'title': data.get('title'), 'content': data.get('content'), 'is_public': data.get('isPublic', False)})
    # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '게시물을 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not form.is_valid(): return error('INVALID_INPUT', '게시물을 확인해 주세요.', 400)
    post = form.save(commit=False)
    post.club, post.author = club, request.user
    with transaction.atomic():
        post.save()
        AuditLog.objects.create(actor=request.user, action='club.post.created', entity_type='club_post', entity_id=str(post.pk))
    return JsonResponse({'post': {'id': str(post.public_id)}}, status=201)


# 운영자가 모집 공고를 생성하거나 수정하며 감사 기록을 남긴다.
# 기능 `club_recruitments`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST', 'PATCH'], auth=True)
def club_recruitments(request, pk):
    from .forms import RecruitmentForm
    from .models import AuditLog
    club = lookup_club(pk)
    # 조건 분기 `not club`: 참이면 error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 조건 분기 `not _club_manage(request.user, club)`: 참이면 error('FORBIDDEN', '권한이 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    instance = None
    # 조건 분기 `request.method == 'PATCH'`: 참이면 먼저 `instance = by_public_id(Recruitment.objects.filter(club=club), data.get('id')).first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.method == 'PATCH':
        instance = by_public_id(Recruitment.objects.filter(club=club), data.get('id')).first()
        # 조건 분기 `not instance`: 참이면 error('NOT_FOUND', '모집 공고를 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not instance: return error('NOT_FOUND', '모집 공고를 찾을 수 없습니다.', 404)
    form = RecruitmentForm({'title': data.get('title'), 'description': data.get('description'), 'opens_at': data.get('opensAt'), 'closes_at': data.get('closesAt'), 'is_open': data.get('isOpen', False)}, instance=instance)
    # 조건 분기 `not form.is_valid()`: 참이면 error('INVALID_INPUT', '모집 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not form.is_valid(): return error('INVALID_INPUT', '모집 정보를 확인해 주세요.', 400)
    recruitment = form.save(commit=False)
    recruitment.club = club
    with transaction.atomic():
        recruitment.save()
        AuditLog.objects.create(actor=request.user, action='club.recruitment.updated' if instance else 'club.recruitment.created', entity_type='recruitment', entity_id=str(recruitment.pk))
    return JsonResponse({'ok': True, 'recruitment': {'id': str(recruitment.public_id)}}, status=201 if request.method == 'POST' else 200)


# 관리자 검토 대기 중인 활성 분실물과 변경 감지 토큰을 조회한다.
# 기능 `admin_finder_list`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET'], auth=True, admin=True)
def admin_finder_list(request):
    from .views import finder_review_token
    posts = FinderPost.objects.filter(public_approval='PENDING', status='ACTIVE').order_by('-created_at')[:100]
    return JsonResponse({'posts': [dict(finder_data(p), reviewToken=finder_review_token(p)) for p in posts]})


# 검토 토큰과 현재 상태를 확인한 후 분실물 공개 여부를 결정한다.
# 기능 `admin_finder_item`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['PATCH'], auth=True, admin=True)
def admin_finder_item(request, pk):
    from hmac import compare_digest
    from .models import AuditLog
    from .views import finder_review_token
    data = body(request)
    decision, token = data.get('decision'), data.get('reviewToken')
    # 조건 분기 `decision not in ('APPROVED', 'REJECTED') or not isinstance(token, str)`: 참이면 error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if decision not in ('APPROVED', 'REJECTED') or not isinstance(token, str):
        return error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        post = FinderPost.objects.select_for_update().filter(pk=pk).first()
        # 조건 분기 `not post`: 참이면 error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not post: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
        # 조건 분기 `post.status != 'ACTIVE' or post.public_approval != 'PENDING' or (not compare_digest(token, finder_review_token(post)))`: 참이면 error('CONFLICT', '게시물이 변경되었습니다. 다시 확인해 주세요.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if post.status != 'ACTIVE' or post.public_approval != 'PENDING' or not compare_digest(token, finder_review_token(post)):
            return error('CONFLICT', '게시물이 변경되었습니다. 다시 확인해 주세요.', 409)
        post.public_approval = decision
        post.save(update_fields=['public_approval'])
        AuditLog.objects.create(actor=request.user, action='finder.' + decision.lower(), entity_type='finder', entity_id=str(pk))
    return JsonResponse({'ok': True})


# 검토 대기 이미지와 연결된 게시물을 관리자에게 보여준다.
# 기능 `admin_media_list`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['GET'], auth=True, admin=True)
def admin_media_list(request):
    from .models import MediaAsset
    assets = MediaAsset.objects.filter(moderation='PENDING').order_by('-created_at')[:100]
    return JsonResponse({'media': [{'id': str(a.pk), 'contentType': a.content_type, 'size': a.size, 'createdAt': a.created_at.isoformat(), 'marketPostId': str(a.market_post_id) if a.market_post_id else None, 'finderPostId': str(a.finder_post_id) if a.finder_post_id else None} for a in assets]})


# 대기 중인 이미지만 승인·거절하고 감사 기록을 남긴다.
# 기능 `admin_media_item`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['PATCH'], auth=True, admin=True)
def admin_media_item(request, pk):
    from .models import AuditLog, MediaAsset
    decision = body(request).get('decision')
    # 조건 분기 `decision not in ('APPROVED', 'REJECTED')`: 참이면 error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if decision not in ('APPROVED', 'REJECTED'): return error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        asset = MediaAsset.objects.select_for_update().filter(pk=pk).first()
        # 조건 분기 `not asset`: 참이면 error('NOT_FOUND', '사진을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not asset: return error('NOT_FOUND', '사진을 찾을 수 없습니다.', 404)
        # 조건 분기 `asset.moderation != 'PENDING'`: 참이면 error('CONFLICT', '이미 검토된 사진입니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if asset.moderation != 'PENDING': return error('CONFLICT', '이미 검토된 사진입니다.', 409)
        asset.moderation = decision
        asset.save(update_fields=['moderation'])
        AuditLog.objects.create(actor=request.user, action='media.' + decision.lower(), entity_type='media', entity_id=str(pk))
    return JsonResponse({'ok': True})


# 다른 사용자를 정지·해제하고 세션 버전을 올려 기존 세션을 무효화한다.
# 기능 `admin_user_status`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'], auth=True, admin=True)
def admin_user_status(request, pk):
    from .models import AuditLog, User
    action = body(request).get('action')
    # 조건 분기 `action not in ('suspend', 'unsuspend')`: 참이면 error('FORBIDDEN', '요청할 수 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if action not in ('suspend', 'unsuspend'): return error('FORBIDDEN', '요청할 수 없습니다.', 403)
    with transaction.atomic():
        users = User.objects.select_for_update()
        user = users.filter(legacy_auth_id=str(pk)).first()
        # 조건 분기 `user is None and str(pk).isdecimal() and (len(str(pk)) <= 18)`: 참이면 먼저 `user = users.filter(pk=int(pk)).first()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if user is None and str(pk).isdecimal() and len(str(pk)) <= 18:
            user = users.filter(pk=int(pk)).first()
        # 조건 분기 `not user`: 참이면 error('NOT_FOUND', '회원을 찾을 수 없습니다.', 404)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not user: return error('NOT_FOUND', '회원을 찾을 수 없습니다.', 404)
        # 조건 분기 `user.pk == request.user.pk`: 참이면 error('FORBIDDEN', '자신의 계정은 정지할 수 없습니다.', 403)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if user.pk == request.user.pk: return error('FORBIDDEN', '자신의 계정은 정지할 수 없습니다.', 403)
        # 조건 분기 `(action == 'suspend') == (not user.is_active)`: 참이면 error('CONFLICT', '이미 요청한 상태입니다.', 409)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if (action == 'suspend') == (not user.is_active): return error('CONFLICT', '이미 요청한 상태입니다.', 409)
        user.is_active = action == 'unsuspend'
        user.session_version += 1
        user.save(update_fields=['is_active', 'session_version'])
        AuditLog.objects.create(actor=request.user, action='user.' + action, entity_type='user', entity_id=user.legacy_auth_id or str(user.pk))
    return JsonResponse({'ok': True})


# 본인 소유 미첨부 이미지 최대 4개를 잠그고 게시물에 연결한다.
# 기능 `attach_images`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
def attach_images(owner, post, ids):
    from .models import MediaAsset
    # 조건 분기 `not isinstance(ids, list) or len(ids) > 4`: 참이면 ValidationError('invalid images') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if not isinstance(ids, list) or len(ids) > 4:
        raise ValidationError('invalid images')
    # 예외 경계: 본문을 시도하고 `(ValueError, TypeError, AttributeError)` 발생 시 ValidationError('invalid images') 예외를 발생시킨다.
    try:
        keys = [uuid.UUID(str(item)) for item in ids]
    except (ValueError, TypeError, AttributeError):
        raise ValidationError('invalid images')
    # 조건 분기 `len(set(keys)) != len(keys)`: 참이면 ValidationError('duplicate images') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if len(set(keys)) != len(keys):
        raise ValidationError('duplicate images')
    assets = list(MediaAsset.objects.select_for_update().filter(pk__in=keys, owner=owner, market_post__isnull=True, finder_post__isnull=True).order_by('pk'))
    # 조건 분기 `len(assets) != len(keys)`: 참이면 ValidationError('images not available') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if len(assets) != len(keys):
        raise ValidationError('images not available')
    # 반복 `assets`: 각 항목을 `asset`에 담아 If 구문으로 이어지는 내부 처리를 실행한다. 항목이 없으면 본문을 건너뛴다.
    for asset in assets:
        # 조건 분기 `isinstance(post, MarketPost)`: 참이면 먼저 `asset.market_post = post`로 상태 또는 조회 조건을 갱신한다. 거짓이면 먼저 `asset.finder_post = post`로 상태 또는 조회 조건을 갱신한다.
        if isinstance(post, MarketPost):
            asset.market_post = post
            asset.save(update_fields=['market_post'])
        else:
            asset.finder_post = post
            asset.save(update_fields=['finder_post'])


# 단일 이미지를 정제해 저장하고 DB 기록 실패 시 객체 정리를 시도한다.
# 기능 `media_upload`: Import 구문으로 이어지는 내부 처리를 실행한다.
@endpoint(['POST'], auth=True)
def media_upload(request):
    import logging
    from . import media
    from .models import MediaAsset
    # 조건 분기 `request.content_type != 'multipart/form-data' or set(request.FILES) != {'file'} or len(request.FILES.getlist('file')) != 1 or request.POST`: 참이면 error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if request.content_type != 'multipart/form-data' or set(request.FILES) != {'file'} or len(request.FILES.getlist('file')) != 1 or request.POST:
        return error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)
    upload = request.FILES.get('file')
    # 조건 분기 `upload is None`: 참이면 error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if upload is None: return error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)
    data, content_type = media.sanitize(upload)
    key = media.put(data, content_type)
    # 예외 경계: 본문을 시도하고 `Exception` 발생 시 Try 구문으로 이어지는 내부 처리를 실행한다.
    try:
        asset = MediaAsset.objects.create(owner=request.user, storage_key=key, content_type=content_type, size=len(data))
    except Exception:
        # 예외 경계: 본문을 시도하고 `Exception` 발생 시 먼저 `logging.getLogger(__name__).exception('Failed to clean up uncommitted image')`를 실행한다.
        try:
            media.delete(key)
        except Exception:
            logging.getLogger(__name__).exception('Failed to clean up uncommitted image')
        raise
    data = {'id': str(asset.pk), 'contentType': asset.content_type, 'size': asset.size}
    return JsonResponse({'asset': data, 'media': data}, status=201)
