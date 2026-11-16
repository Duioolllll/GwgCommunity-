# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `request.path.rstrip('/') or '/'`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
"""PyNext middleware shared by all page, API and static responses."""
from dataclasses import replace

# 원래 경로를 보존하면서 라우팅 경로의 끝 슬래시를 정규화하고 프레임워크 헤더를 추가한다.
# 기능 `application_headers`: 먼저 `request.state['original_path'] = request.path`로 상태 또는 조회 조건을 갱신한다.
async def application_headers(request, call_next):
    request.state['original_path'] = request.path
    normalized = replace(request, path=request.path.rstrip('/') or '/')
    response = await call_next(normalized)
    response.headers.append((b'x-framework', b'PyNext/0.1.2'))
    return response

MIDDLEWARE = [application_headers]
