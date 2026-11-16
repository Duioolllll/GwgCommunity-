# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
"""Application-scoped ORM workers; configuration lives in config.settings."""
from pynext import DjangoResource


# Django ORM 작업의 대기열을 제한하는 애플리케이션 공유 리소스다.
RESOURCES = {"django": DjangoResource("config.settings", max_pending=128)}
