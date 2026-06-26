import os
from decimal import Decimal
from urllib.parse import urljoin

import requests

from django.db import transaction
from django.utils import timezone

from .models import DocumentoTributario, Pedido


def configuracion_facturacion():
    return {
        'provider': os.getenv('BILLING_PROVIDER', 'mock').strip().lower(),
        'libredte_api_url_configured': bool(
            os.getenv('LIBREDTE_API_URL', '').strip()
        ),
        'libredte_api_hash_configured': bool(
            os.getenv('LIBREDTE_API_HASH', '').strip()
        ),
        'libredte_api_key_configured': bool(
            os.getenv('LIBREDTE_API_KEY', '').strip()
        ),
        'libredte_rut_emisor_configured': bool(
            os.getenv('LIBREDTE_RUT_EMISOR', '').strip()
        ),
    }


def validar_configuracion_libredte():
    faltantes = []
    for variable in ('LIBREDTE_API_HASH', 'LIBREDTE_RUT_EMISOR'):
        if not os.getenv(variable, '').strip():
            faltantes.append(variable)
    return faltantes


def _libredte_api_url():
    base_url = os.getenv('LIBREDTE_API_URL', 'https://www.libredte.cl').strip()
    endpoint = os.getenv(
        'LIBREDTE_TEMPORAL_ENDPOINT',
        '/api/dte/documentos/temporales',
    ).strip()
    return urljoin(f'{base_url.rstrip("/")}/', endpoint.lstrip('/'))


def _libredte_timeout():
    try:
        return max(5, int(os.getenv('LIBREDTE_TIMEOUT_SECONDS', '20')))
    except ValueError:
        return 20


def _valor_decimal(valor):
    try:
        return Decimal(str(valor or 0))
    except Exception:
        return Decimal('0')


def _normalizar_items_pedido(pedido):
    items = []
    detalles = pedido.detalles if isinstance(pedido.detalles, list) else []
    for idx, detalle in enumerate(detalles, start=1):
        producto_info = detalle.get('producto_info') or {}
        nombre = (
            detalle.get('producto_nombre') or
            producto_info.get('nombre') or
            f'Producto {idx}'
        )
        cantidad = int(detalle.get('cantidad') or 1)
        precio_unitario = int(
            _valor_decimal(detalle.get('precio_unitario') or 0)
        )
        subtotal = int(
            _valor_decimal(detalle.get('subtotal') or cantidad * precio_unitario)
        )
        items.append({
            'nombre': nombre,
            'cantidad': cantidad,
            'precio_unitario': precio_unitario,
            'monto': subtotal,
        })

    if not items:
        items.append({
            'nombre': f'Pedido #{pedido.pk}',
            'cantidad': 1,
            'precio_unitario': int(pedido.total or 0),
            'monto': int(pedido.total or 0),
        })
    return items


def _payload_libredte(pedido):
    usuario = pedido.usuario
    receptor_nombre = (
        pedido.datos.get('nombre_receptor') or
        pedido.datos.get('cliente_nombre') or
        usuario.get_full_name() or
        usuario.username
    )
    receptor_email = usuario.email or 'cliente@medistock.local'
    return {
        'ambiente': os.getenv('LIBREDTE_AMBIENTE', 'test').strip() or 'test',
        'tipo_documento': DocumentoTributario.TIPO_BOLETA,
        'rut_emisor': os.getenv('LIBREDTE_RUT_EMISOR', '').strip(),
        'pedido_id': pedido.pk,
        'fecha_emision': timezone.now().date().isoformat(),
        'receptor': {
            'rut': pedido.datos.get('rut_receptor') or '66666666-6',
            'razon_social': receptor_nombre,
            'giro': 'Persona natural',
            'email': receptor_email,
        },
        'totales': {
            'monto_total': int(pedido.total or 0),
        },
        'detalles': _normalizar_items_pedido(pedido),
    }


def _resumen_respuesta(response):
    try:
        data = response.json()
    except ValueError:
        data = {'raw': response.text[:500]}
    return {
        'status_code': response.status_code,
        'response': data,
    }


def _buscar_valor(data, claves):
    if not isinstance(data, dict):
        return None
    for clave in claves:
        if data.get(clave) not in (None, ''):
            return data.get(clave)
    for valor in data.values():
        if isinstance(valor, dict):
            encontrado = _buscar_valor(valor, claves)
            if encontrado not in (None, ''):
                return encontrado
    return None


def _documento_error_libredte(pedido, provider_response):
    return DocumentoTributario.objects.create(
        pedido=pedido,
        tipo_documento=DocumentoTributario.TIPO_BOLETA,
        proveedor=DocumentoTributario.PROVEEDOR_LIBREDTE,
        folio=f'LIBREDTE-ERROR-{pedido.pk:06d}',
        estado=DocumentoTributario.ESTADO_ERROR,
        monto_total=pedido.total,
        fecha_emision=None,
        provider_response=provider_response,
    )


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


def generar_documento_libredte_para_pedido(pedido):
    if not getattr(pedido, 'pk', None):
        raise ValueError('El pedido debe estar persistido.')
    if pedido.estado != 'CONFIRMADO':
        raise ValueError('Solo se puede documentar un pedido confirmado.')

    faltantes = validar_configuracion_libredte()
    if faltantes:
        raise ValueError(f'Faltan variables: {", ".join(faltantes)}')

    with transaction.atomic():
        pedido_bloqueado = Pedido.objects.select_for_update().get(
            pk=pedido.pk
        )
        documento_existente = DocumentoTributario.objects.filter(
            pedido=pedido_bloqueado
        ).first()
        if documento_existente:
            return documento_existente, False

        payload = _payload_libredte(pedido_bloqueado)
        api_url = _libredte_api_url()
        api_hash = os.getenv('LIBREDTE_API_HASH', '').strip()
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

        try:
            response = requests.post(
                api_url,
                json=payload,
                headers=headers,
                auth=('X', api_hash),
                timeout=_libredte_timeout(),
            )
        except requests.RequestException as error:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    'provider': 'libredte',
                    'mode': os.getenv('LIBREDTE_AMBIENTE', 'test'),
                    'endpoint': os.getenv(
                        'LIBREDTE_TEMPORAL_ENDPOINT',
                        '/api/dte/documentos/temporales',
                    ),
                    'error': str(error)[:500],
                },
            )
            return documento, True

        resumen = _resumen_respuesta(response)
        if response.status_code >= 400:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    'provider': 'libredte',
                    'mode': os.getenv('LIBREDTE_AMBIENTE', 'test'),
                    'endpoint': os.getenv(
                        'LIBREDTE_TEMPORAL_ENDPOINT',
                        '/api/dte/documentos/temporales',
                    ),
                    **resumen,
                },
            )
            return documento, True

        data = resumen['response']
        folio = _buscar_valor(data, ('folio', 'id', 'codigo', 'documento_id'))
        estado = str(
            _buscar_valor(data, ('estado', 'status', 'estado_dte')) or
            'EMITIDO'
        ).upper()
        url_pdf = _buscar_valor(
            data,
            ('pdf_url', 'url_pdf', 'url', 'link_pdf'),
        ) or ''
        documento = DocumentoTributario.objects.create(
            pedido=pedido_bloqueado,
            tipo_documento=DocumentoTributario.TIPO_BOLETA,
            proveedor=DocumentoTributario.PROVEEDOR_LIBREDTE,
            folio=str(folio or f'LIBREDTE-{pedido_bloqueado.pk:06d}'),
            estado=(
                DocumentoTributario.ESTADO_EMITIDO
                if estado not in {'ERROR', 'RECHAZADO'}
                else DocumentoTributario.ESTADO_ERROR
            ),
            monto_total=pedido_bloqueado.total,
            fecha_emision=timezone.now(),
            url_pdf=str(url_pdf),
            provider_response={
                'provider': 'libredte',
                'mode': os.getenv('LIBREDTE_AMBIENTE', 'test'),
                'endpoint': os.getenv(
                    'LIBREDTE_TEMPORAL_ENDPOINT',
                    '/api/dte/documentos/temporales',
                ),
                **resumen,
            },
        )
        return documento, True
