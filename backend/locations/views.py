import json
import logging
import os
import re
import unicodedata
from pathlib import Path

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import EnvioPedido, Pedido
from logistics.services.chilexpress_service import (
    ChilexpressService,
    ChilexpressServiceError,
)
from logistics.services.mock_shipping_service import MockShippingService


logger = logging.getLogger(__name__)


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

REGION_CODES_NORTH_TO_SOUTH = [
    "R15",
    "R1",
    "R2",
    "R3",
    "R4",
    "R5",
    "RM",
    "R6",
    "R7",
    "R16",
    "R8",
    "R9",
    "R14",
    "R10",
    "R11",
    "R12",
]

REGION_ORDER_BY_CODE = {
    code: index
    for index, code in enumerate(REGION_CODES_NORTH_TO_SOUTH)
}

REGION_NAMES_NORTH_TO_SOUTH = [
    "ARICA Y PARINACOTA",
    "TARAPACA",
    "ANTOFAGASTA",
    "ATACAMA",
    "COQUIMBO",
    "VALPARAISO",
    "METROPOLITANA DE SANTIAGO",
    "LIBERTADOR GRAL BERNARDO O HIGGINS",
    "MAULE",
    "NUBLE",
    "BIOBIO",
    "LA ARAUCANIA",
    "LOS RIOS",
    "LOS LAGOS",
    "AISEN DEL GRAL CARLOS IBANEZ DEL CAMPO",
    "MAGALLANES Y LA ANTARTICA CHILENA",
]

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


def normalizar_texto_orden(value):
    text = unicodedata.normalize("NFD", str(value or "").upper())
    text = "".join(
        character
        for character in text
        if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"[^A-Z0-9]+", " ", text).strip()


REGION_ORDER_BY_NAME = {
    normalizar_texto_orden(name): index
    for index, name in enumerate(REGION_NAMES_NORTH_TO_SOUTH)
}
REGION_ORDER_BY_NAME.update(
    {
        "REGION METROPOLITANA": REGION_ORDER_BY_CODE["RM"],
        "METROPOLITANA": REGION_ORDER_BY_CODE["RM"],
        "ARAUCANIA": REGION_ORDER_BY_CODE["R9"],
        "AISEN DEL GRAL C IBANEZ DEL CAMPO": REGION_ORDER_BY_CODE["R11"],
        "MAGALLANES Y ANTARTICA CHILENA": REGION_ORDER_BY_CODE["R12"],
    }
)


def region_sort_key(region):
    region_code = normalizar_texto_orden(region.get("region_code"))
    region_name = normalizar_texto_orden(region.get("region_name"))
    order = REGION_ORDER_BY_CODE.get(region_code)

    if order is None:
        order = REGION_ORDER_BY_NAME.get(region_name, len(REGION_ORDER_BY_CODE))

    return order, region_name


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
        regions = sorted(coverage["regions"], key=region_sort_key)
        response = Response([
            representar_region(region)
            for region in regions
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

        comunas.sort(
            key=lambda comuna: normalizar_texto_orden(
                comuna.get("comuna_name") or comuna.get("nombre")
            )
        )
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
                        "Chilexpress no tiene cobertura de entrega para "
                        "la comuna seleccionada."
                    ),
                    "county_code": county_code_destino,
                    "operational_status": comuna.get(
                        "operational_status",
                        "UNAVAILABLE",
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        mode = os.getenv("CHILEXPRESS_MODE", "mock").strip().lower()
        rating_key = os.getenv(
            "CHILEXPRESS_RATING_KEY",
            "",
        ).strip()
        legacy_subscription_key = os.getenv(
            "CHILEXPRESS_SUBSCRIPTION_KEY",
            "",
        ).strip()
        coverage_key_configured = bool(
            os.getenv("CHILEXPRESS_COVERAGE_KEY", "").strip()
        )
        shipping_key_configured = bool(
            os.getenv("CHILEXPRESS_SHIPPING_KEY", "").strip()
        )

        logger.warning(
            "Chilexpress quote config chilexpress_mode=%s "
            "coverage_key_configured=%s rating_key_configured=%s "
            "shipping_key_configured=%s legacy_key_configured=%s "
            "intento_real=%s",
            mode or "mock",
            str(coverage_key_configured).lower(),
            str(bool(rating_key)).lower(),
            str(shipping_key_configured).lower(),
            str(bool(legacy_subscription_key)).lower(),
            str(mode == "real" and bool(rating_key)).lower(),
        )

        if mode != "real":
            logger.warning(
                "Cotización Chilexpress usando mock "
                "chilexpress_mode=%s rating_key_configured=%s "
                "intento_real=false destination=%s",
                mode or "mock",
                str(bool(rating_key)).lower(),
                county_code_destino,
            )
            payload = MockShippingService.quote(mode="mock")
        elif not rating_key:
            logger.warning(
                "Cotización Chilexpress usando fallback "
                "chilexpress_mode=real rating_key_configured=false "
                "intento_real=false destination=%s reason=rating_key_missing",
                county_code_destino,
            )
            payload = MockShippingService.quote(mode="fallback")
        else:
            logger.warning(
                "Cotización Chilexpress intentando modo real "
                "chilexpress_mode=real rating_key_configured=true "
                "intento_real=true destination=%s",
                county_code_destino,
            )
            try:
                payload = ChilexpressService().quote(
                    str(county_code_destino).strip().upper(),
                    productos,
                )
            except ChilexpressServiceError as error:
                logger.warning(
                    "Cotización Chilexpress cayó a fallback "
                    "destination=%s reason=%s",
                    county_code_destino,
                    error,
                )
                payload = MockShippingService.quote(mode="fallback")

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
