# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""PyNext route for /admin/reports/<int:pk>/status/."""
from pynext import route
from gateway import dispatch


# 기능 `get`: await dispatch(request, 35, params)을 반환한다.
@route("GET")
async def get(request, params):
    return await dispatch(request, 35, params)


# 기능 `head`: await dispatch(request, 35, params)을 반환한다.
@route("HEAD")
async def head(request, params):
    return await dispatch(request, 35, params)


# 기능 `post`: await dispatch(request, 35, params)을 반환한다.
@route("POST")
async def post(request, params):
    return await dispatch(request, 35, params)


# 기능 `put`: await dispatch(request, 35, params)을 반환한다.
@route("PUT")
async def put(request, params):
    return await dispatch(request, 35, params)


# 기능 `patch`: await dispatch(request, 35, params)을 반환한다.
@route("PATCH")
async def patch(request, params):
    return await dispatch(request, 35, params)


# 기능 `delete`: await dispatch(request, 35, params)을 반환한다.
@route("DELETE")
async def delete(request, params):
    return await dispatch(request, 35, params)


# 기능 `options`: await dispatch(request, 35, params)을 반환한다.
@route("OPTIONS")
async def options(request, params):
    return await dispatch(request, 35, params)
