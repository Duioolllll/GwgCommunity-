# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Reproducible Next.js versus PyNext application benchmark on synthetic data.

Starts a disposable PostgreSQL container, imports the same fixture into both
schemas, then alternates production servers. No production URL is accepted.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import http.client
import json
import os
from pathlib import Path
import platform
import socket
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import quote
from urllib.request import urlopen

import psycopg

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "pynext_app"
PATHS = ("/", "/market", "/clubs", "/api/market", "/api/clubs",
         "/api/market?category=" + quote("책·교재") + "&minPrice=1000&maxPrice=90000&page=2")


# 시험 서버가 쓸 수 있는 빈 포트 번호를 찾는다.
def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


# 서버 프로세스가 쓰는 CPU와 메모리 사용량을 읽는다.
def process_stats(pid):
    ticks, rss = 0, 0
    pending = [pid]
    # pending인 동안 반복한다. 조건이 달라지면 반복을 끝낸다.
    while pending:
        current = pending.pop()
        # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
        try:
            root = Path(f"/proc/{current}")
            values = (root / "stat").read_text().rsplit(")", 1)[1].split()
            ticks += int(values[11]) + int(values[12])
            rss += int((root / "statm").read_text().split()[1]) * os.sysconf("SC_PAGE_SIZE")
            pending.extend(map(int, (root / "task" / str(current) / "children").read_text().split()))
        except (FileNotFoundError, ProcessLookupError):
            continue
    return ticks, rss


# 정해진 시간 동안 요청을 보내 속도와 자원 사용량을 측정한다.
def sample(port, path, concurrency, seconds, pid):
    barrier = threading.Barrier(concurrency + 1)
    deadline = [0.0]
    ticks_before, rss_before = process_stats(pid)
    rss_peak = [rss_before]
    stop_monitor = threading.Event()

    # 측정이 끝날 때까지 서버의 CPU·메모리 사용량을 주기적으로 기록한다.
    def monitor():
        # 측정 종료 신호가 올 때까지 반복해서 서버 상태를 기록한다.
        while not stop_monitor.wait(0.1):
            rss_peak[0] = max(rss_peak[0], process_stats(pid)[1])

    # 한 명의 시험 사용자처럼 반복해서 요청을 보내고 응답 시간을 기록한다.
    def worker(_):
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        records = []
        barrier.wait()
        # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다. 성공하거나 실패해도 finally의 정리 작업은 실행한다.
        try:
            # 미리 정한 시험 종료 시각 전까지 계속 요청을 보낸다.
            while time.perf_counter() < deadline[0]:
                started = time.perf_counter()
                # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
                try:
                    connection.request("GET", path, headers={"Host": "localhost", "Accept-Encoding": "identity"})
                    response = connection.getresponse()
                    body = response.read()
                    status, size = response.status, len(body)
                except (OSError, http.client.HTTPException):
                    status, size = 0, 0
                    connection.close()
                    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
                records.append(((time.perf_counter() - started) * 1000, status, size))
        finally:
            connection.close()
        return records

    monitor_thread = threading.Thread(target=monitor)
    monitor_thread.start()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker, index) for index in range(concurrency)]
        started = time.perf_counter()
        deadline[0] = started + seconds
        barrier.wait()
        records = [row for future in futures for row in future.result()]
    elapsed = time.perf_counter() - started
    stop_monitor.set()
    monitor_thread.join()
    ticks_after, rss_after = process_stats(pid)
    latencies = sorted(row[0] for row in records)
    statuses = {str(status): sum(row[1] == status for row in records) for status in sorted({row[1] for row in records})}
    return {"requests": len(records), "elapsed_seconds": round(elapsed, 3),
            "requests_per_second": round(len(records) / elapsed, 2),
            "p50_ms": round(statistics.median(latencies), 2),
            "p95_ms": round(latencies[max(0, (95 * len(latencies) + 99) // 100 - 1)], 2),
            "p99_ms": round(latencies[max(0, (99 * len(latencies) + 99) // 100 - 1)], 2),
            "errors": sum(row[1] != 200 for row in records), "statuses": statuses,
            "cpu_percent_one_core": round((ticks_after - ticks_before) / os.sysconf("SC_CLK_TCK") / elapsed * 100, 2),
            "peak_rss_mib": round(max(rss_peak[0], rss_after) / 1024 ** 2, 2),
            "bytes_min": min(row[2] for row in records), "bytes_max": max(row[2] for row in records)}


# 서버가 응답할 때까지 기다리고, 시작에 실패하면 오류를 알려 준다.
def wait_ready(server, port, path):
    # 정해 둔 횟수만큼 시도하거나 측정을 반복한다.
    for _ in range(200):
        # 시험 서버가 준비되기 전에 종료되었다면 실패 이유를 알려 준다.
        if server.poll() is not None:
            raise RuntimeError(f"Server on port {port} exited")
        # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
        try:
            with urlopen(f"http://127.0.0.1:{port}{path}", timeout=1):
                return
        except (OSError, TimeoutError):
            time.sleep(0.1)
    raise RuntimeError("Readiness timeout")


# 두 서버가 같은 데이터로 시험하도록 시험 자료를 준비한다.
def seed(source_url):
    with psycopg.connect(source_url, autocommit=True) as connection:
        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
        for migration in sorted((ROOT / "next_engine/drizzle").glob("*.sql")):
            connection.execute(migration.read_text())
        connection.execute('''INSERT INTO "user" (id,name,email,email_verified,status)
            VALUES ('benchmark-user','벤치마크 사용자','bench@example.invalid',true,'ACTIVE_STUDENT')''')
        connection.execute('''INSERT INTO market_posts (id,owner_id,title,description,price,category,created_at,updated_at)
            SELECT md5('post'||i)::uuid,'benchmark-user','테스트 교재 '||i,'합성 데이터',i*100,
                (ARRAY['책·교재','의류','전자기기','나눔','기타'])[1+(i%5)],
                '2026-01-01'::timestamptz+i*interval '1 second','2026-01-01'::timestamptz
            FROM generate_series(1,1000) i''')
        connection.execute('''INSERT INTO clubs (id,slug,name,category,introduction,is_public)
            SELECT md5('club'||i)::uuid,'club-'||i,'테스트 동아리 '||lpad(i::text,2,'0'),'활동','합성 동아리 데이터',true
            FROM generate_series(1,20) i''')
        connection.execute('''INSERT INTO club_recruitments (club_id,title,description,opens_at,closes_at,is_open)
            SELECT id,'모집','합성 모집 데이터',now()-interval '1 day',now()+interval '1 day',true FROM clubs''')


# 프로그램을 시작하고 실행 옵션에 맞는 작업을 진행한다.
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=float, default=3)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--concurrency", type=int, nargs="+", default=[1, 8, 32])
    parser.add_argument("--output", type=Path, default=APP / "benchmarks/results-nextjs-pynext.json")
    args = parser.parse_args()
    # 시험 시간·반복 횟수·동시 접속 수는 모두 양수여야 한다.
    if args.seconds <= 0 or args.repeats <= 0 or any(n <= 0 for n in args.concurrency):
        parser.error("Durations and counts must be positive")
    port, next_port, py_port = free_port(), free_port(), free_port()
    container = f"gwg-framework-bench-{os.getpid()}"
    base_url = f"postgresql://benchmark:benchmark-only@127.0.0.1:{port}"
    source_url, target_url = base_url + "/gwg_next_bench", base_url + "/gwg_pynext_bench"
    # 현재 실행 환경에 실제로 있는 설정만 시험 서버로 복사한다.
    env = {key: os.environ[key] for key in ("PATH", "HOME", "LD_LIBRARY_PATH") if key in os.environ}
    py_env = dict(env, PYTHONPATH=str(APP), DJANGO_DEBUG="0", DJANGO_SETTINGS_MODULE="config.settings",
                  DJANGO_DATABASE_URL=target_url, GWG_LEGACY_DATABASE_URL=source_url,
                  DJANGO_SECRET_KEY="benchmark-only-secret-01234567890123456789",
                  DJANGO_INVITATION_SECRET="benchmark-only-invite-01234567890123456789",
                  PYNEXT_LOG_LEVEL="WARNING")
    next_env = dict(env, NODE_ENV="production", NEXT_TELEMETRY_DISABLED="1", DATABASE_URL=source_url,
                    BETTER_AUTH_SECRET="benchmark-only-secret-01234567890123456789", BETTER_AUTH_URL=f"http://localhost:{next_port}")
    results = {"timestamp_utc": datetime.now(timezone.utc).isoformat(),
               "method": {"workload": "migrated application, not an identical-render microbenchmark",
                          "python": platform.python_version(), "machine": platform.machine(),
                          "cpus": len(os.sched_getaffinity(0)), "seconds": args.seconds,
                          "repeats": args.repeats, "concurrency": args.concurrency,
                          "app_workers_each": 1, "database": "same disposable PostgreSQL 17 container, separate schemas/databases",
                          "fixture": "same IDs and values: 1000 market posts, 20 public clubs and recruitments, 1 user",
                          "http": "HTTP/1.1 keep-alive, no TLS/proxy, identity encoding, full response bodies",
                          "resources": "application process tree only; excludes shared DB and load generator",
                          "limitations": "HTML templates and JSON envelope/serialization differ. API records checked before load. Closed-loop localhost load; not maximum production capacity."},
               "parity": {}, "runs": []}
    servers = []
    # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다. 성공하거나 실패해도 finally의 정리 작업은 실행한다.
    try:
        subprocess.run(["docker", "run", "-d", "--rm", "--name", container,
                        "--memory", "512m", "-e", "POSTGRES_USER=benchmark", "-e", "POSTGRES_PASSWORD=benchmark-only",
                        "-e", "POSTGRES_DB=postgres", "-p", f"127.0.0.1:{port}:5432", "postgres:17"],
                       check=True, stdout=subprocess.DEVNULL)
        # 정해 둔 횟수만큼 시도하거나 측정을 반복한다.
        for _ in range(150):
            # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
            try:
                with psycopg.connect(base_url + "/postgres", autocommit=True) as connection:
                    connection.execute('CREATE DATABASE gwg_next_bench')
                    connection.execute('CREATE DATABASE gwg_pynext_bench')
                break
            except psycopg.OperationalError:
                time.sleep(0.2)
        else:
            raise RuntimeError("Benchmark PostgreSQL did not start")
        seed(source_url)
        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
        for command in ([sys.executable, str(APP / "manage.py"), "migrate", "--noinput"],
                        [sys.executable, str(APP / "manage.py"), "import_legacy", "--apply"],
                        [sys.executable, str(APP / "manage.py"), "import_legacy", "--verify"],
                        [str(Path(sys.executable).with_name("pynext")), "build", "--dir", str(APP)]):
            subprocess.run(command, env=py_env, check=True, stdout=subprocess.DEVNULL)
        with tempfile.TemporaryDirectory(prefix="gwg-framework-bench-", dir="/tmp") as directory:
            with (Path(directory) / "next.log").open("w") as next_log, (Path(directory) / "pynext.log").open("w") as py_log:
                servers.append(subprocess.Popen(["node", str(ROOT / "node_modules/next/dist/bin/next"), "start", str(ROOT / "next_engine"), "--hostname", "127.0.0.1", "--port", str(next_port)], cwd=ROOT / "next_engine", env=next_env, stdout=next_log, stderr=next_log))
                servers.append(subprocess.Popen([sys.executable, str(APP / "serve.py"), "--port", str(py_port), "--workers", "1"], cwd=APP, env=py_env, stdout=py_log, stderr=py_log))
                wait_ready(servers[0], next_port, "/")
                wait_ready(servers[1], py_port, "/health/database")
                # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                for path, key in (("/api/market", "posts"), (PATHS[-1], "posts"), ("/api/clubs", "clubs")):
                    values = []
                    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                    for engine_port in (next_port, py_port):
                        with urlopen(f"http://127.0.0.1:{engine_port}{path}") as response:
                            values.append(json.load(response))
                    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                    for result in values:
                        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                        for row in result[key]:
                            row.pop("createdAt", None)
                    differences = {}
                    # 동아리 목록 응답은 해당 응답 구조에 맞추어 비교한다.
                    if key == "clubs":
                        differences["recruiting"] = sum(a["recruiting"] != b["recruiting"]
                            for a, b in zip(values[0][key], values[1][key]))
                        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                        for result in values:
                            # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                            for row in result[key]:
                                row.pop("recruiting")
                    # 두 구현에서 읽은 데이터가 다르면 같은 조건의 비교가 아니므로 중단한다.
                    if values[0][key] != values[1][key]:
                        raise RuntimeError(f"Fixture/API parity failed for {path}")
                    results["parity"][path] = {"matching_listing_records": len(values[0][key]),
                                               "computed_field_differences": differences}
                results["method"]["nextjs_version"] = json.loads((ROOT / "node_modules/next/package.json").read_text())["version"]
                results["method"]["pynext_version"] = "0.1.2 (ASGI/Uvicorn)"
                engines = [("nextjs", next_port, servers[0].pid), ("pynext", py_port, servers[1].pid)]
                # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                for path in PATHS:
                    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                    for _, engine_port, pid in engines:
                        sample(engine_port, path, 1, 0.5, pid)
                    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                    for concurrency in args.concurrency:
                        # 정해 둔 횟수만큼 시도하거나 측정을 반복한다.
                        for repeat in range(args.repeats):
                            # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
                            # 반복마다 서버 측정 순서를 번갈아 바꿔 먼저 실행하는 쪽의 유리함을 줄인다.
                            for engine, engine_port, pid in (engines if repeat % 2 == 0 else list(reversed(engines))):
                                row = sample(engine_port, path, concurrency, args.seconds, pid)
                                row.update(engine=engine, path=path, concurrency=concurrency, repeat=repeat + 1)
                                results["runs"].append(row)
                            args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
                        print(f"Completed {path} concurrency={concurrency}", flush=True)
    finally:
        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
        for server in servers:
            server.terminate()
        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
        for server in servers:
            # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
            try:
                server.wait(timeout=20)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
        subprocess.run(["docker", "stop", container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    errors = sum(row["errors"] for row in results["runs"])
    print(f"Saved {args.output}; requests={sum(row['requests'] for row in results['runs'])}, errors={errors}")
    # 시험 중 오류가 하나라도 발생했다면 성공한 측정값으로 기록하지 않는다.
    if errors:
        raise SystemExit(1)


# 다른 파일에서 불러올 때는 실행하지 않고, 이 파일을 직접 실행할 때만 아래 시작 코드를 실행한다.
if __name__ == "__main__":
    main()
