import logging
import os

import requests


logger = logging.getLogger(__name__)


class ChilexpressShippingDiagnostic:
    DEFAULT_SHIPPING_BASE_URL = (
        "https://testservices.wschilexpress.com/"
        "transport-orders/api/v1.0"
    )
    TIMEOUT_SECONDS = 15

    def __init__(self):
        self.shipping_key = os.getenv(
            "CHILEXPRESS_SHIPPING_KEY",
            "",
        ).strip()
        shipping_base_url = os.getenv(
            "CHILEXPRESS_SHIPPING_BASE_URL",
            self.DEFAULT_SHIPPING_BASE_URL,
        ).strip().rstrip("/")
        self.shipping_base_url = shipping_base_url
        self.endpoint = (
            shipping_base_url
            if shipping_base_url.endswith("/transport-orders")
            else f"{shipping_base_url}/transport-orders"
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

    def diagnose(self, allow_request=False):
        configured = bool(self.shipping_key)
        base_result = {
            "shipping_base_url": self.shipping_base_url,
            "shipping_key_configured": configured,
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
            "shipping_key_configured=%s request_enabled=%s",
            self.shipping_base_url,
            self.endpoint,
            str(configured).lower(),
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

        # Un objeto vacío es deliberadamente inválido: permite comprobar
        # endpoint y permisos sin incluir datos suficientes para crear una OT.
        try:
            response = requests.post(
                self.endpoint,
                json={},
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

        diagnosis = self._diagnosis(status_code)
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
