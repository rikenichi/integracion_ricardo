class MockShippingService:
    PRICE = 3990
    SERVICE_CODE = "CHX_STANDARD"
    SERVICE_NAME = "Despacho estándar"
    DELIVERY_TERM = "1 a 3 días hábiles"

    @classmethod
    def quote(cls, mode="mock"):
        return cls.format_response(
            courier="Chilexpress",
            service=cls.SERVICE_NAME,
            price=cls.PRICE,
            delivery_term=cls.DELIVERY_TERM,
            service_code=cls.SERVICE_CODE,
            mode=mode,
        )

    @staticmethod
    def format_response(
        *,
        courier,
        service,
        price,
        delivery_term,
        service_code,
        mode,
    ):
        price = int(round(float(price)))
        response = {
            "courier": courier,
            "servicio": service,
            "precio": price,
            "plazo_entrega": delivery_term,
            "codigo_servicio": service_code,
            "modo": mode,
        }

        # Compatibilidad con ConfirmacionPedidoPage.
        response["servicios_disponibles"] = [
            {
                "serviceTypeCode": service_code,
                "serviceDescription": service,
                "serviceValue": price,
                "deliveryType": 1,
            }
        ]
        return response
