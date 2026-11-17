# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
"""Application-scoped ORM workers; configuration lives in config.settings."""
from pynext import DjangoResource


# Django 파이썬 코드로 데이터베이스를 다루는 기능(ORM) 작업의 대기열을 제한하는 애플리케이션 공유 리소스다.
RESOURCES = {"django": DjangoResource("config.settings", max_pending=128)}
