from django.contrib import admin
from django.contrib import messages

from logistics.services.shipping_service import generar_ot_para_pedido
from .models import EnvioPedido, Pedido


def _generar_ot_desde_admin(modeladmin, request, pedido):
    if pedido.estado != 'CONFIRMADO':
        modeladmin.message_user(
            request,
            f'Pedido #{pedido.id}: omitido porque no esta CONFIRMADO.',
            level=messages.WARNING,
        )
        return

    try:
        envio = pedido.envio
    except EnvioPedido.DoesNotExist:
        modeladmin.message_user(
            request,
            f'Pedido #{pedido.id}: no tiene EnvioPedido asociado.',
            level=messages.ERROR,
        )
        return

    if envio.transport_order_number:
        modeladmin.message_user(
            request,
            f'Pedido #{pedido.id}: ya tiene una OT Chilexpress.',
            level=messages.WARNING,
        )
        return

    try:
        result = generar_ot_para_pedido(
            pedido,
            allow_request=True,
        )
    except Exception:
        modeladmin.message_user(
            request,
            f'Pedido #{pedido.id}: no fue posible generar la OT.',
            level=messages.ERROR,
        )
        return

    if result['success']:
        modeladmin.message_user(
            request,
            (
                f'Pedido #{pedido.id}: OT Chilexpress generada '
                f'correctamente.'
            ),
            level=messages.SUCCESS,
        )
        return

    modeladmin.message_user(
        request,
        f'Pedido #{pedido.id}: Chilexpress rechazo la generacion de la OT.',
        level=messages.ERROR,
    )


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
    actions = ('generar_ot_chilexpress',)

    @admin.action(
        description='Generar OT Chilexpress para pedidos seleccionados'
    )
    def generar_ot_chilexpress(self, request, queryset):
        for pedido in queryset.select_related('usuario', 'envio'):
            _generar_ot_desde_admin(self, request, pedido)


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
    actions = ('generar_ot_chilexpress',)

    @admin.action(description='Generar OT Chilexpress')
    def generar_ot_chilexpress(self, request, queryset):
        for envio in queryset.select_related('pedido'):
            _generar_ot_desde_admin(self, request, envio.pedido)
