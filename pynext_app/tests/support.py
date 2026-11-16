# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 컴프리헨션: `('PATH', 'HOME', 'LD_LIBRARY_PATH', 'FONTCONFIG_FILE', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH', 'PLAYWRIGHT_BROWSERS_PATH')`의 각 `key`를 순회한다. `key in os.environ`가 참인 항목만 포함한다.
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


# 기능 `isolated_server`: With 구문으로 이어지는 내부 처리를 실행한다.
@contextmanager
def isolated_server():
    with tempfile.TemporaryDirectory(prefix="gwg-pynext-test-", dir="/tmp") as directory:
        root = Path(directory)
        copy = root / "app"
        shutil.copytree(APP, copy, ignore=shutil.ignore_patterns(
            "__pycache__", ".pynext", ".venv", "private_uploads", "static_collected", ".env", ".env.*"))
        env = {key: os.environ[key] for key in (
            "PATH", "HOME", "LD_LIBRARY_PATH", "FONTCONFIG_FILE",
            "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", "PLAYWRIGHT_BROWSERS_PATH") if key in os.environ}
        env.update(PYTHONPATH=str(copy), DJANGO_DEBUG="1", DJANGO_SETTINGS_MODULE="config.settings",
                   DJANGO_SQLITE_PATH=str(root / "test.sqlite3"), GWG_BROWSER_TEST="1")
        python = sys.executable
        # 반복 `([python, str(copy / 'manage.py'), 'migrate', '--noinput'], [python, str(copy / 'manage.py'), 'collectstatic', '--noinput'], [str(Path(python).with_name('pynext')), 'build', '--dir', str(copy)])`: 각 항목을 `command`에 담아 먼저 `subprocess.run(command, env=env, check=True, stdout=subprocess.DEVNULL)`를 실행한다. 항목이 없으면 본문을 건너뛴다.
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
            # 예외 경계: 본문을 시도하고 `BaseException` 발생 시 먼저 `log.flush()`를 실행한다. 성공·실패와 관계없이 마지막에 먼저 `server.terminate()`를 실행한다.
            try:
                # 반복 `range(150)`: 각 항목을 `_`에 담아 If 구문으로 이어지는 내부 처리를 실행한다. 항목이 없으면 본문을 건너뛴다. 정상 소진 시 RuntimeError('PyNext DB readiness failed') 예외를 발생시킨다.
                for _ in range(150):
                    # 조건 분기 `server.poll() is not None`: 참이면 RuntimeError('PyNext server exited') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
                    if server.poll() is not None:
                        raise RuntimeError("PyNext server exited")
                    # 예외 경계: 본문을 시도하고 `(URLError, TimeoutError)` 발생 시 먼저 `time.sleep(0.1)`를 실행한다.
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
                # 예외 경계: 본문을 시도하고 `subprocess.TimeoutExpired` 발생 시 먼저 `server.kill()`를 실행한다.
                try:
                    server.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
