from django.contrib import admin

from .models import EnvioPedido


@admin.register(EnvioPedido)
class EnvioPedidoAdmin(admin.ModelAdmin):
    list_display = (
        'numero_tracking',
        'pedido',
        'courier',
        'estado',
        'creado_en',
    )
    search_fields = (
        'numero_tracking',
        '=pedido__id',
        'pedido__usuario__username',
    )
    list_filter = ('estado', 'courier')
