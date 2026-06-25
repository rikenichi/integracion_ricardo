from django.core.management.base import BaseCommand, CommandError

from accounts.models import EnvioPedido, Pedido
from logistics.services.shipping_service import generar_ot_para_pedido


class Command(BaseCommand):
    help = (
        'Genera manualmente una OT Chilexpress para un pedido confirmado. '
        'Sin --confirmar solo realiza validaciones.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--pedido-id',
            type=int,
            required=True,
            help='ID del pedido confirmado.',
        )
        parser.add_argument(
            '--confirmar',
            action='store_true',
            help='Autoriza una unica solicitud real a Chilexpress.',
        )

    def handle(self, *args, **options):
        pedido_id = options['pedido_id']
        confirmar = options['confirmar']

        try:
            pedido = Pedido.objects.get(pk=pedido_id)
        except Pedido.DoesNotExist as error:
            raise CommandError(
                f'Pedido #{pedido_id} no existe.'
            ) from error

        if pedido.estado != 'CONFIRMADO':
            raise CommandError(
                f'Pedido #{pedido_id} no esta pagado/confirmado '
                f'(estado actual: {pedido.estado}).'
            )

        try:
            envio = EnvioPedido.objects.get(pedido=pedido)
        except EnvioPedido.DoesNotExist as error:
            raise CommandError(
                f'Pedido #{pedido_id} no tiene EnvioPedido persistido.'
            ) from error

        if envio.transport_order_number:
            self._show_result(
                {
                    'success': True,
                    'mode': 'existing',
                    'transport_order_number': (
                        envio.transport_order_number
                    ),
                    'certificate_number': (
                        envio.certificate_number or None
                    ),
                    'status_description': (
                        envio.ot_status
                        or 'La orden de transporte ya existe.'
                    ),
                }
            )
            return

        if not confirmar:
            self.stdout.write(
                self.style.WARNING(
                    'DRY-RUN: pedido y envio validos. '
                    'No se llamo a Chilexpress.'
                )
            )
            self._show_result(
                {
                    'success': False,
                    'mode': 'disabled',
                    'transport_order_number': None,
                    'certificate_number': None,
                    'status_description': (
                        'Listo para ejecutar con --confirmar.'
                    ),
                }
            )
            return

        result = generar_ot_para_pedido(
            pedido,
            allow_request=True,
        )
        self._show_result(result)
        if not result['success']:
            raise CommandError(
                'Chilexpress no genero una orden de transporte valida.'
            )

    def _show_result(self, result):
        fields = (
            'success',
            'mode',
            'transport_order_number',
            'certificate_number',
            'status_description',
        )
        for field in fields:
            self.stdout.write(f'{field}: {result.get(field)}')
