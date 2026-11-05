import uuid
from django.db import migrations, models


MODELS = ('reservation', 'clubpost', 'recruitment', 'application', 'report')


def populate_public_ids(apps, schema_editor):
    alias = schema_editor.connection.alias
    for name in MODELS:
        model = apps.get_model('core', name)
        for pk in model.objects.using(alias).filter(public_id__isnull=True).values_list('pk', flat=True).iterator():
            model.objects.using(alias).filter(pk=pk).update(public_id=uuid.uuid4())


class Migration(migrations.Migration):
    dependencies = [('core', '0005_alter_user_options_and_more')]
    operations = [
        migrations.AddField(model_name='user', name='legacy_auth_id', field=models.CharField(blank=True, max_length=255, null=True, unique=True)),
        *[migrations.AddField(model_name=name, name='public_id', field=models.UUIDField(editable=False, null=True)) for name in MODELS],
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        *[migrations.AlterField(model_name=name, name='public_id', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)) for name in MODELS],
    ]
