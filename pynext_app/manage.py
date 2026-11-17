#!/usr/bin/env python
# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Django's command-line utility for administrative tasks."""
import os
import sys


# Django 설정 모듈을 지정하고 관리 명령을 실행한다.
# 프로그램을 시작하고 실행 옵션에 맞는 작업을 진행한다.
def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    # 아래 작업을 시도하고, 오류가 나면 except에 적힌 방법으로 처리한다.
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


# 다른 파일에서 불러올 때는 실행하지 않고, 이 파일을 직접 실행할 때만 아래 시작 코드를 실행한다.
if __name__ == '__main__':
    main()
