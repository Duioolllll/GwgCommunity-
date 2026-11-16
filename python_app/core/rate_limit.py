# 요청 제한: 요청자별 키와 시간 창을 DB에 기록해 인증·업무 요청의 반복 시도를 제한한다.
# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 조건식 `0 < len(value) <= 254 and '@' in value`: 참일 때 `value`, 거짓일 때 `''`를 선택한다.
# - 단락 평가 `request.method == 'POST' and config`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `0 < len(value) <= 254 and '@' in value`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `isinstance(data, dict)`: 참일 때 `data.get('email', '')`, 거짓일 때 `''`를 선택한다.
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


# 인증 경로별 IP 및 로그인 이메일 버킷을 DB 잠금으로 공유해 요청을 제한한다.
# 기능 `AuthenticationRateLimitMiddleware`: DB-backed limits shared across browser and API login paths..
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

    # 기능 `__init__`: 먼저 `self.get_response = get_response`로 상태 또는 조회 조건을 갱신한다.
    def __init__(self, get_response):
        self.get_response = get_response

    # 기능 `_key`: hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()을 반환한다.
    def _key(self, identity):
        return hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()

    # 기능 `_login_email`: If 구문으로 이어지는 내부 처리를 실행한다.
    def _login_email(self, request):
        # 조건 분기 `request.content_type == 'application/json'`: 참이면 Try 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 먼저 `value = request.POST.get('username', '')`로 상태 또는 조회 조건을 갱신한다.
        if request.content_type == 'application/json':
            # 예외 경계: 본문을 시도하고 `(ValueError, TypeError)` 발생 시 ''을 반환한다.
            try:
                data = json.loads(request.body)
                value = data.get('email', '') if isinstance(data, dict) else ''
            except (ValueError, TypeError):
                return ''
        else:
            value = request.POST.get('username', '')
        # 조건 분기 `not isinstance(value, str)`: 참이면 ''을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if not isinstance(value, str):
            return ''
        value = value.strip().lower()
        return value if 0 < len(value) <= 254 and '@' in value else ''

    # 기능 `__call__`: 먼저 `config = self.ROUTES.get(request.path)`로 상태 또는 조회 조건을 갱신한다.
    def __call__(self, request):
        config = self.ROUTES.get(request.path)
        # 조건 분기 `request.method == 'POST' and config`: 참이면 먼저 `group, max_attempts, minutes = config`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if request.method == 'POST' and config:
            group, max_attempts, minutes = config
            peer = request.META.get('REMOTE_ADDR', '')
            # 조건 분기 `peer in settings.TRUSTED_PROXY_IPS`: 참이면 먼저 `peer = request.META.get('HTTP_X_REAL_IP', '')`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if peer in settings.TRUSTED_PROXY_IPS:
                peer = request.META.get('HTTP_X_REAL_IP', '')
            # 예외 경계: 본문을 시도하고 `ValueError` 발생 시 먼저 `peer = 'unknown'`로 상태 또는 조회 조건을 갱신한다.
            try:
                peer = str(ipaddress.ip_address(peer))
            except ValueError:
                peer = 'unknown'
            limits = [(self._key(f'ip:{group}:{peer}'), max_attempts, minutes)]
            # 조건 분기 `group == 'login'`: 참이면 먼저 `email = self._login_email(request)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
            if group == 'login':
                email = self._login_email(request)
                # 조건 분기 `email`: 참이면 먼저 `limits.append((self._key(f'login-account:{email}'), 15, 15))`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if email:
                    # The email is never stored, and the bucket is shared by both
                    # login routes and all IP addresses.
                    limits.append((self._key(f'login-account:{email}'), 15, 15))
            now = timezone.now()
            with transaction.atomic():
                buckets = []
                # 반복 `sorted(limits)`: 각 항목을 `(key, maximum, window)`에 담아 먼저 `RequestLimit.objects.get_or_create(key=key, defaults={'window_start': now})`를 실행한다. 항목이 없으면 본문을 건너뛴다.
                for key, maximum, window in sorted(limits):
                    RequestLimit.objects.get_or_create(key=key, defaults={'window_start': now})
                    bucket = RequestLimit.objects.select_for_update().get(pk=key)
                    # 조건 분기 `bucket.window_start <= now - timedelta(minutes=window)`: 참이면 먼저 `bucket.window_start, bucket.count = (now, 0)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                    if bucket.window_start <= now - timedelta(minutes=window):
                        bucket.window_start, bucket.count = now, 0
                    # 조건 분기 `bucket.count >= maximum`: 참이면 먼저 `response = HttpResponse('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', status=429)`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                    if bucket.count >= maximum:
                        response = HttpResponse('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', status=429)
                        response['Retry-After'] = str(window * 60)
                        return response
                    buckets.append(bucket)
                # 반복 `buckets`: 각 항목을 `bucket`에 담아 먼저 `bucket.count += 1`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
                for bucket in buckets:
                    bucket.count += 1
                    bucket.save(update_fields=['window_start', 'count'])
        return self.get_response(request)
