from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_enviopedido_chilexpress_ot'),
    ]

    operations = [
        migrations.AlterField(
            model_name='enviopedido',
            name='ot_status',
            field=models.CharField(blank=True, max_length=500),
        ),
    ]
