# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""Generate explicit PyNext handlers from the preserved named URL catalogue."""
import os
from pathlib import Path
import re
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
from config.urls import urlpatterns

# URL 목록 순서에 맞춰 명시적 라우트 파일을 재생성하므로 실행 시 기존 파일을 덮어쓴다.
APP = Path(__file__).resolve().parent / "app"
# 반복 `enumerate(urlpatterns)`: 각 항목을 `(index, spec)`에 담아 먼저 `path = re.sub('<(?:(?:uuid|str|int):)?(\\w+)>', '[\\1]', spec.pattern._route).strip('/')`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
for index, spec in enumerate(urlpatterns):
    path = re.sub(r"<(?:(?:uuid|str|int):)?(\w+)>", r"[\1]", spec.pattern._route).strip("/")
    target = APP / path / "route.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    source = '"""PyNext route for /' + spec.pattern._route + '."""\nfrom pynext import route\nfrom gateway import dispatch\n'
    # 반복 `('GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS')`: 각 항목을 `method`에 담아 먼저 `source += f'\n\n@route("{method}")\nasync def {method.lower()}(request, params):\n    return await dispatch(request, {index}, params)\n'`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for method in ("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"):
        source += f'\n\n@route("{method}")\nasync def {method.lower()}(request, params):\n    return await dispatch(request, {index}, params)\n'
    target.write_text(source)
# 반복 `(('static/[...path]', -1), ('health/database', 0))`: 각 항목을 `(path, index)`에 담아 먼저 `target = APP / path / 'route.py'`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
for path, index in (("static/[...path]", -1), ("health/database", 0)):
    target = APP / path / "route.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f'from pynext import route\nfrom gateway import dispatch\n\n@route("GET")\nasync def get(request, params):\n    return await dispatch(request, {index}, params)\n')
print(f"Generated {len(urlpatterns)} application routes, static files and DB health route")
