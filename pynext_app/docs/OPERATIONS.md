# PyNext 검증 서비스 운영

실행 단위는 `gwgcommunity-pynext` Compose 프로젝트다. 앱은 루프백 `18083`에서
Uvicorn 워커 2개로 실행한다. Nginx `sunmyxd.tech`의 TLS 가상 호스트가 이 포트로 전달한다.
`18081`, `18082`는 기존 Kubernetes 실험 프록시가 사용하므로 변경하지 않는다.

## 데이터와 설정

이식 전 Django 서비스와 같은 PostgreSQL DB, 서명 키, 세션 테이블, R2 설정을 사용한다.
계정·암호·이메일 인증·초대·업로드 객체를 다시 복사하거나 초기화하지 않는다.
새 앱에는 현재 모델과 0001~0007 마이그레이션이 포함되어 있다.
DB는 기존 `gwgcommunity-python-db-1` 컨테이너와 영속 볼륨이 관리하고,
새 앱은 외부 네트워크 `gwgcommunity-python_default`에 연결한다.
DB를 관리하는 기존 Compose 프로젝트를 `down`하지 말 것.

보호된 `deploy/.env.pynext`는 기존 컨테이너의 DJANGO_/SMTP_/R2_ 설정을 복사한
600 권한 파일이다. `DJANGO_DEBUG=0`, 기존 DATABASE_URL·SECRET_KEY·INVITATION_SECRET과
`PYNEXT_LOG_LEVEL=WARNING`을 유지한다. 환경 파일·키를 화면이나 로그에 출력하지 않는다.

HSTS는 기존 DJANGO_HSTS_* 설정을 유지하며 PyNext 기본 정책으로 덮어쓰지 않는다.
`check --deploy`는 기존 HSTS 미설정에 대해 W004 안내를 출력할 수 있다.

## 배포

저장소 루트에서 실행한다.

```sh
docker compose -f deploy/compose.pynext.yaml build
docker compose -f deploy/compose.pynext.yaml run --rm --no-deps app python manage.py migrate --check --noinput
docker compose -f deploy/compose.pynext.yaml up -d --no-build
docker compose -f deploy/compose.pynext.yaml exec -T app python manage.py check --deploy --fail-level ERROR
curl -fsS -H 'Host: localhost' -H 'X-Forwarded-Proto: https' http://127.0.0.1:18083/health/database
```

예상한 새 마이그레이션이 있으면 백업 후 별도 배포 작업으로 한 번 실행한다.
웹 워커가 자동으로 마이그레이션하지 않는다. 상태 확인 후
`deploy/nginx.sunmyxd.tech.pynext.conf`를 `/etc/nginx/sites-available/sunmyxd.tech`에
설치하고 `nginx -t`가 성공할 때만 `systemctl reload nginx`로 전환한다.
기존 TLS 인증서 경로와 인증 경로 접근 로그 제외, 전달 헤더 덮어쓰기를 유지한다.

```sh
curl -kfsS --resolve sunmyxd.tech:443:127.0.0.1 -D - https://sunmyxd.tech/health/database
```

HTTP 200과 `x-framework: PyNext/0.1.2`, 컨테이너 healthy, CSS·공개 API·로그인 화면을
확인한다. `/healthz`·`/readyz`는 프로세스 검사일 뿐 DB 헬스체크로 사용하지 않는다.

## 복구

전환 직전 Nginx 설정·PostgreSQL custom-format 백업·기존 컨테이너 구성을
`backups/pynext-cutover-<UTC 시각>/`에 700/600 권한으로 보관한다.
백업 경로와 검증 결과는 [전환 기록](CUTOVER.md)에 남긴다.

기존 Django 컨테이너를 복구용으로 유지한다. Nginx upstream을 기존
`127.0.0.1:18080`으로 되돌리고 `nginx -t` 후 reload한다.
두 앱이 동일한 DB 스키마를 사용하므로 애플리케이션 복구에 DB 복원은 필요 없다.
사후 쓰기를 잃을 수 있는 DB 복원은 장애 원인을 확인한 뒤 별도로 결정한다.

```sh
docker compose -f deploy/compose.pynext.yaml logs --tail 50 app
docker compose -f deploy/compose.pynext.yaml ps
```

새 PyNext 버전을 올릴 때는 ASGI 본문 상한 조정, 전체 HTTP 계약, 3MB 이미지·세션·권한
브라우저 흐름과 PostgreSQL 동시성 테스트를 다시 수행한다.
