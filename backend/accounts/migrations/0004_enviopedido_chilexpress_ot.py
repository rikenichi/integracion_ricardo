from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_perfilcliente_direccionentrega'),
    ]

    operations = [
        migrations.AddField(
            model_name='enviopedido',
            name='certificate_number',
            field=models.CharField(blank=True, max_length=60),
        ),
        migrations.AddField(
            model_name='enviopedido',
            name='chilexpress_reference',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='enviopedido',
            name='ot_created_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='enviopedido',
            name='ot_status',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='enviopedido',
            name='provider_response',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='enviopedido',
            name='transport_order_number',
            field=models.CharField(
                blank=True,
                max_length=60,
                null=True,
                unique=True,
            ),
        ),
    ]
