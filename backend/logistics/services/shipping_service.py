import logging
import os

import requests


logger = logging.getLogger(__name__)

CONTACT_ENV_VARIABLES = (
    "CHILEXPRESS_SENDER_NAME",
    "CHILEXPRESS_SENDER_PHONE",
    "CHILEXPRESS_SENDER_EMAIL",
    "CHILEXPRESS_RECIPIENT_NAME",
    "CHILEXPRESS_RECIPIENT_PHONE",
    "CHILEXPRESS_RECIPIENT_EMAIL",
)


def variables_contacto_chilexpress_faltantes():
    return [
        variable
        for variable in CONTACT_ENV_VARIABLES
        if not os.getenv(variable, "").strip()
    ]


class ChilexpressShippingDiagnostic:
    DEFAULT_SHIPPING_BASE_URL = "https://testservices.wschilexpress.com"
    TRANSPORT_ORDERS_PATH = "/transport-orders/api/v1.0/transport-orders"
    TIMEOUT_SECONDS = 15

    def __init__(self):
        self.shipping_key = self._env("CHILEXPRESS_SHIPPING_KEY")
        self.tcc = self._env("CHILEXPRESS_TCC")
        self.marketplace_rut = self._env("CHILEXPRESS_MARKETPLACE_RUT")
        self.seller_rut = self._env("CHILEXPRESS_SELLER_RUT")
        self.origin_county_code = self._env(
            "CHILEXPRESS_ORIGIN_COUNTY_CODE",
            "PUDA",
        ).upper()
        self.label_type = self._env("CHILEXPRESS_LABEL_TYPE", "2")

        self.destination_county_code = self._env(
            "CHILEXPRESS_DESTINATION_COUNTY_CODE",
            "PROV",
        ).upper()
        self.destination_street = self._env(
            "CHILEXPRESS_DESTINATION_STREET",
            "AVENIDA MANUEL MONTT",
        )
        self.destination_street_number = self._env(
            "CHILEXPRESS_DESTINATION_STREET_NUMBER",
            "427",
        )
        self.destination_commercial_office_id = self._env(
            "CHILEXPRESS_DESTINATION_COMMERCIAL_OFFICE_ID",
            "706",
        )
        self.delivery_on_commercial_office = self._env_bool(
            "CHILEXPRESS_DELIVERY_ON_COMMERCIAL_OFFICE",
            False,
        )

        self.return_county_code = self._env(
            "CHILEXPRESS_RETURN_COUNTY_CODE",
            "PLCA",
        ).upper()
        self.return_street = self._env(
            "CHILEXPRESS_RETURN_STREET",
            "SARMIENTO",
        )
        self.return_street_number = self._env(
            "CHILEXPRESS_RETURN_STREET_NUMBER",
            "120",
        )

        self.sender_name = self._env("CHILEXPRESS_SENDER_NAME")
        self.sender_phone = self._env("CHILEXPRESS_SENDER_PHONE")
        self.sender_email = self._env("CHILEXPRESS_SENDER_EMAIL")
        self.recipient_name = self._env("CHILEXPRESS_RECIPIENT_NAME")
        self.recipient_phone = self._env("CHILEXPRESS_RECIPIENT_PHONE")
        self.recipient_email = self._env("CHILEXPRESS_RECIPIENT_EMAIL")

        self.default_weight_kg = self._env(
            "CHILEXPRESS_DEFAULT_WEIGHT_KG",
            "1",
        )
        self.default_height_cm = self._env(
            "CHILEXPRESS_DEFAULT_HEIGHT_CM",
            "1",
        )
        self.default_width_cm = self._env(
            "CHILEXPRESS_DEFAULT_WIDTH_CM",
            "1",
        )
        self.default_length_cm = self._env(
            "CHILEXPRESS_DEFAULT_LENGTH_CM",
            "1",
        )
        self.service_delivery_code = self._env(
            "CHILEXPRESS_SERVICE_DELIVERY_CODE",
            "3",
        )
        self.product_code = self._env(
            "CHILEXPRESS_PRODUCT_CODE",
            "3",
        )
        self.delivery_reference = self._env(
            "CHILEXPRESS_DELIVERY_REFERENCE",
            "TEST-EOC-17",
        )
        self.group_reference = self._env(
            "CHILEXPRESS_GROUP_REFERENCE",
            "GRUPO",
        )
        self.declared_worth = self._env(
            "CHILEXPRESS_DECLARED_WORTH",
            "1000",
        )
        self.declared_content = self._env(
            "CHILEXPRESS_DECLARED_CONTENT",
            "1",
        )
        self.receivable_amount = self._env(
            "CHILEXPRESS_RECEIVABLE_AMOUNT",
            "1000",
        )
        self.timeout_seconds = max(
            1,
            self._positive_int(
                self._env(
                    "CHILEXPRESS_TIMEOUT_SECONDS",
                    str(self.TIMEOUT_SECONDS),
                ),
                self.TIMEOUT_SECONDS,
            ),
        )

        shipping_base_url = self._env(
            "CHILEXPRESS_SHIPPING_BASE_URL",
            self.DEFAULT_SHIPPING_BASE_URL,
        ).rstrip("/")
        self.shipping_base_url = shipping_base_url
        self.endpoint = f"{shipping_base_url}{self.TRANSPORT_ORDERS_PATH}"

    @staticmethod
    def _env(name, default=""):
        return os.getenv(name, default).strip()

    @staticmethod
    def _env_bool(name, default=False):
        value = os.getenv(name)
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _positive_int(value, default):
        try:
            number = int(value)
        except (TypeError, ValueError):
            return default
        return number if number >= 0 else default

    @staticmethod
    def _numeric_string(value, default):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return str(default)
        if number <= 0:
            return str(default)
        return format(number, "g")

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
    def _safe_detail(detail):
        if not isinstance(detail, dict):
            return {
                "transportOrderNumber": None,
                "reference": None,
                "productDescription": None,
                "serviceDescription": None,
                "statusCode": None,
                "statusDescription": None,
                "errors": [],
            }

        errors = detail.get("errors") or detail.get("Errors") or []
        if not isinstance(errors, list):
            errors = [errors]
        return {
            "transportOrderNumber": (
                detail.get("transportOrderNumber")
                or detail.get("TransportOrderNumber")
            ),
            "reference": (
                detail.get("reference")
                or detail.get("Reference")
            ),
            "productDescription": (
                detail.get("productDescription")
                or detail.get("ProductDescription")
            ),
            "serviceDescription": (
                detail.get("serviceDescription")
                or detail.get("ServiceDescription")
            ),
            "statusCode": (
                detail.get("statusCode")
                if "statusCode" in detail
                else detail.get("StatusCode")
            ),
            "statusDescription": (
                detail.get("statusDescription")
                or detail.get("StatusDescription")
            ),
            "errors": errors,
        }

    @classmethod
    def _provider_fields(cls, response):
        try:
            data = response.json()
        except (ValueError, AttributeError):
            message = cls._summarize(getattr(response, "text", ""))
            return {
                "statusCode": None,
                "statusDescription": None,
                "errors": [],
                "data": {
                    "header": {"certificateNumber": None},
                    "details": [],
                },
            }, message

        if not isinstance(data, dict):
            message = cls._summarize(data)
            return {
                "statusCode": None,
                "statusDescription": None,
                "errors": [],
                "data": {
                    "header": {"certificateNumber": None},
                    "details": [],
                },
            }, message

        root_status_code = (
            data.get("statusCode")
            if "statusCode" in data
            else data.get("StatusCode")
        )
        status_description = (
            data.get("statusDescription")
            or data.get("StatusDescription")
            or data.get("message")
            or data.get("Message")
        )
        errors = data.get("errors") or data.get("Errors") or []
        if not isinstance(errors, list):
            errors = [errors]

        provider_data = data.get("data") or data.get("Data") or {}
        if not isinstance(provider_data, dict):
            provider_data = {}
        header = provider_data.get("header") or provider_data.get("Header") or {}
        if not isinstance(header, dict):
            header = {}

        raw_details = (
            provider_data.get("details")
            or provider_data.get("Details")
            or provider_data.get("detail")
            or provider_data.get("Detail")
            or []
        )
        if isinstance(raw_details, dict):
            raw_details = [raw_details]
        elif not isinstance(raw_details, list):
            raw_details = []

        safe_response = {
            "statusCode": root_status_code,
            "statusDescription": status_description,
            "errors": errors,
            "data": {
                "header": {
                    "certificateNumber": (
                        header.get("certificateNumber")
                        if "certificateNumber" in header
                        else header.get("CertificateNumber")
                    )
                },
                "details": [
                    cls._safe_detail(detail)
                    for detail in raw_details
                ],
            },
        }
        message = cls._summarize(
            status_description
            or errors
            or safe_response["data"]["details"]
            or data
        )
        return safe_response, message

    @staticmethod
    def _response_diagnosis(http_status_code, provider_response):
        if http_status_code not in {200, 201, 202}:
            return ChilexpressShippingDiagnostic._diagnosis(
                http_status_code
            )

        details = provider_response.get("data", {}).get("details", [])
        if any(
            detail.get("transportOrderNumber")
            not in {None, "", 0, "0"}
            for detail in details
        ):
            return "transport_order_created"

        if details and any(
            detail.get("errors")
            or detail.get("statusCode") not in {None, "", 0, "0"}
            or bool(detail.get("statusDescription"))
            for detail in details
        ):
            return "payload_detail_rejected"

        return "http_accepted_no_detail_success"

    def _configuration(self):
        addresses_configured = all(
            (
                self.destination_county_code,
                self.destination_street,
                self.destination_street_number,
                self.return_county_code,
                self.return_street,
                self.return_street_number,
            )
        )
        if self.delivery_on_commercial_office:
            addresses_configured = (
                addresses_configured
                and bool(self.destination_commercial_office_id)
            )

        contacts_configured = all(
            (
                self.sender_name,
                self.sender_phone,
                self.sender_email,
                self.recipient_name,
                self.recipient_phone,
                self.recipient_email,
            )
        )
        packages_configured = all(
            (
                self.default_weight_kg,
                self.default_height_cm,
                self.default_width_cm,
                self.default_length_cm,
                self.service_delivery_code,
                self.product_code,
                self.delivery_reference,
                self.group_reference,
                self.declared_worth,
                self.declared_content,
                self.receivable_amount,
            )
        )
        return {
            "shipping_key_configured": bool(self.shipping_key),
            "tcc_configured": bool(self.tcc),
            "marketplace_rut_configured": bool(self.marketplace_rut),
            "seller_rut_configured": bool(self.seller_rut),
            "addresses_configured": bool(addresses_configured),
            "contacts_configured": bool(contacts_configured),
            "packages_configured": bool(packages_configured),
        }

    def _payload(self):
        destination_address = {
            "addressId": 0,
            "countyCoverageCode": str(
                self.destination_county_code
            ),
            "streetName": self.destination_street,
            "streetNumber": str(
                self.destination_street_number
            ),
            "supplement": "",
            "addressType": "DEST",
            "deliveryOnCommercialOffice": (
                self.delivery_on_commercial_office
            ),
        }
        if self.delivery_on_commercial_office:
            destination_address["commercialOfficeId"] = (
                self._positive_int(
                    self.destination_commercial_office_id,
                    0,
                )
            )

        return {
            "header": {
                "certificateNumber": 0,
                "customerCardNumber": str(self.tcc),
                "countyOfOriginCoverageCode": str(
                    self.origin_county_code
                ),
                "labelType": self._positive_int(self.label_type, 2),
                "marketplaceRut": str(self.marketplace_rut),
                "sellerRut": str(self.seller_rut),
            },
            "details": [
                {
                    "addresses": [
                        destination_address,
                        {
                            "addressId": 1,
                            "countyCoverageCode": str(
                                self.return_county_code
                            ),
                            "streetName": self.return_street,
                            "streetNumber": str(
                                self.return_street_number
                            ),
                            "supplement": "",
                            "addressType": "DEV",
                            "deliveryOnCommercialOffice": False,
                            "commercialOfficeId": 0,
                        },
                    ],
                    "contacts": [
                        {
                            "name": self.sender_name,
                            "phoneNumber": str(self.sender_phone),
                            "mail": self.sender_email,
                            "contactType": "R",
                        },
                        {
                            "name": self.recipient_name,
                            "phoneNumber": str(self.recipient_phone),
                            "mail": self.recipient_email,
                            "contactType": "D",
                        },
                    ],
                    "packages": [
                        {
                            "weight": self._numeric_string(
                                self.default_weight_kg,
                                1,
                            ),
                            "height": self._numeric_string(
                                self.default_height_cm,
                                1,
                            ),
                            "width": self._numeric_string(
                                self.default_width_cm,
                                1,
                            ),
                            "length": self._numeric_string(
                                self.default_length_cm,
                                1,
                            ),
                            "serviceDeliveryCode": str(
                                self.service_delivery_code
                            ),
                            "productCode": str(self.product_code),
                            "deliveryReference": str(
                                self.delivery_reference
                            ),
                            "groupReference": str(
                                self.group_reference
                            ),
                            "declaredValue": str(self.declared_worth),
                            "declaredContent": str(
                                self.declared_content
                            ),
                            "receivableAmountInDelivery": (
                                self._positive_int(
                                    self.receivable_amount,
                                    0,
                                )
                            ),
                        }
                    ],
                }
            ],
        }

    def diagnose(self, allow_request=False, payload=None):
        configuration = self._configuration()
        base_result = {
            "shipping_base_url": self.shipping_base_url,
            **configuration,
            "endpoint": self.endpoint,
            "request_executed": False,
            "status_code": None,
            "statusCode": None,
            "statusDescription": None,
            "errors": [],
            "provider_response": {
                "statusCode": None,
                "statusDescription": None,
                "errors": [],
                "data": {
                    "header": {"certificateNumber": None},
                    "details": [],
                },
            },
            "diagnosis": "diagnostic_disabled",
            "message": (
                "Diagnostico desactivado. "
                "Usa allow_request=True de forma manual."
            ),
        }

        logger.warning(
            "Chilexpress Shipping diagnostic config "
            "shipping_key_configured=%s "
            "tcc_configured=%s "
            "marketplace_rut_configured=%s "
            "seller_rut_configured=%s "
            "addresses_configured=%s "
            "contacts_configured=%s "
            "packages_configured=%s",
            str(configuration["shipping_key_configured"]).lower(),
            str(configuration["tcc_configured"]).lower(),
            str(configuration["marketplace_rut_configured"]).lower(),
            str(configuration["seller_rut_configured"]).lower(),
            str(configuration["addresses_configured"]).lower(),
            str(configuration["contacts_configured"]).lower(),
            str(configuration["packages_configured"]).lower(),
        )

        if not allow_request:
            return base_result

        required_groups = {
            "shipping_key_configured": (
                "shipping_key_missing",
                "Falta CHILEXPRESS_SHIPPING_KEY.",
            ),
            "tcc_configured": (
                "missing_tcc",
                "Falta CHILEXPRESS_TCC.",
            ),
            "marketplace_rut_configured": (
                "missing_marketplace_rut",
                "Falta CHILEXPRESS_MARKETPLACE_RUT.",
            ),
            "seller_rut_configured": (
                "missing_seller_rut",
                "Falta CHILEXPRESS_SELLER_RUT.",
            ),
            "addresses_configured": (
                "missing_addresses",
                "Faltan variables para construir addresses.",
            ),
            "contacts_configured": (
                "missing_contacts",
                "Faltan variables para construir contacts.",
            ),
            "packages_configured": (
                "missing_packages",
                "Faltan variables para construir packages.",
            ),
        }
        for flag, (diagnosis, message) in required_groups.items():
            if not configuration[flag]:
                return {
                    **base_result,
                    "diagnosis": diagnosis,
                    "message": message,
                }

        forced_diagnosis = None
        try:
            response = requests.post(
                self.endpoint,
                json=payload if isinstance(payload, dict) else self._payload(),
                headers={
                    "Ocp-Apim-Subscription-Key": self.shipping_key,
                    "Cache-Control": "no-cache",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=self.timeout_seconds,
            )
            status_code = response.status_code
            provider_response, message = self._provider_fields(
                response
            )
        except requests.Timeout as error:
            status_code = None
            provider_response = base_result["provider_response"]
            message = self._summarize(str(error))
            forced_diagnosis = "provider_timeout"
        except requests.RequestException as error:
            error_response = getattr(error, "response", None)
            status_code = getattr(error_response, "status_code", None)
            if error_response is not None:
                provider_response, message = (
                    self._provider_fields(error_response)
                )
            else:
                provider_response = base_result["provider_response"]
                message = self._summarize(str(error))

        diagnosis = forced_diagnosis or self._response_diagnosis(
            status_code,
            provider_response,
        )
        result = {
            **base_result,
            "request_executed": True,
            "status_code": status_code,
            "statusCode": provider_response["statusCode"],
            "statusDescription": provider_response["statusDescription"],
            "errors": provider_response["errors"],
            "provider_response": provider_response,
            "diagnosis": diagnosis,
            "message": message or "Proveedor sin mensaje.",
        }
        logger.warning(
            "Chilexpress Shipping diagnostic result "
            "status_code=%s diagnosis=%s status_description=%s "
            "errors_count=%s",
            status_code or "connection_error",
            diagnosis,
            self._summarize(provider_response["statusDescription"]),
            len(provider_response["errors"]),
        )
        for index, detail in enumerate(
            provider_response["data"]["details"],
            start=1,
        ):
            logger.warning(
                "Chilexpress Shipping diagnostic detail "
                "index=%s transport_order_number=%s reference=%s "
                "product_description=%s service_description=%s "
                "status_code=%s status_description=%s errors_count=%s",
                index,
                detail["transportOrderNumber"],
                self._summarize(detail["reference"]),
                self._summarize(detail["productDescription"]),
                self._summarize(detail["serviceDescription"]),
                detail["statusCode"],
                self._summarize(detail["statusDescription"]),
                len(detail["errors"]),
            )
        return result


def _existing_transport_order_number(source):
    if source is None:
        return None

    if isinstance(source, dict):
        for key in ("transport_order_number", "transportOrderNumber"):
            value = source.get(key)
            if value not in {None, "", 0, "0"}:
                return value
        for key in ("despacho", "envio"):
            value = _existing_transport_order_number(source.get(key))
            if value is not None:
                return value
        return None

    for attribute in ("transport_order_number", "transportOrderNumber"):
        value = getattr(source, attribute, None)
        if value not in {None, "", 0, "0"}:
            return value

    despacho = getattr(source, "despacho", None)
    value = _existing_transport_order_number(despacho)
    if value is not None:
        return value

    try:
        envio = getattr(source, "envio", None)
    except Exception:
        envio = None
    return _existing_transport_order_number(envio)


def _resolve_shipping_payload(service, payload_or_pedido):
    if isinstance(payload_or_pedido, dict):
        if "header" in payload_or_pedido and "details" in payload_or_pedido:
            return payload_or_pedido
        nested_payload = payload_or_pedido.get("chilexpress_payload")
        if isinstance(nested_payload, dict):
            return nested_payload

    nested_payload = getattr(
        payload_or_pedido,
        "chilexpress_payload",
        None,
    )
    if isinstance(nested_payload, dict):
        return nested_payload

    return service._payload()


def _normalized_shipping_result(
    *,
    success=False,
    transport_order_number=None,
    certificate_number=None,
    reference=None,
    service_description=None,
    status_code=None,
    status_description=None,
    provider_response=None,
    mode="disabled",
):
    return {
        "success": bool(success),
        "transport_order_number": transport_order_number,
        "certificate_number": certificate_number,
        "reference": reference,
        "service_description": service_description,
        "status_code": status_code,
        "status_description": status_description,
        "provider_response": provider_response or {},
        "mode": mode,
    }


def crear_orden_transporte_chilexpress(
    payload_or_pedido,
    allow_request=False,
):
    existing_number = _existing_transport_order_number(payload_or_pedido)
    if existing_number is not None:
        logger.warning(
            "Chilexpress Shipping create skipped "
            "reason=transport_order_already_exists"
        )
        return _normalized_shipping_result(
            success=True,
            transport_order_number=existing_number,
            status_description="La orden de transporte ya existe.",
            mode="existing",
        )

    if not allow_request:
        logger.warning(
            "Chilexpress Shipping create disabled allow_request=false"
        )
        return _normalized_shipping_result(
            status_description=(
                "Creacion desactivada. Usa allow_request=True "
                "solo de forma manual."
            ),
            mode="disabled",
        )

    service = ChilexpressShippingDiagnostic()
    payload = _resolve_shipping_payload(service, payload_or_pedido)
    diagnostic_result = service.diagnose(
        allow_request=True,
        payload=payload,
    )
    provider_response = diagnostic_result.get("provider_response") or {}
    provider_data = provider_response.get("data") or {}
    header = provider_data.get("header") or {}
    details = provider_data.get("details") or []
    successful_detail = next(
        (
            detail
            for detail in details
            if detail.get("transportOrderNumber")
            not in {None, "", 0, "0"}
        ),
        None,
    )
    selected_detail = successful_detail or (details[0] if details else {})
    success = successful_detail is not None

    result = _normalized_shipping_result(
        success=success,
        transport_order_number=selected_detail.get(
            "transportOrderNumber"
        ),
        certificate_number=header.get("certificateNumber"),
        reference=selected_detail.get("reference"),
        service_description=selected_detail.get("serviceDescription"),
        status_code=(
            selected_detail.get("statusCode")
            if selected_detail
            else provider_response.get("statusCode")
        ),
        status_description=(
            selected_detail.get("statusDescription")
            or provider_response.get("statusDescription")
            or diagnostic_result.get("message")
        ),
        provider_response=provider_response,
        mode="real",
    )
    logger.warning(
        "Chilexpress Shipping create result "
        "success=%s mode=%s status_code=%s "
        "transport_order_created=%s",
        str(result["success"]).lower(),
        result["mode"],
        result["status_code"],
        str(bool(result["transport_order_number"])).lower(),
    )
    return result


def generar_ot_para_pedido(pedido, allow_request=False):
    existing_number = _existing_transport_order_number(pedido)
    if existing_number is not None:
        logger.warning(
            "Chilexpress OT persistence skipped "
            "reason=transport_order_already_exists"
        )
        return _normalized_shipping_result(
            success=True,
            transport_order_number=existing_number,
            status_description="La orden de transporte ya existe.",
            mode="existing",
        )

    if not allow_request:
        auto_creation_enabled = ChilexpressShippingDiagnostic._env_bool(
            "CHILEXPRESS_CREATE_OT_ON_PAYMENT",
            False,
        )
        logger.warning(
            "Chilexpress OT persistence disabled "
            "allow_request=false automatic_setting=%s",
            str(auto_creation_enabled).lower(),
        )
        return _normalized_shipping_result(
            status_description=(
                "Creacion de OT desactivada. "
                "Se requiere allow_request=True."
            ),
            mode="disabled",
        )

    if not getattr(pedido, "pk", None):
        return _normalized_shipping_result(
            status_description="El pedido debe estar persistido.",
            mode="invalid",
        )

    from django.db import transaction
    from django.utils import timezone

    from accounts.models import EnvioPedido, Pedido

    with transaction.atomic():
        pedido_bloqueado = Pedido.objects.select_for_update().get(
            pk=pedido.pk
        )
        envio, _ = EnvioPedido.objects.get_or_create(
            pedido=pedido_bloqueado,
            defaults={
                "numero_tracking": f"MED-{pedido_bloqueado.pk:06d}",
            },
        )

        if envio.transport_order_number:
            logger.warning(
                "Chilexpress OT persistence skipped "
                "reason=transport_order_already_exists"
            )
            return _normalized_shipping_result(
                success=True,
                transport_order_number=envio.transport_order_number,
                certificate_number=envio.certificate_number or None,
                reference=envio.chilexpress_reference or None,
                status_description=envio.ot_status or None,
                provider_response=envio.provider_response,
                mode="existing",
            )

        missing_contact_variables = (
            variables_contacto_chilexpress_faltantes()
        )
        if missing_contact_variables:
            status_description = (
                "Faltan variables: "
                + ", ".join(missing_contact_variables)
            )
            envio.ot_status = status_description
            envio.save(update_fields=["ot_status", "actualizado_en"])
            logger.warning(
                "Chilexpress OT persistence blocked "
                "reason=missing_contact_variables count=%s",
                len(missing_contact_variables),
            )
            return _normalized_shipping_result(
                status_description=status_description,
                provider_response=envio.provider_response,
                mode="configuration_error",
            )

        result = crear_orden_transporte_chilexpress(
            pedido_bloqueado,
            allow_request=True,
        )
        envio.provider_response = result["provider_response"]
        envio.ot_status = result["status_description"] or ""

        if result["success"] and result["transport_order_number"]:
            envio.courier = "Chilexpress"
            envio.transport_order_number = str(
                result["transport_order_number"]
            )
            envio.certificate_number = str(
                result["certificate_number"] or ""
            )
            envio.chilexpress_reference = result["reference"] or ""
            envio.ot_created_at = timezone.now()

        envio.save(
            update_fields=[
                "courier",
                "transport_order_number",
                "certificate_number",
                "chilexpress_reference",
                "provider_response",
                "ot_status",
                "ot_created_at",
                "actualizado_en",
            ]
        )

    logger.warning(
        "Chilexpress OT persistence result "
        "success=%s mode=%s transport_order_saved=%s",
        str(result["success"]).lower(),
        result["mode"],
        str(bool(result["transport_order_number"])).lower(),
    )
    return result
