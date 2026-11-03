# GwgCommunity

광덕고 학생을 위한 비공식 커뮤니티 프로젝트입니다. Gwg Market, Gwg Clubs, Gwg Finder를 제공하며, 학교의 공식 서비스가 아닙니다. 제품 범위와 개발 명세는 [기획·설계서](docs/planning-and-spec.md)를 참고하세요.

## 개발 환경

Node.js 24와 Corepack, Docker Compose가 필요합니다. 프로젝트는 pnpm lockfile을 사용합니다.

```sh
corepack enable
corepack pnpm install --frozen-lockfile
cp .env.example .env.local
docker compose -f deploy/compose.dev.yaml up -d --wait
corepack pnpm db:migrate
corepack pnpm dev
```

`.env.local`의 `DATABASE_URL`은 로컬 개발용 PostgreSQL을 가리킵니다. 앱을 사용하기 전에 서로 다른 32바이트 이상 난수로 `BETTER_AUTH_SECRET`과 `INVITATION_SECRET`을 설정하고, `BETTER_AUTH_URL`을 브라우저에서 접속하는 정확한 주소로 맞추세요. 이메일 확인은 TLS/STARTTLS를 지원하는 SMTP 설정이 필요합니다. 시크릿과 실제 계정 정보는 저장소에 커밋하지 마세요. DB 마이그레이션 도구는 `.env.local`을 읽고, 이미 설정된 환경 변수를 우선합니다.

브라우저에서 `http://localhost:3000`을 엽니다. 가입은 이메일 확인 후 관리자가 발급한 초대 코드로 활성화됩니다. 기본 관리자 비밀번호는 없습니다. 최초 관리자 설정과 운영상 제한은 [인증 문서](docs/AUTH.md)를 참고하세요. DB를 중지할 때는 `docker compose -f deploy/compose.dev.yaml stop`을 사용합니다. 개발 DB 볼륨에는 데이터가 남습니다.

## 검사

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm db:check
TEST_DATABASE_URL=postgresql://gwg:local-dev-only@localhost:5433/gwg corepack pnpm test:unit
TEST_DATABASE_URL=postgresql://gwg:local-dev-only@localhost:5433/gwg corepack pnpm test:integration
corepack pnpm build
```

통합 테스트는 PostgreSQL에 테스트 데이터를 만들고 정리합니다. 인증 HTTP 테스트는 로컬 PostgreSQL에 임시 DB를 생성하므로 해당 계정에 `CREATEDB` 권한이 필요합니다. 운영 DB가 아닌 테스트 전용 DB에서 실행하세요. 브라우저 테스트와 실서비스 환경 검증은 별도로 수행해야 합니다.

## 현재 상태

기능 구현과 통합 검증이 진행 중입니다. PostgreSQL/Drizzle, 이메일 확인과 초대 코드, Market·Clubs·Finder의 주요 흐름을 연결하고 있습니다. 실제 학생 대상 운영이나 배포가 완료된 상태는 아닙니다. 도메인, 학교 협의, SMTP·Cloudflare·R2 설정, 운영 보안 점검, 백업 복구 및 실사용 검증이 남아 있습니다. 운영 인프라 준비 내용은 [운영 문서](docs/OPERATIONS.md)를 참고하세요.
