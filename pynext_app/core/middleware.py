# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
# 인증된 응답과 인증·관리·미디어 경로의 응답에 비공개 캐시 금지를 적용한다.
class PrivateResponseMiddleware:
    """Never share sessions, moderation queues, or private media via a proxy cache."""

    # 이 기능이 사용할 다음 처리 함수를 기억해 둔다.
    def __init__(self, get_response):
        self.get_response = get_response

    # 요청이 들어올 때마다 필요한 검사와 응답 처리를 실행한다.
    def __call__(self, request):
        response = self.get_response(request)
        # 로그인한 요청이나 인증·관리·사진 관련 응답은 다른 사람에게 재사용되지 않도록 캐시를 막는다.
        if request.user.is_authenticated or request.path.startswith(('/auth/', '/api/auth/', '/admin/', '/api/admin/', '/api/media', '/media/', '/api/csrf')):
            response['Cache-Control'] = 'private, no-store'
        return response
