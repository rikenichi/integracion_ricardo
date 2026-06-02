from django.urls import path

from inventory.views import CatalogoProductoView

urlpatterns = [
    path('api/inventory/catalogo/', CatalogoProductoView.as_view(), name='catalogo-productos'),
]
