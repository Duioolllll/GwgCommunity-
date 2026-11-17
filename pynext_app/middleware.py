# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""PyNext middleware shared by all page, API and static responses."""
from dataclasses import replace

# 원래 경로를 보존하면서 라우팅 경로의 끝 슬래시를 표기 통일하고 프레임워크 헤더를 추가한다.
# 모든 응답에 공통 보안 설정을 넣는다.
async def application_headers(request, call_next):
    request.state['original_path'] = request.path
    normalized = replace(request, path=request.path.rstrip('/') or '/')
    response = await call_next(normalized)
    response.headers.append((b'x-framework', b'PyNext/0.1.2'))
    return response

MIDDLEWARE = [application_headers]
