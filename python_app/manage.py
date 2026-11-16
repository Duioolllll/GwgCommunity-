#!/usr/bin/env python
# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""Django's command-line utility for administrative tasks."""
import os
import sys


# 기능 `main`: Run administrative tasks..
def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    # 예외 경계: 본문을 시도하고 `ImportError` 발생 시 ImportError("Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable? Did you forget to activate a virtual environment?") 예외를 발생시킨다.
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


# 조건 분기 `__name__ == '__main__'`: 참이면 먼저 `main()`를 실행한다. 거짓이면 이 블록을 건너뛰고 이후 코드로 진행한다.
if __name__ == '__main__':
    main()
