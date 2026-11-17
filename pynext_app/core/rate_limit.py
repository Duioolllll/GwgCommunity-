# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
# 요청 제한: 요청자별 키와 시간 창을 DB에 기록해 인증·업무 요청의 반복 시도를 제한한다.
import hashlib
import hmac
import ipaddress
import json
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from .models import RequestLimit


# 로그인·가입·재발송·비밀번호 재설정에 DB 기반 시간 창 제한을 적용한다.
class AuthenticationRateLimitMiddleware:
    """DB-backed limits shared across browser and API login paths."""
    ROUTES = {
        '/auth/login/': ('login', 30, 15),
        '/api/auth/sign-in/email': ('login', 30, 15),
        '/auth/register/': ('register', 10, 60),
        '/api/auth/sign-up/email': ('register', 10, 60),
        '/auth/resend/': ('resend', 10, 60),
        '/auth/password/reset/': ('password-reset', 10, 60),
    }

    # 이 기능이 사용할 다음 처리 함수를 기억해 둔다.
    def __init__(self, get_response):
        self.get_response = get_response

    # IP 또는 이메일 식별자를 비밀키 기반 원문을 숨긴 확인값(HMAC)으로 변환해 원문 저장을 피한다.
    # 원래 접속 정보를 그대로 남기지 않고 횟수 확인용 값을 만든다.
    def _key(self, identity):
        return hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()

    # JSON API와 브라우저 양식에서 로그인 이메일을 표기 통일해 추출한다.
    # 로그인 요청에서 이메일을 찾아 표기를 통일한다.
    def _login_email(self, request):
        # JSON 요청이면 JSON에서 이메일을 읽고, 그 외에는 입력 폼에서 읽는다.
        if request.content_type == 'application/json':
            # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
            try:
                data = json.loads(request.body)
                # 올바른 모양의 이메일만 횟수 제한에 사용하고, 잘못된 값은 빈 문자열로 처리한다.
                value = data.get('email', '') if isinstance(data, dict) else ''
            except (ValueError, TypeError):
                return ''
        else:
            value = request.POST.get('username', '')
        # 이메일이 문자열이 아니면 사용할 수 없는 값으로 처리한다.
        if not isinstance(value, str):
            return ''
        value = value.strip().lower()
        # 올바른 모양의 이메일만 횟수 제한에 사용하고, 잘못된 값은 빈 문자열로 처리한다.
        return value if 0 < len(value) <= 254 and '@' in value else ''

    # 신뢰 프록시만 전달 IP를 사용하고 IP 및 로그인 계정 버킷을 잠가 요청을 제한한다.
    # 요청이 들어올 때마다 필요한 검사와 응답 처리를 실행한다.
    def __call__(self, request):
        config = self.ROUTES.get(request.path)
        # 횟수 제한 대상의 저장 요청일 때만 요청 횟수를 확인한다.
        if request.method == 'POST' and config:
            group, max_attempts, minutes = config
            peer = request.META.get('REMOTE_ADDR', '')
            # 신뢰하도록 설정한 중계 서버를 거친 요청일 때만 전달된 원래 접속 주소를 믿는다.
            if peer in settings.TRUSTED_PROXY_IPS:
                peer = request.META.get('HTTP_X_REAL_IP', '')
            # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
            try:
                peer = str(ipaddress.ip_address(peer))
            except ValueError:
                peer = 'unknown'
            limits = [(self._key(f'ip:{group}:{peer}'), max_attempts, minutes)]
            # 로그인 요청은 접속 주소뿐 아니라 계정별 시도 횟수도 함께 제한한다.
            if group == 'login':
                email = self._login_email(request)
                # 이메일을 읽을 수 있을 때만 해당 계정의 로그인 횟수를 센다.
                if email:
                    limits.append((self._key(f'login-account:{email}'), 15, 15))
            now = timezone.now()
            with transaction.atomic():
                buckets = []
                # 복수 버킷의 잠금 순서를 고정하고 모두 통과한 경우에만 횟수를 올린다.
                # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                for key, maximum, window in sorted(limits):
                    RequestLimit.objects.get_or_create(key=key, defaults={'window_start': now})
                    bucket = RequestLimit.objects.select_for_update().get(pk=key)
                    # 정해 둔 제한 시간이 지났으면 횟수를 새로 세기 시작한다.
                    if bucket.window_start <= now - timedelta(minutes=window):
                        bucket.window_start, bucket.count = now, 0
                    # 허용 횟수를 이미 채웠으면 잠시 뒤 다시 시도하도록 요청을 막는다.
                    if bucket.count >= maximum:
                        response = HttpResponse('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', status=429)
                        response['Retry-After'] = str(window * 60)
                        return response
                    buckets.append(bucket)
                # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                for bucket in buckets:
                    bucket.count += 1
                    bucket.save(update_fields=['window_start', 'count'])
        return self.get_response(request)
