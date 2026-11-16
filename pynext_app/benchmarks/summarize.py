# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 조건식 `'?' in path`: 참일 때 `'`/api/market` 검색·가격·2페이지'`, 거짓일 때 `f'`{path}`'`를 선택한다.
# - 컴프리헨션: `runs`의 각 `row`를 순회한다. `row['path'] == path and row['engine'] == engine and (row['concurrency'] == concurrency)`가 참인 항목만 포함한다.
# - 컴프리헨션: `runs`의 각 `row`를 순회한다.
# - 단락 평가 `row['path'] == path and row['engine'] == engine and (row['concurrency'] == concurrency)`: 왼쪽 값이 거짓이면 남은 항을 평가하지 않고 그 값을 사용한다.
# - 컴프리헨션: `rows(path, engine, concurrency)`의 각 `row`를 순회한다.
# - 컴프리헨션: `runs`의 각 `row`를 순회한다.
# - 컴프리헨션: `runs`의 각 `row`를 순회한다.
"""Render a reviewable report from the stored benchmark measurements."""
import json
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / "results-nextjs-pynext.json").read_text())
runs = data["runs"]
paths = list(dict.fromkeys(row["path"] for row in runs))


# 기능 `rows`: [row for row in runs if row['path'] == path and row['engine'] == engine and (row['concurrency'] == concurrency)]을 반환한다.
def rows(path, engine, concurrency):
    return [row for row in runs if row["path"] == path and row["engine"] == engine and row["concurrency"] == concurrency]


# 기능 `median`: statistics.median((row[key] for row in rows(path, engine, concurrency)))을 반환한다.
def median(path, engine, concurrency, key):
    return statistics.median(row[key] for row in rows(path, engine, concurrency))


# 기능 `label`: '`/api/market` 검색·가격·2페이지' if '?' in path else f'`{path}`'을 반환한다.
def label(path):
    return "`/api/market` 검색·가격·2페이지" if "?" in path else f"`{path}`"


lines = ["# Next.js 대 PyNext 부하 테스트 — 2026-11-15", "",
         f"측정 시작 UTC: {data['timestamp_utc']}. 총 **{sum(row['requests'] for row in runs):,}개 요청**, "
         f"**{len(runs)}개 측정 구간**, **오류 {sum(row['errors'] for row in runs)}건**.", "",
         "## 조건", "",
         "- Next.js 15.5.28 운영 빌드와 PyNext 0.1.2/Uvicorn 운영 앱. 각각 앱 워커 1개.",
         "- 같은 ARM64 호스트, 같은 별도 PostgreSQL 17 컨테이너의 두 DB. 운영 DB와 별개.",
         "- 게시글 1,000개, 공개 동아리 20개와 모집 공고, 사용자 1명의 동일 ID·값을 생성하고 기존 importer로 복제·검증.",
         "- 동시 요청 1·8·32개, 각 경로·조건·엔진당 3초씩 3회. 순서를 번갈아 실행. 표는 반복 결과의 중앙값.",
         "- HTTP/1.1 keep-alive, 전체 본문 수신, 압축 identity, 쿠키 없는 GET. TLS·Nginx·브라우저 에셋 다운로드 제외.",
         "- 각 경로에서 0.5초 워밍업. CPU와 RSS는 앱 프로세스 트리만 측정하며 공통 DB·부하 발생기는 제외.",
         "- 실제 배포 PyNext는 워커 2개다. 비교에서는 프로세스 수를 맞추기 위해 1개로 고정했다.", "",
         "## 데이터 사전 검사", "",
         "Market 목록·필터 검색의 20개 레코드는 ID·값·순서가 일치했다. createdAt의 같은 시각을 표현하는 직렬화 차이는 비교에서 제외했다.",
         "Clubs의 20개 ID·목록 필드는 일치하지만 Next.js의 recruiting은 20개 모두 false, PyNext는 true였다.",
         '기존 Drizzle 쿼리가 `r.club_id = "id"`를 생성하여 외부 clubs.id 대신 모집 공고 자신의 id와 비교하는 것을 확인했다.',
         "기존 Next.js 비교 코드는 변경하지 않았다. 이 계산 필드 차이를 원시 JSON의 parity에 기록했다.", ""]
# 반복 `(1, 8, 32)`: 각 항목을 `concurrency`에 담아 먼저 `lines += [f'## 동시 요청 {concurrency}개', '', '| 경로 | Next.js req/s | PyNext req/s | PyNext/Next.js | Next.js p95 ms | PyNext p95 ms |', '|---|---:|---:|---:|---:|---:|']`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
for concurrency in (1, 8, 32):
    lines += [f"## 동시 요청 {concurrency}개", "",
              "| 경로 | Next.js req/s | PyNext req/s | PyNext/Next.js | Next.js p95 ms | PyNext p95 ms |",
              "|---|---:|---:|---:|---:|---:|"]
    # 반복 `paths`: 각 항목을 `path`에 담아 먼저 `next_rps = median(path, 'nextjs', concurrency, 'requests_per_second')`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for path in paths:
        next_rps = median(path, "nextjs", concurrency, "requests_per_second")
        py_rps = median(path, "pynext", concurrency, "requests_per_second")
        lines.append(f"| {label(path)} | {next_rps:.2f} | {py_rps:.2f} | {py_rps / next_rps:.2f}× | {median(path, 'nextjs', concurrency, 'p95_ms'):.2f} | {median(path, 'pynext', concurrency, 'p95_ms'):.2f} |")
    lines.append("")
lines += ["## 자원 사용 — 동시 요청 32개", "",
          "CPU 100%는 논리 코어 하나를 의미한다. RSS는 각 측정 구간에서 관찰한 최고값의 중앙값이다.", "",
          "| 경로 | Next.js CPU % | PyNext CPU % | Next.js RSS MiB | PyNext RSS MiB |",
          "|---|---:|---:|---:|---:|"]
# 반복 `paths`: 각 항목을 `path`에 담아 먼저 `lines.append(f"| {label(path)} | {median(path, 'nextjs', 32, 'cpu_percent_one_core'):.2f} | {median(path, 'pynext', 32, 'cpu_percent_one_core'):.2f} | {median(path, 'nextjs', 32, 'peak_rss_mib'):.2f} | {median(path, 'pynext', 32, 'peak_rss_mib'):.2f} |")`를 실행한다. 항목이 없으면 본문을 건너뛴다.
for path in paths:
    lines.append(f"| {label(path)} | {median(path, 'nextjs', 32, 'cpu_percent_one_core'):.2f} | {median(path, 'pynext', 32, 'cpu_percent_one_core'):.2f} | {median(path, 'nextjs', 32, 'peak_rss_mib'):.2f} | {median(path, 'pynext', 32, 'peak_rss_mib'):.2f} |")
lines += ["", "## 해석과 한계", "",
          "이 측정에서는 현재 Next.js 앱의 처리량이 더 높았다. 결과는 이식된 두 애플리케이션의 비교이며 프레임워크만 분리한 마이크로벤치마크가 아니다.",
          "Next.js의 홈은 빌드 시 생성된 정적 페이지이고 PyNext의 홈은 세션에 대응하는 서버 렌더링이다. HTML·JSON 봉투와 직렬화, SQL·이미지 조회 방식도 다르다.",
          "PyNext 앱은 DjangoResource의 워커당 동기 스레드 하나를 사용하고 작업이 끝날 때 DB 연결을 닫는다. Next.js는 pg 풀을 사용한다.",
          "이 차이가 API 처리량에 영향을 줄 수 있으나 이 실험만으로 비용을 각각 분리해서 단정하지 않는다.",
          "부하 발생기와 서버가 같은 호스트에서 실행되고 기존 운영·Kubernetes 프로세스도 존재한다. 폐쇄형 부하이므로 최대 용량·장기 안정성·외부 네트워크 지연을 의미하지 않는다.",
          "예약 등의 쓰기 부하는 포함하지 않는다. 거래 예약 동시성은 PostgreSQL 회귀 테스트에서 별도로 검증한다.", "",
          "## 재현", "", "```sh",
          "venv/bin/python pynext_app/benchmarks/compare_nextjs.py",
          "venv/bin/python pynext_app/benchmarks/summarize.py", "```", "",
          "[원시 측정 JSON](results-nextjs-pynext.json)에 p50/p95/p99, 상태 코드, 본문 크기, CPU, RSS와 반복별 기록이 있다.",
          "부하 테스트는 운영 주소를 받지 않으며 테스트용 PostgreSQL 컨테이너를 종료 시 정리한다.",
          "Next.js 빌드는 성공했다. 기존 node_modules의 ESLint 플러그인 누락으로 별도 legacy lint는 실행되지 못했으며 Next.js 소스는 변경하지 않았다.",
          "2026-11-09 결과 파일은 이전 Django/Gunicorn 비교의 역사 자료로 유지한다."]
(ROOT / "RESULTS.md").write_text("\n".join(lines) + "\n")
print(ROOT / "RESULTS.md")
