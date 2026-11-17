# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Run the complete domain/concurrency suite on disposable PostgreSQL 17."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import psycopg

APP = Path(__file__).resolve().parents[1]


# 프로그램을 시작하고 실행 옵션에 맞는 작업을 진행한다.
def main():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    name = f"gwg-pynext-regression-{os.getpid()}"
    url = f"postgresql://gwg:test-only@127.0.0.1:{port}/gwg_pynext_tests"
    # 현재 실행 환경에 실제로 있는 설정만 시험 서버로 복사한다.
    env = {key: os.environ[key] for key in ("PATH", "HOME", "LD_LIBRARY_PATH") if key in os.environ}
    env.update(PYTHONPATH=str(APP), DJANGO_DEBUG="1", DJANGO_DATABASE_URL=url)
    # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다. 성공하거나 실패해도 finally의 정리 작업은 실행한다.
    try:
        subprocess.run(["docker", "run", "-d", "--rm", "--name", name,
                        "-e", "POSTGRES_USER=gwg", "-e", "POSTGRES_PASSWORD=test-only",
                        "-e", "POSTGRES_DB=gwg_pynext_tests", "-p", f"127.0.0.1:{port}:5432", "postgres:17"],
                       check=True, stdout=subprocess.DEVNULL)
        # 정해 둔 횟수만큼 시도하거나 측정을 반복한다.
        for _ in range(150):
            # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
            try:
                with psycopg.connect(url):
                    break
            except psycopg.OperationalError:
                time.sleep(0.2)
        else:
            raise RuntimeError("Test PostgreSQL not ready")
        subprocess.run([sys.executable, str(APP / "manage.py"), "makemigrations", "--check", "--dry-run"], env=env, check=True)
        subprocess.run([sys.executable, str(APP / "manage.py"), "test", "core", "--verbosity", "1"], env=env, check=True)
    finally:
        subprocess.run(["docker", "stop", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# 다른 파일에서 불러올 때는 실행하지 않고, 이 파일을 직접 실행할 때만 아래 시작 코드를 실행한다.
if __name__ == "__main__":
    main()
