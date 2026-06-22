from django.urls import path
from django.contrib import admin

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import LogoutView, PerfilView
from inventory.views import CatalogoProductoView, CategoriaProductoView, ProductoDetalleView

urlpatterns = [
    path("admin/", admin.site.urls),
    path('api/accounts/login/', TokenObtainPairView.as_view(), name='login'),
    path('api/accounts/login/refresh/', TokenRefreshView.as_view(), name='login-refresh'),
    path('api/accounts/perfil/me/', PerfilView.as_view(), name='perfil-me'),
    path('api/accounts/logout/', LogoutView.as_view(), name='logout'),
    path('api/inventory/catalogo/', CatalogoProductoView.as_view(), name='catalogo-productos'),
    path('api/inventory/public/categorias/', CategoriaProductoView.as_view(), name='categorias-productos'),
    path('api/inventory/public/productos/<str:codigo>/', ProductoDetalleView.as_view(), name='detalle-producto'),
]
