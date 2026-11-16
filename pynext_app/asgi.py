# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 단락 평가 `pynext.__version__ != '0.1.2' or transport.MAX_BODY != 1048576`: 왼쪽 값이 참이면 남은 항을 평가하지 않고 그 값을 사용한다.
"""Production PyNext ASGI entry point (Uvicorn with lifespan enabled)."""
import importlib
from pathlib import Path
import pynext
from pynext import SecurityConfig, create_app

# 0.1.2 has a fixed ASGI ceiling and no per-app option. Keep this application
# compatibility adjustment version-locked and covered by real upload tests.
# Image validation remains 5 MiB per file, forms 22 MiB, Nginx 20 MiB.
# 프레임워크 버전과 기존 한도를 확인한 후 업로드 전송 한도만 조정한다.
transport = importlib.import_module("pynext.app")
# 조건 분기 `pynext.__version__ != '0.1.2' or transport.MAX_BODY != 1048576`: 참이면 RuntimeError('Review the PyNext ASGI upload compatibility adjustment') 예외를 발생시킨다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if pynext.__version__ != "0.1.2" or transport.MAX_BODY != 1_048_576:
    raise RuntimeError("Review the PyNext ASGI upload compatibility adjustment")
transport.MAX_BODY = 22 * 1024 * 1024
# Preserve the existing HSTS policy through the application security middleware,
# rather than adding PyNext's independent one-year/subdomain default.
app = create_app(Path(__file__).resolve().parent, production=True,
                 security=SecurityConfig(hsts_enabled=False))
