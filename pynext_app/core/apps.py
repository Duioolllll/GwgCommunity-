# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
from django.apps import AppConfig


# Django에 core 애플리케이션을 등록한다.
# 기능 `CoreConfig`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
