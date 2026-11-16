# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""Start the production PyNext application on Uvicorn."""
import argparse
from pathlib import Path
import sys
import uvicorn

# 프록시 헤더 자동 해석을 끄고 수명주기와 워커 제한을 명시해 서버를 기동한다.
# 조건 분기 `__name__ == '__main__'`: 참이면 먼저 `parser = argparse.ArgumentParser()`로 상태 또는 조회 조건을 갱신한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    uvicorn.run("asgi:app", host=args.host, port=args.port, workers=args.workers,
                proxy_headers=False, lifespan="on", access_log=False,
                timeout_keep_alive=5, timeout_graceful_shutdown=60,
                limit_concurrency=256, server_header=False)
