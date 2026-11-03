# 운영 준비 초안

이 구성은 아직 배포하거나 학교 운영 승인을 받은 상태가 아니다. 도메인, 장비, Cloudflare, SMTP, 백업 저장소와 비밀값은 운영자가 별도로 준비해야 한다. `deploy/compose.yaml`은 app, PostgreSQL, cloudflared를 실행하며 호스트 포트를 게시하지 않는다. DB는 내부 전용 네트워크에 있고 앱과 터널만 별도 네트워크를 공유한다. 앱과 터널은 외부 SMTP/Cloudflare에 연결할 수 있다. Docker 호스트 관리자에게는 컨테이너와 네트워크 접근 권한이 있다.

## 이미지와 배포 전 준비

- CI는 테스트와 별도로 `linux/arm64` 이미지를 빌드하고 GHCR 형식으로 태그만 지정한다. `push: false`이므로 GHCR에 업로드하거나 배포하지 않는다. 실제 게시 및 배포는 별도의 권한과 승인된 절차가 필요하다. Pi에서 사용할 ARM64 이미지의 출처와 digest를 검증한다.
- Pi의 외장 SSD에 Docker 데이터 디렉터리 또는 DB 볼륨을 영속화하고, 전원·냉각·용량을 확인한다. 볼륨은 Compose 프로젝트 이름에 따라 생성되므로 경로와 복구 대상을 확인한다. 서비스 계정의 최소 권한, OS/Docker 업데이트 및 호스트 접근 통제를 설정한다.
- 배포 환경에서 `APP_IMAGE`를 검증된 `ghcr.io/…@sha256:…` digest로 지정한다. PostgreSQL과 cloudflared의 현재 태그도 운영 전 검증된 버전 또는 digest로 고정하고 업데이트 정책을 정한다.
- Git에 포함되지 않는 제한된 권한의 환경 파일에 `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `INVITATION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `TUNNEL_TOKEN`을 설정한다. `DATABASE_URL`의 호스트는 `db`이고 계정·암호·DB 이름은 PostgreSQL 설정과 일치해야 한다. URL 특수 문자는 퍼센트 인코딩한다. 인증과 초대 비밀은 별도의 충분히 긴 난수로 생성한다. Compose 환경 변수와 터널 인자는 호스트 관리자에게 보일 수 있으므로 호스트 권한을 제한한다.
- Cloudflare에서 별도로 Tunnel과 공개 호스트명을 설정하고 서비스 원본을 `http://app:3000`으로 지정한다. 공개 사이트에 Access 로그인을 강제하지 않는다. DNS, HTTPS, WAF, 요청 제한 및 원본 우회 방지 설정은 별도 확인한다. 앱/DB 포트를 호스트나 라우터에 공개하지 않는다.
- SMTP의 TLS와 발신자 설정을 검증하고, 실제 인증 메일 수신을 시험한다. 사진 저장소와 이미지 메타데이터 제거는 아직 구성되지 않았다.

Compose 구성은 `docker compose --env-file <안전한 환경 파일> -f deploy/compose.yaml config --quiet`로 검사한다. 운영 환경에서 이미지 게시와 마이그레이션이 승인된 뒤 `docker compose --env-file <환경 파일> -f deploy/compose.yaml up -d`를 사용한다. 환경 파일이나 `docker compose config`의 전체 출력을 로그에 남기지 않는다. 앱 healthcheck는 홈 페이지의 HTTP 응답만 검사하며 DB 연결이나 전체 서비스 정상 여부를 보증하지 않는다. DB healthcheck는 PostgreSQL의 연결 수락 여부를 검사한다. 외부 HTTPS와 로그인, 학생 권한은 별도로 시험한다.

## 마이그레이션과 롤백

배포 전에 DB 백업과 복원 가능성을 확인한다. 정확히 한 작업자/작업에서 해당 릴리스의 코드와 lockfile을 사용해 내부 DB에 접근 가능한 통제된 환경에서 `pnpm install --frozen-lockfile` 후 `DATABASE_URL`을 안전하게 주입하고 `pnpm db:migrate`를 실행한다. 런타임 이미지는 개발 도구와 마이그레이션 도구를 포함하지 않으며 시작할 때 자동 마이그레이션하지 않는다. 작업 성공과 스키마 호환성을 확인한 뒤 앱 이미지를 교체한다. 실패 시 원인을 확인하고 역호환이 가능한 이전 이미지 digest로 롤백한다. 이미지 롤백은 DB 스키마를 되돌리지 않으므로 역호환이 없으면 검증된 복구 계획이 필요하다.

## PostgreSQL 백업과 복원 시험

운영 중에는 정기적으로 `pg_dump`의 일관된 덤프를 암호화하여 Pi 외부 저장소로 전송한다. 예를 들어 `age` 공개키를 별도 관리하고 아래 파이프를 실행한다. 파일명과 공개키는 실제 운영 값으로 바꾸고, 셸의 `pipefail`을 켜서 덤프 실패를 놓치지 않는다. 백업 파일과 개인키는 서로 분리하며 원본/복구본 접근과 보존 기간을 제한한다.

```sh
set -o pipefail
docker compose --env-file <환경 파일> -f deploy/compose.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' | age -r <백업-공개키> > gwg.dump.age
```

파일이 정상 생성되었는지 확인한 뒤 암호화된 파일을 별도의 저장소에 복사하고 전송 성공을 확인한다. 암호화 전 임시 덤프나 암호를 로그에 남기지 않는다. 예약 주기, 보존 기간, 저장소 장애 알림과 키 교체 절차를 운영 전에 정한다.

복구 시험은 운영 DB가 아닌 **격리된 빈 PostgreSQL 17 인스턴스**에서 수행한다. 개인키로 복호화한 덤프를 해당 인스턴스에 `pg_restore --no-owner --no-privileges`로 복원하고 오류, 테이블과 주요 데이터, 로그인 및 앱 호환성을 확인한다. 복구 시간과 결과를 기록하고 정기적으로 반복한다. 실제 재해 복구 때는 쓰기를 중지하고 대상 DB를 명시적으로 확인한 뒤 승인된 절차에 따라 복원한다. DB 복원은 R2 객체를 복원하지 않는다. 사진 저장소의 별도 백업·삭제·복원 정책과 DB 참조 정합성 검증이 필요하다.
