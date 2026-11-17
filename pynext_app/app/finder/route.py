# 이 파일은 주소와 요청 방식을 실제 처리 함수에 연결한다.
"""PyNext route for /finder/."""
from pynext import route
from gateway import dispatch


# 보관된 사진 파일을 읽는다.
@route("GET")
async def get(request, params):
    return await dispatch(request, 69, params)


# 이 주소의 본문 없는 조회 요청을 공통 처리기로 넘긴다. 실제 권한·입력 검사는 공통 처리기와 업무 코드에서 한다.
@route("HEAD")
async def head(request, params):
    return await dispatch(request, 69, params)


# 이 주소의 저장 요청을 공통 처리기로 넘긴다. 실제 권한·입력 검사는 공통 처리기와 업무 코드에서 한다.
@route("POST")
async def post(request, params):
    return await dispatch(request, 69, params)


# 운영에서는 R2에, 개발 환경에서는 로컬 폴더에 사진을 저장한다.
@route("PUT")
async def put(request, params):
    return await dispatch(request, 69, params)


# 이 주소의 일부 수정 요청을 공통 처리기로 넘긴다. 실제 권한·입력 검사는 공통 처리기와 업무 코드에서 한다.
@route("PATCH")
async def patch(request, params):
    return await dispatch(request, 69, params)


# 보관된 사진 파일을 삭제한다.
@route("DELETE")
async def delete(request, params):
    return await dispatch(request, 69, params)


# 이 주소의 허용 방식 확인 요청을 공통 처리기로 넘긴다. 실제 권한·입력 검사는 공통 처리기와 업무 코드에서 한다.
@route("OPTIONS")
async def options(request, params):
    return await dispatch(request, 69, params)
