from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_enviopedido'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PerfilCliente',
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
                ('rut', models.CharField(blank=True, max_length=20)),
                ('telefono', models.CharField(blank=True, max_length=30)),
                (
                    'tipo_cliente',
                    models.CharField(default='PARTICULAR', max_length=20),
                ),
                ('datos_institucion', models.JSONField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                (
                    'usuario',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='perfil_cliente',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name='DireccionEntrega',
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
                ('direccion', models.CharField(max_length=180)),
                (
                    'num_direccion',
                    models.CharField(blank=True, max_length=30),
                ),
                (
                    'detalle_direccion',
                    models.CharField(blank=True, max_length=120),
                ),
                ('comuna', models.CharField(max_length=30)),
                ('referencia', models.CharField(blank=True, max_length=180)),
                (
                    'nombre_receptor',
                    models.CharField(blank=True, max_length=120),
                ),
                (
                    'telefono_receptor',
                    models.CharField(blank=True, max_length=30),
                ),
                ('es_principal', models.BooleanField(default=False)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                (
                    'usuario',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='direcciones_entrega',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
