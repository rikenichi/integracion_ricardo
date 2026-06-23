from django.conf import settings
from django.db import models


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
