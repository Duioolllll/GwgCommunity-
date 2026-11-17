
from django.db import migrations, models
from django.utils import timezone


# 데이터베이스 구조를 바꿀 순서와 내용을 정한다.
class Migration(migrations.Migration):
    dependencies = [('core', '0006_public_identifiers')]
    operations = [migrations.AddField(
        model_name='invitation', name='created_at',
        field=models.DateTimeField(auto_now_add=True, default=timezone.now),
        preserve_default=False,
    )]
