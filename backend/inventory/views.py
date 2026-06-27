from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.views import descuento_b2b_para_usuario
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


def _inyectar_precio_convenio(data_list, pct_descuento):
    """Agrega precio_final, descuento_porcentaje y tiene_convenio a la lista."""
    result = []
    for item in data_list:
        item = dict(item)
        precio_b2c = item.get('precio_b2c') or item.get('precio_con_iva') or 0
        if pct_descuento > 0:
            item['precio_final'] = round(precio_b2c * (1 - pct_descuento / 100))
            item['descuento_porcentaje'] = pct_descuento
            item['tiene_convenio'] = True
        else:
            item['precio_final'] = precio_b2c
            item['descuento_porcentaje'] = 0
            item['tiene_convenio'] = False
        result.append(item)
    return result


class CatalogoProductoView(APIView):
    def get(self, request):
        if not Producto.objects.exists():
            Producto.objects.bulk_create(Producto(**data) for data in PRODUCTOS_INICIALES)

        productos = Producto.objects.filter(activo=True).order_by('id')
        serializer = ProductoSerializer(productos, many=True)
        pct = descuento_b2b_para_usuario(request.user) if request.user.is_authenticated else 0
        return Response(_inyectar_precio_convenio(serializer.data, pct))


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
        pct = descuento_b2b_para_usuario(request.user) if request.user.is_authenticated else 0
        data = _inyectar_precio_convenio([serializer.data], pct)
        return Response(data[0])


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

    def post(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso

        data = request.data

        # --- campos obligatorios ---
        codigo = str(data.get('sku') or data.get('codigo') or '').strip()
        if not codigo:
            return Response(
                {'error': 'El campo SKU/código es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nombre = str(data.get('nombre') or '').strip()
        if not nombre:
            return Response(
                {'error': 'El campo nombre es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        precio_raw = data.get('valor_unitario') or data.get('precio') or data.get('precio_b2c') or 0
        try:
            precio = int(precio_raw)
            if precio < 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'error': 'El valor unitario debe ser un número mayor o igual a 0.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- SKU duplicado ---
        if Producto.objects.filter(Q(codigo=codigo) | Q(sku=codigo)).exists():
            return Response(
                {'error': f'Ya existe un producto con el SKU/código "{codigo}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- marca: resolver nombre desde índice 1-based ---
        marca_nombre = ''
        marca_id_raw = data.get('marca_id')
        if marca_id_raw:
            try:
                idx = int(marca_id_raw) - 1
                nombres_marcas = list(
                    Producto.objects
                    .exclude(marca_nombre='')
                    .values_list('marca_nombre', flat=True)
                    .distinct()
                    .order_by('marca_nombre')
                )
                if 0 <= idx < len(nombres_marcas):
                    marca_nombre = nombres_marcas[idx]
            except (TypeError, ValueError):
                pass

        # --- categoría: usar el nombre de la primera categoría seleccionada ---
        categoria_nombre = ''
        categoria_ids_raw = data.get('categoria_ids') or []
        if categoria_ids_raw:
            try:
                idx = int(categoria_ids_raw[0]) - 1
                nombres_cats = list(
                    Producto.objects
                    .exclude(categoria_nombre='')
                    .values_list('categoria_nombre', flat=True)
                    .distinct()
                    .order_by('categoria_nombre')
                )
                if 0 <= idx < len(nombres_cats):
                    categoria_nombre = nombres_cats[idx]
            except (TypeError, ValueError):
                pass

        producto = Producto.objects.create(
            codigo=codigo,
            sku=codigo,
            nombre=nombre,
            descripcion=str(data.get('descripcion') or '').strip(),
            precio_b2c=precio,
            precio_b2b=precio,
            marca_nombre=marca_nombre,
            categoria_nombre=categoria_nombre,
            imagen_url=str(data.get('imagen_url') or '').strip(),
            requiere_receta=bool(data.get('requiere_receta', False)),
            activo=bool(data.get('activo', True)),
        )

        serializer = ProductoSerializer(producto)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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


def _resolver_nombre_por_indice(queryset_nombres, id_raw):
    """Devuelve el nombre correspondiente al índice 1-based que envía el frontend."""
    try:
        idx = int(id_raw) - 1
        nombres = list(queryset_nombres)
        if 0 <= idx < len(nombres):
            return nombres[idx]
    except (TypeError, ValueError):
        pass
    return ''


class IngresarProductoView(StaffOnlyMixin, APIView):
    """
    POST /api/inventory/ingresar-producto/

    Crea o recupera un Producto por SKU y actualiza su stock_disponible.
    No existen modelos de Lote, Inventario ni Movimiento en esta versión,
    por lo que codigo_lote/fecha_vencimiento se aceptan pero no se persisten.
    """

    def post(self, request):
        permiso = self.validar_staff(request)
        if permiso is not None:
            return permiso

        data = request.data

        # --- campos obligatorios ---
        codigo = str(data.get('sku') or data.get('codigo') or '').strip()
        if not codigo:
            return Response(
                {'error': 'El campo SKU/código es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nombre = str(data.get('nombre') or '').strip()
        if not nombre:
            return Response(
                {'error': 'El campo nombre es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        precio_raw = data.get('valor_unitario') or data.get('precio') or data.get('precio_b2c') or 0
        try:
            precio = int(precio_raw)
            if precio < 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'error': 'El valor unitario debe ser un número mayor o igual a 0.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            cantidad = int(data.get('cantidad') or 0)
            if cantidad < 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'error': 'La cantidad inicial debe ser un número mayor o igual a 0.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- resolver marca y categoría desde índice 1-based ---
        nombres_marcas = (
            Producto.objects
            .exclude(marca_nombre='')
            .values_list('marca_nombre', flat=True)
            .distinct()
            .order_by('marca_nombre')
        )
        nombres_cats = (
            Producto.objects
            .exclude(categoria_nombre='')
            .values_list('categoria_nombre', flat=True)
            .distinct()
            .order_by('categoria_nombre')
        )

        marca_nombre = _resolver_nombre_por_indice(nombres_marcas, data.get('marca_id'))

        categoria_nombre = ''
        categoria_ids_raw = data.get('categoria_ids') or []
        if categoria_ids_raw:
            categoria_nombre = _resolver_nombre_por_indice(nombres_cats, categoria_ids_raw[0])

        # --- crear o recuperar producto por SKU/codigo ---
        producto, creado = Producto.objects.get_or_create(
            codigo=codigo,
            defaults={
                'sku': codigo,
                'nombre': nombre,
                'descripcion': str(data.get('descripcion') or '').strip(),
                'precio_b2c': precio,
                'precio_b2b': precio,
                'stock_disponible': cantidad,
                'marca_nombre': marca_nombre,
                'categoria_nombre': categoria_nombre,
                'imagen_url': str(data.get('imagen_url') or '').strip(),
                'requiere_receta': bool(data.get('requiere_receta', False)),
                'activo': bool(data.get('activo', True)),
            },
        )

        if not creado:
            # Producto ya existe: actualizar campos y sumar stock
            producto.nombre = nombre
            producto.descripcion = str(data.get('descripcion') or '').strip()
            producto.precio_b2c = precio
            producto.precio_b2b = precio
            producto.stock_disponible += cantidad
            if marca_nombre:
                producto.marca_nombre = marca_nombre
            if categoria_nombre:
                producto.categoria_nombre = categoria_nombre
            imagen = str(data.get('imagen_url') or '').strip()
            if imagen:
                producto.imagen_url = imagen
            producto.requiere_receta = bool(data.get('requiere_receta', False))
            producto.activo = bool(data.get('activo', True))
            producto.save()

        serializer = ProductoSerializer(producto)
        mensaje = (
            f'Producto creado con stock inicial de {cantidad} unidades.'
            if creado
            else f'Producto recuperado. Stock actualizado sumando {cantidad} unidades.'
        )
        return Response(
            {'mensaje': mensaje, 'producto': serializer.data},
            status=status.HTTP_201_CREATED,
        )
