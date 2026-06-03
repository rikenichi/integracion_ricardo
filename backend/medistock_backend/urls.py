from django.urls import path

from inventory.views import CatalogoProductoView, ProductoDetalleView

urlpatterns = [
    path('api/inventory/catalogo/', CatalogoProductoView.as_view(), name='catalogo-productos'),
    path('api/inventory/public/productos/<str:codigo>/', ProductoDetalleView.as_view(), name='detalle-producto'),
]
