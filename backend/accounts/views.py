import os
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponseRedirect
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from transbank.common.integration_api_keys import IntegrationApiKeys
from transbank.common.integration_commerce_codes import IntegrationCommerceCodes
from transbank.common.integration_type import IntegrationType
from transbank.common.options import WebpayOptions
from transbank.webpay.webpay_plus.transaction import Transaction

from inventory.models import Producto
from .billing import generar_documento_mock_para_pedido
from .models import (
    ConvenioB2B,
    DireccionEntrega,
    DocumentoTributario,
    EnvioPedido,
    Pedido,
    PerfilCliente,
    PerfilTrabajador,
)


User = get_user_model()


def descuento_b2b_para_usuario(user):
    """Retorna el porcentaje de descuento activo del ConvenioB2B del usuario.
    Requiere: PerfilCliente con tipo_cliente INSTITUCIONAL, convenio activo
    y dentro del rango de fechas si se definieron. Devuelve 0 en otro caso."""
    from datetime import date
    perfil = getattr(user, 'perfil_cliente', None)
    if not perfil or perfil.tipo_cliente != 'INSTITUCIONAL':
        return 0
    convenio = getattr(perfil, 'convenio_b2b', None)
    if not convenio or not convenio.activo:
        return 0
    hoy = date.today()
    if convenio.fecha_inicio and hoy < convenio.fecha_inicio:
        return 0
    if convenio.fecha_fin and hoy > convenio.fecha_fin:
        return 0
    return convenio.porcentaje_descuento


def webpay_transaction():
    environment = os.getenv('WEBPAY_ENV', '').upper()

    if environment != 'TEST':
        raise ValueError('WEBPAY_ENV debe ser TEST.')

    return Transaction(
        WebpayOptions(
            IntegrationCommerceCodes.WEBPAY_PLUS,
            IntegrationApiKeys.WEBPAY,
            IntegrationType.TEST,
        )
    )


def buscar_pedido_por_token(token):
    return Pedido.objects.filter(pago__token_ws=token).first()


def redirigir_resultado_webpay(**params):
    frontend_url = os.getenv('FRONTEND_WEBPAY_RESULT_URL', '')
    if not frontend_url:
        return Response(
            {'detail': 'Falta FRONTEND_WEBPAY_RESULT_URL.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    separator = '&' if '?' in frontend_url else '?'
    return HttpResponseRedirect(f'{frontend_url}{separator}{urlencode(params)}')


def representar_direccion(direccion):
    if not direccion:
        return None

    return {
        'id': direccion.id,
        'direccion': direccion.direccion,
        'num_direccion': direccion.num_direccion,
        'detalle_direccion': direccion.detalle_direccion,
        'comuna': direccion.comuna,
        'comuna_id': direccion.comuna,
        'referencia': direccion.referencia,
        'nombre_receptor': direccion.nombre_receptor,
        'telefono_receptor': direccion.telefono_receptor,
        'es_principal': direccion.es_principal,
    }


def perfil_usuario(usuario):
    es_administrador = usuario.is_staff or usuario.is_superuser
    perfil = getattr(usuario, 'perfil_cliente', None)
    direccion_principal = (
        usuario.direcciones_entrega.filter(es_principal=True).first()
        or usuario.direcciones_entrega.first()
    )
    return {
        'rol': 'ADMINISTRADOR' if es_administrador else 'CLIENTE',
        'datos': {
            'usuario': {
                'id': usuario.id,
                'username': usuario.username,
                'email': usuario.email,
                'first_name': usuario.first_name,
                'last_name': usuario.last_name,
                'is_staff': es_administrador,
                'grupos': list(usuario.groups.values_list('name', flat=True)),
            },
            'rut': perfil.rut if perfil else '',
            'telefono': perfil.telefono if perfil else '',
            'tipo_cliente': perfil.tipo_cliente if perfil else 'PARTICULAR',
            'datos_institucion': perfil.datos_institucion if perfil else None,
            'direccion_principal': representar_direccion(direccion_principal),
        },
    }


def representar_trabajador(usuario):
    perfil = getattr(usuario, 'perfil_trabajador', None)
    grupos = list(usuario.groups.values_list('name', flat=True))
    cargo = (perfil.cargo if perfil and perfil.cargo else None) or (grupos[0] if grupos else '')
    return {
        'id': usuario.id,
        'usuario': {
            'id': usuario.id,
            'username': usuario.username,
            'email': usuario.email,
            'first_name': usuario.first_name,
            'last_name': usuario.last_name,
            'is_staff': usuario.is_staff,
            'grupos': grupos,
        },
        'rut': perfil.rut if perfil else '',
        'telefono': perfil.telefono if perfil else '',
        'cargo': cargo,
        'area': perfil.area if perfil else '',
        'activo': perfil.activo if perfil is not None else usuario.is_active,
    }


class RegistroClienteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        datos_usuario = request.data.get('usuario')
        if not isinstance(datos_usuario, dict):
            return Response(
                {'usuario': ['Los datos del usuario son requeridos.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = str(datos_usuario.get('username', '')).strip()
        email = str(datos_usuario.get('email', '')).strip()
        password = datos_usuario.get('password', '')
        password2 = datos_usuario.get('password2', '')

        errores_usuario = {}
        errores = {}
        if not username:
            errores_usuario['username'] = ['Este campo es requerido.']
        if not email:
            errores_usuario['email'] = ['Este campo es requerido.']
        if password != password2:
            errores_usuario['password2'] = ['Las contraseñas no coinciden.']
        if User.objects.filter(username__iexact=username).exists():
            errores_usuario['username'] = ['Ya existe un usuario con este nombre.']
        if User.objects.filter(email__iexact=email).exists():
            errores_usuario['email'] = ['Ya existe una cuenta con este correo.']

        try:
            validate_password(password)
        except ValidationError as exc:
            errores_usuario['password'] = list(exc.messages)

        direccion_data = request.data.get('direccion_entrega')
        if not isinstance(direccion_data, dict):
            errores['direccion_entrega'] = {
                'direccion': ['La dirección de entrega es requerida.']
            }
        elif not str(direccion_data.get('direccion', '')).strip():
            errores['direccion_entrega'] = {
                'direccion': ['La dirección es requerida.']
            }
        elif not direccion_data.get('comuna'):
            errores['direccion_entrega'] = {
                'comuna': ['La comuna es requerida.']
            }

        if errores_usuario:
            errores['usuario'] = errores_usuario
        if errores:
            return Response(
                errores,
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            usuario = User.objects.create_user(
                username=username,
                email=email,
                first_name=str(datos_usuario.get('first_name', '')).strip(),
                last_name=str(datos_usuario.get('last_name', '')).strip(),
                password=password,
            )
            PerfilCliente.objects.create(
                usuario=usuario,
                rut=str(request.data.get('rut') or '').strip(),
                telefono=str(request.data.get('telefono') or '').strip(),
                tipo_cliente=str(
                    request.data.get('tipo_cliente') or 'PARTICULAR'
                ).strip().upper(),
                datos_institucion=request.data.get('datos_institucion'),
            )
            DireccionEntrega.objects.create(
                usuario=usuario,
                direccion=str(direccion_data.get('direccion', '')).strip(),
                num_direccion=str(
                    direccion_data.get('num_direccion', '')
                ).strip(),
                detalle_direccion=str(
                    direccion_data.get('detalle_direccion', '')
                ).strip(),
                comuna=str(direccion_data.get('comuna', '')).strip(),
                referencia=str(direccion_data.get('referencia', '')).strip(),
                nombre_receptor=str(
                    direccion_data.get('nombre_receptor', '')
                ).strip(),
                telefono_receptor=str(
                    direccion_data.get('telefono_receptor', '')
                ).strip(),
                es_principal=True,
            )

        return Response(
            perfil_usuario(usuario),
            status=status.HTTP_201_CREATED,
        )


class PerfilView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(perfil_usuario(request.user))

    def patch(self, request):
        usuario = request.user
        email = request.data.get('email')

        if email is not None:
            email = str(email).strip()
            if not email:
                return Response(
                    {'email': ['Este campo no puede quedar vacío.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(email__iexact=email).exclude(
                id=usuario.id
            ).exists():
                return Response(
                    {'email': ['Ya existe una cuenta con este correo.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            usuario.email = email

        for campo in ('first_name', 'last_name'):
            if campo in request.data:
                setattr(usuario, campo, str(request.data.get(campo, '')).strip())
        usuario.save(update_fields=['email', 'first_name', 'last_name'])

        perfil, _ = PerfilCliente.objects.get_or_create(usuario=usuario)
        for campo in ('rut', 'telefono', 'tipo_cliente'):
            if campo in request.data:
                valor = str(request.data.get(campo) or '').strip()
                if campo == 'tipo_cliente':
                    valor = valor.upper()
                setattr(perfil, campo, valor)
        if 'datos_institucion' in request.data:
            perfil.datos_institucion = request.data.get('datos_institucion')
        perfil.save()

        direccion_data = request.data.get('direccion_principal')
        if isinstance(direccion_data, dict):
            direccion = (
                usuario.direcciones_entrega.filter(es_principal=True).first()
                or usuario.direcciones_entrega.first()
                or DireccionEntrega(usuario=usuario)
            )
            for campo in (
                'direccion',
                'num_direccion',
                'detalle_direccion',
                'comuna',
                'referencia',
                'nombre_receptor',
                'telefono_receptor',
            ):
                if campo in direccion_data:
                    setattr(
                        direccion,
                        campo,
                        str(direccion_data.get(campo) or '').strip(),
                    )
            direccion.es_principal = True
            direccion.save()
            usuario.direcciones_entrega.exclude(id=direccion.id).update(
                es_principal=False
            )

        return Response(perfil_usuario(usuario))


class TrabajadorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'detail': 'No tienes permiso para listar trabajadores.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        trabajadores = (
            User.objects
            .filter(
                Q(is_staff=True)
                | Q(is_superuser=True)
                | Q(groups__isnull=False)
                | Q(perfil_trabajador__isnull=False)
            )
            .select_related('perfil_trabajador')
            .prefetch_related('groups')
            .distinct()
            .order_by('id')
        )
        return Response([
            representar_trabajador(usuario)
            for usuario in trabajadores
        ])


class DireccionEntregaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        direcciones = request.user.direcciones_entrega.order_by(
            '-es_principal',
            '-creado_en',
        )
        return Response([
            representar_direccion(direccion)
            for direccion in direcciones
        ])

    def post(self, request):
        direccion = str(request.data.get('direccion', '')).strip()
        comuna = request.data.get('comuna')

        if not direccion or not comuna:
            return Response(
                {'detail': 'Direccion y comuna son requeridas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        es_principal = bool(request.data.get('es_principal', False))
        if es_principal:
            request.user.direcciones_entrega.update(es_principal=False)

        objeto = DireccionEntrega.objects.create(
            usuario=request.user,
            direccion=direccion,
            num_direccion=str(request.data.get('num_direccion', '')).strip(),
            detalle_direccion=str(
                request.data.get('detalle_direccion', '')
            ).strip(),
            comuna=str(comuna).strip(),
            referencia=str(request.data.get('referencia', '')).strip(),
            nombre_receptor=str(
                request.data.get('nombre_receptor', '')
            ).strip(),
            telefono_receptor=str(
                request.data.get('telefono_receptor', '')
            ).strip(),
            es_principal=es_principal,
        )

        return Response(
            representar_direccion(objeto),
            status=status.HTTP_201_CREATED,
        )


class PedidoCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def representar(pedido):
        etiquetas_estado = {
            'PENDIENTE_PAGO': 'Pendiente de pago',
            'CONFIRMADO': 'Pagado / Confirmado',
            'RECHAZADO': 'Pago rechazado',
            'ANULADO': 'Pago anulado',
        }
        try:
            envio_pedido = pedido.envio
        except EnvioPedido.DoesNotExist:
            envio_pedido = None

        envio = None
        if envio_pedido:
            envio = {
                'numero_tracking': envio_pedido.numero_tracking,
                'courier': envio_pedido.courier,
                'estado': envio_pedido.estado,
                'transport_order_number': (
                    envio_pedido.transport_order_number
                ),
                'certificate_number': envio_pedido.certificate_number,
                'chilexpress_reference': (
                    envio_pedido.chilexpress_reference
                ),
                'ot_status': envio_pedido.ot_status,
                'ot_created_at': envio_pedido.ot_created_at,
            }

        try:
            documento = pedido.documento_tributario
        except DocumentoTributario.DoesNotExist:
            documento = None

        dte_info = None
        if documento:
            dte_info = {
                'id': documento.id,
                'pedido': pedido.id,
                'tipo_documento': documento.tipo_documento,
                'tipo_documento_nombre': (
                    documento.get_tipo_documento_display()
                ),
                'proveedor': documento.proveedor,
                'folio': documento.folio,
                'estado': documento.estado,
                'estado_dte': documento.get_estado_display(),
                'monto_total': documento.monto_total,
                'fecha_emision': documento.fecha_emision,
                'url_pdf': documento.url_pdf or None,
            }

        return {
            'id': pedido.id,
            'usuario_id': pedido.usuario_id,
            'usuario': pedido.usuario_id,
            'usuario_username': pedido.usuario.username,
            'usuario_email': pedido.usuario.email,
            'usuario_nombre': (
                pedido.usuario.get_full_name() or pedido.usuario.username
            ),
            'usuario_rol': (
                'ADMINISTRADOR'
                if pedido.usuario.is_staff or pedido.usuario.is_superuser
                else 'CLIENTE'
            ),
            'estado': pedido.estado,
            'estado_display': etiquetas_estado.get(
                pedido.estado,
                pedido.estado.replace('_', ' ').title(),
            ),
            'subtotal': pedido.subtotal,
            'descuento': pedido.datos.get('descuento_pct', 0),
            'total': pedido.total,
            'monto_total': pedido.total,
            'detalles': pedido.detalles,
            'items': pedido.detalles,
            'pago': pedido.pago,
            'despacho': pedido.despacho,
            'envio': envio,
            'dte_info': dte_info,
            'costo_envio': pedido.despacho.get('costo_envio', 0),
            'sucursal_origen_id': pedido.datos.get('sucursal_origen_id'),
            'direccion_entrega_id': pedido.datos.get('direccion_entrega_id'),
            'tipo_venta': pedido.datos.get('tipo_venta'),
            'tipo_despacho': pedido.datos.get('tipo_despacho'),
            'prioridad_medica': pedido.datos.get('prioridad_medica'),
            'fecha_requerida_entrega': pedido.datos.get('fecha_requerida_entrega'),
            'observacion': pedido.datos.get('observacion', ''),
            'receta_requerida': pedido.datos.get('receta_requerida', False),
            'receta_confirmada': pedido.datos.get('receta_confirmada', False),
            'receta_observacion': pedido.datos.get('receta_observacion', ''),
            'productos_con_receta': pedido.datos.get('productos_con_receta', []),
            'creado_en': pedido.creado_en,
            'actualizado_en': pedido.actualizado_en,
        }

    def post(self, request):
        detalles = request.data.get('detalles')

        if not isinstance(detalles, list) or not detalles:
            return Response(
                {'detail': 'El pedido debe incluir al menos un producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        detalles_respuesta = []
        productos_con_receta = []
        total = 0

        for detalle in detalles:
            producto_id = detalle.get('producto_id')

            try:
                cantidad = int(detalle.get('cantidad', 0))
            except (TypeError, ValueError):
                cantidad = 0

            if not producto_id or cantidad <= 0:
                return Response(
                    {'detail': 'Cada detalle debe tener producto_id y cantidad valida.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                producto = Producto.objects.get(id=producto_id, activo=True)
            except Producto.DoesNotExist:
                return Response(
                    {'detail': f'Producto {producto_id} no encontrado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            pct_descuento = descuento_b2b_para_usuario(request.user)
            precio_unitario = round(producto.precio_b2c * (1 - pct_descuento / 100))
            subtotal = precio_unitario * cantidad
            total += subtotal
            detalles_respuesta.append(
                {
                    'producto_id': producto.id,
                    'producto_codigo': producto.codigo,
                    'producto_nombre': producto.nombre,
                    'nombre': producto.nombre,
                    'cantidad': cantidad,
                    'precio_b2c': producto.precio_b2c,
                    'precio_unitario': precio_unitario,
                    'descuento_pct': pct_descuento,
                    'subtotal': subtotal,
                }
            )
            if producto.requiere_receta:
                productos_con_receta.append(
                    {
                        'producto_id': producto.id,
                        'codigo': producto.codigo,
                        'nombre': producto.nombre,
                    }
                )

        receta_confirmada = request.data.get('receta_confirmada') is True
        receta_observacion = str(
            request.data.get('receta_observacion', '')
        ).strip()

        if productos_con_receta and not receta_confirmada:
            return Response(
                {
                    'detail': (
                        'Debes confirmar que cuentas con receta médica '
                        'para los productos que la requieren.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        pedido = Pedido.objects.create(
            usuario=request.user,
            subtotal=total,
            total=total,
            detalles=detalles_respuesta,
            pago={'estado': 'NO_INICIADO', 'modo': 'SIMULADO'},
            despacho={
                'estado': 'COTIZADO',
                'sucursal_origen_id': request.data.get('sucursal_origen_id'),
            },
            datos={
                'sucursal_origen_id': request.data.get('sucursal_origen_id'),
                'direccion_entrega_id': request.data.get('direccion_entrega_id'),
                'tipo_venta': request.data.get('tipo_venta', 'WEBPAY'),
                'tipo_despacho': request.data.get('tipo_despacho', 'NORMAL'),
                'prioridad_medica': request.data.get('prioridad_medica', 'NORMAL'),
                'fecha_requerida_entrega': request.data.get('fecha_requerida_entrega'),
                'observacion': request.data.get('observacion', ''),
                'receta_requerida': bool(productos_con_receta),
                'receta_confirmada': receta_confirmada,
                'receta_observacion': receta_observacion,
                'productos_con_receta': productos_con_receta,
                'descuento_pct': pct_descuento,
            },
        )

        return Response(self.representar(pedido), status=status.HTTP_201_CREATED)


class PedidoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pedido_id):
        pedidos = Pedido.objects.all()
        if not request.user.is_superuser:
            pedidos = pedidos.filter(usuario=request.user)

        try:
            pedido = pedidos.get(id=pedido_id)
        except Pedido.DoesNotExist:
            return Response(
                {'detail': 'Pedido no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(PedidoCreateView.representar(pedido))


class MisPedidosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pedidos = Pedido.objects.select_related('usuario').order_by('-creado_en')
        if not request.user.is_superuser:
            pedidos = pedidos.filter(usuario=request.user)

        return Response([
            PedidoCreateView.representar(pedido)
            for pedido in pedidos
        ])


class PedidosTodosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'detail': 'No tienes permiso para listar todos los pedidos.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        pedidos = (
            Pedido.objects
            .select_related('usuario', 'envio', 'documento_tributario')
            .order_by('-creado_en')
        )
        return Response([
            PedidoCreateView.representar(pedido)
            for pedido in pedidos
        ])


class MisPagosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pedidos = Pedido.objects.exclude(pago={}).order_by('-actualizado_en')
        if not request.user.is_superuser:
            pedidos = pedidos.filter(usuario=request.user)

        pagos = []
        for pedido in pedidos:
            pago = pedido.pago or {}
            respuesta = pago.get('respuesta') or {}
            estado = pago.get('estado', 'NO_INICIADO')
            if estado == 'NO_INICIADO':
                continue

            metodo = (
                'Webpay Plus'
                if pago.get('modo') == 'WEBPAY_PLUS_TEST'
                else pago.get('modo', 'No iniciado')
            )

            pagos.append({
                'id': pedido.id,
                'pedido': pedido.id,
                'pedido_id': pedido.id,
                'metodo': pago.get('modo', ''),
                'metodo_display': metodo,
                'estado': estado,
                'estado_display': estado.replace('_', ' ').title(),
                'monto': respuesta.get('amount', pedido.total),
                'monto_confirmado': respuesta.get('amount'),
                'codigo_autorizacion': respuesta.get('authorization_code', ''),
                'response_code': respuesta.get('response_code'),
                'fecha_creacion': pedido.creado_en,
                'fecha_confirmacion': (
                    pedido.actualizado_en
                    if estado == 'CONFIRMADO'
                    else None
                ),
                'procesado_en': pedido.actualizado_en,
            })

        return Response(pagos)


class WebpayIniciarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pedido_id = request.data.get('pedido_id')

        try:
            pedido = Pedido.objects.get(id=pedido_id, usuario=request.user)
        except Pedido.DoesNotExist:
            return Response(
                {'detail': 'Pedido no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if pedido.estado == 'CONFIRMADO':
            return Response(
                {'detail': 'El pedido ya fue pagado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return_url = os.getenv('WEBPAY_RETURN_URL', '')
        if not return_url:
            return Response(
                {'detail': 'Falta WEBPAY_RETURN_URL.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            response = webpay_transaction().create(
                buy_order=f'pedido-{pedido.id}',
                session_id=f'usuario-{request.user.id}',
                amount=pedido.total,
                return_url=return_url,
            )
        except Exception as exc:
            return Response(
                {'detail': f'No se pudo iniciar Webpay: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        token = response.get('token')
        url = response.get('url')
        if not token or not url:
            return Response(
                {'detail': 'Respuesta incompleta de Transbank.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        pedido.pago = {
            'estado': 'INICIADO',
            'modo': 'WEBPAY_PLUS_TEST',
            'token_ws': token,
            'buy_order': f'pedido-{pedido.id}',
        }
        pedido.save(update_fields=['pago', 'actualizado_en'])

        return Response({'url': url, 'token': token}, status=status.HTTP_201_CREATED)


class WebpayCommitView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return self.confirmar(request)

    def post(self, request):
        return self.confirmar(request)

    def confirmar(self, request):
        token = (
            request.data.get('token_ws')
            or request.query_params.get('token_ws')
            or request.data.get('TBK_TOKEN')
            or request.query_params.get('TBK_TOKEN')
        )

        if not token:
            return redirigir_resultado_webpay(
                estado='RECHAZADO',
                error='Token Webpay no recibido.',
            )

        pedido = buscar_pedido_por_token(token)
        if not pedido:
            return redirigir_resultado_webpay(
                estado='RECHAZADO',
                error='Pedido asociado al token no encontrado.',
            )

        token_ws = request.data.get('token_ws') or request.query_params.get('token_ws')
        if not token_ws:
            pedido.estado = 'ANULADO'
            pedido.pago = {
                **pedido.pago,
                'estado': 'ANULADO',
            }
            pedido.save(update_fields=['estado', 'pago', 'actualizado_en'])
            return redirigir_resultado_webpay(
                estado='ANULADO',
                cancelado='true',
                pedido_id=pedido.id,
            )

        try:
            response = webpay_transaction().commit(token_ws)
        except Exception as exc:
            return redirigir_resultado_webpay(
                estado='RECHAZADO',
                pedido_id=pedido.id,
                error=f'No se pudo confirmar Webpay: {exc}',
            )

        autorizado = (
            response.get('status') == 'AUTHORIZED'
            and response.get('response_code') == 0
        )
        pedido.estado = 'CONFIRMADO' if autorizado else 'RECHAZADO'
        pedido.pago = {
            **pedido.pago,
            'estado': pedido.estado,
            'respuesta': response,
        }
        pedido.save(update_fields=['estado', 'pago', 'actualizado_en'])

        if autorizado:
            EnvioPedido.objects.get_or_create(
                pedido=pedido,
                defaults={
                    'numero_tracking': f'MED-{pedido.id:06d}',
                    'direccion_destino': (
                        f"Dirección registrada #{pedido.datos.get('direccion_entrega_id')}"
                        if pedido.datos.get('direccion_entrega_id')
                        else 'Dirección registrada en el pedido'
                    ),
                    'eventos': [
                        {
                            'id': f'pedido-{pedido.id}-generado',
                            'estado': 'generado',
                            'descripcion': 'Pago aprobado y despacho generado.',
                            'ubicacion': 'Centro de distribución Medistock',
                            'timestamp': pedido.actualizado_en.isoformat(),
                        }
                    ],
                },
            )

        return redirigir_resultado_webpay(
            estado=pedido.estado,
            exito=str(autorizado).lower(),
            pedido_id=pedido.id,
            transaccion_id=response.get('buy_order', ''),
            auth_code=response.get('authorization_code', ''),
            monto=response.get('amount', pedido.total),
            response_code=response.get('response_code', ''),
        )


class WebpayEstadoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, token_ws):
        pedido = buscar_pedido_por_token(token_ws)
        if not pedido:
            return Response(
                {'detail': 'Transaccion no encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if pedido.usuario_id != request.user.id and not request.user.is_superuser:
            return Response(
                {'detail': 'Transaccion no encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            response = webpay_transaction().status(token_ws)
        except Exception as exc:
            return Response(
                {'detail': f'No se pudo consultar Webpay: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'pedido_id': pedido.id, **response})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh:
            return Response(
                {'detail': 'Refresh token requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            return Response(
                {'detail': 'Refresh token invalido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentoTributarioDetalleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        try:
            doc = DocumentoTributario.objects.select_related('pedido__usuario').get(pk=doc_id)
        except DocumentoTributario.DoesNotExist:
            return Response({'detail': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        pedido = doc.pedido
        if pedido.usuario_id != request.user.id and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'Documento no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        comprobante = (doc.provider_response or {}).get('comprobante', {})

        items_raw = comprobante.get('items', [])
        detalles_api = []
        for idx, item in enumerate(items_raw, start=1):
            detalles_api.append({
                'id': idx,
                'nombre_producto': item.get('nombre', ''),
                'descripcion': item.get('nombre', ''),
                'cantidad': item.get('cantidad', 1),
                'precio_unitario': item.get('precio_unitario', 0),
                'monto_total_linea': item.get('subtotal', 0),
                'codigo_producto': '',
            })

        monto_total = int(doc.monto_total or comprobante.get('total', 0))
        monto_neto = int(comprobante.get('monto_neto') or round(monto_total / 1.19))
        monto_iva = monto_total - monto_neto

        data = {
            'id': doc.id,
            'pedido': pedido.id,
            'tipo_documento': doc.tipo_documento,
            'tipo_documento_nombre': doc.get_tipo_documento_display(),
            'proveedor': doc.proveedor,
            'folio': doc.folio,
            'estado': doc.estado,
            'estado_dte': doc.get_estado_display(),
            'fecha_emision': doc.fecha_emision,
            'url_pdf': doc.url_pdf or None,
            'monto_total': monto_total,
            'monto_neto': monto_neto,
            'monto_iva': monto_iva,
            'forma_pago': comprobante.get('forma_pago', ''),
            'razon_social_receptor': comprobante.get('receptor_nombre', ''),
            'cliente_username': pedido.usuario.username,
            'rut_receptor': comprobante.get('receptor_rut', ''),
            'email_receptor': comprobante.get('receptor_email', ''),
            'direccion_receptor': comprobante.get('receptor_direccion', ''),
            'subtotal_productos': comprobante.get('subtotal_productos', pedido.subtotal),
            'costo_envio': comprobante.get('costo_envio', 0),
            'detalles': detalles_api,
        }
        return Response(data)


class GenerarDteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pedido_id = request.data.get('pedido_id')
        if not pedido_id:
            return Response({'detail': 'pedido_id requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pedido = Pedido.objects.select_related('usuario').get(pk=pedido_id)
        except Pedido.DoesNotExist:
            return Response({'detail': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if pedido.usuario_id != request.user.id and not (request.user.is_staff or request.user.is_superuser):
            return Response({'detail': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if pedido.estado != 'CONFIRMADO':
            return Response(
                {'detail': f'El pedido debe estar en estado CONFIRMADO (estado actual: {pedido.estado}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            documento, creado = generar_documento_mock_para_pedido(pedido)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        comprobante = (documento.provider_response or {}).get('comprobante', {})
        monto_total = int(documento.monto_total or 0)
        monto_neto = int(comprobante.get('monto_neto') or round(monto_total / 1.19))
        monto_iva = monto_total - monto_neto

        return Response({
            'id': documento.id,
            'pedido': pedido.id,
            'tipo_documento': documento.tipo_documento,
            'tipo_documento_nombre': documento.get_tipo_documento_display(),
            'proveedor': documento.proveedor,
            'folio': documento.folio,
            'estado': documento.estado,
            'estado_dte': documento.get_estado_display(),
            'fecha_emision': documento.fecha_emision,
            'monto_total': monto_total,
            'monto_neto': monto_neto,
            'monto_iva': monto_iva,
            'creado': creado,
        }, status=status.HTTP_201_CREATED if creado else status.HTTP_200_OK)
