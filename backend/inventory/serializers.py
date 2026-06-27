from rest_framework import serializers

from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    precio = serializers.IntegerField(source='precio_b2c', read_only=True)
    precio_con_iva = serializers.IntegerField(source='precio_b2c', read_only=True)
    valor_unitario = serializers.IntegerField(source='precio_b2c', read_only=True)
    stock_por_sucursal = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            'id',
            'codigo',
            'sku',
            'nombre',
            'descripcion',
            'precio',
            'precio_con_iva',
            'valor_unitario',
            'precio_b2c',
            'precio_b2b',
            'stock_disponible',
            'stock_por_sucursal',
            'categoria_nombre',
            'marca_nombre',
            'imagen_url',
            'requiere_receta',
            'activo',
        ]

    def get_stock_por_sucursal(self, producto):
        return [
            {
                'sucursal_id': 1,
                'sucursal_nombre': 'Sucursal Principal',
                'stock_neto': producto.stock_disponible,
                'disponible': producto.stock_disponible,
            }
        ]
