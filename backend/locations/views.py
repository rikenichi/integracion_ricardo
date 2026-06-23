from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


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
