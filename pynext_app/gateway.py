# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 조건식 `index >= 0`: 참일 때 `urlpatterns[index]`, 거짓일 때 `None`를 선택한다.
# - 단락 평가 `index >= 0 and urlpatterns[index].pattern._route.endswith('/') and (not path.endswith('/'))`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `hasattr(response, 'render') and callable(response.render)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 단락 평가 `scheme or 'http'`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 조건식 `response.streaming`: 참일 때 `b''.join(response.streaming_content)`, 거짓일 때 `response.content`를 선택한다.
# - 단락 평가 `peer or '127.0.0.1'`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `response.items()`의 각 `(key, value)`를 순회한다.
# - 컴프리헨션: `spec.pattern.converters.items()`의 각 `(name, converter)`를 순회한다.
# - 컴프리헨션: `response.cookies.values()`의 각 `cookie`를 순회한다.
# - 단락 평가 `params or {}`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
"""Application adapter for explicit PyNext file routes.

No Django WSGI/ASGI application or reverse proxy is invoked. PyNext selects
each endpoint; named URL and error-page helpers retain existing links.
ORM, templates, session and CSRF libraries preserve data and browser contracts.
"""
from functools import lru_cache
import io
from pynext import DjangoBusyError, Response


# URL 목록 인덱스로 콜백을 고르고 경로 변환·CSRF 검사 및 Django 미들웨어를 연결해 캐시한다.
# 기능 `_handler`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
@lru_cache(maxsize=256)
def _handler(index):
    from django.conf import settings
    from django.core.handlers.exception import convert_exception_to_response
    from django.http import Http404
    from django.middleware.csrf import CsrfViewMiddleware
    from django.utils.module_loading import import_string
    from config.urls import urlpatterns
    spec = urlpatterns[index] if index >= 0 else None
    csrf = CsrfViewMiddleware(lambda request: None)

    # 기능 `endpoint`: If 구문으로 이어지는 내부 처리를 실행한다.
    def endpoint(request):
        # 조건 분기 `spec is None`: 참이면 Http404 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if spec is None:
            raise Http404
        # 예외 경계: 본문을 시도하고 `(ValueError, KeyError)` 발생 시 Http404 예외를 발생시킨다.
        try:
            params = {name: converter.to_python(request.route_params[name])
                      for name, converter in spec.pattern.converters.items()}
        except (ValueError, KeyError):
            raise Http404
        denied = csrf.process_view(request, spec.callback, (), params)
        # 조건 분기 `denied is not None`: 참이면 denied을 반환한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if denied is not None:
            return denied
        response = spec.callback(request, **params)
        # 조건 분기 `hasattr(response, 'render') and callable(response.render)`: 참이면 먼저 `response = response.render()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if hasattr(response, "render") and callable(response.render):
            response = response.render()
        return response

    handler = convert_exception_to_response(endpoint)
    # 반복 `reversed(settings.MIDDLEWARE)`: 각 항목을 `middleware`에 담아 먼저 `handler = convert_exception_to_response(import_string(middleware)(handler))`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for middleware in reversed(settings.MIDDLEWARE):
        handler = convert_exception_to_response(import_string(middleware)(handler))
    return handler


# PyNext 요청 정보를 Django ASGIRequest로 변환하고 응답·쿠키를 수집한 뒤 자원을 닫는다.
# 기능 `_execute`: ImportFrom 구문으로 이어지는 내부 처리를 실행한다.
def _execute(index, method, path, query, headers, body, peer, scheme, params):
    from django.core.handlers.asgi import ASGIRequest
    from config.urls import urlpatterns
    # 조건 분기 `index >= 0 and urlpatterns[index].pattern._route.endswith('/') and (not path.endswith('/'))`: 참이면 먼저 `path += '/'`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
    if index >= 0 and urlpatterns[index].pattern._route.endswith("/") and not path.endswith("/"):
        path += "/"
    scope = {"type": "http", "http_version": "1.1", "method": method,
             "path": path, "raw_path": path.encode(), "root_path": "",
             "query_string": query, "headers": list(headers),
             "client": (peer or "127.0.0.1", 0), "server": ("localhost", 8000),
             "scheme": scheme or "http"}
    request = ASGIRequest(scope, io.BytesIO(body))
    request.route_params = params
    response = None
    # 예외 경계: 본문을 시도하고 . 성공·실패와 관계없이 마지막에 If 구문으로 이어지는 내부 처리를 실행한다.
    try:
        response = _handler(index)(request)
        data = b"".join(response.streaming_content) if response.streaming else response.content
        result_headers = [(key.lower().encode("ascii"), value.encode("latin-1"))
                          for key, value in response.items()]
        result_headers.extend((b"set-cookie", cookie.output(header="").strip().encode("latin-1"))
                              for cookie in response.cookies.values())
        result_headers.append((b"content-security-policy",
                               b"default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'"))
        return response.status_code, result_headers, data
    finally:
        # 조건 분기 `response is not None`: 참이면 먼저 `response.close()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if response is not None:
            response.close()
        request.close()


# Django 작업 풀에서 동기 처리를 실행하고 포화 시 재시도 가능한 503을 반환한다.
# 기능 `dispatch`: 먼저 `request.query`를 실행한다.
async def dispatch(request, index, params=None):
    request.query
    # 예외 경계: 본문을 시도하고 `DjangoBusyError` 발생 시 Response('Service Unavailable', status=503, headers=[(b'retry-after', b'1')])을 반환한다.
    try:
        status, headers, body = await request.resources["django"].run(
            _execute, index, request.method,
            request.state.get("original_path", request.path), request.query_string,
            request.headers, request.body, request.state.get("client_ip"),
            request.state.get("client_scheme"), params or {},
        )
    except DjangoBusyError:
        return Response("Service Unavailable", status=503, headers=[(b"retry-after", b"1")])
    return Response(body, status=status, headers=headers, media_type=None)
