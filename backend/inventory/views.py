from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Producto
from .serializers import ProductoSerializer


PRODUCTOS_INICIALES = [
    {
        'codigo': 'MED-001',
        'sku': 'MED-001',
        'nombre': 'Paracetamol 500 mg',
        'descripcion': 'Analgesico de uso general.',
        'precio_b2c': 1990,
        'precio_b2b': 1590,
        'stock_disponible': 24,
        'categoria_nombre': 'Medicamentos',
        'marca_nombre': 'Medistock',
    },
    {
        'codigo': 'INS-001',
        'sku': 'INS-001',
        'nombre': 'Guantes clinicos',
        'descripcion': 'Caja de guantes desechables.',
        'precio_b2c': 4990,
        'precio_b2b': 4290,
        'stock_disponible': 40,
        'categoria_nombre': 'Insumos medicos',
        'marca_nombre': 'Medistock',
    },
    {
        'codigo': 'CUR-001',
        'sku': 'CUR-001',
        'nombre': 'Gasas esteriles',
        'descripcion': 'Pack para curaciones basicas.',
        'precio_b2c': 2990,
        'precio_b2b': 2490,
        'stock_disponible': 32,
        'categoria_nombre': 'Curaciones',
        'marca_nombre': 'Medistock',
    },
]


class StaffOnlyMixin:
    permission_classes = [IsAuthenticated]

    def validar_staff(self, request):
        if request.user.is_staff or request.user.is_superuser:
            return None
        return Response(
            {'detail': 'No tienes permiso para acceder a inventario.'},
            status=status.HTTP_403_FORBIDDEN,
        )


class CatalogoProductoView(APIView):
    def get(self, request):
        if not Producto.objects.exists():
            Producto.objects.bulk_create(Producto(**data) for data in PRODUCTOS_INICIALES)

        productos = Producto.objects.filter(activo=True).order_by('id')
        serializer = ProductoSerializer(productos, many=True)
        return Response(serializer.data)


class ProductoDetalleView(APIView):
    def get(self, request, codigo):
        filtro = Q(codigo=codigo) | Q(sku=codigo)
        if str(codigo).isdigit():
            filtro |= Q(id=int(codigo))

        producto = get_object_or_404(
            Producto.objects.filter(activo=True),
            filtro,
        )
        serializer = ProductoSerializer(producto)
        return Response(serializer.data)


class CategoriaProductoView(APIView):
    def get(self, request):
        nombres = (
            Producto.objects
            .filter(activo=True)
            .exclude(categoria_nombre='')
            .values_list('categoria_nombre', flat=True)
            .distinct()
            .order_by('categoria_nombre')
        )
        categorias = [
            {'id': index, 'nombre': nombre}
            for index, nombre in enumerate(nombres, start=1)
        ]
        return Response(categorias)


class InventarioListView(StaffOnlyMixin, APIView):
    def get(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso

        productos = Producto.objects.order_by('id')
        data = []
        for producto in productos:
            data.append({
                'id': producto.id,
                'producto_id': producto.id,
                'codigo': producto.codigo,
                'sku': producto.sku,
                'producto_codigo': producto.codigo,
                'producto_sku': producto.sku,
                'nombre': producto.nombre,
                'producto_nombre': producto.nombre,
                'categoria': producto.categoria_nombre,
                'categoria_nombre': producto.categoria_nombre,
                'marca_nombre': producto.marca_nombre,
                'stock': producto.stock_disponible,
                'stock_neto': producto.stock_disponible,
                'cantidad_disponible': producto.stock_disponible,
                'disponible': producto.stock_disponible,
                'cantidad_reservada': 0,
                'stock_critico': 5,
                'precio': producto.precio_b2c,
                'precio_b2c': producto.precio_b2c,
                'precio_b2b': producto.precio_b2b,
                'activo': producto.activo,
                'disponible_venta': producto.activo and producto.stock_disponible > 0,
                'sucursal': 1,
                'sucursal_nombre': 'Sucursal Principal',
            })
        return Response(data)


class ProductoAdminListView(StaffOnlyMixin, APIView):
    def get(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso

        productos = Producto.objects.order_by('id')
        serializer = ProductoSerializer(productos, many=True)
        return Response(serializer.data)


class CategoriaAdminListView(StaffOnlyMixin, APIView):
    def get(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso

        nombres = (
            Producto.objects
            .exclude(categoria_nombre='')
            .values_list('categoria_nombre', flat=True)
            .distinct()
            .order_by('categoria_nombre')
        )
        categorias = [
            {'id': index, 'nombre': nombre}
            for index, nombre in enumerate(nombres, start=1)
        ]
        return Response(categorias)


class MarcaAdminListView(StaffOnlyMixin, APIView):
    def get(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso

        nombres = (
            Producto.objects
            .exclude(marca_nombre='')
            .values_list('marca_nombre', flat=True)
            .distinct()
            .order_by('marca_nombre')
        )
        marcas = [
            {'id': index, 'nombre': nombre}
            for index, nombre in enumerate(nombres, start=1)
        ]
        return Response(marcas)


class LoteListView(StaffOnlyMixin, APIView):
    def get(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso
        return Response([])


class MovimientoInventarioListView(StaffOnlyMixin, APIView):
    def get(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso
        return Response([])


class TrasladoListView(StaffOnlyMixin, APIView):
    def get(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso
        return Response([])
