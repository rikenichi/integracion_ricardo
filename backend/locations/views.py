import json
from pathlib import Path

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import EnvioPedido, Pedido


COVERAGE_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "chilexpress_cobertura.json"
)

# Conserva los IDs usados por el frontend anterior para las ubicaciones
# principales, pero expone siempre los códigos reales en campos separados.
LEGACY_REGION_IDS = {
    "RM": 1,
    "R5": 2,
    "R8": 3,
    "R7": 4,
    "R6": 5,
}

LEGACY_COMUNA_IDS = {
    "STGO": 101,
    "MIPU": 102,
    "LAFL": 103,
    "LCON": 104,
    "VALP": 201,
    "VINA": 202,
    "CONC": 301,
    "THNO": 302,
}

FALLBACK_COVERAGE = {
    "source": "Medistock controlled fallback",
    "generated_at": None,
    "regions": [
        {
            "region_code": "RM",
            "region_name": "Región Metropolitana",
            "comunas": [
                {"comuna_code": "STGO", "comuna_name": "Santiago"},
                {"comuna_code": "MIPU", "comuna_name": "Maipú"},
                {"comuna_code": "LAFL", "comuna_name": "La Florida"},
                {"comuna_code": "LCON", "comuna_name": "Las Condes"},
            ],
        },
        {
            "region_code": "R5",
            "region_name": "Valparaíso",
            "comunas": [
                {"comuna_code": "VALP", "comuna_name": "Valparaíso"},
                {"comuna_code": "VINA", "comuna_name": "Viña del Mar"},
            ],
        },
        {
            "region_code": "R8",
            "region_name": "Biobío",
            "comunas": [
                {"comuna_code": "CONC", "comuna_name": "Concepción"},
                {"comuna_code": "THNO", "comuna_name": "Talcahuano"},
            ],
        },
        {"region_code": "R7", "region_name": "Maule", "comunas": []},
        {
            "region_code": "R6",
            "region_name": "O'Higgins",
            "comunas": [],
        },
    ],
}


def completar_fallback():
    for region in FALLBACK_COVERAGE["regions"]:
        for comuna in region["comunas"]:
            comuna.update(
                {
                    "enabled": True,
                    "operational_status": "DELIVERY_AND_PICKUP",
                    "delivery_available": True,
                    "pickup_available": True,
                    "offices": [],
                }
            )


completar_fallback()


def cargar_cobertura():
    try:
        with COVERAGE_PATH.open(encoding="utf-8") as archivo:
            data = json.load(archivo)
    except FileNotFoundError:
        return FALLBACK_COVERAGE, "El archivo de cobertura no existe."
    except (OSError, json.JSONDecodeError) as error:
        return FALLBACK_COVERAGE, f"No se pudo leer la cobertura: {error}"

    if not isinstance(data, dict) or not isinstance(data.get("regions"), list):
        return FALLBACK_COVERAGE, "El JSON de cobertura tiene formato inválido."

    if not data["regions"]:
        return FALLBACK_COVERAGE, "El JSON de cobertura no contiene regiones."

    return data, None


def region_id_publico(region):
    region_code = str(region.get("region_code", "")).strip().upper()
    return LEGACY_REGION_IDS.get(region_code, region_code)


def comuna_id_publico(comuna):
    comuna_code = str(comuna.get("comuna_code", "")).strip().upper()
    return LEGACY_COMUNA_IDS.get(comuna_code, comuna_code)


def representar_region(region):
    return {
        "id": region_id_publico(region),
        "nombre": region.get("region_name", ""),
        "region_code": region.get("region_code", ""),
        "region_name": region.get("region_name", ""),
    }


def representar_comuna(region, comuna):
    comuna_code = str(comuna.get("comuna_code", "")).strip().upper()
    offices = comuna.get("offices")
    return {
        "id": comuna_id_publico(comuna),
        "region_id": region_id_publico(region),
        "region_code": region.get("region_code", ""),
        "nombre": comuna.get("comuna_name", ""),
        "comuna_code": comuna_code,
        "comuna_name": comuna.get("comuna_name", ""),
        "county_code": comuna_code,
        "enabled": bool(comuna.get("enabled")),
        "operational_status": comuna.get(
            "operational_status",
            "UNAVAILABLE",
        ),
        "delivery_available": bool(comuna.get("delivery_available")),
        "pickup_available": bool(comuna.get("pickup_available")),
        "offices": offices if isinstance(offices, list) else [],
    }


def buscar_region(regions, requested_id):
    requested = str(requested_id or "").strip().upper()
    for region in regions:
        identifiers = {
            str(region.get("region_code", "")).strip().upper(),
            str(region_id_publico(region)).strip().upper(),
        }
        if requested in identifiers:
            return region
    return None


def buscar_comuna(regions, county_code):
    requested = str(county_code or "").strip().upper()
    for region in regions:
        for comuna in region.get("comunas", []):
            comuna_code = str(
                comuna.get("comuna_code", "")
            ).strip().upper()
            if comuna_code == requested:
                return region, comuna
    return None, None


def agregar_metadata_cobertura(response, coverage, warning):
    response["X-Coverage-Source"] = coverage.get("source", "unknown")
    if warning:
        response["X-Coverage-Fallback"] = "true"
    return response


class RegionListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        coverage, warning = cargar_cobertura()
        response = Response([
            representar_region(region)
            for region in coverage["regions"]
        ])
        return agregar_metadata_cobertura(response, coverage, warning)


class ComunaListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        coverage, warning = cargar_cobertura()
        region_id = request.query_params.get("region_id")
        include_disabled = (
            request.query_params.get("include_disabled", "").lower()
            in {"1", "true", "yes"}
        )
        regions = coverage["regions"]

        if region_id:
            region = buscar_region(regions, region_id)
            regions = [region] if region else []

        comunas = []
        for region in regions:
            for comuna in region.get("comunas", []):
                if include_disabled or comuna.get("enabled"):
                    comunas.append(representar_comuna(region, comuna))

        comunas.sort(key=lambda comuna: comuna["nombre"])
        response = Response(comunas)
        return agregar_metadata_cobertura(response, coverage, warning)


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

        if (
            not county_code_destino
            or not isinstance(productos, list)
            or not productos
        ):
            return Response(
                {"detail": "Debes indicar destino y productos para cotizar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        coverage, warning = cargar_cobertura()
        _, comuna = buscar_comuna(
            coverage["regions"],
            county_code_destino,
        )

        if not comuna:
            return Response(
                {
                    "detail": (
                        "La comuna de destino no existe en la cobertura "
                        "Chilexpress disponible."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not comuna.get("enabled") or not comuna.get("delivery_available"):
            return Response(
                {
                    "detail": (
                        "La comuna de destino no está habilitada para "
                        "despacho a domicilio."
                    ),
                    "county_code": county_code_destino,
                    "operational_status": comuna.get(
                        "operational_status",
                        "UNAVAILABLE",
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = {
            "courier": "Chilexpress",
            "coverage_source": coverage.get("source"),
            "coverage_generated_at": coverage.get("generated_at"),
            "origin_county_code": "STGO",
            "destination_county_code": str(
                county_code_destino
            ).strip().upper(),
            "num_cajas": 1,
            "servicios_disponibles": [
                {
                    "serviceTypeCode": "MEDISTOCK-DEMO",
                    "serviceDescription": (
                        "Despacho estándar con cobertura Chilexpress"
                    ),
                    "serviceValue": 3990,
                    "deliveryType": 1,
                }
            ],
        }
        if warning:
            payload["coverage_warning"] = warning

        response = Response(payload)
        return agregar_metadata_cobertura(response, coverage, warning)


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

        if pedido.estado != "CONFIRMADO":
            return Response(
                {
                    "detail": (
                        "El envío se genera cuando el pago está confirmado."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        timestamp = pedido.actualizado_en or timezone.now()
        envio, _ = EnvioPedido.objects.get_or_create(
            pedido=pedido,
            defaults={
                "numero_tracking": f"MED-{pedido.id:06d}",
                "direccion_destino": (
                    "Dirección registrada "
                    f"#{pedido.datos.get('direccion_entrega_id')}"
                    if pedido.datos.get("direccion_entrega_id")
                    else "Dirección registrada en el pedido"
                ),
                "eventos": [
                    {
                        "id": f"pedido-{pedido.id}-generado",
                        "estado": "generado",
                        "descripcion": (
                            "Pedido recibido y despacho generado."
                        ),
                        "ubicacion": (
                            "Centro de distribución Medistock"
                        ),
                        "timestamp": timestamp.isoformat(),
                    }
                ],
            },
        )

        return Response(
            {
                "pedido_id": pedido.id,
                "pedido": pedido.id,
                "numero_tracking": envio.numero_tracking,
                "courier": envio.courier,
                "estado": envio.estado,
                "estado_label": envio.estado_label,
                "fecha_estimada_entrega": envio.fecha_estimada_entrega,
                "direccion_destino": envio.direccion_destino,
                "eventos": envio.eventos,
            }
        )
