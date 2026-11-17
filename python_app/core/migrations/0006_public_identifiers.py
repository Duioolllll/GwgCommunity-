

import uuid
from django.db import migrations, models


MODELS = ('reservation', 'clubpost', 'recruitment', 'application', 'report')


# 기존 데이터에 외부에서 사용할 새 번호를 채운다.
def populate_public_ids(apps, schema_editor):
    alias = schema_editor.connection.alias


    # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
    for name in MODELS:
        model = apps.get_model('core', name)


        # 목록에서 항목을 하나씩 꺼내 아래 작업을 적용한다. 목록이 비어 있으면 반복하지 않는다.
        for pk in model.objects.using(alias).filter(public_id__isnull=True).values_list('pk', flat=True).iterator():
            model.objects.using(alias).filter(pk=pk).update(public_id=uuid.uuid4())


# 데이터베이스 구조를 바꿀 순서와 내용을 정한다.
class Migration(migrations.Migration):
    dependencies = [('core', '0005_alter_user_options_and_more')]


    # 목록의 각 항목을 필요한 응답 정보로 바꿔 한데 모은다.
    operations = [
        migrations.AddField(model_name='user', name='legacy_auth_id', field=models.CharField(blank=True, max_length=255, null=True, unique=True)),
        *[migrations.AddField(model_name=name, name='public_id', field=models.UUIDField(editable=False, null=True)) for name in MODELS],
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        *[migrations.AlterField(model_name=name, name='public_id', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)) for name in MODELS],
    ]
