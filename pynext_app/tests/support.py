# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Disposable app, database and PyNext server for HTTP/browser verification."""
from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen

APP = Path(__file__).resolve().parents[1]


# 실제 운영 데이터와 떨어진 시험 서버를 잠시 실행한다.
@contextmanager
def isolated_server():
    with tempfile.TemporaryDirectory(prefix="gwg-pynext-test-", dir="/tmp") as directory:
        root = Path(directory)
        copy = root / "app"
        shutil.copytree(APP, copy, ignore=shutil.ignore_patterns(
            "__pycache__", ".pynext", ".venv", "private_uploads", "static_collected", ".env", ".env.*"))
        # 현재 실행 환경에 실제로 있는 설정만 시험 서버로 복사한다.
        env = {key: os.environ[key] for key in (
            "PATH", "HOME", "LD_LIBRARY_PATH", "FONTCONFIG_FILE",
            "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", "PLAYWRIGHT_BROWSERS_PATH") if key in os.environ}
        env.update(PYTHONPATH=str(copy), DJANGO_DEBUG="1", DJANGO_SETTINGS_MODULE="config.settings",
                   DJANGO_SQLITE_PATH=str(root / "test.sqlite3"), GWG_BROWSER_TEST="1")
        python = sys.executable
        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
        for command in ([python, str(copy / "manage.py"), "migrate", "--noinput"],
                        [python, str(copy / "manage.py"), "collectstatic", "--noinput"],
                        [str(Path(python).with_name("pynext")), "build", "--dir", str(copy)]):
            subprocess.run(command, env=env, check=True, stdout=subprocess.DEVNULL)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env["GWG_BROWSER_URL"] = f"http://127.0.0.1:{port}"
        with (root / "server.log").open("w+") as log:
            server = subprocess.Popen([python, str(copy / "serve.py"), "--port", str(port), "--workers", "1"],
                                      cwd=copy, env=env, stdout=log, stderr=log)
            # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다. 성공하거나 실패해도 finally의 정리 작업은 실행한다.
            try:
                # 정해 둔 횟수만큼 시도하거나 측정을 반복한다.
                for _ in range(150):
                    # 시험 서버가 준비되기 전에 종료되었다면 실패 이유를 알려 준다.
                    if server.poll() is not None:
                        raise RuntimeError("PyNext server exited")
                    # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
                    try:
                        with urlopen(env["GWG_BROWSER_URL"] + "/health/database", timeout=0.5):
                            break
                    except (URLError, TimeoutError):
                        time.sleep(0.1)
                else:
                    raise RuntimeError("PyNext DB readiness failed")
                yield copy, env
            except BaseException:
                log.flush()
                log.seek(0)
                print(log.read(), file=sys.stderr)
                raise
            finally:
                server.terminate()
                # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
                try:
                    server.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
