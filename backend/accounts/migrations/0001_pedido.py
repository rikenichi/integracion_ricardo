from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Pedido',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('estado', models.CharField(default='PENDIENTE_PAGO', max_length=30)),
                ('subtotal', models.PositiveBigIntegerField(default=0)),
                ('total', models.PositiveBigIntegerField(default=0)),
                ('detalles', models.JSONField(default=list)),
                ('pago', models.JSONField(default=dict)),
                ('despacho', models.JSONField(default=dict)),
                ('datos', models.JSONField(default=dict)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                (
                    'usuario',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='pedidos',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
