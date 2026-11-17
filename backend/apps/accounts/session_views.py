from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .sessions import SessionStorageUnavailable, session_for_token
from .throttles import RefreshRateThrottle


class RefreshInput(serializers.Serializer):
    refresh = serializers.CharField(trim_whitespace=False)


class SessionRefreshView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (RefreshRateThrottle,)
    logout = False

    def get_authenticate_header(self, request):
        return 'Bearer realm="api"'

    def post(self, request):
        serializer = RefreshInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
        except TokenError as error:
            raise InvalidToken() from error
        try:
            with transaction.atomic():
                session = session_for_token(token, lock=True, allow_revoked=self.logout)
                token.check_exp()
                if self.logout:
                    if session.revoked_at is None:
                        session.revoked_at = timezone.now()
                        session.save(update_fields=["revoked_at"])
                    result = None
                else:
                    result = {"access": str(token.access_token)}
        except TokenError as error:
            raise InvalidToken() from error
        except DatabaseError as error:
            raise SessionStorageUnavailable() from error
        return Response(
            result, status=status.HTTP_204_NO_CONTENT if self.logout else status.HTTP_200_OK
        )


class LogoutView(SessionRefreshView):
    logout = True
