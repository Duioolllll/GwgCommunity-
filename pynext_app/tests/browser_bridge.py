# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""Compatibility entry point for the PyNext browser story."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name("browser.py")), run_name="__main__")
