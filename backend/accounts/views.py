import os
from urllib.parse import urlencode

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
from .models import Pedido


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


def perfil_usuario(usuario):
    es_administrador = usuario.is_staff or usuario.is_superuser
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
            }
        },
    }


class PerfilView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(perfil_usuario(request.user))


class DireccionEntregaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        direccion = str(request.data.get('direccion', '')).strip()
        comuna = request.data.get('comuna')

        if not direccion or not comuna:
            return Response(
                {'detail': 'Direccion y comuna son requeridas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            comuna_id = int(comuna)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'La comuna debe ser valida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'id': (request.user.id * 100000) + comuna_id,
                'direccion': direccion,
                'num_direccion': request.data.get('num_direccion', ''),
                'detalle_direccion': request.data.get('detalle_direccion', ''),
                'comuna': comuna,
                'referencia': request.data.get('referencia', ''),
                'nombre_receptor': request.data.get('nombre_receptor', ''),
                'telefono_receptor': request.data.get('telefono_receptor', ''),
                'es_principal': bool(request.data.get('es_principal', False)),
            },
            status=status.HTTP_201_CREATED,
        )


class PedidoCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def representar(pedido):
        return {
            'id': pedido.id,
            'usuario_id': pedido.usuario_id,
            'estado': pedido.estado,
            'estado_display': 'Pendiente de pago',
            'subtotal': pedido.subtotal,
            'descuento': 0,
            'total': pedido.total,
            'monto_total': pedido.total,
            'detalles': pedido.detalles,
            'items': pedido.detalles,
            'pago': pedido.pago,
            'despacho': pedido.despacho,
            'costo_envio': pedido.despacho.get('costo_envio', 0),
            'sucursal_origen_id': pedido.datos.get('sucursal_origen_id'),
            'direccion_entrega_id': pedido.datos.get('direccion_entrega_id'),
            'tipo_venta': pedido.datos.get('tipo_venta'),
            'tipo_despacho': pedido.datos.get('tipo_despacho'),
            'prioridad_medica': pedido.datos.get('prioridad_medica'),
            'fecha_requerida_entrega': pedido.datos.get('fecha_requerida_entrega'),
            'observacion': pedido.datos.get('observacion', ''),
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

            subtotal = producto.precio_b2c * cantidad
            total += subtotal
            detalles_respuesta.append(
                {
                    'producto_id': producto.id,
                    'producto_codigo': producto.codigo,
                    'producto_nombre': producto.nombre,
                    'nombre': producto.nombre,
                    'cantidad': cantidad,
                    'precio_unitario': producto.precio_b2c,
                    'subtotal': subtotal,
                }
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
