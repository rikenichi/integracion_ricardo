"""Descarga y normaliza la cobertura GeoReference de Chilexpress.

Configurar CHILEXPRESS_SUBSCRIPTION_KEY en backend/.env y ejecutar:
    cd backend
    python scripts/descargar_cobertura_chilexpress.py

CHILEXPRESS_COVERAGE_BASE_URL es opcional y por defecto usa TEST.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"
OUTPUT_PATH = BACKEND_DIR / "locations" / "data" / "chilexpress_cobertura.json"

load_dotenv(ENV_PATH)

BASE_URL = os.getenv(
    "CHILEXPRESS_COVERAGE_BASE_URL",
    "https://testservices.wschilexpress.com/georeference/api/v1.0",
).rstrip("/")

SUBSCRIPTION_KEY = os.getenv("CHILEXPRESS_SUBSCRIPTION_KEY", "").strip()

TIMEOUT_SECONDS = 30


def realizar_peticion(endpoint: str, parametros: dict | None = None) -> dict:
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"

    if parametros:
        url = f"{url}?{urlencode(parametros)}"

    request = Request(
        url,
        headers={
            "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
            "Cache-Control": "no-cache",
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            contenido = response.read().decode("utf-8")
            return json.loads(contenido)

    except HTTPError as error:
        detalle = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Error HTTP {error.code} al consultar {url}: {detalle}"
        ) from error

    except URLError as error:
        raise RuntimeError(
            f"No se pudo conectar con Chilexpress en {url}: {error.reason}"
        ) from error

    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Chilexpress devolvió una respuesta que no es JSON válido: {url}"
        ) from error


def validar_respuesta(data: dict, operacion: str) -> None:
    status_code = data.get("statusCode")

    if status_code is not None and status_code != 0:
        descripcion = data.get("statusDescription", "Error desconocido")
        errores = data.get("errors")

        raise RuntimeError(
            f"{operacion} falló. "
            f"statusCode={status_code}, "
            f"statusDescription={descripcion}, "
            f"errors={errores}"
        )


def obtener_regiones() -> list[dict]:
    data = realizar_peticion("regions")
    validar_respuesta(data, "Consulta de regiones")

    regiones = data.get("regions", [])

    if not isinstance(regiones, list):
        raise RuntimeError("El campo 'regions' no contiene una lista.")

    return regiones


def obtener_coberturas(region_id: str) -> list[dict]:
    data = realizar_peticion(
        "coverage-areas",
        {
            "RegionCode": region_id,
            "type": 0,
        },
    )

    validar_respuesta(data, f"Consulta de coberturas para {region_id}")

    coberturas = data.get("coverageAreas", [])

    if not isinstance(coberturas, list):
        raise RuntimeError(
            f"El campo 'coverageAreas' de la región {region_id} no es una lista."
        )

    return coberturas


def eliminar_duplicados(coberturas: list[dict]) -> list[dict]:
    registros_unicos = {}

    for cobertura in coberturas:
        clave = (
            cobertura.get("regionCode"),
            cobertura.get("countyCode"),
            cobertura.get("coverageName"),
        )

        registros_unicos[clave] = cobertura

    return list(registros_unicos.values())


def estado_operacional(delivery_available: bool, pickup_available: bool) -> str:
    if delivery_available and pickup_available:
        return "DELIVERY_AND_PICKUP"
    if delivery_available:
        return "DELIVERY_ONLY"
    if pickup_available:
        return "PICKUP_ONLY"
    return "UNAVAILABLE"


def normalizar_cobertura(cobertura: dict) -> dict:
    # Chilexpress expone ind_ppd para cobertura de entrega y
    # ind_rd para disponibilidad de retiro.
    delivery_available = bool(cobertura.get("ind_ppd"))
    pickup_available = bool(cobertura.get("ind_rd"))
    offices = cobertura.get("offices")

    return {
        "comuna_code": str(cobertura.get("countyCode", "")).strip(),
        "comuna_name": str(
            cobertura.get("coverageName")
            or cobertura.get("countyName")
            or ""
        ).strip(),
        "enabled": delivery_available or pickup_available,
        "operational_status": estado_operacional(
            delivery_available,
            pickup_available,
        ),
        "delivery_available": delivery_available,
        "pickup_available": pickup_available,
        "offices": offices if isinstance(offices, list) else [],
    }


def guardar_json_temporal(datos: dict) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    archivo_temporal = OUTPUT_PATH.with_suffix(".tmp")

    with archivo_temporal.open("w", encoding="utf-8") as archivo:
        json.dump(
            datos,
            archivo,
            ensure_ascii=False,
            indent=2,
        )

    archivo_temporal.replace(OUTPUT_PATH)


def main() -> int:
    if not ENV_PATH.exists():
        print(f"ERROR: no existe el archivo {ENV_PATH}")
        return 1

    if not SUBSCRIPTION_KEY:
        print(
            "ERROR: falta CHILEXPRESS_SUBSCRIPTION_KEY "
            "en backend/.env"
        )
        return 1

    print("Consultando regiones de Chilexpress...")

    try:
        regiones_api = obtener_regiones()
    except RuntimeError as error:
        print(f"ERROR GENERAL: {error}")
        print("No se modificó el JSON anterior.")
        return 1

    regiones_guardadas = []
    regiones_con_error = []
    total_coberturas = 0

    for region in regiones_api:
        region_id = str(region.get("regionId", "")).strip()
        region_name = str(region.get("regionName", "")).strip()

        if not region_id:
            print("Se omitió una región sin regionId.")
            continue

        print(f"Consultando {region_id} - {region_name}...")

        try:
            coberturas = obtener_coberturas(region_id)
            coberturas = eliminar_duplicados(coberturas)

            regiones_guardadas.append(
                {
                    "region_code": region_id,
                    "region_name": region_name,
                    "comunas": [
                        normalizar_cobertura(cobertura)
                        for cobertura in coberturas
                    ],
                }
            )

            total_coberturas += len(coberturas)

            print(f"  Coberturas obtenidas: {len(coberturas)}")

        except RuntimeError as error:
            regiones_con_error.append(
                {
                    "regionId": region_id,
                    "regionName": region_name,
                    "error": str(error),
                }
            )

            print(f"  ERROR: {error}")

    if not regiones_guardadas:
        print("ERROR: no se pudo descargar ninguna región.")
        print("No se modificó el JSON anterior.")
        return 1

    resultado = {
        "source": "Chilexpress GeoReference REST API - testservices",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": BASE_URL,
        "regions": regiones_guardadas,
        "errors": regiones_con_error,
        "summary": {
            "regions_received": len(regiones_api),
            "regions_saved": len(regiones_guardadas),
            "regions_with_errors": len(regiones_con_error),
            "coverage_areas_saved": total_coberturas,
        },
    }

    try:
        guardar_json_temporal(resultado)
    except OSError as error:
        print(f"ERROR al guardar el archivo JSON: {error}")
        return 1

    print()
    print("Descarga terminada.")
    print(f"Regiones recibidas: {len(regiones_api)}")
    print(f"Regiones guardadas: {len(regiones_guardadas)}")
    print(f"Regiones con error: {len(regiones_con_error)}")
    print(f"Coberturas guardadas: {total_coberturas}")
    print(f"Archivo generado: {OUTPUT_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
