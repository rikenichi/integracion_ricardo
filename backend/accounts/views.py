from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


def perfil_usuario(usuario):
    es_administrador = usuario.is_staff or usuario.is_superuser
    return {
        'rol': 'ADMINISTRADOR' if es_administrador else 'CLIENTE',
        'datos': {
            'usuario': {
                'id': usuario.id,
                'username': usuario.username,
                'email': usuario.email,
                'first_name': usuario.first_name,
                'last_name': usuario.last_name,
                'is_staff': es_administrador,
            }
        },
    }


class PerfilView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(perfil_usuario(request.user))


class DireccionEntregaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        direccion = str(request.data.get('direccion', '')).strip()
        comuna = request.data.get('comuna')

        if not direccion or not comuna:
            return Response(
                {'detail': 'Direccion y comuna son requeridas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            comuna_id = int(comuna)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'La comuna debe ser valida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'id': (request.user.id * 100000) + comuna_id,
                'direccion': direccion,
                'num_direccion': request.data.get('num_direccion', ''),
                'detalle_direccion': request.data.get('detalle_direccion', ''),
                'comuna': comuna,
                'referencia': request.data.get('referencia', ''),
                'nombre_receptor': request.data.get('nombre_receptor', ''),
                'telefono_receptor': request.data.get('telefono_receptor', ''),
                'es_principal': bool(request.data.get('es_principal', False)),
            },
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get('refresh')
        if not refresh:
            return Response(
                {'detail': 'Refresh token requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            return Response(
                {'detail': 'Refresh token invalido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)
