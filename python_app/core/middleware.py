# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `request.user.is_authenticated or request.path.startswith(('/auth/', '/api/auth/', '/admin/', '/api/admin/', '/api/media', '/media/', '/api/csrf'))`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
# 기능 `PrivateResponseMiddleware`: Never share sessions, moderation queues, or private media via a proxy cache..
class PrivateResponseMiddleware:
    """Never share sessions, moderation queues, or private media via a proxy cache."""

    # 기능 `__init__`: 먼저 `self.get_response = get_response`로 상태 또는 조회 조건을 갱신한다.
    def __init__(self, get_response):
        self.get_response = get_response

    # 인증 사용자 응답과 지정된 인증·관리·미디어 경로는 공유 캐시를 금지한다.
    # 기능 `__call__`: 먼저 `response = self.get_response(request)`로 상태 또는 조회 조건을 갱신한다.
    def __call__(self, request):
        response = self.get_response(request)
        # 조건 분기 `request.user.is_authenticated or request.path.startswith(('/auth/', '/api/auth/', '/admin/', '/api/admin/', '/api/media', '/media/', '/api/csrf'))`: 참이면 먼저 `response['Cache-Control'] = 'private, no-store'`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
        if request.user.is_authenticated or request.path.startswith(('/auth/', '/api/auth/', '/admin/', '/api/admin/', '/api/media', '/media/', '/api/csrf')):
            response['Cache-Control'] = 'private, no-store'
        return response
