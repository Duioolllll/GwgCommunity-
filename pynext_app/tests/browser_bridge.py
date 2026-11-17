# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Compatibility entry point for the PyNext browser story."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name("browser.py")), run_name="__main__")
