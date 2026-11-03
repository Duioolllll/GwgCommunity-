# GwgCommunity | 광덕고 반개방형 학생 커뮤니티 — 기획·설계서

<aside>
🎓

**GwgCommunity — 광덕고 학생 중심 반개방형 웹 플랫폼**

상태: 기획 확정 / 개발 전 · 기준일: 2026년 11월 3일

핵심 서비스: **Gwg Market · Gwg Clubs · Gwg Finder** · 학생 인증: **1회용 초대 코드**

https://stitch.withgoogle.com/projects/[6114229510706286346](https://stitch.withgoogle.com/projects/6114229510706286346)

https://github.com/Duioolllll/GwgCommunity-.[git](https://github.com/Duioolllll/GwgCommunity-.git)

</aside>

## 1. 프로젝트 개요

- **프로젝트명:** GwgCommunity
- **한 줄 소개:** 학생이 만들고 학생이 사용하는 학교생활 커뮤니티
- **목표:** 교내 중고거래, 동아리 활동 홍보·모집, 분실물 찾기를 하나의 반응형 웹서비스에 통합한다.
- **대상:** 광덕고 학생, 공개 활동 정보를 보는 외부 방문자, 서비스 운영 관리자.
- **기획 배경:** 학교에서 리로스쿨을 사용하므로 과제·학사 공지 기능을 중복 구현하지 않는다. 학생 대 학생 교류와 생활 편의를 보완하는 서비스에 집중한다.
- **배포 목표:** 독립 도메인 또는 서브도메인, HTTPS, 호스팅, 모바일·PC 반응형 퍼블리싱.
- **운영 원칙:** 학교 공식 서비스로 오인되지 않도록 비공식 학생 프로젝트임을 표시하고, 학교 명칭·로고 사용 및 실제 학생 대상 운영은 학교 측과 협의한다.

## 2. 확정된 주요 결정

| 항목 | 결정 |
| --- | --- |
| 서비스 운영 형태 | 반개방형 |
| 비회원·외부 방문자 | 공개 동아리 소개·프로젝트 열람 및 승인된 일부 게시물 제한 열람 |
| 인증된 학생 | 게시글 작성, 거래 신청, 동아리 지원, 분실물 등록·조회 |
| 학생 가입 방식 | 관리자 발급 1회용 초대 코드 + 이메일 확인 |
| 인증 보안 | 서버 검증, 코드 만료·폐기, 사용 횟수 제한, 무차별 대입 방지 |
| 핵심 서비스 | Gwg Market, Gwg Clubs, Gwg Finder |
| 기술 스택 | 아래 기술 후보를 기준으로 개발 시 확정 |

## 3. 핵심 기능 및 MVP 범위

### 🛍 Gwg Market — 교내 중고거래

- 판매·나눔 게시글 등록: 제목, 사진, 카테고리, 설명, 가격, 상태
- 검색 및 필터링: 카테고리·가격·상태
- 거래 신청 및 상태 전환: **판매 중 → 예약 중 → 거래 완료** (취소 시 복귀 조건 정의)
- 거래 연락처·정확한 만남 장소는 비회원에게 공개하지 않음
- **MVP:** 상품 등록·검색·수정·삭제, 예약·완료 처리
- **후속:** 사용자 간 메시지, 관심 목록, 신고 기능 개선

### 🧩 Gwg Clubs — 동아리·학생 활동

- 동아리 프로필, 활동 사진, 프로젝트 전시, 행사 소개 공개
- 동아리 관리자가 모집 공고 작성 및 지원서 상태 관리
- 지원 가능한 학년, 관심 분야, 모집 기간 필터링
- **MVP:** 동아리 페이지, 게시글, 모집 공고, 신청서 접수 및 관리
- **후속:** 행사 체크인, 팀원 매칭, 포트폴리오 확장
- 공개 콘텐츠에 학생 실명·연락처·얼굴 사진을 올릴 때는 필요한 동의를 확보

### 🔎 Gwg Finder — 교내 분실물

- 잃어버린 물건 및 습득물 등록: 종류·색상·사진·대략적 장소·날짜
- 유사한 글 자동 추천 및 검색
- 상세한 소유권 확인은 비공개 절차로 처리하며 정확한 위치·개인정보는 공개하지 않음
- **MVP:** 분실·습득 등록, 기본 필터 검색, 규칙 기반 매칭
- **후속:** 이미지 특징 비교, 매칭 알림, 수령 확인

## 4. 접근 권한 정책

| 기능 | 비회원 / 외부인 | 초대 인증 학생 | 관리자 / 승인된 동아리 운영자 |
| --- | --- | --- | --- |
| 동아리·공개 프로젝트 열람 | 가능 | 가능 | 가능 |
| Market 열람 | 개인정보 제외, 일부 정보만 | 전체 허용 범위 | 운영 관리 |
| Market 거래 신청·글 작성 | 불가 | 가능 | 관리 |
| Finder 열람 | 공개 승인된 게시글만 | 허용 범위 내 열람 | 관리 |
| Finder 등록·매칭 요청 | 불가 | 가능 | 관리 |
| 동아리 지원 | 불가 | 가능 | 지원서 관리(권한 범위 내) |
| 신고 | 공개 신고 접수는 선택적으로 허용 | 가능 | 처리 |
| 초대 코드 발급·폐기 | 불가 | 불가 | 관리자 전용 |

**접근 통제 원칙:** 화면에서 버튼을 숨기는 것만으로 끝내지 않고, 서버 API마다 사용자 세션과 역할을 검사한다. 동아리 운영자는 자신이 담당하는 동아리의 신청서만 조회할 수 있다.

## 5. 초대 코드 기반 학생 인증 설계

1. 관리자가 암호학적으로 안전한 난수로 고유 초대 코드를 생성한다.
2. 코드는 확인된 배포 경로로 개인별 제공한다. 기본 정책은 **1회 사용, 발급 후 7일 만료**다.
3. 사용자는 이메일, 비밀번호, 닉네임을 등록하고 이메일 소유를 확인한다.
4. 사용자로부터 초대 코드를 받아 서버에서 해시 조회·유효기간·미사용·폐기 여부를 검증한다.
5. DB 트랜잭션을 통해 코드 사용 기록과 학생 계정 활성화를 원자적으로 처리한다.
6. 성공 시 학생 권한을 부여하고 Market·Clubs·Finder의 학생 전용 API 접근을 허용한다.
7. 실패 횟수·속도를 제한하고 관리자에게 폐기 및 계정 정지 기능을 제공한다.

**보안 중요사항**

- 초대 코드는 **재학 여부를 단독으로 증명하지 않는다.** 유출·재배포 위험이 있으므로 학교 구성원임이 확인된 경로로 배포하고, 운영 정책상 의심 계정의 추가 확인·차단 절차를 둔다.
- 원본 코드를 DB에 평문 저장하지 않으며, 코드 생성은 추측하기 어렵게 구현한다.
- 중복 사용은 단순 사전 조회가 아닌 DB 트랜잭션/조건부 업데이트로 방지한다.
- 비밀번호는 인증 라이브러리를 사용해 안전하게 해시 처리하고, 로그에는 비밀번호·초대 코드를 남기지 않는다.
- 학생증 사진이나 주민등록번호를 기본 가입 요건으로 수집하지 않는다.

## 6. 시스템 구조 및 기술 후보

```
브라우저 (모바일 / PC)
    ↓ HTTPS
도메인 · DNS · TLS
    ↓
Next.js 웹 프론트엔드 + API 서버
    ├── 인증 / 역할·권한 검사
    ├── Gwg Market
    ├── Gwg Clubs
    ├── Gwg Finder (매칭 로직)
    └── 관리자 대시보드
         ↓               ↓
    PostgreSQL      이미지 오브젝트 저장소
```

| 계층 | 추천 기술 | 선택 이유 |
| --- | --- | --- |
| 프론트엔드 | Next.js + TypeScript | 반응형 웹, 라우팅 및 서버 연계 |
| UI | Tailwind CSS 4 + shadcn/ui + Radix UI | 흑백 디자인 시스템 및 접근성 |
| API | Next.js App Router Route Handlers + Server Actions(서버 검증) | 단일 TypeScript 코드베이스에서 비즈니스 로직 처리 |
| DB | PostgreSQL 17 + Drizzle ORM | SQL 마이그레이션 및 트랜잭션 |
| 인증 | Better Auth + 자체 초대 코드 검증 | 이메일 인증 및 학생 권한 관리 |
| 이미지 | Cloudflare R2 (S3 호환 API) | 사진 업로드 및 비용 분리 |
| 배포(우선 후보) | Raspberry Pi 5 4GB + Docker Compose + Cloudflare Tunnel/WAF + GitHub Actions | ARM64 컨테이너, 인바운드 포트 없이 공개 운영 |
| 개발 관리 | GitHub + GitHub Actions | 버전 및 배포 이력 |

**호스팅 우선 후보(미확정):** Raspberry Pi 5 4GB 직접 호스팅 + Cloudflare Tunnel + Cloudflare WAF. 최종 하드웨어/저장장치·도메인·패키지 버전·학교 협의·학생 배포 일정은 추후 확인한다. 상세한 기준은 문서 하단 기술 명세 H 참조.

## 7. 데이터베이스 초안 (ERD 설계 대상)

- **users:** id, email, password_hash 또는 인증 제공자 식별자, nickname, role, status, created_at
- **invitation_codes:** id, code_hash, expires_at, used_at, redeemed_by, revoked_at, issued_by
- **market_posts:** id, author_id, title, description, price, category, status, created_at
- **market_requests:** id, post_id, requester_id, status, created_at
- **clubs:** id, name, introduction, owner_id, visibility
- **club_members:** club_id, user_id, role
- **club_posts:** id, club_id, author_id, content, visibility
- **club_applications:** id, club_id, applicant_id, application_data, status
- **lost_found_posts:** id, author_id, kind(lost/found), category, color, general_location, occurred_at, status
- **lost_found_matches:** id, lost_post_id, found_post_id, score, created_at
- **reports:** id, reporter_id, target_type, target_id, reason, status
- **audit_logs:** id, actor_id, action, entity_type, entity_id, created_at
- **media_assets:** id, owner_id, storage_key, content_type, moderation_status

관계: 사용자 1:N 게시글·거래 신청·분실물; 동아리 1:N 모집 신청/활동 게시글; 분실물 N:M 후보 매칭; 발급 코드 0..1회 사용.

## 8. 핵심 알고리즘 — 분실물 유사도 매칭

**규칙 기반 1차 MVP 예시** (가중치는 테스트 후 조정):

- 분류 일치: 40점
- 색상 일치: 25점
- 장소 유사도: 최대 20점
- 날짜 차이: 최대 15점
- 총합 = 0~100점. 예를 들어 70점 이상만 추천 후보로 노출한다. 이 점수는 통계적 확률이 아닌 **임의 정의한 비교 점수**다.

```
입력: 분실 게시글 L
후보 = 상태가 활성인 습득 게시글 목록
각 후보 F마다:
  점수 = 유형 비교 + 색상 비교 + 장소 비교 + 날짜 비교
  조건에 맞는 후보를 결과에 추가
결과를 점수 내림차순으로 정렬
상위 N개 추천
```

검증 사례: 색상만 같은 다른 물건, 같은 물건이지만 날짜가 다른 경우, 장소가 누락된 경우, 중복 등록. 추천 결과는 소유권 증명이 아니므로 무단 수령 방지 절차를 별도로 둔다.

## 9. 화면 및 URL 구성 초안

- `/` 공개 홈, 소개, 주요 서비스 진입
- `/market` 공개 범위 내 상품 목록 / `/market/new` 학생 전용 작성
- `/clubs` 동아리 탐색 / `/clubs/[id]` 동아리 소개·모집
- `/finder` 분실물·습득물 목록 / `/finder/new` 학생 전용 등록
- `/auth/register`, `/auth/login`, `/auth/invite`
- `/me` 내 게시글·신청 현황
- `/admin` 초대 코드, 회원, 신고, 공개 게시물 관리

## 10. 단계별 개발 계획

### Phase 1 — 배포 가능한 MVP

- [ ]  와이어프레임 및 반응형 퍼블리싱
- [ ]  DB 스키마와 인증·권한 구현
- [ ]  초대 코드 발급·사용·만료·폐기
- [ ]  Market 상품 CRUD 및 거래 상태
- [ ]  Clubs 공개 소개·모집 신청
- [ ]  Finder 게시글 CRUD 및 검색
- [ ]  공개/학생/관리자 권한별 API 테스트
- [ ]  도메인 + HTTPS + 실제 호스팅 연동

### Phase 2 — 차별화 기능

- [ ]  Finder 유사도 매칭 및 테스트
- [ ]  동아리 지원서 관리와 운영 권한 세분화
- [ ]  마켓 거래 신청·완료 흐름 개선
- [ ]  신고·차단·감사 로그 및 기본 운영 대시보드

### Phase 3 — 학교 내 시범 운영

- [ ]  학교 관계자와 명칭·운영·인증 경로 협의
- [ ]  소수 학생 대상 사용성 테스트
- [ ]  접근성·모바일 UX·보안 점검
- [ ]  개인정보 안내, 보관·삭제 정책, 신고 처리 절차
- [ ]  피드백 반영 및 정식 공개 여부 결정

## 11. 프로그래밍 수행평가 연결

- **프로그램 기획:** 학교생활 문제 정의 → 리로스쿨과 중복 회피 → 대상 사용자 분석 → 기능·비기능 요구 사항 → 개발 도구 선택 이유.
- **프로그램 설계:** 사이트맵, 권한 표, 화면 와이어프레임, 시스템 구조도, ERD, 가입/거래/분실물 처리 순서도 및 의사코드.
- **도메인·호스팅·퍼블리싱:** DNS·HTTPS 개념, 반응형 HTML/CSS 구현, 서버 배포 절차, 실제 서비스 URL과 테스트 결과 제시.
- **검증 자료:** 가입 성공/만료 코드 거부, 외부인 접근 차단, 거래 상태 전환, 분실물 매칭 경계 사례를 시험하고 결과를 기록.
- **산출물:** 기획·설계서, 코드 저장소, 동작 화면, 배포 주소, 테스트 결과.

## 12. 주요 위험과 대책

| 위험 | 대책 |
| --- | --- |
| 코드 유출로 외부 가입 | 개별 1회용·만료·발급 통제, 이상 가입 정지 |
| 개인정보/학교 정보 노출 | 최소 수집, 공개/비공개 필드 분리, 접근 제어 |
| 중고거래 분쟁·사기 | 신고·차단·거래 상태 기록, 초기에는 결제 중개 안 함 |
| 분실물 오수령 | 소유권 확인 질문과 비공개 수령 절차 |
| 게시물 악용·부적절 콘텐츠 | 신고·관리자 검토, 삭제·제재 규칙 |
| 운영 지속성 부족 | 작은 MVP, 담당자 지정, 간단한 관리 도구 |
| 기존 서비스 중복 | 학사·과제 기능 제외, 학생 주도 활동 특화 |

## 13. 다음 확정 과제

- [ ]  정식 도메인/서브도메인 및 배포 환경 선정
- [ ]  실제 학생 계정 확인·초대 코드 배포 정책 확정
- [ ]  학교 및 동아리 운영 협의 범위 결정
- [ ]  상세 와이어프레임과 디자인 시스템 정의
- [ ]  각 서비스 MVP의 세부 요구사항 및 완료 조건 작성
- [ ]  개인정보 처리·운영 관리 정책 초안 작성

---

**메모:** 이 문서는 대화에서 결정한 사항과 개발 권장안을 함께 정리한 초안이다. 구현 완료나 학교 공식 승인·운영 개시를 뜻하지 않는다.

---

# 📐 개발 실행 명세서 (PRD · Frontend · Backend)

<aside>
🔗

**공식 개발 저장소:** [Duioolllll/GwgCommunity-](https://github.com/Duioolllll/GwgCommunity-.git)

Git Clone: `git clone https://github.com/Duioolllll/GwgCommunity-.git`

이 저장소를 GwgCommunity의 **지정 GitHub 저장소**로 사용한다. 아래 작업 항목은 구현 지시용 초안이며 저장소의 실제 파일·브랜치·기존 구현 여부는 아직 검증하지 않았다.

</aside>

## A. 제품 요구사항 문서 (PRD)

### A1. 목표와 비목표

- 목표: 학생 간 거래·동아리 활동·분실물 찾기 통합, 비회원의 안전한 공개 열람, 초대 코드 기반 가입, 모바일 우선 접근성.
- 비목표(v1): 리로스쿨 과제·학사 기능 복제, 온라인 결제/정산, 실시간 채팅, AI 이미지 인식, 공식 재학증명 자동화.
- 성공 지표(시범 운영 목표치, 추후 조정): 핵심 흐름 3개 모두 정상 완료, 권한 우회 테스트 0건, 모바일 주요 화면 정상 표시, 테스트 학생의 주요 과업 완료율 90% 이상.

### A2. 사용자 스토리 / 인수 기준

| ID | 우선순위 | 사용자 스토리 | 완료 조건 |
| --- | --- | --- | --- |
| AUTH-01 | P0 | 방문자는 초대 코드로 학생 가입을 요청한다 | 유효·미사용 코드만 허용, 만료/폐기/중복 사용 거절 |
| AUTH-02 | P0 | 학생은 로그인·로그아웃한다 | 보호 API는 세션 없으면 401 반환 |
| PUB-01 | P0 | 방문자는 공개 동아리 활동을 본다 | 비공개 필드/지원서는 응답에서 제외 |
| MKT-01 | P0 | 학생은 중고 물품을 등록·수정한다 | 본인 글만 수정·삭제, 입력·이미지 검증 |
| MKT-02 | P0 | 학생은 거래를 예약·완료한다 | 동시 예약 시 단 1건만 성공, 상태 전환 검증 |
| CLB-01 | P0 | 동아리 운영자는 소개·모집 공고를 관리한다 | 담당 동아리에만 쓰기 권한 |
| CLB-02 | P0 | 학생은 동아리에 지원한다 | 중복 지원 제한, 본인 신청 상태 조회 |
| FND-01 | P0 | 학생은 분실·습득물을 등록한다 | 필수 정보 확인, 상세 연락처 비공개 |
| FND-02 | P1 | 학생은 비슷한 습득물을 추천받는다 | 점수 내림차순, 동일/종료 글 제외 |
| ADM-01 | P0 | 관리자는 신고·코드·계정을 관리한다 | 모든 관리자 API 권한 검사 및 감사 기록 |
| OPS-01 | P0 | 서비스는 실제 도메인으로 HTTPS 접속된다 | 운영 URL, TLS 인증서, 배포 기록 확인 |

### A3. 비기능 요구사항

- 접근성: 키보드 탐색, 폼 레이블, 색 대비, 반응형 360px 이상 검증.
- 성능: 초기 목표로 주요 목록 API p95 500ms 이내(테스트 환경·부하 명시), 이미지 최적화, 페이지네이션.
- 보안: HTTPS, 안전한 쿠키, CSRF 대책, 서버 RBAC, 입력 검증, 요청 제한, 보안 헤더.
- 개인정보: 최소 수집, 삭제 요청 처리, 이미지 메타데이터 제거 검토, 업로드 크기·유형 제한.
- 운영: 오류 로깅(비밀정보 마스킹), 백업·복구 테스트, 관리자 신고 처리.

## B. Frontend 상세 설계

### B1. 라우트와 화면

| 경로 | 화면 | 핵심 UI | 접근 |
| --- | --- | --- | --- |
| / | 홈 | 서비스 소개·최근 공개 활동·검색 진입 | 공개 |
| /market | 상품 목록 | 검색·필터·정렬·카드·페이지네이션 | 제한 공개 |
| /market/[id] | 상품 상세 | 이미지·가격·상태·거래 신청 | 열람 제한 공개 / 신청 학생 |
| /market/new | 상품 작성 | 입력·사진 업로드·미리보기 | 학생 |
| /clubs | 동아리 목록 | 분류·검색·모집 상태 | 공개 |
| /clubs/[id] | 동아리 상세 | 소개·활동·모집 공고 | 공개 |
| /clubs/[id]/apply | 지원 | 폼·지원 상태 | 학생 |
| /finder | 분실물 목록 | 분실/습득 전환·필터·매칭 | 제한 공개 |
| /finder/new | 분실물 등록 | 사진·유형·날짜·장소 | 학생 |
| /auth/register | 가입 | 이메일·닉네임·비밀번호·코드 | 공개 |
| /auth/login | 로그인 | 로그인·오류 처리 | 공개 |
| /me | 마이페이지 | 내 글·거래·지원·계정 설정 | 학생 |
| /admin | 관리자 | 코드·신고·계정·통계 | 관리자 |

### B2. 컴포넌트 작업 단위

- 공통: Header, MobileNav, Footer, AuthGate, RoleGuard, SearchBar, FilterPanel, Pagination, EmptyState, ErrorState, LoadingSkeleton, ConfirmDialog, ReportDialog.
- Market: ProductCard, ProductGallery, PriceTag, ProductForm, TradeStatusBadge, TradeRequestAction.
- Clubs: ClubCard, ClubProfile, RecruitmentCard, ApplicationForm, ClubAdminPanel.
- Finder: LostFoundCard, ItemForm, SimilarityResult, ClaimFlow.
- Admin: InviteCodeTable, GenerateCodeDialog, ReportQueue, ModerationActions, AuditLogTable.
- UI 상태: 로딩·빈 결과·검증 실패·권한 없음·서버 오류·성공 피드백을 각 화면에서 분리한다.

### B3. 프론트엔드 완료 기준

- [ ]  모바일/데스크톱 레이아웃과 내비게이션 동작
- [ ]  URL 직접 접근·새로고침 시 보호 화면 권한 처리
- [ ]  폼 검증·에러 메시지·이미지 미리보기
- [ ]  목록 검색·필터·페이지네이션 URL 상태 유지
- [ ]  접근성 기본 검사와 주요 사용자 흐름 E2E 통과

## C. Backend / API 상세 설계

### C1. API 계약 초안

| Method | Endpoint | 설명 | 권한 |
| --- | --- | --- | --- |
| POST | /api/auth/register | 초대 코드 검증 및 계정 생성 | 공개 + 제한 |
| GET | /api/me | 현재 사용자 정보 | 로그인 |
| GET | /api/market | 상품 목록 조회 | 공개 범위 적용 |
| POST | /api/market | 상품 생성 | 학생 |
| PATCH | /api/market/:id | 본인 상품 수정 | 작성자 |
| POST | /api/market/:id/reservations | 거래 예약 | 학생 |
| PATCH | /api/market/:id/status | 거래 완료/취소 | 권한자 |
| GET | /api/clubs | 동아리 목록 | 공개 |
| POST | /api/clubs/:id/applications | 동아리 지원 | 학생 |
| GET | /api/clubs/:id/applications | 지원서 목록 | 해당 동아리 운영자 |
| GET | /api/finder | 분실·습득 목록 | 공개 범위 적용 |
| POST | /api/finder | 분실·습득 등록 | 학생 |
| GET | /api/finder/:id/matches | 매칭 후보 | 학생 + 접근 검증 |
| POST | /api/reports | 신고 접수 | 학생 |
| POST | /api/admin/invites | 초대 코드 발급 | 관리자 |
| POST | /api/admin/invites/:id/revoke | 코드 폐기 | 관리자 |
| PATCH | /api/admin/reports/:id | 신고 처리 | 관리자 |

모든 API는 공통 에러 형식(`code`, `message`, `requestId`)을 사용한다. 실제 라우트는 기존 저장소 구조 확인 후 조정한다.

### C2. DB / 트랜잭션 작업

- 마이그레이션: users, invitation_codes, market_posts, market_requests, clubs, club_members, club_applications, lost_found_posts, lost_found_matches, reports, media_assets, audit_logs.
- 인덱스: 게시글 생성일·상태·카테고리, 동아리 모집 상태, 초대 코드 해시(unique), 사용자 이메일(unique), 분실물 검색 키.
- 제약: 거래 중복 예약 방지, 동아리 중복 지원 제한, 참조 무결성, 상태 enum 검증.
- 트랜잭션: 코드 소비+계정 활성화, 상품 예약 상태 변경, 거래 완료 기록.
- 삭제 정책: 사용자 탈퇴 시 계정·게시글·지원서의 삭제/익명화 정책 별도 확정.

### C3. 보안 테스트 케이스

- [ ]  만료·폐기·재사용·추측 코드 거절
- [ ]  초대 코드 동시 사용 요청 시 1건만 성공
- [ ]  다른 사용자의 글 수정·삭제 403
- [ ]  다른 동아리의 지원서 열람 403
- [ ]  비회원 API 응답에 연락처·신청서 필드 없음
- [ ]  예약 동시 요청 시 상태 일관성 유지
- [ ]  XSS, 파일 위장 업로드, 비정상 입력 거절
- [ ]  관리자 API 비관리자 접근 차단
- [ ]  요청 제한, 감사 로그, 비밀정보 마스킹 확인

## D. GitHub 저장소 및 협업 규칙

**지정 저장소:** [https://github.com/Duioolllll/GwgCommunity-.git](https://github.com/Duioolllll/GwgCommunity-.git)

**제안 디렉터리 (기존 코드 확인 전 가안):**

```
GwgCommunity-/
  src/app/                 # 웹 페이지·API 라우트 (Next.js 채택 시)
  src/components/          # 공통·도메인 UI
  src/features/            # market, clubs, finder
  src/lib/                 # 인증, DB, 권한, 유틸
  drizzle/                 # Drizzle SQL 마이그레이션
  tests/                   # unit, integration, e2e
  docs/                    # PRD, API, ERD, 운영 문서
  .github/workflows/       # CI
```

- 브랜치: `main` 보호, 기능별 `feat/auth-invite`, `feat/market`, `feat/clubs`, `feat/finder` 등.
- PR: 변경 목적, 테스트 결과, 스크린샷, 마이그레이션 여부, 보안 영향 명시.
- CI: lint → typecheck → unit/integration → build → E2E(필요 환경) 순서.
- 환경변수: `.env.example`만 커밋, 실제 DB URL·비밀 키·초대 코드 원문은 커밋 금지.
- 배포: 개발/운영 환경 분리, DB 마이그레이션 및 롤백 계획 마련.

## E. 개발 티켓 / 의존성

| 티켓 | 작업 | 우선순위 | 선행 조건 | 검수 기준 |
| --- | --- | --- | --- | --- |
| INF-01 | 저장소 조사·개발 환경·CI | P0 | 없음 | 설치·빌드·검사 명령 문서화 |
| ARC-01 | DB 스키마·마이그레이션 | P0 | INF-01 | 빈 DB 재구성 가능 |
| AUTH-01 | 세션·역할·초대 코드 | P0 | ARC-01 | 인증·권한 테스트 통과 |
| UI-01 | 디자인 토큰·레이아웃 | P0 | INF-01 | 모바일/PC 공통 UI |
| MKT-01 | 상품 CRUD·검색 | P0 | AUTH-01, UI-01 | 작성자 권한·검색 테스트 |
| MKT-02 | 예약·완료 상태 | P0 | MKT-01 | 경쟁 조건 테스트 |
| CLB-01 | 동아리 소개·모집 | P0 | AUTH-01, UI-01 | 공개·비공개 분리 |
| CLB-02 | 지원서·운영자 권한 | P0 | CLB-01 | 담당자만 지원서 조회 |
| FND-01 | 분실·습득 CRUD | P0 | AUTH-01, UI-01 | 게시·검색 흐름 동작 |
| FND-02 | 유사도 매칭 | P1 | FND-01 | 점수 경계·정렬 테스트 |
| ADM-01 | 코드·신고 관리 | P0 | AUTH-01 | 관리자만 조작 |
| SEC-01 | 보안·개인정보 검수 | P0 | 기능 통합 | 권한 우회·노출 테스트 |
| DEP-01 | DNS·HTTPS·호스팅 | P0 | INF-01, 기능 통합 | 운영 URL 접속·롤백 절차 |
| UAT-01 | 시범 운영 테스트 | P1 | SEC-01, DEP-01 | 실제 사용자 피드백 기록 |

## F. 마일스톤 / Definition of Done

1. **M1 기반 구축:** 저장소 구조 검토, 개발 환경, CI, DB, UI 기반.
2. **M2 인증:** 초대 코드 가입, 로그인, RBAC, 관리자 코드 발급.
3. **M3 핵심 기능:** Market·Clubs·Finder 기본 흐름 완성.
4. **M4 품질:** 매칭, 신고, E2E, 보안·접근성·성능 점검.
5. **M5 배포:** 도메인·HTTPS·운영 문서·소규모 테스트.

완료 정의: 기능 구현 + 단위/통합 테스트 + 권한 검증 + 반응형 확인 + 문서 갱신 + CI 통과. 실제 배포/학교 운영은 별도 승인과 준비 후 진행.

## G. 수행평가 제출 증빙 체크리스트

- [ ]  기획 목적·기존 시스템과 차별화 근거
- [ ]  사용자 요구사항 표 및 우선순위
- [ ]  사이트맵·와이어프레임
- [ ]  전체 아키텍처 및 ERD
- [ ]  초대 코드 인증 순서도
- [ ]  거래 상태 머신 및 분실물 매칭 의사코드
- [ ]  도메인·호스팅·퍼블리싱 선택 근거
- [ ]  GitHub 커밋·PR·CI 결과
- [ ]  실제 배포 URL·스크린샷·테스트 결과

**구현 착수 전 확인:** GitHub 저장소 현재 구조와 라이선스, 배포 환경, 실제 인증 코드 배포 방식, 학교 협조 범위. 이 문서는 명세서이며 코드 수정·푸시·배포가 수행되었다는 뜻은 아니다.

---

# H. GwgCommunity 기술 구현 가이드 — Raspberry Pi 5 배포 우선안

<aside>
🧭

**기술 기준선 v1.0 — 설계 확정 / 호스팅 장비는 우선 후보**

- GitHub 지정 저장소: [Duioolllll/GwgCommunity-](https://github.com/Duioolllll/GwgCommunity-.git)
- 디자인 참고: [Stitch GwgCommunity 프로젝트](https://stitch.withgoogle.com/projects/6114229510706286346)
- 저장소 확인 결과(2026-11-03): 공개 GitHub 저장소가 존재하지만 아직 코드가 없는 빈 저장소로 확인됨.
- 운영 서버는 **Raspberry Pi 5 (RAM 4GB)** + **Cloudflare 방화벽(WAF)**을 우선 검토한다. 사용자 제안 단계이므로 실제 배포 전 확정 필요.
- 본 섹션은 앞선 기술 후보 및 이전 예시 디렉터리보다 우선하는 **구현 지침**이다.
</aside>

## H1. 구체 기술 스택 및 선정 근거

| 구성 | 선정 기술 | 사용 목적 |
| --- | --- | --- |
| 운영체제 | Raspberry Pi OS Lite 64-bit (ARM64) | GUI 없이 메모리 절약, Pi 5 운영 |
| 런타임 | Node.js 24 LTS (ARM64) | 서버와 개발 환경 동일 메이저 사용 |
| 패키지 관리 | pnpm + Corepack | lockfile 고정, 재현 가능한 빌드 |
| 프론트엔드 | Next.js App Router + React + TypeScript strict | SSR/라우팅과 타입 안전성 |
| UI | Tailwind CSS 4 + shadcn/ui + Radix UI | 흑백 디자인 시스템과 접근성 |
| 아이콘 | Lucide React | 단색 SVG 아이콘 |
| 폼 및 DTO | Zod + React Hook Form | 클라이언트·서버 입력 검증 |
| 백엔드 | Next.js Route Handlers + 기능별 서비스 모듈 | 별도 Express 프로세스 없이 API 구성 |
| 인증 | Better Auth | 이메일 로그인·세션·검증 |
| 학생 확인 | 별도 초대 코드 검증 서비스 | 1회용 코드 + 활성 학생 권한 |
| 데이터베이스 | PostgreSQL 17 | 트랜잭션·정합성·인덱스 |
| ORM | Drizzle ORM + Drizzle Kit | TS 스키마 및 SQL 마이그레이션 |
| 이미지 | Cloudflare R2 | 사진을 Pi 디스크·메모리에서 분리 |
| 컨테이너 | Docker Engine + Docker Compose | 앱/DB/터널 독립 서비스 |
| 외부 공개 | Cloudflare Tunnel (cloudflared) | 공유기 포트포워딩 없이 서버로 연결 |
| 네트워크 보호 | Cloudflare DNS(프록시) + WAF | HTTP 요청 필터링, 챌린지 등 |
| 원격 관리 | SSH 공개키 + Tailscale 또는 제한된 관리 경로 | 관리자 접속 통제 |
| CI/CD | GitHub Actions + Docker Buildx + GHCR | ARM64 이미지 빌드·배포 |
| 테스트 | Vitest + React Testing Library + Playwright | 단위·UI·E2E |
| 로깅 | Pino + 관리자 감사 로그 | 요청 추적 및 사건 기록 |

**버전 원칙:** Node.js 24 LTS, PostgreSQL 17, Tailwind CSS 4를 기준으로 선택하되, Next.js·React·Better Auth·Drizzle의 정확한 호환 버전은 프로젝트 생성 시 공식 릴리스와 취약점 공지를 확인하고 `pnpm-lock.yaml`에 고정한다. 여기서 특정 최신 패치 버전을 단정하지 않는다.

**초기 제외:** Redis, Elasticsearch, 별도 NestJS/Express API, WebSocket 채팅, 결제·정산, AI 이미지 모델, Kubernetes. 실제 사용 증가 및 측정된 병목이 발생하면 재평가.

## H2. 배포 아키텍처 — Cloudflare Tunnel 우선

```
공개 방문자 / 초대 인증 학생 / 운영자
        │ HTTPS
        ▼
Cloudflare DNS + Proxy + WAF
        │ Cloudflare Tunnel
        ▼
   cloudflared 컨테이너 ─── (아웃바운드 연결)
        │ 내부 Docker 네트워크
        ▼
   Next.js 서버 (3000, 외부 포트 비공개)
        ├── Better Auth / 권한 확인
        ├── Gwg Market
        ├── Gwg Clubs
        ├── Gwg Finder
        └── 관리자 API
        │                 │
        ▼                 ▼
  PostgreSQL 17       Cloudflare R2
  Pi 연결 SSD 볼륨     사진 파일 저장
        ▲
     암호화 백업 → 별도 외부 저장소
```

- Docker Compose 서비스: `app`, `db`, `cloudflared` (필요 시 운영 전용 백업 작업).
- 웹 앱과 DB에 `ports:` 공개 바인딩을 두지 않는다. 같은 Docker 네트워크에서 `cloudflared → http://app:3000`으로 라우팅하도록 설정.
- Cloudflare Tunnel 사용 시 **Caddy는 필수 아님**. 외부 TLS는 Cloudflare가 처리하며, Tunnel에서 애플리케이션까지는 서버 내부 Docker 네트워크를 통과한다. 나중에 오리진 TLS 또는 별도 로컬 프록시가 필요한 경우 Caddy를 추가.
- 공유기에서 80/443 및 PostgreSQL 5432 포트포워딩 금지. 가능하면 SSH도 인터넷에 직접 열지 않는다.
- **반개방형**이므로 사이트 전체에 Cloudflare Access 로그인 게이트를 적용하지 않는다. 공개 페이지는 누구나 열람 가능해야 하며, 운영자 관리 화면만 별도 Access 정책을 검토할 수 있다.
- WAF는 공격 표면 감소용이지 서버 인증·SQL 검증·권한 검사를 대체하지 않는다. Cloudflare 요금제에서 제공되는 규칙·요청 제한 기능은 실제 설정 시 확인.

## H3. Pi 5 4GB 최적화 전략

| 항목 | 설계 기준 |
| --- | --- |
| 서버 OS | Raspberry Pi OS Lite 64-bit, 불필요한 GUI 제거 |
| 저장장치 | **외장 SSD 권장**, 특히 PostgreSQL 데이터는 microSD 단독 운영 지양 |
| CPU 아키텍처 | linux/arm64 이미지로 명시적 빌드 |
| 메모리 | 4GB 전체 중 OS·DB·Next.js·Tunnel을 합쳐 여유 메모리 유지 |
| Next.js | production `output: 'standalone'`, 서버 압축·캐시·이미지 최적화 적용 |
| 빌드 | Pi에서 `next build` 지양. GitHub Actions에서 사전 빌드 후 이미지 pull |
| DB | 연결 풀 소규모 시작, 인덱스·페이지네이션·쿼리 관찰 |
| R2 | 업로드 크기·유형 제한, 검증된 업로드 경로, 원본 파일 검사 |
| 모니터링 | 메모리·CPU·디스크 여유, container 재시작, DB 접속 확인 |
| 전원·발열 | 안정적 전원공급 장치, 냉각, 정전 후 자동 부팅·서비스 복구 |

**용량 수치는 운영 전 계측:** 4GB에서 앱과 DB의 동시 실행은 소규모 사용을 대상으로 현실적이지만, 동접 처리량을 보장할 수는 없다. 사진을 R2로 분리하고 과도한 워커·캐시·DB 연결을 제한한다. SSD 미연결·장시간 정전·가정용 회선 장애 등에서는 가용성이 제한될 수 있다.

## H4. 프로젝트 폴더 상세 구조

```
GwgCommunity-/
├── .github/workflows/{ci.yml,deploy.yml}
├── docs/{PRD.md,ARCHITECTURE.md,API.md,ERD.md,SECURITY.md,OPERATIONS.md}
├── drizzle/                       # SQL 마이그레이션
├── public/
├── src/
│   ├── app/
│   │   ├── (public)/              # 공개 홈·동아리·제한 공개 목록
│   │   ├── (auth)/                # 로그인·이메일 검증·초대 코드
│   │   ├── (student)/             # 마이페이지·게시글 작성
│   │   ├── admin/                 # 관리자 페이지
│   │   └── api/                   # Route Handlers
│   ├── components/{ui,layout,shared}/
│   ├── features/
│   │   ├── market/
│   │   ├── clubs/
│   │   ├── finder/
│   │   ├── invitations/
│   │   └── moderation/
│   ├── lib/{auth,db,permissions,storage,validation,logging}/
│   └── styles/
├── tests/{unit,integration,e2e}/
├── deploy/
│   ├── compose.yaml
│   └── README.md
├── Dockerfile
├── drizzle.config.ts
├── .env.example
├── .nvmrc
├── package.json
└── pnpm-lock.yaml
```

프론트/백엔드를 나누어 별개 서버로 띄우지 않고 **하나의 Next.js 배포 단위**로 운영한다. API에서도 서비스 모듈 분리, 입력 검증, 역할/소유권 검증, DB 트랜잭션을 강제한다.

## H5. 화면·디자인 규격 (Stitch 연계)

- **브랜드:** GwgCommunity / Gwg Market / Gwg Clubs / Gwg Finder
- 배경 `#FFFFFF`, 텍스트 `#111111`, 보조 `#525252`, 카드 `#FAFAFA`, 테두리 `#E5E5E5`, 검정 CTA `#171717`.
- 포인트 컬러·장식용 그라데이션 없이 흑백·명도 위주. 상태는 텍스트 및 모양으로 구별.
- 모바일 우선(360px 기준 테스트), 데스크톱 3열 카드, 일관된 수직 여백과 얇은 라인.
- 화면: 홈, Market 목록/상세/글쓰기, Clubs 소개/모집/신청, Finder 목록/등록/매칭, 로그인/초대 코드, 마이페이지, 관리자.
- 공통 UI: Header, MobileNav, ItemCard, SearchFilter, Modal, FormField, EmptyState, Skeleton, ReportDialog, Toast.
- 공개 콘텐츠와 회원 전용 버튼은 UI에서 구분하되, **실제 차단은 서버 API**에서 실행.
- Stitch 디자인은 참고안이며, 실제 컴포넌트·키보드 탐색·모바일 접근성에 맞춰 구현.

## H6. 데이터베이스 모델 및 인덱스

| 테이블 | 주요 데이터 | 필수 제약 |
| --- | --- | --- |
| 사용자/세션 | Better Auth 스키마 + 추가 profile | 인증 라이브러리 버전에 맞춰 생성 |
| invitations | code_hash, expires_at, redeemed_at, redeemed_by, revoked_at | 해시 unique, 1회 사용 |
| market_posts | owner_id, title, price, category, status | 작성자 FK, 금액 검증 |
| market_reservations | post_id, requester_id, status | 게시글당 활성 예약 1개 |
| clubs / club_members | name, slug, user_id, club_role | slug unique, 멤버 중복 방지 |
| club_recruitments | club_id, open_at, close_at, status | 모집 기간·상태 |
| club_applications | recruitment_id, applicant_id, status | 동일 모집 중복 지원 차단 |
| finder_posts | owner_id, kind, category, color, area, happened_at | 조회 필터 인덱스 |
| finder_matches | lost_id, found_id, score | 동일 매칭 쌍 중복 방지 |
| media_assets | owner_id, r2_key, size, mime | 객체 소유권 및 형식 검증 |
| reports / audit_logs | actor_id, target_id, action, status | 감사 기록·신고 상태 |

검색 키·날짜·상태에 인덱스를 지정하고, 목록은 **페이지네이션(기본 20건 등)**을 사용한다. DB 기본 저장 공간은 외장 SSD에 영속 볼륨으로 연결한다. Better Auth 스키마 및 실제 ORM 모델은 설치 버전에서 확인한다.

## H7. 학생 초대 코드 인증 알고리즘

**상태 흐름:** `UNVERIFIED_EMAIL → VERIFIED_PENDING_INVITE → ACTIVE_STUDENT`; 별도 정지 상태 `SUSPENDED`.

1. 사용자 이메일/비밀번호 등록, 이메일 소유 확인.
2. 관리자 발급 코드를 입력. 코드는 안전 난수 128비트 이상, 한 번만 사용, 기본 7일 만료.
3. 서버에서 코드의 HMAC 또는 동등한 안전한 검증값을 계산하여 DB 조회.
4. 유효기간·미사용·폐기 여부를 검사.
5. **DB 트랜잭션** 안에서 미사용 코드 조건부 갱신과 학생 상태 활성화를 함께 처리.
6. 동시 요청 시 갱신에 성공한 1건만 허용.
7. 보호 API에서는 로그인 여부 + `ACTIVE_STUDENT` + 게시물 소유권/동아리 역할 검증.
8. 시도 횟수 제한, 감사 기록, 관리자 폐기·정지 기능 포함.

**주의:** 초대 코드를 획득했다는 사실만으로 실제 재학 여부가 증명되지는 않는다. 학교 구성원이 확인된 채널을 통해 코드를 배포해야 하며, 원본 코드·비밀번호·토큰은 로그나 GitHub에 남기지 않는다.

## H8. 세 핵심 서비스의 서버 규칙

**Gwg Market**

- `AVAILABLE → RESERVED → COMPLETED`, 예약 취소 시 권한자만 `RESERVED → AVAILABLE`.
- 예약 시 상태 조건부 갱신을 사용하여 동시 예약 충돌 처리.
- 작성자만 글 수정·삭제 가능, 본인 글에 거래 신청 불가.
- v1에는 결제 중개/에스크로 없음. 연락처·상세 장소 등 민감정보는 비공개.

**Gwg Clubs**

- 동아리 운영자는 해당 동아리의 공개 소개·모집 공고·지원서만 관리.
- 모집 기간 내 승인된 학생만 지원 가능, 동일 모집 중복 지원 거절.
- 가입 상태: 제출·검토·승인·거절·취소 등으로 정의.
- 공개 소개와 지원서의 개인 답변은 별도 데이터 권한으로 분리.

**Gwg Finder**

- 분실/습득 유형, 물건 분류, 색상, 대략적 장소, 날짜 기반 검색.
- MVP 후보 점수 예시: 분류 40 + 색상 25 + 장소 최대 20 + 날짜 최대 15 = 100점.
- 결과는 점수 내림차순, 임계점 70점 이상 추천(현장 테스트로 조정).
- 점수는 통계적 확률이 아닌 규칙 기반 유사도이며, 실제 소유권은 별도 비공개 질문으로 확인.

## H9. API 공통 계약과 권한

- `/api/auth/*`: Better Auth 지원 경로와 커스텀 초대 코드 API를 충돌 없이 배치.
- `GET /api/market`, `POST /api/market`, `POST /api/market/:id/reservations`.
- `GET /api/clubs`, `POST /api/clubs/:id/applications`.
- `GET /api/finder`, `POST /api/finder`, `GET /api/finder/:id/matches`.
- `POST /api/admin/invitations`, `POST /api/admin/invitations/:id/revoke`, 신고 처리 API.
- 응답 오류 표준: `{ code, message, requestId }`; 인증 없음 401, 권한 부족 403, 리소스 없음 404, 충돌 409, 과도한 요청 429.
- 비회원 응답 DTO는 학생 연락처, 신청서, 이메일, 상세 소유권 검증 정보를 제외.
- Zod로 서버 입력 검증, 세션·권한·소유권 검사, 객체 저장 업로드 별도 검증.
- 페이지네이션, 사진 파일 크기 제한, URL 검색 필터와 로깅 정책을 일관 적용.

## H10. Cloudflare WAF / Tunnel / 원격 접근 보안

- Cloudflare DNS에서 공개 도메인을 Tunnel 공개 호스트명으로 연결.
- WAF 관리형 규칙, 로그인·초대 코드·게시글 등록 경로의 요청 제한 규칙을 요금제 기능 내에서 검토.
- 공개 사이트는 Cloudflare Access 로그인 강제 금지(반개방형 유지). 관리자 페이지는 별도 보호 정책 선택.
- 서버의 외부 인바운드 포트는 열지 않음. 앱·DB Docker 내부망 전용.
- 관리용 SSH는 공개키 인증, 가능하면 Tailscale 등 사설 관리 경로 사용.
- Cloudflare 요청 헤더를 신뢰할 때는 오리진으로 직접 진입하는 우회 경로를 차단해야 한다.
- Cloudflare의 필터링만으로 내부 RBAC·인증·CSRF·XSS·SQL 주입 방지를 대체하지 않는다.
- **유출 방지:** Tunnel 토큰, DB 암호, R2 자격증명, OAuth/SMTP 자격증명은 환경변수/시크릿 저장소로 관리하고 저장소에 푸시하지 않는다.

## H11. 배포·CI/CD 구체 설계

1. PR 생성 시 GitHub Actions에서 lint → TypeScript typecheck → unit/integration → production build → 필요 시 Playwright를 실행.
2. `main` 통합 시 Docker Buildx로 `linux/arm64` 이미지를 **GitHub Actions에서 빌드**하여 GHCR에 업로드.
3. Pi 5는 애플리케이션 소스 전체 빌드 대신 지정 이미지 digest를 pull한다.
4. DB 마이그레이션은 백업 확인 후 별도 통제된 1회 작업으로 실행.
5. Docker Compose가 `app`, `db`, `cloudflared`를 운영. 앱·DB 외부 포트는 비공개.
6. 앱은 Next.js `output: standalone` 최적화, healthcheck 및 restart 정책 사용.
7. CI/CD에서 프로덕션 시크릿을 출력하지 않으며, 배포 권한은 별도로 제한한다.
8. 실패 시 이전 정상 이미지 digest로 롤백. DB 마이그레이션의 역호환성을 고려.
9. `main` 브랜치 보호, PR 리뷰·검사 통과 및 배포 태그 기록.

**배포 조건:** Raspberry Pi OS 64bit, 안정적 냉각/전원, SSD 데이터 볼륨, Cloudflare Tunnel 연결, 서비스 도메인, 외부망 접속 및 인증 테스트, 암호화 백업 복구 테스트.

## H12. 데이터 보존·복구·운영

- PostgreSQL과 R2 데이터는 서로 다른 저장소에 있으므로 백업 정책도 구분.
- DB는 주기적 암호화 백업을 **Pi 외부의 저장소**로 전송하고 실제 복원 시험 진행.
- R2 사진의 삭제 정책 및 버전/복원 방법 결정. 사용자 탈퇴 시 삭제·익명화 절차 정의.
- 전원 단절 후 Docker 자동 기동·DB 정합성 검사, SSD 용량·온도·RAM 감시.
- 비밀번호·이메일·코드·세션 쿠키는 로그에 기록하지 않음.
- 사진 공개 범위를 제한하고 원본 EXIF 및 위치 메타데이터 유출 방지.
- 정기 보안 업데이트 및 의존성 점검. 피크 사용 시 메모리·응답시간 계측 후 최적화.

## H13. 개발 티켓을 위한 구현 순서

| 단계 | 작업 티켓 | 완료 기준 |
| --- | --- | --- |
| 1 | REPO-01: Node 24 + pnpm + Next.js + TS + ESLint 초기화 | lockfile, 설치/빌드, README |
| 2 | UI-01: Stitch 흑백 토큰과 공통 UI | 모바일/데스크톱 화면 및 접근성 기본 검증 |
| 3 | DB-01: PostgreSQL 17 + Drizzle | 마이그레이션/연결/트랜잭션 테스트 |
| 4 | AUTH-01: Better Auth 로그인/세션 | 이메일 인증 및 401/403 검증 |
| 5 | AUTH-02: 1회용 초대 코드 | 만료·중복·동시 사용·폐기 테스트 |
| 6 | MARKET-01: 중고거래 CRUD/예약 | 실제 UI/API 연결 및 예약 경쟁 테스트 |
| 7 | CLUBS-01: 동아리·모집·지원서 | 운영자 권한과 정보 비공개 검증 |
| 8 | FINDER-01: 분실·습득·유사도 | 등록·검색·점수 로직 검증 |
| 9 | ADMIN-01: 코드·신고·계정 | 관리 기능 감사 로그/권한 확인 |
| 10 | INFRA-01: ARM64 Docker + Pi Compose | Pi 5에서 앱·DB·Tunnel 실행 |
| 11 | SECURITY-01: WAF/Tunnel/인증 점검 | 외부 직접 포트 접근 불가, 권한 우회 차단 |
| 12 | DEPLOY-01: CI/CD·백업·운영 | GHCR 배포, HTTPS, 롤백/복원 리허설 |
| 13 | UAT-01: 학생 시범 테스트 | 사용자 피드백, 결함 목록 및 수정 |

## H14. 수행평가 제출에 연결할 증빙

- 기획: 리로스쿨과 중복 없는 서비스 목적 및 사용자 요구.
- 설계: 화면 사이트맵, 시스템 아키텍처, ERD, 사용자 역할별 권한표.
- 알고리즘: 초대 코드 트랜잭션 순서도, 거래 상태 전이, 분실물 유사도 점수 계산.
- 퍼블리싱: Stitch에서 실제 HTML/CSS/React 기반 반응형 화면으로 구현한 결과.
- 도메인/호스팅: Cloudflare DNS → Tunnel → Raspberry Pi 5 → Docker → Next.js 흐름.
- 보안: WAF 규칙·비공개 포트·API 권한 테스트.
- 결과: GitHub PR·CI 로그·ARM64 빌드·서비스 URL·사용자 시범 검증.

## H15. 현재 미확정 사항

- [ ]  Raspberry Pi 5 4GB 최종 사용 확정, 외장 SSD 및 전원·냉각 구성
- [ ]  실제 도메인/서브도메인 확정
- [ ]  Cloudflare 계정의 WAF·요청 제한 기능 확인
- [ ]  학교 명칭 사용 및 학생 인증 코드 배포 협의
- [ ]  운영자·신고 담당자 지정 및 데이터 보존 정책 수립
- [ ]  패키지 실제 설치 후 호환성·ARM64 빌드 검증

**주의:** 이 문서는 **실제 구현 전에 작성한 구체 명세**이며 GitHub에 코드 업로드, 장비 설치, 터널·WAF 설정, 배포가 완료되었다는 의미는 아니다.