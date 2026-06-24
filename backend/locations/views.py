from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Pedido


REGIONES = [
    {"id": 1, "nombre": "Región Metropolitana"},
    {"id": 2, "nombre": "Valparaíso"},
    {"id": 3, "nombre": "Biobío"},
    {"id": 4, "nombre": "Maule"},
    {"id": 5, "nombre": "O'Higgins"},
]

COMUNAS = [
    {"id": 101, "region_id": 1, "nombre": "Santiago", "county_code": "STGO"},
    {"id": 102, "region_id": 1, "nombre": "Maipú", "county_code": "MAIP"},
    {"id": 103, "region_id": 1, "nombre": "La Florida", "county_code": "LFLA"},
    {"id": 104, "region_id": 1, "nombre": "Las Condes", "county_code": "LCON"},
    {"id": 201, "region_id": 2, "nombre": "Valparaíso", "county_code": "VALP"},
    {"id": 202, "region_id": 2, "nombre": "Viña del Mar", "county_code": "VINA"},
    {"id": 301, "region_id": 3, "nombre": "Concepción", "county_code": "CONC"},
    {"id": 302, "region_id": 3, "nombre": "Talcahuano", "county_code": "TALC"},
]


class RegionListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(REGIONES)


class ComunaListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        region_id = request.query_params.get("region_id")
        comunas = COMUNAS

        if region_id:
            comunas = [
                comuna
                for comuna in COMUNAS
                if str(comuna["region_id"]) == str(region_id)
            ]

        return Response(comunas)


class SucursalDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, sucursal_id):
        if sucursal_id != 1:
            return Response(
                {"detail": "Sucursal no encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "id": 1,
                "nombre": "Sucursal Medistock Santiago",
                "direccion": "Santiago Centro",
                "comuna_nombre": "Santiago",
                "region_nombre": "Región Metropolitana",
                "county_code": "STGO",
            }
        )


class CotizarDespachoView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        county_code_destino = request.data.get("county_code_destino")
        productos = request.data.get("productos")

        if not county_code_destino or not isinstance(productos, list) or not productos:
            return Response(
                {"detail": "Debes indicar destino y productos para cotizar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "courier": "Medistock simulado",
                "origin_county_code": "STGO",
                "destination_county_code": county_code_destino,
                "num_cajas": 1,
                "servicios_disponibles": [
                    {
                        "serviceTypeCode": "MEDISTOCK-DEMO",
                        "serviceDescription": "Despacho estándar simulado",
                        "serviceValue": 3990,
                        "deliveryType": 1,
                    }
                ],
            }
        )


class TrackingPedidoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pedido_id):
        pedidos = Pedido.objects.all()
        if not request.user.is_superuser:
            pedidos = pedidos.filter(usuario=request.user)

        try:
            pedido = pedidos.get(id=pedido_id)
        except Pedido.DoesNotExist:
            return Response(
                {"detail": "Pedido no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        timestamp = pedido.actualizado_en or timezone.now()
        return Response(
            {
                "pedido_id": pedido.id,
                "pedido": pedido.id,
                "numero_tracking": f"MED-{pedido.id:06d}",
                "courier": "Medistock despacho controlado",
                "estado": "generado",
                "estado_label": "Generado",
                "fecha_estimada_entrega": None,
                "direccion_destino": (
                    f"Dirección registrada #{pedido.datos.get('direccion_entrega_id')}"
                    if pedido.datos.get("direccion_entrega_id")
                    else "Dirección registrada en el pedido"
                ),
                "eventos": [
                    {
                        "id": f"pedido-{pedido.id}-generado",
                        "estado": "generado",
                        "descripcion": "Pedido recibido y despacho generado.",
                        "ubicacion": "Centro de distribución Medistock",
                        "timestamp": timestamp.isoformat(),
                    }
                ],
            }
        )
