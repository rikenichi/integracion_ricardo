from django.urls import path
from django.contrib import admin

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import (
    DireccionEntregaView,
    LogoutView,
    PedidoCreateView,
    PedidoDetailView,
    PerfilView,
    WebpayCommitView,
    WebpayEstadoView,
    WebpayIniciarView,
)
from inventory.views import CatalogoProductoView, CategoriaProductoView, ProductoDetalleView
from locations.views import (
    ComunaListView,
    CotizarDespachoView,
    RegionListView,
    SucursalDetailView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path('api/accounts/login/', TokenObtainPairView.as_view(), name='login'),
    path('api/accounts/login/refresh/', TokenRefreshView.as_view(), name='login-refresh'),
    path('api/accounts/perfil/me/', PerfilView.as_view(), name='perfil-me'),
    path('api/accounts/mis-direcciones/', DireccionEntregaView.as_view(), name='mis-direcciones'),
    path('api/accounts/logout/', LogoutView.as_view(), name='logout'),
    path('api/inventory/catalogo/', CatalogoProductoView.as_view(), name='catalogo-productos'),
    path('api/inventory/public/categorias/', CategoriaProductoView.as_view(), name='categorias-productos'),
    path('api/inventory/public/productos/<str:codigo>/', ProductoDetalleView.as_view(), name='detalle-producto'),
    path('api/locations/regions/', RegionListView.as_view(), name='locations-regions'),
    path('api/locations/comunas/', ComunaListView.as_view(), name='locations-comunas'),
    path('api/locations/sucursales/<int:sucursal_id>/', SucursalDetailView.as_view(), name='locations-sucursal'),
    path('api/logistics/cotizar/', CotizarDespachoView.as_view(), name='logistics-cotizar'),
    path('api/orders/pedidos/', PedidoCreateView.as_view(), name='orders-pedidos-create'),
    path('api/orders/pedidos/<int:pedido_id>/', PedidoDetailView.as_view(), name='orders-pedidos-detail'),
    path('api/payments/webpay/iniciar/', WebpayIniciarView.as_view(), name='webpay-iniciar'),
    path('api/payments/webpay/commit/', WebpayCommitView.as_view(), name='webpay-commit'),
    path('api/payments/webpay/estado/<str:token_ws>/', WebpayEstadoView.as_view(), name='webpay-estado'),
]
