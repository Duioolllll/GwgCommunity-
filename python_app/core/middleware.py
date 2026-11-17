

# 개인 정보가 든 응답을 다른 사람이 재사용하지 못하게 한다.
class PrivateResponseMiddleware:
    """Never share sessions, moderation queues, or private media via a proxy cache."""


    # 이 기능을 사용할 때 필요한 기본값을 준비한다.
    def __init__(self, get_response):
        self.get_response = get_response


    # 요청을 받을 때 공통 검사를 한 뒤 다음 처리로 넘긴다.
    def __call__(self, request):
        response = self.get_response(request)


        # 로그인한 사용자의 요청이거나 계정·관리·이미지 등 민감한 정보를 다루는 주소일 때 필요한 값을 정한 뒤 아래 처리를 계속한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
        if request.user.is_authenticated or request.path.startswith(('/auth/', '/api/auth/', '/admin/', '/api/admin/', '/api/media', '/media/', '/api/csrf')):
            response['Cache-Control'] = 'private, no-store'
        return response
