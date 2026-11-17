# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
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
# 등록한 주소를 하나씩 읽어 PyNext가 사용할 경로 파일을 만든다.
for index, spec in enumerate(urlpatterns):
    path = re.sub(r"<(?:(?:uuid|str|int):)?(\w+)>", r"[\1]", spec.pattern._route).strip("/")
    target = APP / path / "route.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    source = '"""PyNext route for /' + spec.pattern._route + '."""\nfrom pynext import route\nfrom gateway import dispatch\n'
    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
    for method in ("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"):
        source += f'\n\n@route("{method}")\nasync def {method.lower()}(request, params):\n    return await dispatch(request, {index}, params)\n'
    target.write_text(source)
# 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
for path, index in (("static/[...path]", -1), ("health/database", 0)):
    target = APP / path / "route.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f'from pynext import route\nfrom gateway import dispatch\n\n@route("GET")\nasync def get(request, params):\n    return await dispatch(request, {index}, params)\n')
print(f"Generated {len(urlpatterns)} application routes, static files and DB health route")
