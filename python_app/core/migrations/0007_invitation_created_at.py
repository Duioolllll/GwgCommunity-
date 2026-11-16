# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
from django.db import migrations, models
from django.utils import timezone


# 기능 `Migration`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Migration(migrations.Migration):
    dependencies = [('core', '0006_public_identifiers')]
    operations = [migrations.AddField(
        model_name='invitation', name='created_at',
        field=models.DateTimeField(auto_now_add=True, default=timezone.now),
        preserve_default=False,
    )]
