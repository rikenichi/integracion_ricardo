import json
import logging
import os

import requests

from .mock_shipping_service import MockShippingService


logger = logging.getLogger(__name__)


class ChilexpressServiceError(RuntimeError):
    pass


class ChilexpressService:
    DEFAULT_RATING_BASE_URL = (
        "https://testservices.wschilexpress.com/"
        "rating/api/v1.0"
    )
    TIMEOUT_SECONDS = 15

    def __init__(self):
        self.mode = os.getenv(
            "CHILEXPRESS_MODE",
            "mock",
        ).strip().lower()
        self.rating_key = os.getenv(
            "CHILEXPRESS_RATING_KEY",
            "",
        ).strip()
        self.legacy_subscription_key = os.getenv(
            "CHILEXPRESS_SUBSCRIPTION_KEY",
            "",
        ).strip()
        rating_base_url = os.getenv(
            "CHILEXPRESS_RATING_BASE_URL",
            self.DEFAULT_RATING_BASE_URL,
        ).strip().rstrip("/")
        self.rating_base_url = rating_base_url
        self.rating_url = (
            rating_base_url
            if rating_base_url.endswith("/rates/courier")
            else f"{rating_base_url}/rates/courier"
        )
        self.origin_region = os.getenv(
            "CHILEXPRESS_ORIGIN_REGION",
            "RM",
        ).strip()
        self.origin_comuna = os.getenv(
            "CHILEXPRESS_ORIGIN_COMUNA",
            "STGO",
        ).strip()
        self.default_weight_kg = self._positive_float(
            "CHILEXPRESS_DEFAULT_WEIGHT_KG",
            1.0,
        )
        self.default_length_cm = self._positive_float(
            "CHILEXPRESS_DEFAULT_LENGTH_CM",
            10.0,
        )
        self.default_width_cm = self._positive_float(
            "CHILEXPRESS_DEFAULT_WIDTH_CM",
            10.0,
        )
        self.default_height_cm = self._positive_float(
            "CHILEXPRESS_DEFAULT_HEIGHT_CM",
            10.0,
        )

    @staticmethod
    def _positive_float(variable_name, default):
        try:
            value = float(os.getenv(variable_name, default))
        except (TypeError, ValueError):
            return default
        return value if value > 0 else default

    @staticmethod
    def _positive_number(value, default):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return default
        return number if number > 0 else default

    def _package_from_products(self, products):
        total_weight_kg = 0
        declared_worth = 0
        lengths = []
        widths = []
        heights = []

        for product in products:
            quantity = self._positive_number(product.get("cantidad"), 1)
            weight_mg = self._positive_number(product.get("peso_mg"), 0)
            length_mm = self._positive_number(product.get("largo_mm"), 0)
            width_mm = self._positive_number(product.get("ancho_mm"), 0)
            height_mm = self._positive_number(product.get("alto_mm"), 0)
            unit_value = self._positive_number(
                product.get("valor_unitario"),
                0,
            )

            total_weight_kg += (weight_mg / 1_000_000) * quantity
            declared_worth += unit_value * quantity
            if length_mm:
                lengths.append(length_mm / 10)
            if width_mm:
                widths.append(width_mm / 10)
            if height_mm:
                heights.append(height_mm / 10)

        return {
            "weight": total_weight_kg or self.default_weight_kg,
            "height": max(heights, default=self.default_height_cm),
            "width": max(widths, default=self.default_width_cm),
            "length": max(lengths, default=self.default_length_cm),
            "declared_worth": max(int(round(declared_worth)), 1000),
        }

    def _build_payload(self, destination_county_code, products):
        package = self._package_from_products(products)
        return {
            "originCountyCode": self.origin_comuna,
            "destinationCountyCode": destination_county_code,
            "package": {
                "weight": package["weight"],
                "height": package["height"],
                "width": package["width"],
                "length": package["length"],
            },
            "productType": 3,
            "contentType": 1,
            "declaredWorth": package["declared_worth"],
            "deliveryTime": 0,
        }

    @staticmethod
    def _extract_options(data):
        if not isinstance(data, dict):
            return []

        for key in (
            "courierServiceOptions",
            "serviceOptions",
            "services",
            "rates",
        ):
            options = data.get(key)
            if isinstance(options, list):
                return options

        for key in ("data", "result"):
            options = ChilexpressService._extract_options(data.get(key))
            if options:
                return options

        return []

    @staticmethod
    def _service_price(service):
        for key in ("serviceValue", "price", "value", "amount"):
            try:
                value = float(service.get(key))
            except (AttributeError, TypeError, ValueError):
                continue
            if value >= 0:
                return value
        return None

    def quote(self, destination_county_code, products):
        if self.mode != "real":
            raise ChilexpressServiceError(
                "CHILEXPRESS_MODE no está configurado como real."
            )

        if not self.rating_key:
            logger.warning(
                "Chilexpress real no iniciado: falta rating key. "
                "legacy_key_configured=%s",
                str(bool(self.legacy_subscription_key)).lower(),
            )
            raise ChilexpressServiceError(
                "Falta CHILEXPRESS_RATING_KEY."
            )

        payload = self._build_payload(
            destination_county_code,
            products,
        )
        logger.warning(
            "Iniciando cotización Chilexpress real "
            "chilexpress_mode=%s rating_key_configured=%s "
            "rating_base_url=%s endpoint=%s "
            "origin_region=%s origin_comuna=%s destination=%s "
            "products=%s payload=%s",
            self.mode,
            str(bool(self.rating_key)).lower(),
            self.rating_base_url,
            self.rating_url,
            self.origin_region,
            self.origin_comuna,
            destination_county_code,
            len(products),
            json.dumps(payload, ensure_ascii=True, sort_keys=True),
        )

        try:
            response = requests.post(
                self.rating_url,
                json=payload,
                headers={
                    "Ocp-Apim-Subscription-Key": self.rating_key,
                    "Cache-Control": "no-cache",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=self.TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as error:
            error_response = getattr(error, "response", None)
            status_code = getattr(error_response, "status_code", None)
            response_text = getattr(error_response, "text", "")
            summary = " ".join(str(response_text or "").split())[:300]
            if status_code == 400:
                diagnosis = "payload_rejected"
            elif status_code in {401, 403}:
                diagnosis = "credential_or_permission"
            else:
                diagnosis = "provider_or_connection_error"
            logger.warning(
                "Chilexpress real falló status_code=%s diagnosis=%s "
                "message=%s",
                status_code or "connection_error",
                diagnosis,
                summary or str(error),
            )
            raise ChilexpressServiceError(
                "No se pudo cotizar con Chilexpress "
                f"(status={status_code or 'connection_error'}, "
                f"diagnosis={diagnosis})."
            ) from error
        except ValueError as error:
            logger.warning(
                "Chilexpress real respondió JSON inválido status=%s",
                response.status_code,
            )
            raise ChilexpressServiceError(
                "Chilexpress devolvió una respuesta inválida."
            ) from error

        options = self._extract_options(data)
        priced_options = [
            (self._service_price(option), option)
            for option in options
        ]
        priced_options = [
            item
            for item in priced_options
            if item[0] is not None
        ]

        if not priced_options:
            logger.warning(
                "Chilexpress real respondió sin servicios cotizables "
                "status=%s destination=%s",
                response.status_code,
                destination_county_code,
            )
            raise ChilexpressServiceError(
                "Chilexpress no devolvió servicios cotizables."
            )

        price, service = min(priced_options, key=lambda item: item[0])
        service_name = (
            service.get("serviceDescription")
            or service.get("description")
            or service.get("serviceName")
            or "Despacho Chilexpress"
        )
        service_code = str(
            service.get("serviceTypeCode")
            or service.get("serviceCode")
            or service.get("code")
            or "CHX_REAL"
        )
        delivery_term = (
            service.get("deliveryDescription")
            or service.get("deliveryTime")
            or service.get("estimatedDelivery")
            or MockShippingService.DELIVERY_TERM
        )

        logger.warning(
            "Chilexpress real respondió correctamente status=%s "
            "destination=%s service_code=%s price=%s options=%s",
            response.status_code,
            destination_county_code,
            service_code,
            int(round(price)),
            len(priced_options),
        )

        return MockShippingService.format_response(
            courier="Chilexpress",
            service=str(service_name),
            price=price,
            delivery_term=str(delivery_term),
            service_code=service_code,
            mode="real",
        )
