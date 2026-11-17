

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


# 짧은 시간에 로그인 등을 너무 많이 시도하면 제한한다.
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


    # 이 기능을 사용할 때 필요한 기본값을 준비한다.
    def __init__(self, get_response):
        self.get_response = get_response


    # 요청자를 구분할 값을 원문이 드러나지 않는 형태로 만든다.
    def _key(self, identity):
        return hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()


    # 로그인 요청에 들어 있는 이메일을 읽는다.
    def _login_email(self, request):


        # JSON 요청이면 JSON에서 이메일을 읽고, 그 외에는 입력 폼에서 읽는다.
        if request.content_type == 'application/json':


            # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
            try:
                data = json.loads(request.body)


                # 받은 내용이 항목 이름과 값으로 된 데이터일 때만 이메일을 읽는다.
                value = data.get('email', '') if isinstance(data, dict) else ''


            # 이 종류의 오류가 나면 상황에 맞는 결과를 돌려주고 현재 함수를 끝낸다.
            except (ValueError, TypeError):
                return ''
        else:
            value = request.POST.get('username', '')


        # 이메일이 문자열이 아니면 사용할 수 없는 값으로 처리한다.
        if not isinstance(value, str):
            return ''
        value = value.strip().lower()


        # 이메일이 비어 있지 않고 254자 이하이며 @가 있을 때만 횟수 제한에 사용할 이메일로 받아들인다.
        # 여러 조건을 모두 만족해야 한다. 앞에서 만족하지 못하면 뒤 조건은 확인하지 않는다.
        return value if 0 < len(value) <= 254 and '@' in value else ''


    # 요청을 받을 때 공통 검사를 한 뒤 다음 처리로 넘긴다.
    def __call__(self, request):
        config = self.ROUTES.get(request.path)


        # 횟수 제한 대상의 저장 요청일 때만 요청 횟수를 확인한다.
        if request.method == 'POST' and config:
            group, max_attempts, minutes = config
            peer = request.META.get('REMOTE_ADDR', '')


            # 신뢰하도록 설정한 중계 서버를 거친 요청일 때만 전달된 원래 접속 주소를 믿는다.
            if peer in settings.TRUSTED_PROXY_IPS:
                peer = request.META.get('HTTP_X_REAL_IP', '')


            # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
            try:
                peer = str(ipaddress.ip_address(peer))


            # 이 종류의 오류가 나면 필요한 값을 정한 뒤 아래 처리를 계속한다.
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


                # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
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


                # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
                for bucket in buckets:
                    bucket.count += 1
                    bucket.save(update_fields=['window_start', 'count'])
        return self.get_response(request)
