from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from inventory.models import Producto
from .models import Pedido


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
