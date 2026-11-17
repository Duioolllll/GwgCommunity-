# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Production PyNext ASGI entry point (Uvicorn with lifespan enabled)."""
import importlib
from pathlib import Path
import pynext
from pynext import SecurityConfig, create_app

# 프레임워크 버전과 기존 한도를 확인한 후 업로드 전송 한도만 조정한다.
transport = importlib.import_module("pynext.app")
# 검증한 PyNext 버전과 요청 크기 제한이 맞지 않으면 호환되지 않을 수 있으므로 시작을 중단한다.
if pynext.__version__ != "0.1.2" or transport.MAX_BODY != 1_048_576:
    raise RuntimeError("Review the PyNext ASGI upload compatibility adjustment")
transport.MAX_BODY = 22 * 1024 * 1024
app = create_app(Path(__file__).resolve().parent, production=True,
                 security=SecurityConfig(hsts_enabled=False))
