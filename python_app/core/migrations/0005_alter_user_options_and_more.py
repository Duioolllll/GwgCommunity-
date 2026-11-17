

import django.db.models.functions.text
from django.db import migrations, models


# 데이터베이스 구조를 바꿀 순서와 내용을 정한다.
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
