from django.db import models


class Producto(models.Model):
    codigo = models.CharField(max_length=40, unique=True)
    sku = models.CharField(max_length=40, blank=True)
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True)
    precio_b2c = models.PositiveIntegerField(default=0)
    precio_b2b = models.PositiveIntegerField(default=0)
    stock_disponible = models.PositiveIntegerField(default=0)
    categoria_nombre = models.CharField(max_length=80, blank=True)
    marca_nombre = models.CharField(max_length=80, blank=True)
    imagen_url = models.URLField(blank=True)
    activo = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.sku:
            self.sku = self.codigo
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.codigo} - {self.nombre}'
