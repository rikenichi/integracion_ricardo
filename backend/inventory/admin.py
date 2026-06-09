from django.contrib import admin

from .models import Producto


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'sku', 'nombre', 'precio', 'activo')
    search_fields = ('codigo', 'sku', 'nombre')
    list_filter = ('activo',)

    @admin.display(description='Precio', ordering='precio_b2c')
    def precio(self, producto):
        return producto.precio_b2c
