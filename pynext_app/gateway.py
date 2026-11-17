# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Application adapter for explicit PyNext file routes.

No Django WSGI/ASGI application or reverse proxy is invoked. PyNext selects
each endpoint; named URL and error-page helpers retain existing links.
ORM, templates, session and CSRF libraries preserve data and browser contracts.
"""
from functools import lru_cache
import io
from pynext import DjangoBusyError, Response


# URL 목록 인덱스로 콜백을 고르고 경로 변환·다른 사이트의 대리 요청을 막는 확인값(CSRF) 검사 및 Django 미들웨어를 연결해 캐시한다.
# 주소별 처리 함수를 준비하고 같은 기능은 다시 사용할 수 있게 한다.
@lru_cache(maxsize=256)
def _handler(index):
    from django.conf import settings
    from django.core.handlers.exception import convert_exception_to_response
    from django.http import Http404
    from django.middleware.csrf import CsrfViewMiddleware
    from django.utils.module_loading import import_string
    from config.urls import urlpatterns
    # 일반 주소라면 해당 처리 규칙을 고르고, 정적 파일용 특수 주소라면 별도 처리할 수 있게 비워 둔다.
    spec = urlpatterns[index] if index >= 0 else None
    csrf = CsrfViewMiddleware(lambda request: None)

    # 주소에 들어 있는 번호를 읽고 다른 사이트의 대리 요청을 막는 검사를 거쳐 실제 화면·API 기능을 실행한다.
    def endpoint(request):
        # 주소에 맞는 처리 규칙이 없으면 찾을 수 없다는 응답을 만든다.
        if spec is None:
            raise Http404
        # 요청 처리를 실행한다. 도중에 오류가 나면 정해진 오류 응답으로 바꾸고 정리 작업을 마친다.
        try:
            params = {name: converter.to_python(request.route_params[name])
                      for name, converter in spec.pattern.converters.items()}
        except (ValueError, KeyError):
            raise Http404
        denied = csrf.process_view(request, spec.callback, (), params)
        # 앞선 권한 검사에서 거절 사유가 나왔다면 실제 작업을 하지 않고 그 결과를 보낸다.
        if denied is not None:
            return denied
        response = spec.callback(request, **params)
        # 아직 화면 내용을 만들지 않은 응답이면 실제 HTML을 완성한다.
        if hasattr(response, "render") and callable(response.render):
            response = response.render()
        return response

    handler = convert_exception_to_response(endpoint)
    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
    for middleware in reversed(settings.MIDDLEWARE):
        handler = convert_exception_to_response(import_string(middleware)(handler))
    return handler


# PyNext 요청 정보를 Django ASGIRequest로 변환하고 응답·쿠키를 수집한 뒤 자원을 닫는다.
# PyNext가 받은 요청을 Django 기능이 읽을 수 있는 요청으로 바꿔 실행한다.
def _execute(index, method, path, query, headers, body, peer, scheme, params):
    from django.core.handlers.asgi import ASGIRequest
    from config.urls import urlpatterns
    # 끝에 /가 필요한 주소인데 빠져 있으면 올바른 주소로 이동시킨다.
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
    # 요청 처리를 실행한다. 도중에 오류가 나면 정해진 오류 응답으로 바꾸고 정리 작업을 마친다. 성공하거나 실패해도 finally의 정리 작업은 실행한다.
    try:
        response = _handler(index)(request)
        # 주소에 맞는 처리 규칙을 고르고, 응답 본문은 전송 방식에 맞추어 바이트로 모은다.
        data = b"".join(response.streaming_content) if response.streaming else response.content
        result_headers = [(key.lower().encode("ascii"), value.encode("latin-1"))
                          for key, value in response.items()]
        result_headers.extend((b"set-cookie", cookie.output(header="").strip().encode("latin-1"))
                              for cookie in response.cookies.values())
        result_headers.append((b"content-security-policy",
                               b"default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'"))
        return response.status_code, result_headers, data
    finally:
        # 앞 단계에서 이미 응답을 만들었다면 같은 요청을 다시 처리하지 않는다.
        if response is not None:
            response.close()
        request.close()


# Django 작업 풀에서 동기 처리를 실행하고 포화 시 재시도 가능한 503을 반환한다.
# 주소와 요청 방식을 확인한 뒤 맞는 기능을 실행하고 응답을 돌려준다.
async def dispatch(request, index, params=None):
    request.query
    # 요청 처리를 실행한다. 도중에 오류가 나면 정해진 오류 응답으로 바꾸고 정리 작업을 마친다.
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
