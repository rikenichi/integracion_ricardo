from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_pedido'),
    ]

    operations = [
        migrations.CreateModel(
            name='EnvioPedido',
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
                ('numero_tracking', models.CharField(max_length=40, unique=True)),
                (
                    'courier',
                    models.CharField(
                        default='Medistock despacho controlado',
                        max_length=80,
                    ),
                ),
                ('estado', models.CharField(default='generado', max_length=30)),
                ('estado_label', models.CharField(default='Generado', max_length=60)),
                ('direccion_destino', models.CharField(blank=True, max_length=255)),
                ('eventos', models.JSONField(default=list)),
                ('fecha_estimada_entrega', models.DateField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                (
                    'pedido',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='envio',
                        to='accounts.pedido',
                    ),
                ),
            ],
        ),
    ]
