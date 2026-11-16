# 기능 조사와 API 전환 계약

2026-11-05 기준 `next_engine/src/app/api/**/route.ts`, 페이지, `features/`, DB 스키마와 `core/api.py`, `views.py`, `models.py`, 테스트를 비교했다. Django 운영 경로는 이 디렉터리이며 `next_engine/`은 참고용 보관 코드다. 코드가 있는 것과 실제 외부 SMTP/R2 환경이 검증된 것은 구분한다.

| 영역 | 기존 기능 | Django 구현과 이번 보완 |
|---|---|---|
| 홈·반응형 탐색 | 홈, 모바일 메뉴 | HTML 템플릿·공통 CSS, 모바일 브라우저 검증 |
| 가입·메일 | 가입, 이메일 검증, 재전송 | Django 폼·서명 토큰·SMTP, 메일 타임아웃 추가 |
| 로그인·세션 | 이메일 로그인, 로그아웃, 정지 시 무효화 | Django 세션·CSRF, 계정/IP 제한, session_version으로 정지 해제 후에도 이전 세션 무효 |
| 비밀번호 복구 | Better Auth 계약 | Django `/auth/password/reset/`로 제공, 기존 해시·세션 자동 호환 불가 |
| 내 정보 | `/api/me`, 내 게시물·예약·지원 | HTML·API 제공, 레거시 사용자 ID 매핑 보존 |
| 초대 | 발급·조회·폐기·사용, 만료·사용 횟수 제한 | 누락된 관리자 GET 목록 및 발급 시각 추가, HMAC 해시만 저장, 동시 사용 잠금 |
| Market | 목록·검색·가격·상태·페이지, 상세, 작성·수정·삭제 | HTML·JSON 구현. 상세 설명은 인증 학생만 열람하는 Django 정책 유지 |
| 예약 | 본인 예약 금지, 경쟁 방지, 취소·거래 완료 | 트랜잭션·조건부 유일성, 잘못된 action 400 및 성공 ok 필드 보완 |
| Clubs | 공개 목록, 소개·활동·모집, 운영자 관리·지원·검토 | HTML·JSON 구현, 목록의 recruiting 상태 추가, UUID/slug API 지원 |
| Finder | 공개 승인, 본인 대기글, 검색·작성·수정·종료·삭제 | HTML·JSON 구현, 부분 검색·유효한 필터 검사·createdAt/isOwn/hasMore 보완 |
| Finder 매칭 | 분류·색상·장소·날짜 가중치, 70점 이상 최대 20개 | 동일 점수 규칙, JSON score를 세부 점수 객체로 복구하고 scoreTotal 별칭 제공 |
| 신고 | 본인 글 금지, 관리자 목록·상태 변경·경쟁 감지 | HTML·JSON, from 상태 확인 및 409 충돌 |
| 이미지 | 5MB·픽셀·타입 검증, 메타데이터 제거, 비공개 객체 저장 | Pillow 재인코딩·비공개 R2, 승인/소유자 권한, 중복 파일 필드 거부, asset/media 응답 별칭 |
| 관리자 | 사진·Finder 승인, 초대·신고, 회원 정지 | HTML·JSON, 콘텐츠 변경 시 오래된 승인 거부, 개인 응답 공유 캐시 방지 |
| 운영 | 앱·DB·프록시·상태 검사 | Python 전용 이미지·Compose, Gunicorn, DB 포함 `/healthz/`, Django upstream |

## 보존한 API 경로

아래는 모두 Django가 제공한다. 변경 요청에는 `GET /api/csrf`로 받은 쿠키와 `X-CSRFToken`이 필요하다.

| 경로 | 메서드 |
|---|---|
| `/api/csrf`, `/api/me` | GET |
| `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-out` | POST |
| `/api/invitations/redeem` | POST |
| `/api/admin/invitations` | GET, POST |
| `/api/admin/invitations/{uuid}/revoke` | POST |
| `/api/market` | GET, POST |
| `/api/market/{uuid}` | GET, PATCH, DELETE |
| `/api/market/{uuid}/reservations` | POST |
| `/api/market/{uuid}/status` | PATCH |
| `/api/clubs` | GET |
| `/api/clubs/{uuid-or-slug}` | GET, PATCH |
| `/api/clubs/{uuid-or-slug}/posts` | POST |
| `/api/clubs/{uuid-or-slug}/recruitments` | POST, PATCH |
| `/api/clubs/{uuid-or-slug}/applications` | GET (`mine=1` 지원), POST, PATCH |
| `/api/finder` | GET, POST |
| `/api/finder/{uuid}` | GET, PATCH, DELETE |
| `/api/finder/{uuid}/matches` | GET |
| `/api/reports` | POST |
| `/api/admin/reports` | GET |
| `/api/admin/reports/{uuid}` | PATCH |
| `/api/media` | POST (multipart `file` 하나) |
| `/api/media/{uuid}` | GET |
| `/api/admin/media`, `/api/admin/finder` | GET |
| `/api/admin/media/{uuid}`, `/api/admin/finder/{uuid}` | PATCH |
| `/api/admin/users/{legacy-id-or-django-id}/status` | POST |

## 명시적인 계약 차이

- Better Auth의 범용 `/api/auth/*` 프로토콜·쿠키·토큰은 Django와 호환되지 않는다. 위 3개 인증 API 외의 이메일 검증·재전송·비밀번호 복구는 `/auth/verify/.../`, `/auth/resend/`, `/auth/password/reset/` HTML 흐름을 사용한다. 가입 JSON은 `name`, `email`, `password`를 받지만 Django username 규칙·고유성·비밀번호 검사가 적용된다.
- Django는 상태 변경에 세션 쿠키와 CSRF 토큰을 함께 요구한다. CSRF 실패는 기본 Django HTML 403이며, 잘못된 UUID 경로는 HTML 404일 수 있다. 기존 클라이언트가 무조건 JSON을 파싱하지 않도록 수정해야 한다.
- Market 목록은 이전처럼 설명·이메일을 제외한다. Django 상세도 비학생에게 설명을 숨기는 기존 Django 개인정보 정책을 유지한다. 분류는 레거시 고정 enum보다 넓은 문자열로 받아 이관된 분류를 보존한다.
- Finder 목록은 `hasMore`와 이전 Django의 `hasNext`를 함께 반환한다. 매칭 `score`는 레거시 세부 점수 객체이며 이전 Django 숫자 소비자는 `scoreTotal`을 사용한다. 수정은 공개 승인을 다시 요구한다. 공개 필터 q는 제목만 검색한다.
- Clubs 목록은 페이지당 20개와 `hasNext/page`를 반환한다(레거시는 최대 100개). 페이지를 순회한다. 지원 본문은 기존 2000자보다 넓은 3000자를 허용한다. 승인·거절이 끝난 지원을 다시 바꾸는 요청은 409로 거부한다. HTML 상세는 현재 모집만 보이고 API는 전체 모집을 반환한다.
- 사진 업로드는 레거시 `asset`과 Django `media`를 함께 반환한다. 저장 키·비공개 주소를 클라이언트에 공개하지 않는다. 원본 R2 객체를 이동·삭제하지 않고 기존 키를 참조한다. 게시물 삭제로 분리된 파일은 공개되지 않으며 자동 삭제하지 않는다.
- 사용자 정수 PK와 일부 하위 모델의 내부 PK는 바뀐다. `legacy_auth_id`와 `public_id` UUID를 보존하여 JSON 경로에 사용한다. 감사 기록의 과거 entity ID는 원문을 유지한다. 레거시 세션과 재계산 가능한 Finder 매칭 캐시만 가져오지 않는다.
- `/admin/`은 기능별 Django 관리 페이지이며 django.contrib.admin 기본 모델 UI를 노출하지 않는다. 최초 관리자 부여는 `bootstrap_admin` 명령으로 한다.

## 검증 범위

전체 Django 테스트는 권한·CSRF·세션·비밀번호 복구·초대·예약 경쟁·이미지·API 계약을 검증한다. PostgreSQL 복사 fixture는 원본 스키마, 데이터 관계, UUID, 재실행 거부 및 `--verify`를 검증한다. 브라우저 테스트는 격리 SQLite에서 실제 Gunicorn으로 가입→이메일 확인→로그인→초대→이미지·거래·Finder·지원·신고·관리자·모바일 흐름을 실행한다. 실제 SMTP 발송·R2 버킷 정책·Cloudflare 챌린지·백업 외부 보관은 운영 환경별 검증 대상이다.
