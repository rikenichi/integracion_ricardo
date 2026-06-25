from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_alter_enviopedido_ot_status'),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentoTributario',
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
                (
                    'tipo_documento',
                    models.CharField(
                        choices=[
                            ('BOLETA', 'Boleta'),
                            ('FACTURA', 'Factura'),
                        ],
                        default='BOLETA',
                        max_length=10,
                    ),
                ),
                (
                    'proveedor',
                    models.CharField(
                        choices=[
                            ('MOCK', 'Mock'),
                            ('LIBREDTE', 'LibreDTE'),
                        ],
                        default='MOCK',
                        max_length=10,
                    ),
                ),
                (
                    'folio',
                    models.CharField(max_length=60, unique=True),
                ),
                (
                    'estado',
                    models.CharField(
                        choices=[
                            ('PENDIENTE', 'Pendiente'),
                            ('EMITIDO', 'Emitido'),
                            ('ERROR', 'Error'),
                        ],
                        default='PENDIENTE',
                        max_length=12,
                    ),
                ),
                (
                    'monto_total',
                    models.PositiveBigIntegerField(default=0),
                ),
                (
                    'fecha_emision',
                    models.DateTimeField(blank=True, null=True),
                ),
                ('url_pdf', models.URLField(blank=True)),
                (
                    'provider_response',
                    models.JSONField(blank=True, default=dict),
                ),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                (
                    'pedido',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='documento_tributario',
                        to='accounts.pedido',
                    ),
                ),
            ],
        ),
    ]
