import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_perfiltrabajador'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConvenioB2B',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=120)),
                ('porcentaje_descuento', models.PositiveSmallIntegerField(default=10, help_text='Porcentaje de descuento sobre precio_b2c (0-100).')),
                ('activo', models.BooleanField(default=True)),
                ('fecha_inicio', models.DateField(blank=True, null=True)),
                ('fecha_fin', models.DateField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('perfil', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='convenio_b2b',
                    to='accounts.perfilcliente',
                )),
            ],
        ),
    ]
