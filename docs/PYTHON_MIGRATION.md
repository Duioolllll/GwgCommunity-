# Django 전환 및 운영 준비

현재 운영 서비스를 바꾸는 자동 배포 절차가 아니다. Django는 기존 Next.js 서버와 별도 프로세스·DB로 시험한다. Nginx + Cloudflare TLS/WAF는 기존 구성을 유지하며 실제 전환은 데이터 검증과 운영자의 별도 승인 후 진행한다.

## 별도 데이터베이스로 복사

1. 기존 PostgreSQL과 R2를 각각 백업하고 **격리된 환경에서 복원 가능성을 확인**한다. 소스 코드 tar 백업은 데이터 백업이 아니다.
2. 새 Django 전용 PostgreSQL DB를 준비하고 `DJANGO_DATABASE_URL`을 그 빈 DB로 지정한다. 기존 Better Auth DB를 대상으로 Django 마이그레이션을 실행하지 않는다.
3. `DJANGO_DEBUG=0`, 충분한 길이의 별도 `DJANGO_SECRET_KEY`, `DJANGO_INVITATION_SECRET`, SMTP, 사이트 호스트·CSRF origin, 비공개 R2 자격증명을 안전하게 설정한다. 기존 미사용 초대 코드를 보존할 경우 Django의 `DJANGO_INVITATION_SECRET`은 기존 코드 해시에 사용된 값과 같아야 한다. 서로 다른 값이면 이전 코드를 폐기·재발급하는 계획을 세운다.
4. Django 마이그레이션을 새 DB에 실행한다. 원본 접근은 읽기 전용 DB 계정과 보안 연결을 사용하고 `GWG_LEGACY_DATABASE_URL`을 안전하게 주입한다. 시크릿이 포함된 연결 문자열을 명령 인자, Git, 로그에 남기지 않는다.
5. `python python_app/manage.py import_legacy`는 읽기 전용 건수 확인만 수행한다. `--apply`는 비어 있는 **다른 이름의 PostgreSQL DB**에 원본의 일관된 스냅샷을 한 트랜잭션으로 복사한다. 대상이 비어 있지 않으면 중단한다. 실제 전환 시 원본 쓰기를 중지한 뒤 최종 복사해야 누락이 없다.
6. 기존 사용자 이메일·닉네임, 학생·정지·관리자 상태, 초대 코드, 상품과 예약, 동아리·지원, 분실물, 사진 메타데이터, 신고와 감사 기록의 건수·관계를 확인한다. 재계산 가능한 Finder 매칭 기록과 기존 세션은 복사하지 않는다. 기존 게시물 UUID는 유지하지만 일부 동아리 하위 항목, 신고, 사용자 등의 내부 ID는 바뀐다. 과거 감사 로그에는 원래 ID가 남는다.
7. 기존 비밀번호는 이관되지 않는다. 모든 기존 계정은 이메일 비밀번호 재설정이 필요하다. 복사 시 임의의 복구 불가능한 비밀번호를 설정하며 기존 세션은 무효화된다. 이메일 소유권과 SMTP 발송을 확인하고 안내 절차를 정한다. 알림은 자동 발송하지 않는다.
8. R2 객체는 복사·삭제하지 않고 기존 키를 참조한다. 버킷·자격증명·접근 범위가 올바른지, 승인 전 사진이 공개되지 않는지 실제로 검증한다. 레거시 이미지와 게시물 삭제 후 남은 객체의 정리·복원 정책을 따로 정한다.
9. 공개/학생/관리자 테스트, 동시 예약·코드 경쟁, 모바일, SMTP, 이미지, 신고 및 백업 복원을 점검한다. 기존 API 클라이언트가 있다면 Django의 세션·CSRF와 응답, 변경된 내부 ID를 별도 검증한다.

## Nginx와 Cloudflare

`deploy/compose.python.yaml`은 앱을 호스트 loopback에만 게시하고 DB 포트를 게시하지 않는 예시다. `deploy/python.env.example`은 Django 환경 파일의 예시이고 `deploy/python.compose.env.example`은 Compose 이미지·DB 설정 예시다. 두 파일을 각각 접근이 제한된 위치에 복사하고 실제 값을 채워 `docker compose --env-file <Compose 환경 파일> -f deploy/compose.python.yaml`로 사용한다. Django DB URL의 계정·암호·DB 이름은 Compose DB 설정과 일치해야 한다. `deploy/nginx.python.conf.example`은 현재 Nginx를 자동 변경하지 않는 샘플이다. 실제 호스트명, TLS 인증서, Cloudflare SSL 모드와 오리진 접근 제한은 현재 구성을 점검해 반영한다. Cloudflare Tunnel은 Django 실행에 필요하지 않다.

Django의 보안 쿠키는 HTTPS를 요구한다. `DJANGO_TRUST_FORWARDED_PROTO=1`은 직접 앱 접근이 차단되고 Nginx가 `X-Forwarded-Proto`를 덮어쓰는 경우에만 설정한다. `DJANGO_TRUSTED_PROXY_IPS`는 Nginx 주소만 지정하고, Nginx가 Cloudflare의 공식 IP 범위에서 온 요청에 대해서만 실제 클라이언트 주소를 검증·덮어쓰도록 설정해야 한다. 그렇지 않으면 클라이언트 IP를 위조하거나 많은 이용자가 하나의 제한에 묶일 수 있다. 현재 환경에 맞게 WAF와 인증 요청 제한을 시험한다.

인증·비밀번호 재설정 URL에는 토큰이 들어가므로 Nginx, 애플리케이션, 외부 로그에 해당 URL이 기록되지 않게 구성한다. 예제 Nginx는 `/auth/` 접근 로그를 끈다. 운영 SMTP의 TLS/STARTTLS, 보안 헤더, 환경변수 권한, S3 비공개 설정, 이미지 크기 제한과 백업 암호화도 확인한다. Django 설정 검사는 `python python_app/manage.py check --deploy`로 실행하고, TLS 종료 위치에 맞춰 경고를 검토한다. 기본 설정에서 HTTPS 리다이렉트와 HSTS 경고가 발생한다. Cloudflare/Nginx의 HTTPS 강제 및 HSTS 적용을 검증하거나, 신뢰할 수 있는 프록시 설정 이후 `DJANGO_SECURE_SSL_REDIRECT`와 `DJANGO_HSTS_SECONDS`를 정책에 맞춰 설정한다.

## 전환과 롤백

준비한 이미지를 격리 환경에서 검증하고 별도 DB에 복사한 뒤 Nginx upstream 변경으로 전환한다. 기존 앱·DB·R2 백업과 이전 이미지 digest를 유지한다. 새 서버에서 쓰기가 발생한 후 이전 서버로 단순 전환하면 그 이후 데이터가 누락되므로, 롤백 시 쓰기 중지·데이터 정합성·복원 범위를 먼저 결정한다. 배포와 실제 데이터 복사는 자동으로 실행하지 않는다.
