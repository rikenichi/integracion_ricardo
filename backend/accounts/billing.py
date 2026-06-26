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
        'libredte_auth_mode': _libredte_auth_mode(),
        'libredte_rut_emisor_configured': bool(
            os.getenv('LIBREDTE_RUT_EMISOR', '').strip()
        ),
    }


def validar_configuracion_libredte():
    faltantes = []
    variables_requeridas = ['LIBREDTE_RUT_EMISOR']
    auth_mode = _libredte_auth_mode()
    if auth_mode == 'basic_hash':
        variables_requeridas.append('LIBREDTE_API_HASH')
    elif auth_mode in {'basic_key', 'apikey'}:
        variables_requeridas.append('LIBREDTE_API_KEY')
    else:
        variables_requeridas.extend((
            'LIBREDTE_API_HASH',
            'LIBREDTE_API_KEY',
        ))

    for variable in variables_requeridas:
        if not os.getenv(variable, '').strip():
            faltantes.append(variable)
    return faltantes


def _libredte_auth_mode():
    auth_mode = os.getenv('LIBREDTE_AUTH_MODE', 'basic_key').strip().lower()
    compatibilidad = {
        'basic': 'basic_hash',
        'both': 'basic_both',
    }
    auth_mode = compatibilidad.get(auth_mode, auth_mode)
    if auth_mode not in {
        'basic_hash',
        'basic_key',
        'basic_both',
        'apikey',
    }:
        return 'basic_key'
    return auth_mode


def _libredte_api_key_header_name():
    return os.getenv('LIBREDTE_API_KEY_HEADER', 'X-API-Key').strip() or 'X-API-Key'


def _libredte_api_url():
    return _libredte_url_config()['full_url']


def _libredte_url_config():
    temporal_url = os.getenv('LIBREDTE_TEMPORAL_URL', '').strip()
    base_url = os.getenv('LIBREDTE_API_URL', 'https://www.libredte.cl').strip()
    endpoint = _libredte_endpoint_configurado()
    if temporal_url:
        return {
            'url_base': '',
            'endpoint': '',
            'full_url': temporal_url,
            'source': 'LIBREDTE_TEMPORAL_URL',
        }
    return {
        'url_base': base_url,
        'endpoint': endpoint,
        'full_url': urljoin(f'{base_url.rstrip("/")}/', endpoint.lstrip('/')),
        'source': 'LIBREDTE_API_URL+LIBREDTE_TEMPORAL_ENDPOINT',
    }


def _libredte_endpoint_configurado():
    return os.getenv(
        'LIBREDTE_TEMPORAL_ENDPOINT',
        '/api/dte/documentos/emitir',
    ).strip()


def _libredte_params_temporal():
    ambiente = os.getenv('LIBREDTE_AMBIENTE', 'test').strip().lower()
    return {
        'normalizar': '1',
        'formato': 'json',
        'links': '1',
        'email': '0',
        '_contribuyente_rut': os.getenv('LIBREDTE_RUT_EMISOR', '').strip(),
        '_contribuyente_certificacion': '1' if ambiente == 'test' else '0',
    }


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
            'IndExe': 0,
            'NmbItem': str(nombre)[:80],
            'QtyItem': cantidad,
            'PrcItem': precio_unitario or subtotal,
        })

    if not items:
        items.append({
            'IndExe': 0,
            'NmbItem': f'Pedido #{pedido.pk}',
            'QtyItem': 1,
            'PrcItem': int(pedido.total or 0),
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
    direccion = (
        pedido.datos.get('direccion_entrega') or
        pedido.datos.get('direccion') or
        'Sin direccion'
    )
    comuna = (
        pedido.datos.get('comuna_nombre') or
        pedido.datos.get('comuna') or
        'Santiago'
    )
    return {
        'Encabezado': {
            'IdDoc': {
                'TipoDTE': 39,
            },
            'Emisor': {
                'RUTEmisor': os.getenv('LIBREDTE_RUT_EMISOR', '').strip(),
            },
            'Receptor': {
                'RUTRecep': pedido.datos.get('rut_receptor') or '66666666-6',
                'RznSocRecep': str(receptor_nombre)[:100],
                'GiroRecep': 'Persona natural',
                'DirRecep': str(direccion)[:70],
                'CmnaRecep': str(comuna)[:20],
            },
        },
        'Detalle': _normalizar_items_pedido(pedido),
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


def _provider_response_base():
    url_config = _libredte_url_config()
    auth_mode = _libredte_auth_mode()
    api_key_header = (
        _libredte_api_key_header_name()
        if auth_mode == 'apikey'
        else ''
    )
    return {
        'provider': 'libredte',
        'mode': os.getenv('LIBREDTE_AMBIENTE', 'test'),
        'auth_mode': auth_mode,
        'api_key_header_name': api_key_header,
        'url_base': url_config['url_base'],
        'endpoint': url_config['endpoint'],
        'full_url': url_config['full_url'],
        'url_source': url_config['source'],
        'params': _libredte_params_temporal(),
    }


def _libredte_request_auth():
    auth_mode = _libredte_auth_mode()
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    auth = None

    if auth_mode in {'basic_hash', 'basic_both'}:
        auth = ('X', os.getenv('LIBREDTE_API_HASH', '').strip())

    if auth_mode == 'basic_key':
        headers['Authorization'] = (
            f'Basic {os.getenv("LIBREDTE_API_KEY", "").strip()}'
        )

    if auth_mode == 'apikey':
        headers[_libredte_api_key_header_name()] = os.getenv(
            'LIBREDTE_API_KEY',
            '',
        ).strip()

    if auth_mode == 'basic_both':
        headers['Authorization'] = (
            f'Basic {os.getenv("LIBREDTE_API_KEY", "").strip()}'
        )

    return headers, auth


def crear_documento_temporal_libredte(pedido):
    payload = _payload_libredte(pedido)
    headers, auth = _libredte_request_auth()
    response = requests.post(
        _libredte_api_url(),
        json=payload,
        headers=headers,
        auth=auth,
        params=_libredte_params_temporal(),
        timeout=_libredte_timeout(),
    )
    return response


def generar_dte_real_desde_temporal(*args, **kwargs):
    raise NotImplementedError(
        'La generacion real del DTE desde temporal no esta activada.'
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

        try:
            response = crear_documento_temporal_libredte(pedido_bloqueado)
        except requests.RequestException as error:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    **_provider_response_base(),
                    'error': str(error)[:500],
                },
            )
            return documento, True

        resumen = _resumen_respuesta(response)
        if response.status_code >= 400:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    **_provider_response_base(),
                    **resumen,
                },
            )
            return documento, True

        data = resumen['response']
        codigo_temporal = _buscar_valor(
            data,
            ('codigo', 'id', 'documento_id', 'folio'),
        )
        estado = str(
            _buscar_valor(data, ('estado', 'status', 'estado_dte')) or
            'PENDIENTE'
        ).upper()
        url_pdf = _buscar_valor(
            data,
            ('pdf_url', 'url_pdf', 'url', 'link_pdf'),
        ) or ''
        documento = DocumentoTributario.objects.create(
            pedido=pedido_bloqueado,
            tipo_documento=DocumentoTributario.TIPO_BOLETA,
            proveedor=DocumentoTributario.PROVEEDOR_LIBREDTE,
            folio=str(codigo_temporal or f'LIBREDTE-TMP-{pedido_bloqueado.pk:06d}'),
            estado=(
                DocumentoTributario.ESTADO_PENDIENTE
                if estado not in {'ERROR', 'RECHAZADO'}
                else DocumentoTributario.ESTADO_ERROR
            ),
            monto_total=pedido_bloqueado.total,
            fecha_emision=timezone.now(),
            url_pdf=str(url_pdf),
            provider_response={
                **_provider_response_base(),
                **resumen,
            },
        )
        return documento, True
