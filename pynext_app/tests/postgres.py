# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 컴프리헨션: `('PATH', 'HOME', 'LD_LIBRARY_PATH')`의 각 `key`를 순회한다. `key in os.environ`가 참인 항목만 포함한다.
"""Run the complete domain/concurrency suite on disposable PostgreSQL 17."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import psycopg

APP = Path(__file__).resolve().parents[1]


# 기능 `main`: With 구문으로 이어지는 내부 처리를 실행한다.
def main():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    name = f"gwg-pynext-regression-{os.getpid()}"
    url = f"postgresql://gwg:test-only@127.0.0.1:{port}/gwg_pynext_tests"
    env = {key: os.environ[key] for key in ("PATH", "HOME", "LD_LIBRARY_PATH") if key in os.environ}
    env.update(PYTHONPATH=str(APP), DJANGO_DEBUG="1", DJANGO_DATABASE_URL=url)
    # 예외 경계: 본문을 시도하고 . 성공·실패와 관계없이 마지막에 먼저 `subprocess.run(['docker', 'stop', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)`를 실행한다.
    try:
        subprocess.run(["docker", "run", "-d", "--rm", "--name", name,
                        "-e", "POSTGRES_USER=gwg", "-e", "POSTGRES_PASSWORD=test-only",
                        "-e", "POSTGRES_DB=gwg_pynext_tests", "-p", f"127.0.0.1:{port}:5432", "postgres:17"],
                       check=True, stdout=subprocess.DEVNULL)
        # 반복 `range(150)`: 각 항목을 `_`에 담아 Try 구문으로 이어지는 내부 처리를 실행한다. 항목이 없으면 본문을 건너뛴다. 정상 소진 시 RuntimeError('Test PostgreSQL not ready') 예외를 발생시킨다.
        for _ in range(150):
            # 예외 경계: 본문을 시도하고 `psycopg.OperationalError` 발생 시 먼저 `time.sleep(0.2)`를 실행한다.
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


# 조건 분기 `__name__ == '__main__'`: 참이면 먼저 `main()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if __name__ == "__main__":
    main()
