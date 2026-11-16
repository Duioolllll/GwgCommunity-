# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""Run the complete browser story on a disposable PyNext server/database."""
import subprocess
import sys
from support import isolated_server

# 조건 분기 `__name__ == '__main__'`: 참이면 With 구문으로 이어지는 내부 처리를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if __name__ == "__main__":
    with isolated_server() as (copy, env):
        subprocess.run([sys.executable, str(copy / "tests/browser_smoke.py")], env=env, check=True)
