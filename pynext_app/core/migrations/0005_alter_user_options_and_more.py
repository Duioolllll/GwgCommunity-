# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.

import django.db.models.functions.text
from django.db import migrations, models


# 데이터베이스의 표와 항목을 어떤 순서로 바꿀지 기록한다.
class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('core', '0004_user_session_version'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='user',
            options={},
        ),
        migrations.AddConstraint(
            model_name='user',
            constraint=models.UniqueConstraint(django.db.models.functions.text.Lower('email'), name='unique_email_case_insensitive'),
        ),
    ]
