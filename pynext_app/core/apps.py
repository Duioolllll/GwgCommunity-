# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
from django.apps import AppConfig


# Django에 core 애플리케이션을 등록한다.
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
