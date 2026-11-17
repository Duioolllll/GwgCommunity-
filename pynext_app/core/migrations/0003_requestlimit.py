# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.

from django.db import migrations, models


# 데이터베이스의 표와 항목을 어떤 순서로 바꿀지 기록한다.
class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_mediaasset'),
    ]

    operations = [
        migrations.CreateModel(
            name='RequestLimit',
            fields=[
                ('key', models.CharField(max_length=64, primary_key=True, serialize=False)),
                ('count', models.PositiveIntegerField(default=0)),
                ('window_start', models.DateTimeField()),
            ],
        ),
    ]
