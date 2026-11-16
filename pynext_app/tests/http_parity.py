# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `headers or {}`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `converter.__class__.__name__ == 'UUIDConverter'`: 참일 때 `'11111111-1111-4111-8111-111111111111'`, 거짓일 때 `'999999' if converter.__class__.__name__ == 'IntConverter' else 'missing'`를 선택한다.
# - 단락 평가 `expected.get('Content-Type', '').startswith('application/json') and status == 200`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `self.cookies`의 각 `cookie`를 순회한다. `cookie.name == 'csrftoken'`가 참인 항목만 포함한다.
# - 컴프리헨션: `self.cookies`의 각 `cookie`를 순회한다. `cookie.name == 'csrftoken'`가 참인 항목만 포함한다.
# - 컴프리헨션: `response.headers.items()`의 각 `(key, value)`를 순회한다.
# - 조건식 `converter.__class__.__name__ == 'IntConverter'`: 참일 때 `'999999'`, 거짓일 때 `'missing'`를 선택한다.
"""Exercise every migrated route and authentication through actual PyNext HTTP."""
import http.cookiejar
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import unittest
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

from support import isolated_server


# 기능 `HTTPParity`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class HTTPParity(unittest.TestCase):
    # 기능 `setUpClass`: 먼저 `cls.base = os.environ['GWG_BROWSER_URL']`로 상태 또는 조회 조건을 갱신한다.
    @classmethod
    def setUpClass(cls):
        cls.base = os.environ["GWG_BROWSER_URL"]

    # 기능 `setUp`: 먼저 `self.cookies = http.cookiejar.CookieJar()`로 상태 또는 조회 조건을 갱신한다.
    def setUp(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.cookies))

    # 기능 `request`: 먼저 `request = Request(self.base + path, data=body, method=method, headers=headers or {})`로 상태 또는 조회 조건을 갱신한다.
    def request(self, path, method="GET", body=None, headers=None):
        request = Request(self.base + path, data=body, method=method, headers=headers or {})
        # 예외 경계: 본문을 시도하고 `HTTPError` 발생 시 먼저 `response = exc`로 상태 또는 조회 조건을 갱신한다.
        try:
            response = self.opener.open(request, timeout=15)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()

    # 기능 `test_every_route_matches_established_application`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
    def test_every_route_matches_established_application(self):
        from django.test import Client
        from config.urls import urlpatterns
        baseline = Client()
        # 반복 `urlpatterns`: 각 항목을 `spec`에 담아 먼저 `path = '/' + spec.pattern._route`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
        for spec in urlpatterns:
            path = "/" + spec.pattern._route
            # 반복 `spec.pattern.converters.items()`: 각 항목을 `(name, converter)`에 담아 먼저 `value = '11111111-1111-4111-8111-111111111111' if converter.__class__.__name__ == 'UUIDConverter' else '999999' if converter.__class__.__name__ == 'IntConverter' else 'missing'`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
            for name, converter in spec.pattern.converters.items():
                value = "11111111-1111-4111-8111-111111111111" if converter.__class__.__name__ == "UUIDConverter" else "999999" if converter.__class__.__name__ == "IntConverter" else "missing"
                path = re.sub(r"<(?:(?:uuid|str|int):)?" + name + ">", value, path)
            with self.subTest(path=path):
                expected = baseline.get(path, follow=True)
                status, headers, content = self.request(path)
                self.assertEqual(status, expected.status_code)
                self.assertLess(status, 500)
                self.assertEqual(headers.get("x-framework"), "PyNext/0.1.2")
                # 조건 분기 `expected.get('Content-Type', '').startswith('application/json') and status == 200`: 참이면 먼저 `self.assertEqual(json.loads(content), json.loads(expected.content))`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                if expected.get("Content-Type", "").startswith("application/json") and status == 200:
                    self.assertEqual(json.loads(content), json.loads(expected.content))

    # 기능 `test_api_login_session_csrf_and_signout`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
    def test_api_login_session_csrf_and_signout(self):
        from core.models import User
        User.objects.create_user(username="api", email="api@example.test", password="Api-Password-2026!", email_verified=True, student_active=True)
        status, _, content = self.request("/api/csrf")
        self.assertEqual(status, 200)
        token = next(cookie.value for cookie in self.cookies if cookie.name == "csrftoken")
        status, _, _ = self.request("/api/auth/sign-in/email", "POST", json.dumps({"email": "api@example.test", "password": "Api-Password-2026!"}).encode(), {"Content-Type": "application/json", "X-CSRFToken": token})
        self.assertEqual(status, 200)
        status, headers, content = self.request("/api/me")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(content)["user"]["email"], "api@example.test")
        self.assertIn("no-store", headers.get("cache-control", ""))
        self.assertEqual(self.request("/api/market", "POST", b"{}", {"Content-Type": "application/json"})[0], 403)
        _, _, content = self.request("/api/csrf")
        token = next(cookie.value for cookie in self.cookies if cookie.name == "csrftoken")
        self.assertEqual(self.request("/api/auth/sign-out", "POST", b"{}", {"Content-Type": "application/json", "X-CSRFToken": token})[0], 200)
        self.assertEqual(self.request("/api/me")[0], 401)

    # 기능 `test_transport_body_and_query_limits`: 먼저 `self.assertEqual(self.request('/api/media', 'POST', b'x' * (1024 * 1024 + 1))[0], 403)`를 실행한다.
    def test_transport_body_and_query_limits(self):
        # A body > 1 MiB reaches CSRF validation, instead of the old transport 413.
        self.assertEqual(self.request("/api/media", "POST", b"x" * (1024 * 1024 + 1))[0], 403)
        self.assertEqual(self.request("/api/media", "POST", b"x" * (22 * 1024 * 1024 + 1))[0], 413)
        self.assertEqual(self.request("/api/market?q=%FF")[0], 400)
        self.assertEqual(self.request("/api/market/not-a-uuid")[0], 404)
        self.assertEqual(self.request("/health/database")[0], 200)


# 조건 분기 `__name__ == '__main__'`: 참이면 If 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if __name__ == "__main__":
    # 조건 분기 `os.environ.get('GWG_PARITY_CHILD') == '1'`: 참이면 Import 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 With 구문으로 이어지는 내부 처리를 실행한다.
    if os.environ.get("GWG_PARITY_CHILD") == "1":
        import django
        django.setup()
        unittest.main()
    else:
        with isolated_server() as (copy, env):
            env["GWG_PARITY_CHILD"] = "1"
            subprocess.run([sys.executable, str(copy / "tests/http_parity.py")], env=env, check=True)
