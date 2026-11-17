# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


# 데이터베이스의 표와 항목을 어떤 순서로 바꿀지 기록한다.
class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MediaAsset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('storage_key', models.CharField(max_length=200, unique=True)),
                ('content_type', models.CharField(max_length=30)),
                ('size', models.PositiveIntegerField()),
                ('moderation', models.CharField(choices=[('PENDING', '대기'), ('APPROVED', '승인'), ('REJECTED', '거부')], default='PENDING', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('finder_post', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='images', to='core.finderpost')),
                ('market_post', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='images', to='core.marketpost')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'constraints': [models.CheckConstraint(condition=models.Q(('market_post__isnull', False), ('finder_post__isnull', False), _negated=True), name='media_at_most_one_post')],
            },
        ),
    ]
