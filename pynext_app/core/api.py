# 이 파일은 화면과 주고받는 요청을 처리한다.
# HTTP 호환 API: 메서드·인증·다른 사이트의 대리 요청을 막는 확인값(CSRF)·입력을 검사한 후 거래, 동아리, 분실물과 관리자 업무를 이름과 값을 묶은 JSON 응답으로 제공한다.
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


# 오류 코드와 요청별 식별자를 담은 이름과 값을 묶은 JSON 응답을 만든다.
# 실패 이유와 상태 번호를 묶어서 응답한다.
def error(code, message, status):
    return JsonResponse({'code': code, 'message': message, 'requestId': uuid.uuid4().hex}, status=status)


# JSON 객체만 허용하고 본문 크기를 16KiB로 제한한다.
# 요청 내용이 알맞은 크기의 JSON인지 확인하고 읽는다. JSON은 이름과 값을 묶어 주고받는 형식이다.
def body(request):
    # 약속한 JSON 형식으로 보내지 않은 요청은 읽지 않고 거절한다.
    if request.content_type != 'application/json':
        raise ValueError('content type')
    # 내용이 16KB를 넘으면 너무 큰 요청으로 보고 거절한다.
    if len(request.body) > 16384:
        raise ValueError('body too large')
    data = json.loads(request.body)
    # JSON 안에 이름과 값으로 묶인 자료가 들어 있지 않으면 거절한다.
    if not isinstance(data, dict):
        raise ValueError('not an object')
    return data


# HTTP 메서드와 선택적 학생·관리자 권한을 확인하고 입력 예외를 400으로 변환한다.
# 기능 실행 전에 요청 방식과 로그인·학생·관리자 권한을 확인한다.
def endpoint(methods, auth=False, admin=False):
    # 원래 기능 앞에 공통 검사를 붙인다.
    def decorator(view):
        # 필요한 권한을 먼저 검사하고 통과한 요청만 원래 기능에 전달한다.
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            # 이 주소에서 허용하지 않은 요청 방식은 거절한다.
            if request.method not in methods:
                return error('METHOD_NOT_ALLOWED', '지원하지 않는 요청입니다.', 405)
            # 로그인이 필요한 기능이면 로그인·학생 인증 상태를 먼저 확인한다.
            if auth:
                # 로그인하지 않았다면 이 기능을 이용할 수 없다고 알려 준다.
                if not request.user.is_authenticated:
                    return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
                # 정지되지 않았고 이메일·학생 인증도 끝난 계정만 학생 전용 기능을 쓸 수 있다.
                if not (request.user.is_active and request.user.email_verified and request.user.student_active):
                    return error('FORBIDDEN', '학생 인증이 필요합니다.', 403)
                # 관리자 전용 기능을 일반 사용자가 요청하면 거절한다.
                if admin and not request.user.is_superuser:
                    return error('FORBIDDEN', '관리자 권한이 필요합니다.', 403)
            # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
            try:
                return view(request, *args, **kwargs)
            except (ValueError, TypeError, json.JSONDecodeError, ValidationError):
                return error('INVALID_INPUT', '입력값을 확인해 주세요.', 400)
        return wrapped
    return decorator


# 계정 활성화, 이메일 확인, 학생 인증을 모두 확인한다.
# 로그인·이메일 인증·학생 인증을 모두 마친 사용자인지 확인한다.
def student(request):
    u = request.user
    return u.is_authenticated and u.is_active and u.email_verified and u.student_active


# 인증 누락과 학생 자격 부족을 구분해 JSON 오류를 반환한다.
# 로그인과 학생 인증 상태에 따라 접근을 허용하거나 거절한다.
def auth_error(request):
    # 로그인하지 않았다면 이 기능을 이용할 수 없다고 알려 준다.
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    # 로그인·이메일 인증·학생 인증을 모두 마치지 않았다면 학생 전용 작업을 막는다.
    if not student(request):
        return error('FORBIDDEN', '학생 인증이 필요합니다.', 403)


# 중고 게시물의 API 응답 필드를 구성한다. 공개 여부는 호출자가 결정한다.
# 거래 글에서 화면에 보여 줄 정보를 골라 응답용 자료로 만든다.
def market_data(post):
    return {'id': str(post.pk), 'title': post.title, 'description': post.description, 'price': post.price, 'category': post.category, 'status': post.status, 'createdAt': post.created_at.isoformat()}


# 분실·습득 게시물의 공개용 필드를 직렬화한다.
# 분실물 글에서 공개할 수 있는 정보만 골라 응답용 자료로 만든다.
def finder_data(post):
    return {'id': str(post.pk), 'kind': post.kind, 'title': post.title, 'category': post.category, 'color': post.color, 'generalLocation': post.general_location, 'occurredAt': post.occurred_at.isoformat(), 'status': post.status, 'createdAt': post.created_at.isoformat()}


# 화면에서 쓰는 generalLocation 같은 이름을 파이썬 폼의 general_location 형식으로 맞춘다.
# 분실물 입력값을 폼에서 검사할 수 있는 모양으로 맞춘다.
def finder_form_data(data):
    return {'kind': data.get('kind'), 'title': data.get('title'), 'category': data.get('category'), 'color': data.get('color'), 'general_location': data.get('generalLocation', data.get('general_location')), 'occurred_at': data.get('occurredAt', data.get('occurred_at'))}


# 페이지 값을 1부터 10000까지로 제한하고 잘못된 값은 첫 페이지로 처리한다.
# 입력받은 페이지 번호를 확인하고, 올바르지 않으면 1페이지를 사용한다.
def page_number(request):
    value = request.GET.get('page', '1')
    # 페이지 번호가 올바른 양수면 최대 10000까지 사용하고, 잘못된 값이면 1페이지를 사용한다.
    return min(int(value), 10000) if value.isdecimal() and len(value) <= 5 and int(value) > 0 else 1


# 로그인 사용자의 인증 상태와 역할을 반환하며 캐시를 금지한다.
# 내 글·예약·지원 내역을 모아 보여 준다.
@endpoint(['GET'])
def me(request):
    # 로그인하지 않았다면 이 기능을 이용할 수 없다고 알려 준다.
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    u = request.user
    # 관리자 여부와 이메일·학생 인증 단계에 맞춰 계정 역할과 상태 이름을 정한다.
    response = JsonResponse({'user': {'id': u.legacy_auth_id or str(u.pk), 'name': u.first_name or u.username, 'nickname': u.first_name or u.username, 'email': u.email, 'emailVerified': u.email_verified, 'studentActive': u.student_active, 'role': 'admin' if u.is_superuser else 'student', 'status': 'ACTIVE_STUDENT' if u.student_active else 'VERIFIED_PENDING_INVITE' if u.email_verified else 'UNVERIFIED_EMAIL'}})
    response['Cache-Control'] = 'no-store'
    return response


# 로그인 사용자의 초대 코드를 검증한 뒤 학생 인증 서비스에 전달한다.
# 초대 코드로 학생 인증을 시도하고 결과를 알려 준다.
@endpoint(['POST'])
def redeem(request):
    # 로그인하지 않았다면 이 기능을 이용할 수 없다고 알려 준다.
    if not request.user.is_authenticated:
        return error('UNAUTHENTICATED', '로그인이 필요합니다.', 401)
    code = body(request).get('code', '')
    # 초대 코드가 문자열이 아니거나 128자를 넘으면 잘못된 입력으로 처리한다.
    if not isinstance(code, str) or len(code) > 128:
        raise ValueError('code')
    ok, message = redeem_invitation(request.user, code)
    # 학생 인증에 성공했으면 성공 응답을, 실패했으면 초대 코드 오류를 보낸다.
    return JsonResponse({'ok': True}) if ok else error('INVALID_INVITATION', message, 400)


# 공개 목록은 설명을 제외하고 필터·페이지를 적용하며 생성은 학생 인증을 요구한다.
# 거래 글 목록을 검색하거나 새 글을 저장한다.
@endpoint(['GET', 'POST'])
def market_collection(request):
    # 저장 요청이면 입력 내용을 검사하고 새 데이터를 만든다. 다른 요청은 아래의 조회 처리로 이어진다.
    if request.method == 'POST':
        denied = auth_error(request)
        # 앞선 권한 검사에서 거절 사유가 나왔다면 실제 작업을 하지 않고 그 결과를 보낸다.
        if denied is not None: return denied
        data = body(request)
        form = MarketForm(data)
        # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
        if not form.is_valid(): return error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            attach_images(request.user, post, data.get('imageIds', []))
        return JsonResponse({'post': market_data(post)}, status=201)
    query = MarketPost.objects.all()
    q = request.GET.get('q', '')[:120]
    # 검색어를 입력했다면 그 내용이 들어 있는 자료만 고른다.
    if q: query = query.filter(title__icontains=q)
    # 분류 조건이 있으면 그 분류에 맞는 글만 남긴다.
    if request.GET.get('category'): query = query.filter(category=request.GET['category'][:50])
    # 판매 중·예약 중·완료 중에서 올바른 상태를 골랐을 때만 검색 조건에 넣는다.
    if request.GET.get('status') in MarketPost.Status.values: query = query.filter(status=request.GET['status'])
    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
    for name, lookup in [('minPrice', 'price__gte'), ('maxPrice', 'price__lte')]:
        value = request.GET.get(name, '')
        # 가격이 9자리 이하의 숫자로 입력되었을 때만 가격 검색 조건에 넣는다.
        if value.isdecimal() and len(value) <= 9: query = query.filter(**{lookup: int(value)})
    page = page_number(request)
    posts = list(query.order_by('-created_at', '-pk')[(page - 1) * 20:page * 20 + 1])
    # 목록에서 필요한 조건에 맞는 항목만 골라 결과에 넣는다.
    return JsonResponse({'posts': [{k: v for k, v in market_data(post).items() if k != 'description'} for post in posts[:20]], 'hasNext': len(posts) > 20, 'page': page})


# 공개 상세는 학생이 아닌 사용자에게 설명을 숨기고, 변경은 작성자와 판매 상태를 잠금 안에서 확인한다.
# 거래 글 하나를 조회·수정·삭제한다. 글 주인인지와 거래 상태도 확인한다.
@endpoint(['GET', 'PATCH', 'DELETE'])
def market_item(request, pk):
    # 조회 요청이면 저장된 내용을 보여 준다. 내용을 바꾸는 요청은 아래에서 따로 검사한다.
    if request.method == 'GET':
        post = MarketPost.objects.filter(pk=pk).first()
        # 해당 글을 찾을 수 없으면 더 진행하지 않는다.
        if not post:
            return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        data = market_data(post)
        # 로그인·이메일 인증·학생 인증을 모두 마치지 않았다면 학생 전용 작업을 막는다.
        if not student(request):
            data.pop('description', None)
        return JsonResponse({'post': data})
    denied = auth_error(request)
    # 앞선 권한 검사에서 거절 사유가 나왔다면 실제 작업을 하지 않고 그 결과를 보낸다.
    if denied is not None: return denied
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().filter(pk=pk).first()
        # 해당 글이 없으면 찾을 수 없다는 결과를 보낸다.
        if post is None: return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        # 글 작성자가 아니면 글을 수정하거나 삭제할 수 없다.
        if post.owner_id != request.user.pk: return error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)
        # 판매 중인 글만 수정하거나 삭제할 수 있다. 예약·완료된 거래의 내용을 함부로 바꾸지 못하게 한다.
        if post.status != 'AVAILABLE': return error('CONFLICT', '판매 중인 상품만 변경할 수 있습니다.', 409)
        # 삭제 요청이면 이 데이터를 삭제하고 결과를 돌려준다.
        if request.method == 'DELETE':
            post.delete()
            return JsonResponse({'ok': True})
        form = MarketForm(body(request), instance=post)
        # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
        if not form.is_valid(): return error('INVALID_INPUT', '상품 정보를 확인해 주세요.', 400)
        form.save()
        return JsonResponse({'post': market_data(post)})


# 중복 예약 방지는 공통 예약 서비스에 맡기고 충돌을 409로 반환한다.
# 다른 학생의 판매 중인 글에 거래 예약을 신청한다.
@endpoint(['POST'], auth=True)
def market_reserve(request, pk):
    # 해당 거래 글이 없으면 찾을 수 없다는 응답을 보낸다.
    if not MarketPost.objects.filter(pk=pk).exists(): return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
    # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
    try:
        reserve(pk, request.user)
    except DomainError:
        return error('CONFLICT', '예약할 수 없습니다.', 409)
    return JsonResponse({'ok': True}, status=201)


# 게시물 행을 잠근 뒤 소유자의 완료 또는 거래 당사자의 취소를 예약 상태와 함께 반영한다.
# 거래를 취소하거나 완료하고 글과 예약 상태를 함께 바꾼다.
@endpoint(['PATCH'], auth=True)
def market_status(request, pk):
    action = body(request).get('action')
    # 예약 취소나 거래 완료 이외의 작업 이름은 허용하지 않는다.
    if action not in ('cancel', 'complete'):
        return error('INVALID_INPUT', '거래 상태를 확인해 주세요.', 400)
    with transaction.atomic():
        post = MarketPost.objects.select_for_update().filter(pk=pk).first()
        # 해당 글이 없으면 찾을 수 없다는 결과를 보낸다.
        if post is None: return error('NOT_FOUND', '상품을 찾을 수 없습니다.', 404)
        active = post.reservations.filter(status='ACTIVE').first()
        # 진행 중인 예약이 있고 글도 예약 중이어야 취소·완료 작업을 할 수 있다.
        if not active or post.status != 'RESERVED': return error('CONFLICT', '변경할 예약이 없습니다.', 409)
        # 거래 완료는 글 작성자만 처리할 수 있다.
        if action == 'complete' and post.owner_id == request.user.pk:
            post.status, active.status = 'COMPLETED', 'COMPLETED'
        # 예약 취소는 글 작성자 또는 예약 당사자만 할 수 있다.
        elif action == 'cancel' and request.user.pk in (post.owner_id, active.requester_id):
            post.status, active.status = 'AVAILABLE', 'CANCELLED'
        else:
            return error('FORBIDDEN', '권한이 없습니다.', 403)
        post.save(update_fields=['status'])
        active.save(update_fields=['status'])
    return JsonResponse({'ok': True, 'post': market_data(post)})


# 활성 승인 게시물과 인증된 작성자 자신의 글을 조회하고 신규 글과 이미지를 중간 상태가 남지 않도록 한 번에 저장한다.
# 분실물 목록을 검색하거나 새 글을 저장한다.
@endpoint(['GET', 'POST'])
def finder_collection(request):
    # 저장 요청이면 입력 내용을 검사하고 새 데이터를 만든다. 다른 요청은 아래의 조회 처리로 이어진다.
    if request.method == 'POST':
        denied = auth_error(request)
        # 앞선 권한 검사에서 거절 사유가 나왔다면 실제 작업을 하지 않고 그 결과를 보낸다.
        if denied is not None: return denied
        data = body(request)
        form = FinderForm(finder_form_data(data))
        # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
        if not form.is_valid(): return error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)
        with transaction.atomic():
            post = form.save(commit=False)
            post.owner = request.user
            post.save()
            attach_images(request.user, post, data.get('imageIds', []))
        return JsonResponse({'post': finder_data(post)}, status=201)
    # 미승인 글은 학생 인증을 마친 작성자에게만 본인 글로 허용한다.
    allowed = Q(public_approval='APPROVED')
    # 인증을 마친 학생이면 학생에게 허용된 범위까지 글을 보여 준다.
    if student(request): allowed |= Q(owner=request.user)
    query = FinderPost.objects.filter(allowed, status='ACTIVE')
    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
    for field in ('kind', 'category', 'color'):
        value = request.GET.get(field, '').strip()
        # 검색값은 50자 이하로 제한하고, 종류는 분실·습득 중에서만 고르게 한다.
        if len(value) > 50 or (field == 'kind' and value and value not in ('lost', 'found')):
            raise ValueError('invalid finder filter')
        # 검색값을 입력한 항목만 검색 조건에 추가한다.
        # 분실·습득 종류는 정확히 비교하고, 다른 검색 항목은 입력 글자가 포함되는지 찾는다.
        if value: query = query.filter(**{field if field == 'kind' else field + '__icontains': value})
    q = request.GET.get('q', '').strip()
    # 검색어가 120자를 넘으면 잘못된 검색 요청으로 처리한다.
    if len(q) > 120: raise ValueError('invalid search')
    raw_page = request.GET.get('page', '1')
    # 페이지 번호가 기본 숫자 형식이 아니거나 1~10000 범위를 벗어나면 요청을 거절한다.
    if not raw_page.isascii() or not raw_page.isdecimal() or len(raw_page) > 5 or not 1 <= int(raw_page) <= 10000:
        raise ValueError('invalid page')
    # 검색어를 입력했다면 그 내용이 들어 있는 자료만 고른다.
    if q: query = query.filter(title__icontains=q)
    page = page_number(request)
    posts = list(query.order_by('-created_at', '-pk')[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'posts': [dict(finder_data(post), isOwn=student(request) and post.owner_id == request.user.pk) for post in posts[:20]], 'hasMore': len(posts) > 20, 'hasNext': len(posts) > 20, 'page': page})


# 공개 범위와 소유권을 검사하고 수정된 글은 다시 공개 심사 대기 상태로 돌린다.
# 분실물 글 하나를 조회·수정·종료·삭제한다.
@endpoint(['GET', 'PATCH', 'DELETE'])
def finder_item(request, pk):
    # 조회 요청이면 저장된 내용을 보여 준다. 내용을 바꾸는 요청은 아래에서 따로 검사한다.
    if request.method == 'GET':
        allowed = Q(public_approval='APPROVED', status='ACTIVE')
        # 인증을 마친 학생이면 학생에게 허용된 범위까지 글을 보여 준다.
        if student(request): allowed |= Q(owner=request.user)
        post = FinderPost.objects.filter(allowed, pk=pk).first()
        # 글을 찾았으면 내용을 보내고, 없으면 찾을 수 없다는 응답을 보낸다.
        return JsonResponse({'post': finder_data(post)}) if post else error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
    denied = auth_error(request)
    # 앞선 권한 검사에서 거절 사유가 나왔다면 실제 작업을 하지 않고 그 결과를 보낸다.
    if denied is not None: return denied
    with transaction.atomic():
        post = FinderPost.objects.select_for_update().filter(pk=pk).first()
        # 해당 글을 찾을 수 없으면 더 진행하지 않는다.
        if not post: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
        # 글 작성자가 아니면 글을 수정하거나 삭제할 수 없다.
        if post.owner_id != request.user.pk: return error('FORBIDDEN', '작성자만 변경할 수 있습니다.', 403)
        # 삭제 요청이면 이 데이터를 삭제하고 결과를 돌려준다.
        if request.method == 'DELETE':
            post.delete()
            return JsonResponse({'ok': True})
        data = body(request)
        # 진행 중인 분실물 글만 바꿀 수 있다. 이미 종료된 글에는 이 작업을 허용하지 않는다.
        if post.status != 'ACTIVE': return error('CONFLICT', '종료된 게시물입니다.', 409)
        # 글 종료 요청이면 내용을 수정하는 대신 상태만 종료로 바꾼다.
        if data == {'action': 'close'}:
            post.status = 'CLOSED'
            post.save(update_fields=['status'])
            return JsonResponse({'ok': True})
        form = FinderForm(finder_form_data(data), instance=post)
        # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
        if not form.is_valid(): return error('INVALID_INPUT', '게시물 정보를 확인해 주세요.', 400)
        changed = form.save(commit=False)
        changed.public_approval = 'PENDING'
        changed.save()
        return JsonResponse({'ok': True, 'post': finder_data(changed)})


# 본인의 활성 글과 반대 유형 후보를 비교해 70점 이상 상위 20개를 반환한다.
# 반대 종류의 글을 찾아 비슷한 정도를 점수로 계산한다.
@endpoint(['GET'], auth=True)
def finder_matches(request, pk):
    source = FinderPost.objects.filter(pk=pk, owner=request.user, status='ACTIVE').first()
    # 비교 기준으로 쓸 분실물 글을 찾지 못하면 더 진행하지 않는다.
    if not source: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
    candidates = FinderPost.objects.filter(Q(public_approval='APPROVED') | Q(owner=request.user), status='ACTIVE').exclude(kind=source.kind).exclude(pk=pk)
    matches = sorted(((score_match(source, item), item) for item in candidates), key=lambda item: (-item[0], str(item[1].pk)))
    # 목록에서 필요한 조건에 맞는 항목만 골라 결과에 넣는다.
    return JsonResponse({'matches': [{'score': score_breakdown(source, post), 'scoreTotal': score, 'post': finder_data(post)} for score, post in matches if score >= 70][:20]})


# 공개 동아리와 현재 모집 여부를 조회하고 20개씩 페이지 처리한다.
# 공개 동아리 목록을 검색한다.
@endpoint(['GET'])
def club_collection(request):
    now = timezone.now()
    recruiting = Recruitment.objects.filter(club_id=OuterRef('pk'), is_open=True, opens_at__lte=now, closes_at__gt=now)
    clubs = Club.objects.filter(is_public=True).annotate(recruiting=Exists(recruiting)).order_by('name', 'pk')
    page = page_number(request)
    rows = list(clubs[(page - 1) * 20:page * 20 + 1])
    return JsonResponse({'clubs': [{'id': str(c.pk), 'slug': c.slug, 'name': c.name, 'category': c.category, 'introduction': c.introduction, 'recruiting': c.recruiting} for c in rows[:20]], 'hasNext': len(rows) > 20, 'page': page})


# 본인 지원과 운영자 지원 목록을 구분하고 모집 기간·중복 지원·종결 상태를 검사한다.
# 동아리 지원서를 제출하거나 담당자가 지원 상태를 확인·변경한다.
@endpoint(['GET', 'POST', 'PATCH'], auth=True)
def club_applications(request, pk):
    club = lookup_club(pk)
    # 해당 동아리가 없으면 찾을 수 없다는 응답을 보낸다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 비공개 동아리는 그 동아리를 관리할 권한이 있는 사람만 볼 수 있다.
    if not club.is_public and not _club_manage(request.user, club):
        return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 조회 요청이면 저장된 내용을 보여 준다. 내용을 바꾸는 요청은 아래에서 따로 검사한다.
    if request.method == 'GET':
        # 내 내역 보기 요청이면 현재 사용자의 지원서만 골라 준다.
        if request.GET.get('mine') == '1':
            apps = Application.objects.filter(recruitment__club=club, applicant=request.user).select_related('recruitment')
            return JsonResponse({'applications': [{'recruitmentId': str(a.recruitment.public_id), 'status': a.status} for a in apps]})
        # 전체 관리자도 아니고 해당 동아리 운영자도 아니면 지원서를 열람·관리할 수 없다.
        if not request.user.is_superuser and not ClubMember.objects.filter(club=club, user=request.user, role__in=['owner', 'manager']).exists():
            return error('FORBIDDEN', '권한이 없습니다.', 403)
        apps = Application.objects.filter(recruitment__club=club).select_related('applicant', 'recruitment')[:100]
        return JsonResponse({'applications': [{'id': str(a.public_id), 'recruitmentId': str(a.recruitment.public_id), 'recruitmentTitle': a.recruitment.title, 'applicantName': a.applicant.first_name or a.applicant.username, 'answers': a.answers, 'status': a.status, 'createdAt': a.created_at.isoformat()} for a in apps]})
    data = body(request)
    # 수정 요청이면 기존 데이터를 바꿀 권한과 입력값을 확인한다.
    if request.method == 'PATCH':
        from .models import AuditLog
        # 이 동아리의 운영자나 전체 관리자가 아니면 관리 작업을 막는다.
        if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
        status = data.get('status')
        # 지원서 상태는 검토 중·합격·거절 중 하나로만 바꿀 수 있다.
        if status not in ('IN_REVIEW', 'ACCEPTED', 'REJECTED'):
            return error('INVALID_INPUT', '지원 상태를 확인해 주세요.', 400)
        with transaction.atomic():
            app = by_public_id(Application.objects.select_for_update().filter(recruitment__club=club), data.get('applicationId')).first()
            # 해당 지원서가 없으면 찾을 수 없다고 알려 준다.
            if not app: return error('NOT_FOUND', '지원서를 찾을 수 없습니다.', 404)
            # 이미 취소·합격·거절된 지원서는 다시 심사하지 않는다.
            if app.status in ('CANCELLED', 'ACCEPTED', 'REJECTED'): return error('CONFLICT', '종료된 지원입니다.', 409)
            app.status = status
            app.save(update_fields=['status'])
            AuditLog.objects.create(actor=request.user, action='application.' + status.lower(), entity_type='application', entity_id=str(app.pk))
        return JsonResponse({'ok': True})
    now = timezone.now()
    recruitment = by_public_id(Recruitment.objects.filter(club=club, club__is_public=True, is_open=True, opens_at__lte=now, closes_at__gt=now), data.get('recruitmentId')).first()
    answer = data.get('answer', '')
    # 모집 공고가 없거나 지원 답변이 비어 있거나 3000자를 넘으면 지원을 받지 않는다.
    if not recruitment or not isinstance(answer, str) or not answer.strip() or len(answer) > 3000:
        return error('INVALID_INPUT', '지원 내용을 확인해 주세요.', 400)
    # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
    try:
        with transaction.atomic():
            app = Application.objects.create(recruitment=recruitment, applicant=request.user, answers={'answer': answer.strip()})
    except IntegrityError:
        return error('CONFLICT', '이미 지원한 모집입니다.', 409)
    return JsonResponse({'ok': True, 'application': {'id': str(app.public_id), 'status': app.status}}, status=201)


# 최근 신고 최대 100건을 관리자에게 반환한다.
# 관리자가 신고 목록을 확인한다.
@endpoint(['GET'], auth=True, admin=True)
def admin_reports(request):
    from .models import Report
    rows = Report.objects.order_by('-created_at')[:100]
    return JsonResponse({'reports': [{'id': str(r.public_id), 'targetType': r.target_type, 'targetId': r.target_id, 'reason': r.reason, 'status': r.status, 'createdAt': r.created_at.isoformat()} for r in rows]})


# 신고의 현재 상태를 잠금 안에서 확인하고 상태 변경과 관리 작업 기록을 함께 저장한다.
# 관리자가 신고 처리 상태를 바꾼다.
@endpoint(['PATCH'], auth=True, admin=True)
def admin_report(request, pk):
    from .models import AuditLog, Report
    data = body(request)
    new_status = data.get('to', data.get('status'))
    previous = data.get('from')
    # 신고는 검토 완료 또는 처리 완료 상태로만 바꿀 수 있다.
    if new_status not in ('REVIEWED', 'RESOLVED'):
        return error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)
    # 이전 신고 상태로 보낸 값이 접수·검토 완료 중 하나인지 확인한다.
    if previous is not None and previous not in ('OPEN', 'REVIEWED'):
        return error('INVALID_INPUT', '신고 상태를 확인해 주세요.', 400)
    with transaction.atomic():
        report = by_public_id(Report.objects.select_for_update(), pk).first()
        # 해당 신고가 없으면 처리할 수 없다고 알려 준다.
        if not report: return error('NOT_FOUND', '신고를 찾을 수 없습니다.', 404)
        # 이미 처리된 신고, 같은 상태로 바꾸는 요청, 화면을 연 뒤 상태가 달라진 요청은 중복 처리하지 않는다.
        if report.status == 'RESOLVED' or report.status == new_status or (previous is not None and report.status != previous):
            return error('CONFLICT', '신고 상태가 변경되었습니다.', 409)
        report.status = new_status
        report.save(update_fields=['status'])
        AuditLog.objects.create(actor=request.user, action='report.' + new_status.lower(), entity_type='report', entity_id=str(report.public_id))
    return JsonResponse({'status': report.status, 'report': {'id': str(report.public_id)}})


# 초대 목록을 조회하거나 초대 코드를 발급하며 코드가 담긴 응답은 캐시하지 않는다.
# 관리자가 초대 코드를 발급하거나 발급 내역을 확인한다.
@endpoint(['GET', 'POST'], auth=True, admin=True)
def admin_invites(request):
    from .services import issue_invitation
    from .models import Invitation
    # 조회 요청이면 저장된 내용을 보여 준다. 내용을 바꾸는 요청은 아래에서 따로 검사한다.
    if request.method == 'GET':
        rows = Invitation.objects.select_related('issued_by').order_by('-created_at', '-pk')[:100]
        # 사용·폐기 시각이 있으면 읽을 수 있는 날짜 문자열로 보내고, 없으면 빈 값으로 보낸다.
        return JsonResponse({'invitations': [{'id': str(i.pk), 'issuedBy': i.issued_by.legacy_auth_id or str(i.issued_by_id), 'createdAt': i.created_at.isoformat(), 'expiresAt': i.expires_at.isoformat(), 'redeemedAt': i.redeemed_at.isoformat() if i.redeemed_at else None, 'revokedAt': i.revoked_at.isoformat() if i.revoked_at else None} for i in rows]})
    invite, code = issue_invitation(request.user)
    response = JsonResponse({'invitation': {'id': str(invite.pk), 'expiresAt': invite.expires_at.isoformat()}, 'code': code}, status=201)
    response['Cache-Control'] = 'no-store'
    return response


# 사용 또는 폐기되지 않은 초대를 잠가 폐기하고 관리 작업 기록을 남긴다.
# 아직 쓰지 않은 초대 코드를 더 이상 쓰지 못하게 한다.
@endpoint(['POST'], auth=True, admin=True)
def admin_revoke(request, pk):
    from .models import Invitation, AuditLog
    with transaction.atomic():
        invite = Invitation.objects.select_for_update().filter(pk=pk).first()
        # 해당 초대 코드가 없으면 찾을 수 없다고 알려 준다.
        if not invite: return error('NOT_FOUND', '초대 코드를 찾을 수 없습니다.', 404)
        # 이미 쓰거나 폐기한 코드는 다시 폐기하지 않는다.
        if invite.redeemed_at or invite.revoked_at: return error('CONFLICT', '폐기할 수 없는 코드입니다.', 409)
        invite.revoked_at = timezone.now()
        invite.save(update_fields=['revoked_at'])
        AuditLog.objects.create(actor=request.user, action='invitation.revoked', entity_type='invitation', entity_id=str(pk))
    return JsonResponse({'ok': True})


# 존재하고 신고 가능한 대상인지 확인하고 자기 글 신고를 막은 뒤 관리 작업 기록과 함께 저장한다.
# 다른 사람의 글에 대한 신고를 저장한다.
@endpoint(['POST'], auth=True)
def reports(request):
    from .forms import ReportForm
    from .models import AuditLog, ClubPost
    data = body(request)
    form = ReportForm({'target_type': data.get('targetType'), 'target_id': data.get('targetId'), 'reason': data.get('reason')})
    # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
    if not form.is_valid(): return error('INVALID_INPUT', '신고 내용을 확인해 주세요.', 400)
    target_type, target_id = form.cleaned_data['target_type'], form.cleaned_data['target_id']
    # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
    try:
        # 신고 대상이 거래 글이면 거래 글에서 작성자와 공개 범위를 확인한다.
        if target_type == 'market':
            target = MarketPost.objects.filter(pk=target_id).first()
            # 신고 대상 글을 찾았을 때만 작성자 번호를 읽는다. 대상이 없으면 빈 값으로 둔다.
            owner = target.owner_id if target else None
        # 신고 대상이 분실물 글이면 해당 글에서 작성자와 공개 범위를 확인한다.
        elif target_type == 'finder':
            target = FinderPost.objects.filter(pk=target_id, public_approval='APPROVED', status='ACTIVE').first()
            # 신고 대상 글을 찾았을 때만 작성자 번호를 읽는다. 대상이 없으면 빈 값으로 둔다.
            owner = target.owner_id if target else None
        else:
            target = by_public_id(ClubPost.objects.filter(is_public=True, club__is_public=True), target_id).first()
            # 신고 대상 글을 찾았을 때만 작성자 번호를 읽는다. 대상이 없으면 빈 값으로 둔다.
            owner = target.author_id if target else None
    except (ValueError, ValidationError):
        owner = None
    # 신고 대상의 작성자를 찾을 수 없으면 잘못된 대상으로 처리한다.
    if owner is None: return error('NOT_FOUND', '대상을 찾을 수 없습니다.', 404)
    # 자신이 쓴 글을 자신이 신고하지 못하게 한다.
    if owner == request.user.pk: return error('FORBIDDEN', '자신의 글은 신고할 수 없습니다.', 403)
    # 동아리 활동 글을 신고하는 경우 그 글의 작성자를 확인한다.
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


# 이후 상태 변경 요청에 사용할 다른 사이트의 대리 요청을 막는 확인값(CSRF) 쿠키를 설정한다.
# 다른 사이트가 사용자를 대신해 요청하지 못하도록 확인값을 발급한다.
@ensure_csrf_cookie
@endpoint(['GET'])
def csrf(request):
    return JsonResponse({'ok': True})


# 이메일 로그인 양식으로 인증한 뒤 로그인 상태을 만든다.
# 이메일과 비밀번호를 확인한 뒤 로그인 상태를 저장한다.
@endpoint(['POST'])
def sign_in(request):
    from django.contrib.auth import login
    from .forms import EmailLoginForm
    data = body(request)
    form = EmailLoginForm(request, data={'username': data.get('email', ''), 'password': data.get('password', '')})
    # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
    if not form.is_valid(): return error('INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인해 주세요.', 401)
    login(request, form.get_user())
    return JsonResponse({'ok': True})


# 현재 로그인 로그인 상태을 종료한다.
# 현재 로그인 상태를 지운다.
@endpoint(['POST'])
def sign_out(request):
    from django.contrib.auth import logout
    logout(request)
    return JsonResponse({'ok': True})


# 가입 정보를 검증해 사용자를 만들고 서명된 이메일 확인 링크를 보낸다.
# 가입 내용을 검사하고 이메일 확인 안내를 보낸다.
@endpoint(['POST'])
def sign_up(request):
    from django.core import signing
    from django.core.mail import send_mail
    from django.urls import reverse
    from .forms import RegisterForm
    data = body(request)
    form = RegisterForm({'username': data.get('name'), 'email': data.get('email'), 'password1': data.get('password'), 'password2': data.get('password')})
    # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
    if not form.is_valid(): return error('INVALID_INPUT', '가입 정보를 확인해 주세요.', 400)
    # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
    try:
        with transaction.atomic():
            user = form.save()
    except IntegrityError:
        return error('INVALID_INPUT', '가입 정보를 사용할 수 없습니다.', 400)
    token = signing.dumps({'user': user.pk, 'email': user.email}, salt='email-verification')
    send_mail('GwgCommunity 이메일 확인', f'이메일 확인 링크: {request.build_absolute_uri(reverse("verify-email", args=[token]))}', None, [user.email])
    return JsonResponse({'ok': True}, status=201)


# 슈퍼유저 또는 해당 동아리 대표·운영자인지 확인한다.
# 관리자 또는 해당 동아리 운영자인지 확인한다.
def _club_manage(user, club):
    return user.is_superuser or ClubMember.objects.filter(club=club, user=user, role__in=['owner', 'manager']).exists()


# 고유 번호(UUID) 또는 슬러그로 동아리를 조회한다.
# 동아리 번호로 동아리를 찾는다.
def lookup_club(identifier):
    # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
    try:
        return Club.objects.filter(Q(pk=uuid.UUID(str(identifier))) | Q(slug=identifier)).first()
    except ValueError:
        return Club.objects.filter(slug=identifier).first()


# 공개 동아리 상세를 반환하고 수정 시 운영 권한과 관리 작업 기록을 적용한다.
# 동아리 정보를 조회하거나 담당자가 수정한다.
@endpoint(['GET', 'PATCH'])
def club_item(request, pk):
    from .forms import ClubForm
    from .models import AuditLog
    club = lookup_club(pk)
    # 해당 동아리가 없으면 찾을 수 없다는 응답을 보낸다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 조회 요청이면 저장된 내용을 보여 준다. 내용을 바꾸는 요청은 아래에서 따로 검사한다.
    if request.method == 'GET':
        # 동아리가 비공개라면 활동 글을 외부에 보여 주지 않는다.
        if not club.is_public: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
        return JsonResponse({'club': {'id': str(club.pk), 'slug': club.slug, 'name': club.name, 'category': club.category, 'introduction': club.introduction, 'isPublic': club.is_public, 'posts': [{'id': str(p.public_id), 'title': p.title, 'content': p.content, 'createdAt': p.created_at.isoformat()} for p in club.posts.filter(is_public=True)[:100]], 'recruitments': [{'id': str(r.public_id), 'title': r.title, 'description': r.description, 'opensAt': r.opens_at.isoformat(), 'closesAt': r.closes_at.isoformat(), 'isOpen': r.is_open} for r in club.recruitments.order_by('opens_at')[:100]]}})
    denied = auth_error(request)
    # 앞선 권한 검사에서 거절 사유가 나왔다면 실제 작업을 하지 않고 그 결과를 보낸다.
    if denied is not None: return denied
    # 이 동아리의 운영자나 전체 관리자가 아니면 관리 작업을 막는다.
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    form = ClubForm({'slug': club.slug, 'name': data.get('name'), 'category': data.get('category'), 'introduction': data.get('introduction'), 'is_public': data.get('isPublic', False)}, instance=club)
    # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
    if not form.is_valid(): return error('INVALID_INPUT', '동아리 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        form.save()
        AuditLog.objects.create(actor=request.user, action='club.updated', entity_type='club', entity_id=str(club.pk))
    return JsonResponse({'ok': True})


# 동아리 운영자의 활동 글 작성과 관리 작업 기록을 처리한다.
# 동아리 운영자가 활동 글을 저장한다.
@endpoint(['POST'], auth=True)
def club_post(request, pk):
    from .forms import ClubPostForm
    from .models import AuditLog
    club = lookup_club(pk)
    # 해당 동아리가 없으면 찾을 수 없다는 응답을 보낸다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 이 동아리의 운영자나 전체 관리자가 아니면 관리 작업을 막는다.
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    form = ClubPostForm({'title': data.get('title'), 'content': data.get('content'), 'is_public': data.get('isPublic', False)})
    # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
    if not form.is_valid(): return error('INVALID_INPUT', '게시물을 확인해 주세요.', 400)
    post = form.save(commit=False)
    post.club, post.author = club, request.user
    with transaction.atomic():
        post.save()
        AuditLog.objects.create(actor=request.user, action='club.post.created', entity_type='club_post', entity_id=str(post.pk))
    return JsonResponse({'post': {'id': str(post.public_id)}}, status=201)


# 동아리 운영자가 모집을 생성·수정할 때 양식 검증과 관리 작업 기록을 적용한다.
# 동아리 모집 공고를 만들거나 수정한다.
@endpoint(['POST', 'PATCH'], auth=True)
def club_recruitments(request, pk):
    from .forms import RecruitmentForm
    from .models import AuditLog
    club = lookup_club(pk)
    # 해당 동아리가 없으면 찾을 수 없다는 응답을 보낸다.
    if not club: return error('NOT_FOUND', '동아리를 찾을 수 없습니다.', 404)
    # 이 동아리의 운영자나 전체 관리자가 아니면 관리 작업을 막는다.
    if not _club_manage(request.user, club): return error('FORBIDDEN', '권한이 없습니다.', 403)
    data = body(request)
    instance = None
    # 수정 요청이면 기존 데이터를 바꿀 권한과 입력값을 확인한다.
    if request.method == 'PATCH':
        instance = by_public_id(Recruitment.objects.filter(club=club), data.get('id')).first()
        # 기존 모집 공고가 없으면 새 공고를 만드는 경우로 처리한다.
        if not instance: return error('NOT_FOUND', '모집 공고를 찾을 수 없습니다.', 404)
    form = RecruitmentForm({'title': data.get('title'), 'description': data.get('description'), 'opens_at': data.get('opensAt'), 'closes_at': data.get('closesAt'), 'is_open': data.get('isOpen', False)}, instance=instance)
    # 필수 내용이나 값의 형식이 잘못되었다면 저장하지 않고 입력 오류를 알려 준다.
    if not form.is_valid(): return error('INVALID_INPUT', '모집 정보를 확인해 주세요.', 400)
    recruitment = form.save(commit=False)
    recruitment.club = club
    with transaction.atomic():
        recruitment.save()
        # 기존 공고를 바꾼 작업과 새 공고를 만든 작업을 서로 다른 기록으로 남긴다.
        AuditLog.objects.create(actor=request.user, action='club.recruitment.updated' if instance else 'club.recruitment.created', entity_type='recruitment', entity_id=str(recruitment.pk))
    # 새로 만들었으면 201번, 기존 내용을 바꾸었으면 200번 성공 응답을 보낸다.
    return JsonResponse({'ok': True, 'recruitment': {'id': str(recruitment.public_id)}}, status=201 if request.method == 'POST' else 200)


# 공개 심사 대기 중인 활성 분실물과 변경 감지용 검토 토큰을 반환한다.
# 관리자가 공개 심사를 기다리는 분실물 글을 확인한다.
@endpoint(['GET'], auth=True, admin=True)
def admin_finder_list(request):
    from .views import finder_review_token
    posts = FinderPost.objects.filter(public_approval='PENDING', status='ACTIVE').order_by('-created_at')[:100]
    return JsonResponse({'posts': [dict(finder_data(p), reviewToken=finder_review_token(p)) for p in posts]})


# 잠긴 게시물의 상태와 검토 토큰을 재확인해 오래된 심사를 거부한다.
# 분실물 글의 최신 내용을 확인한 뒤 공개를 승인하거나 거절한다.
@endpoint(['PATCH'], auth=True, admin=True)
def admin_finder_item(request, pk):
    from hmac import compare_digest
    from .models import AuditLog
    from .views import finder_review_token
    data = body(request)
    decision, token = data.get('decision'), data.get('reviewToken')
    # 승인·거절 중 하나를 보냈는지, 최신 글 확인값도 보냈는지 검사한다.
    if decision not in ('APPROVED', 'REJECTED') or not isinstance(token, str):
        return error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        post = FinderPost.objects.select_for_update().filter(pk=pk).first()
        # 해당 글을 찾을 수 없으면 더 진행하지 않는다.
        if not post: return error('NOT_FOUND', '게시물을 찾을 수 없습니다.', 404)
        # 진행 중인 심사 대기 글이고 확인값도 최신 내용과 맞아야 심사한다. 오래된 화면으로 새 내용을 승인하지 못하게 한다.
        if post.status != 'ACTIVE' or post.public_approval != 'PENDING' or not compare_digest(token, finder_review_token(post)):
            return error('CONFLICT', '게시물이 변경되었습니다. 다시 확인해 주세요.', 409)
        post.public_approval = decision
        post.save(update_fields=['public_approval'])
        AuditLog.objects.create(actor=request.user, action='finder.' + decision.lower(), entity_type='finder', entity_id=str(pk))
    return JsonResponse({'ok': True})


# 심사 대기 중인 이미지 최대 100건을 조회한다.
# 관리자가 심사할 사진 목록을 확인한다.
@endpoint(['GET'], auth=True, admin=True)
def admin_media_list(request):
    from .models import MediaAsset
    assets = MediaAsset.objects.filter(moderation='PENDING').order_by('-created_at')[:100]
    # 연결된 글이 있으면 글 번호를 보내고, 없으면 빈 값으로 보낸다.
    return JsonResponse({'media': [{'id': str(a.pk), 'contentType': a.content_type, 'size': a.size, 'createdAt': a.created_at.isoformat(), 'marketPostId': str(a.market_post_id) if a.market_post_id else None, 'finderPostId': str(a.finder_post_id) if a.finder_post_id else None} for a in assets]})


# 대기 중인 이미지만 승인 또는 거부하고 관리 작업 기록을 남긴다.
# 관리자가 사진 공개를 승인하거나 거절한다.
@endpoint(['PATCH'], auth=True, admin=True)
def admin_media_item(request, pk):
    from .models import AuditLog, MediaAsset
    decision = body(request).get('decision')
    # 사진이나 글의 심사 결과는 승인 또는 거절만 허용한다.
    if decision not in ('APPROVED', 'REJECTED'): return error('INVALID_INPUT', '검토 정보를 확인해 주세요.', 400)
    with transaction.atomic():
        asset = MediaAsset.objects.select_for_update().filter(pk=pk).first()
        # 해당 사진이 없으면 찾을 수 없다고 알려 준다.
        if not asset: return error('NOT_FOUND', '사진을 찾을 수 없습니다.', 404)
        # 심사 대기 중인 사진만 심사할 수 있다. 이미 심사한 사진의 중복 처리를 막는다.
        if asset.moderation != 'PENDING': return error('CONFLICT', '이미 검토된 사진입니다.', 409)
        asset.moderation = decision
        asset.save(update_fields=['moderation'])
        AuditLog.objects.create(actor=request.user, action='media.' + decision.lower(), entity_type='media', entity_id=str(pk))
    return JsonResponse({'ok': True})


# 자기 계정 변경을 막고 계정 상태 및 로그인 상태 버전을 변경해 기존 로그인 상태을 무효화한다.
# 관리자가 계정 이용을 정지하거나 정지를 푼다.
@endpoint(['POST'], auth=True, admin=True)
def admin_user_status(request, pk):
    from .models import AuditLog, User
    action = body(request).get('action')
    # 계정 정지와 정지 해제 이외의 작업은 받지 않는다.
    if action not in ('suspend', 'unsuspend'): return error('FORBIDDEN', '요청할 수 없습니다.', 403)
    with transaction.atomic():
        users = User.objects.select_for_update()
        user = users.filter(legacy_auth_id=str(pk)).first()
        # 공개 번호로 사용자를 못 찾았고 짧은 숫자 번호를 받았다면 예전 내부 번호로도 찾아본다.
        if user is None and str(pk).isdecimal() and len(str(pk)) <= 18:
            user = users.filter(pk=int(pk)).first()
        # 해당 사용자가 없으면 작업을 멈춘다.
        if not user: return error('NOT_FOUND', '회원을 찾을 수 없습니다.', 404)
        # 관리자가 자기 계정을 정지하지 못하게 한다.
        if user.pk == request.user.pk: return error('FORBIDDEN', '자신의 계정은 정지할 수 없습니다.', 403)
        # 요청한 정지 상태가 이미 적용돼 있으면 같은 작업을 다시 하지 않는다.
        if (action == 'suspend') == (not user.is_active): return error('CONFLICT', '이미 요청한 상태입니다.', 409)
        user.is_active = action == 'unsuspend'
        user.session_version += 1
        user.save(update_fields=['is_active', 'session_version'])
        AuditLog.objects.create(actor=request.user, action='user.' + action, entity_type='user', entity_id=user.legacy_auth_id or str(user.pk))
    return JsonResponse({'ok': True})


# 최대 네 개의 중복 없는 미연결 이미지를 소유자 기준으로 잠가 게시물에 연결한다.
# 사진이 내 소유이고 아직 다른 글에 붙지 않았는지 확인한 뒤 연결한다.
def attach_images(owner, post, ids):
    from .models import MediaAsset
    # 사진 번호는 목록으로 보내야 하고 한 글에는 최대 4장만 연결한다.
    if not isinstance(ids, list) or len(ids) > 4:
        raise ValidationError('invalid images')
    # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
    try:
        keys = [uuid.UUID(str(item)) for item in ids]
    except (ValueError, TypeError, AttributeError):
        raise ValidationError('invalid images')
    # 같은 사진 번호를 여러 번 보냈으면 중복 연결을 막는다.
    if len(set(keys)) != len(keys):
        raise ValidationError('duplicate images')
    # 동일 이미지의 중복 연결을 피하도록 미연결 자산을 잠금 순서대로 조회한다.
    assets = list(MediaAsset.objects.select_for_update().filter(pk__in=keys, owner=owner, market_post__isnull=True, finder_post__isnull=True).order_by('pk'))
    # 내가 소유한 미연결 사진을 모두 찾지 못했다면 글에 연결하지 않는다.
    if len(assets) != len(keys):
        raise ValidationError('images not available')
    # 선택한 사진을 하나씩 확인하며 글과 연결한다.
    for asset in assets:
        # 거래 글이면 거래용 사진 연결 칸에 저장하고, 그 외에는 분실물 글에 연결한다.
        if isinstance(post, MarketPost):
            asset.market_post = post
            asset.save(update_fields=['market_post'])
        else:
            asset.finder_post = post
            asset.save(update_fields=['finder_post'])


# 단일 업로드를 정제해 비공개 저장하고 DB 생성 실패 시 저장 객체를 정리한다.
# 사진 한 장을 검사해 저장하고, 저장 도중 실패하면 남은 파일을 지운다.
@endpoint(['POST'], auth=True)
def media_upload(request):
    import logging
    from . import media
    from .models import MediaAsset
    # 업로드 요청은 file이라는 이름의 사진 한 장만 허용하고 다른 항목은 받지 않는다.
    if request.content_type != 'multipart/form-data' or set(request.FILES) != {'file'} or len(request.FILES.getlist('file')) != 1 or request.POST:
        return error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)
    upload = request.FILES.get('file')
    # 사진 파일이 실제로 없으면 업로드를 거절한다.
    if upload is None: return error('INVALID_INPUT', '이미지 파일을 확인해 주세요.', 400)
    data, content_type = media.sanitize(upload)
    # 객체 저장소는 DB 함께 성공하거나 함께 취소되는 저장 작업 밖이므로 메타데이터 저장 실패 시 직접 삭제한다.
    key = media.put(data, content_type)
    # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
    try:
        asset = MediaAsset.objects.create(owner=request.user, storage_key=key, content_type=content_type, size=len(data))
    except Exception:
        # 입력 확인과 저장을 시도한다. 입력·권한·저장 오류가 나면 아래 오류 처리에서 알맞은 실패 응답을 보낸다.
        try:
            media.delete(key)
        except Exception:
            logging.getLogger(__name__).exception('Failed to clean up uncommitted image')
        raise
    data = {'id': str(asset.pk), 'contentType': asset.content_type, 'size': asset.size}
    return JsonResponse({'asset': data, 'media': data}, status=201)
