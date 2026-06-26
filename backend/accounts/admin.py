from django.contrib import admin
from django.contrib import messages

from logistics.services.shipping_service import generar_ot_para_pedido
from .billing import (
    generar_documento_libredte_para_pedido,
    generar_documento_mock_para_pedido,
    validar_configuracion_libredte,
)
from .models import DocumentoTributario, EnvioPedido, Pedido


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
        (
            f'Pedido #{pedido.id}: '
            f"{result.get('status_description') or 'Chilexpress rechazo la OT.'}"
        ),
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
    actions = (
        'generar_ot_chilexpress',
        'generar_dte_mock',
        'generar_dte_libredte',
    )

    @admin.action(
        description='Generar OT Chilexpress para pedidos seleccionados'
    )
    def generar_ot_chilexpress(self, request, queryset):
        for pedido in queryset.select_related('usuario', 'envio'):
            _generar_ot_desde_admin(self, request, pedido)

    @admin.action(
        description='Generar DTE mock para pedidos seleccionados'
    )
    def generar_dte_mock(self, request, queryset):
        for pedido in queryset:
            if pedido.estado != 'CONFIRMADO':
                self.message_user(
                    request,
                    (
                        f'Pedido #{pedido.id}: omitido porque '
                        'no esta CONFIRMADO.'
                    ),
                    level=messages.WARNING,
                )
                continue

            try:
                documento, creado = (
                    generar_documento_mock_para_pedido(pedido)
                )
            except Exception:
                self.message_user(
                    request,
                    (
                        f'Pedido #{pedido.id}: no fue posible '
                        'generar el DTE mock.'
                    ),
                    level=messages.ERROR,
                )
                continue

            if creado:
                self.message_user(
                    request,
                    (
                        f'Pedido #{pedido.id}: DTE mock '
                        f'{documento.folio} generado correctamente.'
                    ),
                    level=messages.SUCCESS,
                )
            else:
                self.message_user(
                    request,
                    f'Pedido #{pedido.id}: ya tiene un DTE.',
                    level=messages.WARNING,
                )

    @admin.action(
        description='Generar DTE LibreDTE para pedidos seleccionados'
    )
    def generar_dte_libredte(self, request, queryset):
        faltantes = validar_configuracion_libredte()
        if faltantes:
            self.message_user(
                request,
                f'No se puede usar LibreDTE. Faltan variables: {", ".join(faltantes)}',
                level=messages.ERROR,
            )
            return

        for pedido in queryset:
            if pedido.estado != 'CONFIRMADO':
                self.message_user(
                    request,
                    (
                        f'Pedido #{pedido.id}: omitido porque '
                        'no esta CONFIRMADO.'
                    ),
                    level=messages.WARNING,
                )
                continue

            try:
                documento, creado = (
                    generar_documento_libredte_para_pedido(pedido)
                )
            except Exception as error:
                self.message_user(
                    request,
                    (
                        f'Pedido #{pedido.id}: no fue posible generar '
                        f'el DTE LibreDTE. {str(error)[:180]}'
                    ),
                    level=messages.ERROR,
                )
                continue

            if not creado:
                self.message_user(
                    request,
                    f'Pedido #{pedido.id}: ya tiene un DTE.',
                    level=messages.WARNING,
                )
                continue

            if documento.estado == DocumentoTributario.ESTADO_EMITIDO:
                self.message_user(
                    request,
                    (
                        f'Pedido #{pedido.id}: DTE LibreDTE '
                        f'{documento.folio} generado correctamente.'
                    ),
                    level=messages.SUCCESS,
                )
            else:
                self.message_user(
                    request,
                    (
                        f'Pedido #{pedido.id}: LibreDTE respondio con error. '
                        'Revisa el DocumentoTributario generado.'
                    ),
                    level=messages.ERROR,
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
    actions = ('generar_ot_chilexpress',)

    @admin.action(description='Generar OT Chilexpress')
    def generar_ot_chilexpress(self, request, queryset):
        for envio in queryset.select_related('pedido'):
            _generar_ot_desde_admin(self, request, envio.pedido)


@admin.register(DocumentoTributario)
class DocumentoTributarioAdmin(admin.ModelAdmin):
    list_display = (
        'pedido',
        'tipo_documento',
        'proveedor',
        'folio',
        'estado',
        'monto_total',
        'fecha_emision',
    )
    list_filter = (
        'tipo_documento',
        'proveedor',
        'estado',
    )
    search_fields = (
        'folio',
        '=pedido__id',
        'pedido__usuario__username',
        'pedido__usuario__email',
    )
    readonly_fields = (
        'pedido',
        'tipo_documento',
        'proveedor',
        'folio',
        'estado',
        'monto_total',
        'fecha_emision',
        'url_pdf',
        'error_proveedor',
        'creado_en',
        'actualizado_en',
    )
    exclude = ('provider_response',)

    @admin.display(description='Error proveedor')
    def error_proveedor(self, obj):
        response = obj.provider_response or {}
        endpoint = response.get('endpoint') or 'No disponible'
        status_code = response.get('status_code') or 'No disponible'
        body = response.get('response') or {}

        mensaje = 'No disponible'
        if isinstance(body, dict):
            mensaje = (
                body.get('message') or
                body.get('mensaje') or
                body.get('error') or
                body.get('detail') or
                body.get('statusDescription') or
                body.get('raw') or
                body.get('errors') or
                'No disponible'
            )
        elif body:
            mensaje = str(body)
        elif response.get('error'):
            mensaje = response.get('error')

        return (
            f'HTTP: {status_code} | '
            f'Endpoint: {endpoint} | '
            f'Mensaje: {str(mensaje)[:500]}'
        )
