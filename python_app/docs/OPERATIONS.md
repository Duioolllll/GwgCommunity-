# Django 운영 및 전환

모든 명령은 `python_app/`에서 실행한다. `Dockerfile`, `compose.yaml`, `nginx.conf.example`이 운영 기준이다. 레거시 코드는 `../next_engine/`에 보관한다. 환경 파일·백업·키는 Git에 넣지 않는다.

## 별도 환경 준비

1. `cp .env.example .env && chmod 600 .env`로 복사하고 실제 도메인, TLS, SMTP, 비공개 R2 값과 32바이트 이상 별도 비밀키 두 개를 설정한다. Compose DB 비밀번호는 URL에 안전한 임의 64자리 16진수를 사용한다. 내부 healthcheck를 위해 `DJANGO_ALLOWED_HOSTS`에 `localhost`도 포함한다. `DJANGO_DATABASE_URL`은 Compose에서 DB 설정으로 조합된다. 쉘 환경 변수는 Compose `.env`보다 우선한다.
2. `DJANGO_TRUST_FORWARDED_PROTO=1`과 HTTPS 리다이렉트는 신뢰된 Nginx만 앱에 접근하고 해당 헤더를 덮어쓰는 경우에만 켠다. IP 제한이 올바르게 동작하도록 실제 Nginx/Docker 게이트웨이를 `DJANGO_TRUSTED_PROXY_IPS`에 지정하고, Cloudflare의 공식 주소 범위를 신뢰하는 real-IP 설정과 원본 접근 제한을 별도 구성한다. HSTS 및 하위 도메인 preload는 전체 도메인의 HTTPS 준비 후 설정한다.
3. 기존 서비스와 다른 Compose 프로젝트 이름과 빈 DB 볼륨을 사용해 준비한다. 운영 DB에 테스트·스키마 생성·레거시 복사를 직접 실행하지 않는다.

```sh
docker compose -p gwg-staging config --quiet
docker compose -p gwg-staging build app
docker compose -p gwg-staging up -d --wait db
docker compose -p gwg-staging run --rm app python manage.py migrate --noinput
docker compose -p gwg-staging run --rm app python manage.py check --deploy
docker compose -p gwg-staging up -d --wait app
```

이 예제는 호스트 18080 포트를 사용하므로 기존 서비스와 겹치면 `.env`의 `PYTHON_APP_PORT`를 변경한다. 프로덕션 이미지에는 Python과 의존성만 포함된다. 비공개 이미지의 R2 접근·승인 전 비공개 여부, SMTP TLS와 실제 수신, 관리자 부트스트랩, DB 백업 복원과 HTTPS/CSRF를 확인한다. `bootstrap_admin --username <계정> --confirm-bootstrap`은 검증된 기존 계정에 한 번만 사용한다.

## 데이터 복사 및 검증

원본 PostgreSQL과 R2를 백업하고 격리된 곳에서 복원 가능성을 확인한다. Django의 **서로 다른 이름의 빈 PostgreSQL**에만 Django 스키마를 준비한다. 원본 DB는 읽기 전용 계정과 적절한 암호화 연결을 사용한다. `GWG_LEGACY_DATABASE_URL`은 접근 제한된 별도 환경 파일로 컨테이너에 전달하며 값이나 전체 Compose 출력을 기록하지 않는다.

```sh
# legacy.env에는 GWG_LEGACY_DATABASE_URL만 넣고 chmod 600 처리
docker compose -p gwg-staging run --rm --env-from-file /secure/path/legacy.env app python manage.py import_legacy
docker compose -p gwg-staging run --rm --env-from-file /secure/path/legacy.env app python manage.py import_legacy --apply
docker compose -p gwg-staging run --rm --env-from-file /secure/path/legacy.env app python manage.py import_legacy --verify
```

기본 명령은 원본 건수만 읽고, `--apply`는 비어 있는 대상에 일관된 원본 스냅샷을 복사한다. `--verify`는 양쪽의 주요 테이블 건수를 비교하며 관계·내용·R2 객체·메일을 보증하지 않는다. 원본의 쓰기를 중단하고 최종 복사를 해야 전환 사이의 변경이 누락되지 않는다. 사용자·권한·초대·게시물·예약·동아리·지원·신고·이미지와 관계를 점검한다. 기존 미사용 초대 코드를 유지하려면 동일한 초대 해시 비밀을 사용해야 한다.

레거시 사용자 비밀번호와 세션은 복사되지 않는다. 기존 사용자는 이메일 소유권 확인 후 `/auth/password/reset/`에서 재설정해야 하므로 전환 전 SMTP 발송과 수신을 확인하고 사용자에게 직접 안내한다. 자동 안내 메일은 발송하지 않는다. 기존 이메일 미검증 계정은 이메일 확인 절차도 필요하다. R2 객체는 복사·삭제하지 않으며 원래 키를 참조한다.

## Nginx 전환과 복구

`nginx.conf.example`의 도메인과 인증서를 실제 환경에 맞춰 별도 설치하고 `nginx -t`로 확인한다. Django 앱의 loopback 포트만 upstream으로 사용한다. 인증 URL 접근 로그는 끈다. 기존 설정·이미지·DB·백업을 보존하고 원본 쓰기 중단→최종 복사→검증→upstream 전환→HTTPS/로그인/쓰기 검증 순으로 진행한다. 새 서버에 쓰기가 발생한 후 이전 서버로 단순 롤백하면 새 데이터가 누락되므로 먼저 쓰기를 중지하고 복원 범위와 역방향 이전을 결정한다. `down -v`를 운영 데이터에 사용하지 않는다.

## 독립 검증

CI는 별도 PostgreSQL과 빈 SQLite를 사용해 Django 전체 테스트, 이전 fixture, 브라우저 흐름, 배포 설정 검사 및 Python 이미지 빌드를 수행한다. 브라우저 테스트는 `GWG_BROWSER_TEST=1`, 명시적인 빈 `DJANGO_SQLITE_PATH`가 필요하고 PostgreSQL 연결을 거부한다. 외부 SMTP·R2·Cloudflare는 실제 운영 자격과 네트워크에서 별도로 검증해야 한다.


## 2026-11-05 운영 적용

운영 앱 이미지 `gwgcommunity-python:release-20261105`를 적용하고 `core.0007_invitation_created_at`을 실행했다. 기존 Django DB는 `backups/python-pre-release-20261105-205815/django.dump`에 백업했으며, 별도의 임시 PostgreSQL에 복원한 뒤 마이그레이션을 검증했다. 백업은 로컬에 보관되므로 암호화한 외부 백업이 별도로 필요하다.

운영 앱·DB 컨테이너는 healthy이며, 원본 HTTPS의 `/healthz/`, 홈, 로그인, Market, Clubs, Finder, `/api/csrf`가 200을 반환했다. 외부 자동 요청은 Cloudflare 챌린지(403)로 응답해 브라우저 외부 접속 확인은 별도 필요하다. SMTP는 설정하지 않았고 이메일 인증은 추후 구성한다. 최초 관리자 계정은 생성하지 않았다. 운영 `check --deploy`의 HSTS 미설정 경고가 남아 있다.

이전 앱 이미지는 `gwgcommunity-python:perf`, 이전 Compose 이미지 선택 설정은 권한 제한된 `deploy/.env.python-compose.pre-release-20261105`에 보관되어 있다. 실제 롤백 때 새 서버의 쓰기 데이터를 먼저 고려한다.
