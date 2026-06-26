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
    return _libredte_url_config('temporal')['full_url']


def _normalizar_libredte_url(base_url, endpoint):
    base = base_url.rstrip('/')
    path = endpoint.strip()
    if base.endswith('/api') and path.startswith('/api/'):
        path = path[4:]
    return urljoin(f'{base}/', path.lstrip('/'))


def _libredte_url_config(tipo='temporal'):
    if tipo == 'documento':
        url_variable = 'LIBREDTE_DOCUMENT_URL'
        endpoint_variable = 'LIBREDTE_DOCUMENT_ENDPOINT'
        endpoint_default = '/dte/documentos/generar'
    else:
        url_variable = 'LIBREDTE_TEMPORAL_URL'
        endpoint_variable = 'LIBREDTE_TEMPORAL_ENDPOINT'
        endpoint_default = '/dte/documentos/emitir'

    full_url = os.getenv(url_variable, '').strip()
    base_url = os.getenv('LIBREDTE_API_URL', 'https://libredte.cl/api').strip()
    endpoint = os.getenv(endpoint_variable, endpoint_default).strip()
    if full_url:
        return {
            'url_base': '',
            'endpoint': '',
            'full_url': full_url,
            'source': url_variable,
        }
    return {
        'url_base': base_url,
        'endpoint': endpoint,
        'full_url': _normalizar_libredte_url(base_url, endpoint),
        'source': f'LIBREDTE_API_URL+{endpoint_variable}',
    }


def _libredte_endpoint_configurado():
    return os.getenv(
        'LIBREDTE_TEMPORAL_ENDPOINT',
        '/dte/documentos/emitir',
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


def _libredte_params_documento():
    return {
        'getXML': '0',
        'links': '1',
        'email': '0',
        'retry': '0',
        'gzip': '0',
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
    message = _mensaje_seguro_respuesta(data)
    return {
        'status_code': response.status_code,
        'message': message,
        'response': data,
    }


def _mensaje_seguro_respuesta(data):
    if isinstance(data, dict):
        mensaje = (
            data.get('message') or
            data.get('mensaje') or
            data.get('error') or
            data.get('detail') or
            data.get('statusDescription') or
            data.get('raw') or
            data.get('errors')
        )
        return str(mensaje)[:500] if mensaje else 'Sin mensaje del proveedor'
    if data:
        return str(data)[:500]
    return 'Sin mensaje del proveedor'


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


def _provider_response_base(tipo='temporal'):
    url_config = _libredte_url_config(tipo)
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
        'request_stage': tipo,
        'url_base': url_config['url_base'],
        'endpoint': url_config['endpoint'],
        'full_url': url_config['full_url'],
        'url_source': url_config['source'],
        'params': (
            _libredte_params_documento()
            if tipo == 'documento'
            else _libredte_params_temporal()
        ),
    }


def _provider_response_exception(error, message, tipo='temporal'):
    return {
        **_provider_response_base(tipo),
        'status_code': None,
        'error_type': error.__class__.__name__,
        'message': message,
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
    temporal_response = args[0] if args else {}
    payload = _payload_generar_desde_temporal(temporal_response)
    if not payload:
        raise ValueError('LibreDTE no entrego codigo temporal para generar DTE.')
    headers, auth = _libredte_request_auth()
    response = requests.post(
        _libredte_url_config('documento')['full_url'],
        json=payload,
        headers=headers,
        auth=auth,
        params=_libredte_params_documento(),
        timeout=_libredte_timeout(),
    )
    return response


def _rut_sin_dv(rut):
    digitos = ''.join(caracter for caracter in str(rut) if caracter.isdigit())
    return digitos[:-1] if len(digitos) > 1 else digitos


def _payload_generar_desde_temporal(temporal_response):
    data = temporal_response if isinstance(temporal_response, dict) else {}
    codigo = _buscar_valor(data, ('codigo', 'id', 'documento_id'))
    if not codigo:
        return None
    tipo_dte = _buscar_valor(data, ('dte', 'TipoDTE', 'tipo_dte')) or 39
    emisor = (
        _buscar_valor(data, ('emisor', 'rut_emisor', 'RUTEmisor')) or
        _rut_sin_dv(os.getenv('LIBREDTE_RUT_EMISOR', '').strip())
    )
    receptor = (
        _buscar_valor(data, ('receptor', 'rut_receptor', 'RUTRecep')) or
        66666666
    )
    emisor = _rut_sin_dv(emisor) if not str(emisor).isdigit() else emisor
    receptor = (
        _rut_sin_dv(receptor)
        if not str(receptor).isdigit()
        else receptor
    )
    return {
        'codigo': codigo,
        'dte': int(tipo_dte),
        'emisor': int(emisor),
        'receptor': int(receptor),
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
            response_temporal = crear_documento_temporal_libredte(
                pedido_bloqueado
            )
        except requests.exceptions.Timeout as error:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                _provider_response_exception(
                    error,
                    'Timeout al conectar con LibreDTE',
                ),
            )
            return documento, True
        except requests.RequestException as error:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                _provider_response_exception(error, str(error)[:500]),
            )
            return documento, True

        resumen_temporal = _resumen_respuesta(response_temporal)
        if response_temporal.status_code >= 400:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    **_provider_response_base('temporal'),
                    **resumen_temporal,
                },
            )
            return documento, True

        try:
            response_documento = generar_dte_real_desde_temporal(
                resumen_temporal['response']
            )
        except requests.exceptions.Timeout as error:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    **_provider_response_exception(
                        error,
                        'Timeout al generar DTE real en LibreDTE',
                        'documento',
                    ),
                    'temporal': resumen_temporal,
                },
            )
            return documento, True
        except (ValueError, requests.RequestException) as error:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    **_provider_response_exception(
                        error,
                        str(error)[:500],
                        'documento',
                    ),
                    'temporal': resumen_temporal,
                },
            )
            return documento, True

        resumen_documento = _resumen_respuesta(response_documento)
        if response_documento.status_code >= 400:
            documento = _documento_error_libredte(
                pedido_bloqueado,
                {
                    **_provider_response_base('documento'),
                    **resumen_documento,
                    'temporal': resumen_temporal,
                },
            )
            return documento, True

        data = resumen_documento['response']
        folio = _buscar_valor(
            data,
            ('folio', 'Folio', 'id', 'documento_id', 'codigo'),
        )
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
                **_provider_response_base('documento'),
                **resumen_documento,
                'temporal': resumen_temporal,
            },
        )
        return documento, True
