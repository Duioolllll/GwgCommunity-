> 이전 Django/Gunicorn 구현입니다. 현재 실행·배포는 [PyNext 앱](../pynext_app/README.md)을 사용합니다.

# Django 앱

Python 3.12 + Django + Gunicorn + PostgreSQL 기반 서버입니다. HTML 템플릿은 `core/template_source.py`, 공통 CSS는 `core/static/core/site.css`에 있습니다.

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
DJANGO_DEBUG=1 .venv/bin/python manage.py migrate
DJANGO_DEBUG=1 .venv/bin/python manage.py runserver 127.0.0.1:8000
DJANGO_DEBUG=1 .venv/bin/python manage.py check
DJANGO_DEBUG=1 .venv/bin/python manage.py makemigrations --check --dry-run
DJANGO_DEBUG=1 .venv/bin/python manage.py collectstatic --noinput
DJANGO_DEBUG=1 .venv/bin/python manage.py test
```

개발 DB는 기본적으로 임시 디렉터리의 SQLite에 생성됩니다. `DJANGO_SQLITE_PATH`로 빈 개발 DB를 지정할 수 있습니다. 개발 메일과 사진 저장소에 실제 학생 데이터를 넣지 마세요.

[운영·이전 절차](docs/OPERATIONS.md), [기능 비교와 API 차이](docs/PARITY.md)를 참고하세요. 브라우저 검증은 `requirements-test.txt`와 Playwright Chromium이 필요하며, `GWG_BROWSER_TEST=1`과 빈 `DJANGO_SQLITE_PATH`를 지정하고 테스트 전용 서버를 실행한 뒤 `python tests/browser_smoke.py`로 수행합니다. 테스트는 계정과 게시물을 생성하므로 운영 DB를 사용할 수 없습니다.
