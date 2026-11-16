# GwgCommunity PyNext

현재 서버 구현은 **PyNext 0.1.2 + CPython 3.14 + Uvicorn + PostgreSQL**이다.
`app/`의 78개 파일 라우트(기존 서비스 76개, 정적 파일, DB 헬스체크)를 PyNext가 선택한다.
Django WSGI/ASGI 앱으로 HTTP를 전달하지 않는다. `gateway.py`는 기존 Django 기반
업무 함수·ORM·폼·템플릿·세션·CSRF·보안 미들웨어를 라이브러리로 재사용한다.
따라서 Django 의존성을 제거한 네이티브 재작성은 아니며, DjangoResource 공식 기능
위에 애플리케이션에서 작성하고 검증한 호환 어댑터가 있다. 실행에 `python_app/`이나
Node.js가 필요하지 않다. 기존 계정, 암호, 세션, DB 스키마와 R2 객체를 유지한다.

## 실행

```sh
python3.14 -m venv venv
venv/bin/pip install -r pynext_app/requirements.txt
export DJANGO_DEBUG=1
export DJANGO_SQLITE_PATH=/tmp/gwg-pynext-development.sqlite3
export PYTHONPATH="$PWD/pynext_app"
venv/bin/python pynext_app/manage.py migrate
venv/bin/python pynext_app/manage.py collectstatic --noinput
venv/bin/pynext build --dir pynext_app
venv/bin/python pynext_app/serve.py --port 8000 --workers 2
```

`config/urls.py`는 템플릿의 URL 이름과 업무 함수 카탈로그다. 변경 후
`DJANGO_DEBUG=1 venv/bin/python pynext_app/generate_routes.py`로 명시적 PyNext
파일을 재생성하고 빌드한다. 인증 페이지와 API는 요청마다 실행하며 공유 캐시를 쓰지 않는다.

## 검증

```sh
venv/bin/pip install -r pynext_app/requirements-test.txt
DJANGO_DEBUG=1 venv/bin/python pynext_app/manage.py test core
venv/bin/python pynext_app/tests/postgres.py
venv/bin/python pynext_app/tests/http_parity.py
venv/bin/python -m playwright install --with-deps chromium
venv/bin/python pynext_app/tests/browser.py
venv/bin/python pynext_app/benchmarks/compare_nextjs.py
```

HTTP·브라우저 테스트는 `/tmp` 아래에 앱·SQLite·이미지를 새로 만들고 종료 시 정리한다.
브라우저 테스트는 1 MiB보다 큰 약 3 MiB 이미지 업로드도 검사한다.
벤치마크는 **Next.js 대 PyNext**를 비교하며, 별도 PostgreSQL 컨테이너에 동일한 합성
데이터를 만든다. 원시 결과와 방법·제약은 [비교 결과](benchmarks/RESULTS.md)에 있다.
이전 2026-11-09 Django/Gunicorn 비교 파일은 과거 참고 자료다.

## 운영에서 확인할 점

- PyNext는 공식적으로 실험 단계다. 이 서버는 제작자의 요청에 따른 검증 서비스다.
- `serve.py`의 Uvicorn ASGI 모드를 사용한다. Axum CLI의 1 MiB 업로드 상한 때문에
  `pynext start`로 운영 명령을 바꾸면 안 된다.
- `asgi.py`는 0.1.2의 ASGI `MAX_BODY`를 명시적으로 22 MiB로 조정한다. Nginx는 20 MiB,
  개별 이미지는 5 MiB로 제한한다. PyNext 버전 변경 시 검토하도록 시작 시 버전을 검사한다.
- `/healthz`와 `/readyz`는 PyNext 예약 경로이며 DB를 검사하지 않는다.
  실제 서비스 헬스체크는 **`/health/database`**다. 기존 `/healthz/`도 호환된다.
- DjangoResource는 워커마다 동기 실행 스레드 하나와 128개 대기 슬롯을 갖는다.
  가득 차면 503/Retry-After를 반환한다. 운영은 Uvicorn 워커 2개다.
- 인증 경로에는 접근 로그를 남기지 않는다. 운영 PyNext 로그는 WARNING이며,
  Nginx의 기존 타이밍 로그를 유지한다. 비밀값과 실제 응답 본문을 보고서에 기록하지 않는다.

배포·복구 절차는 [운영 문서](docs/OPERATIONS.md)를 따른다.
공식 지침: [한국어 매뉴얼](https://github.com/Duioolllll/PyNext/blob/v0.1.2/docs/ko/manual.md),
[Django 연동](https://github.com/Duioolllll/PyNext/blob/v0.1.2/docs/DJANGO.md),
[0.1.2 릴리스](https://github.com/Duioolllll/PyNext/releases/tag/v0.1.2).
