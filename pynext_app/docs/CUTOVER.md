# PyNext 실서버 전환 기록

- 완료: 2026-11-15 22:09:36 KST (2026-11-15T13:09:36.460339+00:00).
- 사이트: https://sunmyxd.tech/
- 컨테이너: `gwgcommunity-pynext-app-1`, healthy, Uvicorn 워커 2개.
- 이미지: `gwgcommunity-pynext:release-20261115` (`sha256:dbf2104c8ed3e1eaa687b8010d113688cded7994f83cc72031cceaf1a3949517`).
- 경로: Nginx TLS → `127.0.0.1:18083` → PyNext 파일 라우트 → 기존 업무 라이브러리 → PostgreSQL/R2.
- 기존 앱은 `127.0.0.1:18080`에서 healthy 상태로 복구용 보존.
- 기존 K3s 실험 프록시 18081·18082는 유지.

## 데이터와 백업

백업: `/home/skqew/GwgCommunity-/backups/pynext-cutover-20261115T125618Z`. PostgreSQL custom-format 백업은 74,024바이트이며
`pg_restore --list`로 205개 인덱스/헤더 행을 확인했다. 기존 Nginx·컨테이너 설정도 보관했다.
백업 디렉터리는 700, DB·비밀 설정 파일은 600 권한이다.

새 앱은 기존 DB·비밀 키·저장소 설정을 그대로 사용한다. 24개 테이블의 건수와
계정 정보의 집계 지문이 기존/새 앱에서 같았다. 전환 당시 사용자 0명, 저장 세션 0건이므로
기존 실제 로그인 세션의 연속성은 실데이터로 검증할 대상이 없었다. 임시 DB의 로그인·
세션 회전·로그아웃·권한·CSRF는 HTTP/브라우저 테스트에서 검증했다.
운영 DB에 테스트 계정이나 부하 데이터를 만들지 않았다. 대기 중인 마이그레이션은 없었다.

## 검증

- SQLite: 37개 중 35개 통과, PostgreSQL 전용 동시성 검사 2개 제외.
- 별도 PostgreSQL 17: 37개 모두 통과. `makemigrations --check --dry-run` 변경 없음.
- 실제 PyNext HTTP: 76개 기존 경로 응답 비교, 로그인·세션·로그아웃·CSRF·입력/본문 제한 통과.
- 브라우저: 가입·이메일 확인·초대·약 3MB 이미지 업로드/검토·거래·Finder·동아리·관리자·모바일 통과.
- 운영 후보: DB 헬스체크와 컨테이너 healthy, `manage.py migrate --check` 통과.
- 운영 설정 검사: 오류 없음. 기존 HSTS=0 정책에 대한 Django W004 안내 유지.
  PyNext가 임의로 별도의 HSTS 정책을 추가하지 않도록 설정했다.
- `nginx -t` 성공 후 reload. 원본 HTTPS 14개 검사와 공개 HTTPS 2개 검사 모두 예상 상태와
  `x-framework: PyNext/0.1.2` 확인. [검증 JSON](cutover-verification.json)에 경로·상태·크기를 기록했다.
- 공개 도메인의 실제 Chromium: 데스크톱/모바일 레이아웃·CSS·DB 헬스체크·콘솔 오류 없음 확인.
- Next.js/PyNext: 108개 측정 구간, 33,969개 요청, 오류 0건. [비교 보고서](../benchmarks/RESULTS.md).

복구는 백업 Nginx 설정 또는 upstream 18080으로 복원하고 `nginx -t` 후 reload한다.
동일한 DB를 유지하므로 앱 복구에 DB 덮어쓰기는 필요 없다.
