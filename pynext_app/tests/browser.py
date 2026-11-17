# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Run the complete browser story on a disposable PyNext server/database."""
import subprocess
import sys
from support import isolated_server

# 다른 파일에서 불러올 때는 실행하지 않고, 이 파일을 직접 실행할 때만 아래 시작 코드를 실행한다.
if __name__ == "__main__":
    with isolated_server() as (copy, env):
        subprocess.run([sys.executable, str(copy / "tests/browser_smoke.py")], env=env, check=True)
