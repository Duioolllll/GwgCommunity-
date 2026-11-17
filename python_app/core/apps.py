
from django.apps import AppConfig


# Django에 핵심 기능 묶음의 이름을 알려 준다.
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
