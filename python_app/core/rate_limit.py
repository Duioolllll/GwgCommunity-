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

    def __init__(self, get_response):
        self.get_response = get_response

    def _key(self, identity):
        return hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()

    def _login_email(self, request):
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
                value = data.get('email', '') if isinstance(data, dict) else ''
            except (ValueError, TypeError):
                return ''
        else:
            value = request.POST.get('username', '')
        if not isinstance(value, str):
            return ''
        value = value.strip().lower()
        return value if 0 < len(value) <= 254 and '@' in value else ''

    def __call__(self, request):
        config = self.ROUTES.get(request.path)
        if request.method == 'POST' and config:
            group, max_attempts, minutes = config
            peer = request.META.get('REMOTE_ADDR', '')
            if peer in settings.TRUSTED_PROXY_IPS:
                peer = request.META.get('HTTP_X_REAL_IP', '')
            try:
                peer = str(ipaddress.ip_address(peer))
            except ValueError:
                peer = 'unknown'
            limits = [(self._key(f'ip:{group}:{peer}'), max_attempts, minutes)]
            if group == 'login':
                email = self._login_email(request)
                if email:
                    # The email is never stored, and the bucket is shared by both
                    # login routes and all IP addresses.
                    limits.append((self._key(f'login-account:{email}'), 15, 15))
            now = timezone.now()
            with transaction.atomic():
                buckets = []
                for key, maximum, window in sorted(limits):
                    RequestLimit.objects.get_or_create(key=key, defaults={'window_start': now})
                    bucket = RequestLimit.objects.select_for_update().get(pk=key)
                    if bucket.window_start <= now - timedelta(minutes=window):
                        bucket.window_start, bucket.count = now, 0
                    if bucket.count >= maximum:
                        response = HttpResponse('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', status=429)
                        response['Retry-After'] = str(window * 60)
                        return response
                    buckets.append(bucket)
                for bucket in buckets:
                    bucket.count += 1
                    bucket.save(update_fields=['window_start', 'count'])
        return self.get_response(request)
