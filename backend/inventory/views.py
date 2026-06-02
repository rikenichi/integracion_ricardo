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


class CatalogoProductoView(APIView):
    def get(self, request):
        if not Producto.objects.exists():
            Producto.objects.bulk_create(Producto(**data) for data in PRODUCTOS_INICIALES)

        productos = Producto.objects.filter(activo=True).order_by('id')
        serializer = ProductoSerializer(productos, many=True)
        return Response(serializer.data)
