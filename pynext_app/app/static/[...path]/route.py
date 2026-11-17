# 이 파일은 주소와 요청 방식을 실제 처리 함수에 연결한다.
from pynext import route
from gateway import dispatch

# 보관된 사진 파일을 읽는다.
@route("GET")
async def get(request, params):
    return await dispatch(request, -1, params)
