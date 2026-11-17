# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
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


class HTTPParity(unittest.TestCase):
    # 여러 테스트가 함께 사용할 시험 환경을 준비한다.
    @classmethod
    def setUpClass(cls):
        cls.base = os.environ["GWG_BROWSER_URL"]

    # 각 테스트가 독립적으로 실행되도록 필요한 시험 데이터를 만든다.
    def setUp(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = build_opener(HTTPCookieProcessor(self.cookies))

    # 시험 서버에 요청을 보내 응답을 읽는다.
    def request(self, path, method="GET", body=None, headers=None):
        request = Request(self.base + path, data=body, method=method, headers=headers or {})
        # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
        try:
            response = self.opener.open(request, timeout=15)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()

    # 분실물의 공개 범위와 유사도 계산이 올바른지 확인한다.
    def test_every_route_matches_established_application(self):
        from django.test import Client
        from config.urls import urlpatterns
        baseline = Client()
        # 등록한 주소를 하나씩 읽어 PyNext가 사용할 경로 파일을 만든다.
        for spec in urlpatterns:
            path = "/" + spec.pattern._route
            # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
            for name, converter in spec.pattern.converters.items():
                # 주소가 요구하는 번호 형식에 맞는 시험용 번호를 골라 요청한다.
                value = "11111111-1111-4111-8111-111111111111" if converter.__class__.__name__ == "UUIDConverter" else "999999" if converter.__class__.__name__ == "IntConverter" else "missing"
                path = re.sub(r"<(?:(?:uuid|str|int):)?" + name + ">", value, path)
            with self.subTest(path=path):
                expected = baseline.get(path, follow=True)
                status, headers, content = self.request(path)
                self.assertEqual(status, expected.status_code)
                self.assertLess(status, 500)
                self.assertEqual(headers.get("x-framework"), "PyNext/0.1.2")
                # 성공한 JSON 응답은 화면 글자가 아니라 안에 담긴 자료를 비교한다.
                if expected.get("Content-Type", "").startswith("application/json") and status == 200:
                    self.assertEqual(json.loads(content), json.loads(expected.content))

    # 다른 사이트가 사용자를 대신해 요청하지 못하도록 확인값을 검사하는지 확인한다.
    def test_api_login_session_csrf_and_signout(self):
        from core.models import User
        User.objects.create_user(username="api", email="api@example.test", password="Api-Password-2026!", email_verified=True, student_active=True)
        status, _, content = self.request("/api/csrf")
        self.assertEqual(status, 200)
        # 응답 쿠키에서 요청 확인용 CSRF 값을 찾아 다음 시험 요청에 사용한다.
        token = next(cookie.value for cookie in self.cookies if cookie.name == "csrftoken")
        status, _, _ = self.request("/api/auth/sign-in/email", "POST", json.dumps({"email": "api@example.test", "password": "Api-Password-2026!"}).encode(), {"Content-Type": "application/json", "X-CSRFToken": token})
        self.assertEqual(status, 200)
        status, headers, content = self.request("/api/me")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(content)["user"]["email"], "api@example.test")
        self.assertIn("no-store", headers.get("cache-control", ""))
        self.assertEqual(self.request("/api/market", "POST", b"{}", {"Content-Type": "application/json"})[0], 403)
        _, _, content = self.request("/api/csrf")
        # 응답 쿠키에서 요청 확인용 CSRF 값을 찾아 다음 시험 요청에 사용한다.
        token = next(cookie.value for cookie in self.cookies if cookie.name == "csrftoken")
        self.assertEqual(self.request("/api/auth/sign-out", "POST", b"{}", {"Content-Type": "application/json", "X-CSRFToken": token})[0], 200)
        self.assertEqual(self.request("/api/me")[0], 401)

    # 요청에 대한 결과와 접근 제한이 예상대로인지 확인한다.
    def test_transport_body_and_query_limits(self):
        self.assertEqual(self.request("/api/media", "POST", b"x" * (1024 * 1024 + 1))[0], 403)
        self.assertEqual(self.request("/api/media", "POST", b"x" * (22 * 1024 * 1024 + 1))[0], 413)
        self.assertEqual(self.request("/api/market?q=%FF")[0], 400)
        self.assertEqual(self.request("/api/market/not-a-uuid")[0], 404)
        self.assertEqual(self.request("/health/database")[0], 200)


# 다른 파일에서 불러올 때는 실행하지 않고, 이 파일을 직접 실행할 때만 아래 시작 코드를 실행한다.
if __name__ == "__main__":
    # 설정 또는 요청에 담긴 GWG_PARITY_CHILD 값이 1 와 같음인 경우 아래에 적힌 작업을 진행한다. 그 외에는 서로 관련된 저장 작업을 함께 처리한다.
    if os.environ.get("GWG_PARITY_CHILD") == "1":
        import django
        django.setup()
        unittest.main()
    else:
        with isolated_server() as (copy, env):
            env["GWG_PARITY_CHILD"] = "1"
            subprocess.run([sys.executable, str(copy / "tests/http_parity.py")], env=env, check=True)
