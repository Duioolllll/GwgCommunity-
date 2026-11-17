# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Start the production PyNext application on Uvicorn."""
import argparse
from pathlib import Path
import sys
import uvicorn

# 프록시 헤더 자동 해석을 끄고 수명주기와 워커 제한을 명시해 서버를 기동한다.
# 다른 파일에서 불러올 때는 실행하지 않고, 이 파일을 직접 실행할 때만 아래 시작 코드를 실행한다.
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
