# Django 앱

GwgCommunity의 Python 서버입니다. Node.js 없이 실행하며 HTML과 CSS 원본도 `core/template_source.py`의 Python 문자열로 관리합니다. 인증·초대 코드, Market, Clubs, Finder, 이미지 검토 및 관리자 기능을 제공합니다. JSON API는 `config/urls.py`를 참고하세요. 이전 Better Auth의 세션/API 계약과 Django의 세션·CSRF 계약은 서로 호환되지 않습니다.

## 시작하기

저장소 최상위에서 Python 3.12 가상환경을 만든 후:

```sh
.venv/bin/pip install -r python_app/requirements.txt
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py migrate
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py runserver 127.0.0.1:8000
DJANGO_DEBUG=1 .venv/bin/python python_app/manage.py test core
```

개발 DB는 기본적으로 저장소 밖 임시 경로에 생성됩니다. 저장 위치를 직접 지정할 때는 `DJANGO_SQLITE_PATH=/absolute/path/dev.sqlite3`를 사용합니다. 이메일은 콘솔에 출력되고 사진은 `python_app/private_uploads`에 비공개로 저장됩니다. 개발 모드·콘솔 메일·개발용 이미지 저장소에 실제 학생 데이터를 넣지 않습니다.

브라우저 흐름 테스트는 Playwright와 별도의 빈 개발 DB를 사용합니다. `requirements-test.txt`를 설치하고 Playwright Chromium을 준비한 다음, 빈 `DJANGO_SQLITE_PATH`에 마이그레이션을 적용해 로컬 서버를 실행하고 `python_app/tests/browser_smoke.py`를 실행합니다. 이 스크립트는 테스트 계정과 게시물을 생성하므로 실제 DB에 연결하면 안 됩니다. `GWG_BROWSER_URL`과 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`로 주소와 브라우저를 지정할 수 있습니다.

PostgreSQL 테스트는 `DJANGO_DATABASE_URL`, `DJANGO_TEST_DATABASE_NAME`으로 별도의 테스트 DB를 지정하고 CREATEDB 권한이 필요합니다. Django 테스트는 해당 테스트 DB를 생성하고 삭제합니다. 운영 DB 이름을 테스트 DB 이름으로 사용하지 마세요. 동시성 테스트는 PostgreSQL에서 실행되며 SQLite에서는 건너뜁니다.

## 설정과 현재 범위

- 학생 가입은 이메일 확인 후 일회용 초대 코드로 활성화됩니다. 첫 관리자는 검증된 기존 계정에 대해 `bootstrap_admin --username <계정> --confirm-bootstrap`으로 한 번만 부여할 수 있습니다.
- 사진은 파일 크기·종류·픽셀 수를 제한하고 재인코딩하며, 승인된 사진만 공개합니다. 운영 모드에는 비공개 R2 버킷 설정이 필요합니다.
- 계정·IP 기반 시도 제한은 PostgreSQL에 저장됩니다. 실제 프록시 IP 설정과 WAF 제한은 운영 환경에서 시험해야 합니다.
- 기존 DB 복사 명령은 [운영 가이드](../docs/PYTHON_MIGRATION.md)에 설명되어 있습니다. 기존 비밀번호와 세션은 이전되지 않으며, 사용자는 이메일로 비밀번호를 재설정해야 합니다.
- 미연결 사진은 공개되지 않지만 R2에 남을 수 있습니다. 수집·정리 및 복구 정책을 운영 전 확정해야 합니다.
- 완전한 기존 API 호환성, 실제 SMTP·R2·Nginx·Cloudflare 연결, 접근성·보안 검토와 실데이터 복원 시험은 배포 전 별도로 확인해야 합니다.
