#!/usr/bin/env python

"""Django's command-line utility for administrative tasks."""
import os
import sys


# 명령줄에서 받은 작업을 Django 관리 도구로 실행한다.
def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')


    # 실패할 수 있는 작업을 시도한다. 문제가 생기면 아래 except에서 종류에 맞게 처리한다.
    try:
        from django.core.management import execute_from_command_line


    # 이 종류의 오류가 나면 잘못된 요청이나 설정임을 알리고 처리를 중단한다.
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


# 이 파일을 명령줄에서 직접 실행했을 때 필요한 저장·안내 작업을 실행한다. 조건에 맞지 않으면 이 부분을 건너뛴다.
if __name__ == '__main__':
    main()
