# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
from pynext import route
from gateway import dispatch

# 기능 `get`: await dispatch(request, 0, params)을 반환한다.
@route("GET")
async def get(request, params):
    return await dispatch(request, 0, params)
