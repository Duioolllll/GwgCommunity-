# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
from django.db import migrations, models
from django.utils import timezone


# 데이터베이스의 표와 항목을 어떤 순서로 바꿀지 기록한다.
class Migration(migrations.Migration):
    dependencies = [('core', '0006_public_identifiers')]
    operations = [migrations.AddField(
        model_name='invitation', name='created_at',
        field=models.DateTimeField(auto_now_add=True, default=timezone.now),
        preserve_default=False,
    )]
