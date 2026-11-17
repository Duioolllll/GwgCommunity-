

from django.db import migrations, models


# 데이터베이스 구조를 바꿀 순서와 내용을 정한다.
class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_requestlimit'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='session_version',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
