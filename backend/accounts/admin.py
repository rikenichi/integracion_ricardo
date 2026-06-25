from django.contrib import admin

from .models import EnvioPedido, Pedido


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'estado',
        'total',
        'usuario',
        'creado_en',
    )
    list_filter = ('estado',)
    search_fields = (
        '=id',
        'usuario__username',
        'usuario__email',
    )


@admin.register(EnvioPedido)
class EnvioPedidoAdmin(admin.ModelAdmin):
    list_display = (
        'numero_tracking',
        'pedido',
        'courier',
        'estado',
        'transport_order_number',
        'certificate_number',
        'chilexpress_reference',
        'ot_status',
        'ot_created_at',
        'creado_en',
    )
    search_fields = (
        'numero_tracking',
        'transport_order_number',
        'certificate_number',
        'chilexpress_reference',
        '=pedido__id',
        'pedido__usuario__username',
        'pedido__usuario__email',
    )
    list_filter = ('estado', 'courier')
