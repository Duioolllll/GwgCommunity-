# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Invoke existing public Django business logic inside DjangoResource's thread."""
import json


# 익명 Django 요청을 구성해 공개 중고거래 또는 동아리 API를 호출한다.
def call_public_api(name, query_string):
    from django.contrib.auth.models import AnonymousUser
    from django.test import RequestFactory
    from core import api

    view = {"market": api.market_collection, "clubs": api.club_collection}[name]
    request = RequestFactory().get("/api/" + name, QUERY_STRING=query_string.decode("latin-1"))
    request.user = AnonymousUser()
    response = view(request)
    return response.status_code, json.loads(response.content)
