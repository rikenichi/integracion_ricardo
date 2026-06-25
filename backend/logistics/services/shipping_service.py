import logging
import os

import requests


logger = logging.getLogger(__name__)


class ChilexpressShippingDiagnostic:
    DEFAULT_SHIPPING_BASE_URL = "https://testservices.wschilexpress.com"
    TRANSPORT_ORDERS_PATH = (
        "/transport-orders/api/v1.0/transport-orders"
    )
    TIMEOUT_SECONDS = 15

    def __init__(self):
        self.shipping_key = os.getenv(
            "CHILEXPRESS_SHIPPING_KEY",
            "",
        ).strip()
        self.tcc = os.getenv(
            "CHILEXPRESS_TCC",
            "",
        ).strip()
        self.seller_rut = os.getenv(
            "CHILEXPRESS_SELLER_RUT",
            "",
        ).strip()
        shipping_base_url = os.getenv(
            "CHILEXPRESS_SHIPPING_BASE_URL",
            self.DEFAULT_SHIPPING_BASE_URL,
        ).strip().rstrip("/")
        self.shipping_base_url = shipping_base_url
        self.endpoint = (
            f"{shipping_base_url}{self.TRANSPORT_ORDERS_PATH}"
        )

    @staticmethod
    def _summarize(value):
        return " ".join(str(value or "").split())[:300]

    @staticmethod
    def _diagnosis(status_code):
        if status_code == 400:
            return "key_accepted_payload_rejected"
        if status_code == 401:
            return "credential_rejected"
        if status_code == 403:
            return "permission_denied"
        if status_code == 404:
            return "endpoint_not_found"
        if status_code in {200, 201, 202}:
            return "request_accepted_review_response"
        return "provider_or_connection_error"

    @staticmethod
    def _diagnose_provider_message(status_code, message):
        normalized = str(message or "").lower()
        if status_code == 400 and (
            "tarjeta chilexpress" in normalized
            or "customer card" in normalized
            or "customercardnumber" in normalized
            or "tcc" in normalized
        ):
            return "missing_or_invalid_tcc"
        if status_code == 400 and (
            "rut seller" in normalized
            or "sellerrut" in normalized
            or "seller rut" in normalized
        ):
            return "missing_or_invalid_seller_rut"
        return ChilexpressShippingDiagnostic._diagnosis(status_code)

    @staticmethod
    def _numeric_identifier(value):
        digits = "".join(
            character
            for character in str(value or "")
            if character.isdigit()
        )
        return int(digits) if digits else None

    def diagnose(self, allow_request=False):
        configured = bool(self.shipping_key)
        tcc_configured = bool(self.tcc)
        seller_rut_configured = bool(self.seller_rut)
        base_result = {
            "shipping_base_url": self.shipping_base_url,
            "shipping_key_configured": configured,
            "tcc_configured": tcc_configured,
            "seller_rut_configured": seller_rut_configured,
            "endpoint": self.endpoint,
            "request_executed": False,
            "status_code": None,
            "diagnosis": "diagnostic_disabled",
            "message": (
                "Diagnóstico desactivado. "
                "Usa allow_request=True de forma manual."
            ),
        }

        logger.warning(
            "Chilexpress Shipping diagnostic config "
            "shipping_base_url=%s endpoint=%s "
            "shipping_key_configured=%s tcc_configured=%s "
            "seller_rut_configured=%s "
            "request_enabled=%s",
            self.shipping_base_url,
            self.endpoint,
            str(configured).lower(),
            str(tcc_configured).lower(),
            str(seller_rut_configured).lower(),
            str(bool(allow_request)).lower(),
        )

        if not allow_request:
            return base_result

        if not configured:
            return {
                **base_result,
                "diagnosis": "shipping_key_missing",
                "message": "Falta CHILEXPRESS_SHIPPING_KEY.",
            }

        if not tcc_configured:
            return {
                **base_result,
                "diagnosis": "missing_tcc",
                "message": "Falta CHILEXPRESS_TCC.",
            }

        if not seller_rut_configured:
            return {
                **base_result,
                "diagnosis": "missing_seller_rut",
                "message": "Falta CHILEXPRESS_SELLER_RUT.",
            }

        customer_card_number = self._numeric_identifier(self.tcc)
        seller_rut = self._numeric_identifier(self.seller_rut)
        if not customer_card_number:
            return {
                **base_result,
                "diagnosis": "missing_tcc",
                "message": "CHILEXPRESS_TCC debe contener números.",
            }
        if not seller_rut:
            return {
                **base_result,
                "diagnosis": "missing_seller_rut",
                "message": (
                    "CHILEXPRESS_SELLER_RUT debe contener números."
                ),
            }

        # Solo se envían identificadores de cuenta dentro del encabezado.
        # El payload sigue incompleto y no contiene datos para crear una OT.
        diagnostic_payload = {
            "header": {
                "customerCardNumber": customer_card_number,
                "sellerRut": seller_rut,
            }
        }
        try:
            response = requests.post(
                self.endpoint,
                json=diagnostic_payload,
                headers={
                    "Ocp-Apim-Subscription-Key": self.shipping_key,
                    "Cache-Control": "no-cache",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=self.TIMEOUT_SECONDS,
            )
            status_code = response.status_code
            message = self._summarize(response.text)
        except requests.RequestException as error:
            error_response = getattr(error, "response", None)
            status_code = getattr(error_response, "status_code", None)
            message = self._summarize(
                getattr(error_response, "text", "")
                or str(error)
            )

        diagnosis = self._diagnose_provider_message(
            status_code,
            message,
        )
        result = {
            **base_result,
            "request_executed": True,
            "status_code": status_code,
            "diagnosis": diagnosis,
            "message": message or "Proveedor sin mensaje.",
        }
        logger.warning(
            "Chilexpress Shipping diagnostic result "
            "status_code=%s diagnosis=%s message=%s",
            status_code or "connection_error",
            diagnosis,
            result["message"],
        )
        return result
