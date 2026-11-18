"""Durable JWT session issuance and validation."""

import uuid
from datetime import UTC, datetime

from django.core.exceptions import ValidationError
from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AuthSession, User


class SessionStorageUnavailable(APIException):
    status_code = 503
    default_detail = "Session service unavailable."
    default_code = "session_unavailable"


def issue_session(user):
    try:
        with transaction.atomic():
            token = RefreshToken.for_user(user)
            session = AuthSession.objects.create(
                user=user, expires_at=datetime.fromtimestamp(token["exp"], tz=UTC)
            )
            token["sid"] = str(session.pk)
            return token
    except DatabaseError as error:
        raise SessionStorageUnavailable() from error


def session_for_token(token, *, lock=False, allow_revoked=False):
    try:
        sid = uuid.UUID(str(token["sid"]))
        user_id = token[api_settings.USER_ID_CLAIM]
    except (KeyError, ValueError, TypeError, AttributeError):
        raise AuthenticationFailed("Invalid session.")
    try:
        query = AuthSession.objects.select_related("user")
        if lock:
            query = query.select_for_update(of=("self",))
        session = query.filter(pk=sid, user_id=user_id).first()
        if (
            session is None
            or not session.user.is_active
            or session.expires_at <= timezone.now()
            or (session.revoked_at is not None and not allow_revoked)
        ):
            raise AuthenticationFailed("Invalid session.")
        return session
    except (ValueError, TypeError, ValidationError, User.DoesNotExist):
        raise AuthenticationFailed("Invalid session.")
    except DatabaseError as error:
        raise SessionStorageUnavailable() from error


class SessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user = super().get_user(validated_token)
            session_for_token(validated_token)
            return user
        except DatabaseError as error:
            raise SessionStorageUnavailable() from error
