from django.conf import settings
from django.db import models


class PerfilCliente(models.Model):
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil_cliente',
    )
    rut = models.CharField(max_length=20, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    tipo_cliente = models.CharField(max_length=20, default='PARTICULAR')
    datos_institucion = models.JSONField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Perfil de {self.usuario.username}'


class DireccionEntrega(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='direcciones_entrega',
    )
    direccion = models.CharField(max_length=180)
    num_direccion = models.CharField(max_length=30, blank=True)
    detalle_direccion = models.CharField(max_length=120, blank=True)
    comuna = models.CharField(max_length=30)
    referencia = models.CharField(max_length=180, blank=True)
    nombre_receptor = models.CharField(max_length=120, blank=True)
    telefono_receptor = models.CharField(max_length=30, blank=True)
    es_principal = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.direccion} - {self.usuario.username}'


class Pedido(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='pedidos',
    )
    estado = models.CharField(max_length=30, default='PENDIENTE_PAGO')
    subtotal = models.PositiveBigIntegerField(default=0)
    total = models.PositiveBigIntegerField(default=0)
    detalles = models.JSONField(default=list)
    pago = models.JSONField(default=dict)
    despacho = models.JSONField(default=dict)
    datos = models.JSONField(default=dict)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Pedido #{self.id} - {self.usuario.username}'


class EnvioPedido(models.Model):
    pedido = models.OneToOneField(
        Pedido,
        on_delete=models.CASCADE,
        related_name='envio',
    )
    numero_tracking = models.CharField(max_length=40, unique=True)
    courier = models.CharField(max_length=80, default='Medistock despacho controlado')
    transport_order_number = models.CharField(
        max_length=60,
        unique=True,
        null=True,
        blank=True,
    )
    certificate_number = models.CharField(max_length=60, blank=True)
    chilexpress_reference = models.CharField(max_length=120, blank=True)
    provider_response = models.JSONField(default=dict, blank=True)
    ot_status = models.CharField(max_length=500, blank=True)
    ot_created_at = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=30, default='generado')
    estado_label = models.CharField(max_length=60, default='Generado')
    direccion_destino = models.CharField(max_length=255, blank=True)
    eventos = models.JSONField(default=list)
    fecha_estimada_entrega = models.DateField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.numero_tracking} - Pedido #{self.pedido_id}'


class PerfilTrabajador(models.Model):
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil_trabajador',
    )
    rut = models.CharField(max_length=20, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    cargo = models.CharField(max_length=80, blank=True)
    area = models.CharField(max_length=80, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Perfil trabajador de {self.usuario.username}'


class DocumentoTributario(models.Model):
    TIPO_BOLETA = 'BOLETA'
    TIPO_FACTURA = 'FACTURA'
    TIPOS_DOCUMENTO = (
        (TIPO_BOLETA, 'Boleta'),
        (TIPO_FACTURA, 'Factura'),
    )

    PROVEEDOR_MOCK = 'MOCK'
    PROVEEDOR_LIBREDTE = 'LIBREDTE'
    PROVEEDORES = (
        (PROVEEDOR_MOCK, 'Mock'),
        (PROVEEDOR_LIBREDTE, 'LibreDTE'),
    )

    ESTADO_PENDIENTE = 'PENDIENTE'
    ESTADO_EMITIDO = 'EMITIDO'
    ESTADO_ERROR = 'ERROR'
    ESTADOS = (
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_EMITIDO, 'Emitido'),
        (ESTADO_ERROR, 'Error'),
    )

    pedido = models.OneToOneField(
        Pedido,
        on_delete=models.CASCADE,
        related_name='documento_tributario',
    )
    tipo_documento = models.CharField(
        max_length=10,
        choices=TIPOS_DOCUMENTO,
        default=TIPO_BOLETA,
    )
    proveedor = models.CharField(
        max_length=10,
        choices=PROVEEDORES,
        default=PROVEEDOR_MOCK,
    )
    folio = models.CharField(max_length=60, unique=True)
    estado = models.CharField(
        max_length=12,
        choices=ESTADOS,
        default=ESTADO_PENDIENTE,
    )
    monto_total = models.PositiveBigIntegerField(default=0)
    fecha_emision = models.DateTimeField(null=True, blank=True)
    url_pdf = models.URLField(blank=True)
    provider_response = models.JSONField(default=dict, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def __str__(self):
        return (
            f'{self.tipo_documento} {self.folio} '
            f'- Pedido #{self.pedido_id}'
        )
