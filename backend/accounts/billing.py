import os

from django.db import transaction
from django.utils import timezone

from .models import DocumentoTributario, Pedido


def configuracion_facturacion():
    return {
        'provider': os.getenv('BILLING_PROVIDER', 'mock').strip().lower(),
        'libredte_api_url_configured': bool(
            os.getenv('LIBREDTE_API_URL', '').strip()
        ),
        'libredte_api_token_configured': bool(
            os.getenv('LIBREDTE_API_TOKEN', '').strip()
        ),
    }


def generar_documento_mock_para_pedido(pedido):
    if not getattr(pedido, 'pk', None):
        raise ValueError('El pedido debe estar persistido.')
    if pedido.estado != 'CONFIRMADO':
        raise ValueError('Solo se puede documentar un pedido confirmado.')

    tipo_documento = str(
        pedido.datos.get('tipo_documento', DocumentoTributario.TIPO_BOLETA)
    ).upper()
    if tipo_documento not in {
        DocumentoTributario.TIPO_BOLETA,
        DocumentoTributario.TIPO_FACTURA,
    }:
        tipo_documento = DocumentoTributario.TIPO_BOLETA

    with transaction.atomic():
        pedido_bloqueado = Pedido.objects.select_for_update().get(
            pk=pedido.pk
        )
        documento_existente = DocumentoTributario.objects.filter(
            pedido=pedido_bloqueado
        ).first()
        if documento_existente:
            return documento_existente, False

        prefijo = 'BOL' if tipo_documento == 'BOLETA' else 'FAC'
        documento = DocumentoTributario.objects.create(
            pedido=pedido_bloqueado,
            tipo_documento=tipo_documento,
            proveedor=DocumentoTributario.PROVEEDOR_MOCK,
            folio=f'{prefijo}-MOCK-{pedido_bloqueado.pk:06d}',
            estado=DocumentoTributario.ESTADO_EMITIDO,
            monto_total=pedido_bloqueado.total,
            fecha_emision=timezone.now(),
            provider_response={
                'mode': 'mock',
                'message': 'Documento tributario local de demostracion.',
            },
        )
        return documento, True
