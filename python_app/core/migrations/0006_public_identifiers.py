# 제출용 기능·분기 설명: 조건식은 실제 코드의 평가 순서와 반환값을 기준으로 읽는다.
# 표현식·화면 분기 목록 (같은 조건이 다른 함수에서 반복될 수 있음):
# - 컴프리헨션: `MODELS`의 각 `name`를 순회한다.
# - 컴프리헨션: `MODELS`의 각 `name`를 순회한다.
import uuid
from django.db import migrations, models


MODELS = ('reservation', 'clubpost', 'recruitment', 'application', 'report')


# 기능 `populate_public_ids`: 먼저 `alias = schema_editor.connection.alias`로 상태 또는 조회 조건을 갱신한다.
def populate_public_ids(apps, schema_editor):
    alias = schema_editor.connection.alias
    # 반복 `MODELS`: 각 항목을 `name`에 담아 먼저 `model = apps.get_model('core', name)`로 상태 또는 조회 조건을 갱신한다. 항목이 없으면 본문을 건너뛴다.
    for name in MODELS:
        model = apps.get_model('core', name)
        # 반복 `model.objects.using(alias).filter(public_id__isnull=True).values_list('pk', flat=True).iterator()`: 각 항목을 `pk`에 담아 먼저 `model.objects.using(alias).filter(pk=pk).update(public_id=uuid.uuid4())`를 실행한다. 항목이 없으면 본문을 건너뛴다.
        for pk in model.objects.using(alias).filter(public_id__isnull=True).values_list('pk', flat=True).iterator():
            model.objects.using(alias).filter(pk=pk).update(public_id=uuid.uuid4())


# 기능 `Migration`: 관련 데이터·상태 또는 동작을 하나의 형식으로 정의한다.
class Migration(migrations.Migration):
    dependencies = [('core', '0005_alter_user_options_and_more')]
    operations = [
        migrations.AddField(model_name='user', name='legacy_auth_id', field=models.CharField(blank=True, max_length=255, null=True, unique=True)),
        *[migrations.AddField(model_name=name, name='public_id', field=models.UUIDField(editable=False, null=True)) for name in MODELS],
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        *[migrations.AlterField(model_name=name, name='public_id', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)) for name in MODELS],
    ]
