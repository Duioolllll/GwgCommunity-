

from django.db import migrations, models


# 데이터베이스 구조를 바꿀 순서와 내용을 정한다.
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
