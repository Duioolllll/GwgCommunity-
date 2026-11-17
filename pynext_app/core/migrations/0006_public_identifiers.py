# 이 파일은 관련 기능을 실행하기 위한 코드와 설정을 모아 둔다.
import uuid
from django.db import migrations, models


MODELS = ('reservation', 'clubpost', 'recruitment', 'application', 'report')


# 기존 데이터에도 공개용 고유 번호를 채워 넣는다.
def populate_public_ids(apps, schema_editor):
    alias = schema_editor.connection.alias
    # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
    for name in MODELS:
        model = apps.get_model('core', name)
        # 준비한 목록을 하나씩 읽어 아래 작업을 반복한다. 목록이 비어 있으면 건너뛴다.
        for pk in model.objects.using(alias).filter(public_id__isnull=True).values_list('pk', flat=True).iterator():
            model.objects.using(alias).filter(pk=pk).update(public_id=uuid.uuid4())


# 데이터베이스의 표와 항목을 어떤 순서로 바꿀지 기록한다.
class Migration(migrations.Migration):
    dependencies = [('core', '0005_alter_user_options_and_more')]
    operations = [
        migrations.AddField(model_name='user', name='legacy_auth_id', field=models.CharField(blank=True, max_length=255, null=True, unique=True)),
        *[migrations.AddField(model_name=name, name='public_id', field=models.UUIDField(editable=False, null=True)) for name in MODELS],
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        *[migrations.AlterField(model_name=name, name='public_id', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)) for name in MODELS],
    ]
