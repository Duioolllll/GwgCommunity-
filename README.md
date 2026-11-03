# GwgCommunity

광덕고 학생 중심 반개방형 웹 플랫폼 — 교내 중고거래(Gwg Market), 동아리 활동(Gwg Clubs), 분실물 찾기(Gwg Finder)를 하나의 반응형 웹서비스에 통합하는 비공식 학생 프로젝트.

- 기획·설계서 및 개발 실행 명세서: [docs/planning-and-spec.md](docs/planning-and-spec.md)
- 상태: 초기 프론트엔드 기반 구축 중 (2026-11-03 기준)

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 홈, Market, Clubs, Finder 화면을 확인할 수 있습니다.

## 현재 구현 범위

- Next.js App Router + TypeScript strict 기반
- 반응형 흑백 UI: 홈, Market, Clubs, Finder, 로그인, 학생 가입, 마이페이지, 관리자 화면
- 서버 API: 초대 코드 발급·1회 사용 검증, 로그인 세션 쿠키, Market 등록·예약, Clubs 지원, Finder 등록
- 권한 검사: 비회원, 학생, 관리자 역할별 API 접근 제한
- 검사 명령: `npm run lint`, `npm run typecheck`, `npm run build`

현재 저장소는 외부 DB를 연결하기 전 단계라 개발 서버 프로세스 메모리에 데이터를 저장합니다. 따라서 재시작하면 테스트 데이터와 세션이 초기화되며, 실제 운영 전에는 명세의 PostgreSQL·Drizzle·Better Auth·R2 연결과 이메일 확인을 추가해야 합니다. 데모 관리자 계정은 `admin@gwg.local` / `admin1234`이며 운영 환경에서 반드시 제거·교체해야 합니다.
