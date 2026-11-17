from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event
from unittest.mock import patch

from django.core.cache import cache
from django.db import DatabaseError, close_old_connections, connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AuthSession, User


class SessionSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email="session@example.com", password="Strong-pass-123"
        )
        self.client = APIClient()

    def login(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.user.email, "password": "Strong-pass-123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return response.data

    def access(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/candidates/me/profile/")
        self.client.credentials()
        return response.status_code

    def test_revocation_and_independent_sessions(self):
        first, second = self.login(), self.login()
        self.assertEqual(self.access(first["access"]), 404)
        self.assertEqual(
            self.client.post("/api/v1/auth/logout/", {"refresh": first["refresh"]}).status_code, 204
        )
        self.assertEqual(
            self.client.post("/api/v1/auth/logout/", {"refresh": first["refresh"]}).status_code, 204
        )
        self.assertEqual(self.access(first["access"]), 401)
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/token/refresh/", {"refresh": first["refresh"]}
            ).status_code,
            401,
        )
        self.assertEqual(self.access(second["access"]), 404)

    def test_legacy_and_disabled_rejected(self):
        legacy = RefreshToken.for_user(self.user)
        self.assertEqual(self.access(str(legacy.access_token)), 401)
        self.assertEqual(
            self.client.post("/api/v1/auth/token/refresh/", {"refresh": str(legacy)}).status_code,
            401,
        )
        tokens = self.login()
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self.access(tokens["access"]), 401)
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/token/refresh/", {"refresh": tokens["refresh"]}
            ).status_code,
            401,
        )

    def test_storage_failure_closed(self):
        tokens = self.login()
        with patch(
            "apps.accounts.sessions.AuthSession.objects.select_related", side_effect=DatabaseError
        ):
            self.assertEqual(self.access(tokens["access"]), 503)

    def test_expired_session_and_ownership_are_rejected(self):
        from .sessions import issue_session

        token = issue_session(self.user)
        sid = token["sid"]
        other = User.objects.create_user(email="other@example.com", password="Strong-pass-123")
        forged = RefreshToken.for_user(other)
        forged["sid"] = sid
        self.assertEqual(self.access(str(forged.access_token)), 401)
        self.assertEqual(
            self.client.post("/api/v1/auth/token/refresh/", {"refresh": str(forged)}).status_code,
            401,
        )
        AuthSession.objects.filter(pk=sid).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.access(str(token.access_token)), 401)
        self.assertEqual(
            self.client.post("/api/v1/auth/logout/", {"refresh": str(token)}).status_code, 401
        )

    def test_storage_failure_cannot_issue_refresh_or_confirm_logout(self):
        tokens = self.login()
        with patch(
            "apps.accounts.sessions.AuthSession.objects.select_related", side_effect=DatabaseError
        ):
            self.assertEqual(
                self.client.post(
                    "/api/v1/auth/token/refresh/", {"refresh": tokens["refresh"]}
                ).status_code,
                503,
            )
            self.assertEqual(
                self.client.post(
                    "/api/v1/auth/logout/", {"refresh": tokens["refresh"]}
                ).status_code,
                503,
            )
        with patch("apps.accounts.sessions.AuthSession.objects.create", side_effect=DatabaseError):
            self.assertEqual(
                self.client.post(
                    "/api/v1/auth/login/", {"email": self.user.email, "password": "Strong-pass-123"}
                ).status_code,
                503,
            )


class SessionConcurrencyTests(TransactionTestCase):
    def test_refresh_and_logout_serialize_in_both_orders(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL row locks required")
        from . import session_views
        from .sessions import issue_session

        user = User.objects.create_user(email="race@example.com", password="Strong-pass-123")
        original = session_views.session_for_token
        for first_path in ("logout", "refresh"):
            token = str(issue_session(user))
            acquired, release, started = Event(), Event(), Event()

            def intercept(*args, acquired=acquired, release=release, **kwargs):
                session = original(*args, **kwargs)
                if not acquired.is_set():
                    acquired.set()
                    if not release.wait(10):
                        raise RuntimeError("lock test timed out")
                return session

            def request(path, signal=False, started=started, token=token):
                close_old_connections()
                try:
                    if signal:
                        started.set()
                    return APIClient().post(path, {"refresh": token}, format="json").status_code
                finally:
                    close_old_connections()

            first = (
                "/api/v1/auth/logout/" if first_path == "logout" else "/api/v1/auth/token/refresh/"
            )
            second = (
                "/api/v1/auth/token/refresh/" if first_path == "logout" else "/api/v1/auth/logout/"
            )
            with (
                patch.object(session_views, "session_for_token", side_effect=intercept),
                ThreadPoolExecutor(max_workers=2) as pool,
            ):
                one = pool.submit(request, first)
                self.assertTrue(acquired.wait(10))
                two = pool.submit(request, second, True)
                self.assertTrue(started.wait(10))
                self.assertFalse(two.done())
                release.set()
                self.assertEqual(one.result(timeout=10), 204 if first_path == "logout" else 200)
                self.assertEqual(two.result(timeout=10), 401 if first_path == "logout" else 204)
            self.assertEqual(
                APIClient()
                .post("/api/v1/auth/token/refresh/", {"refresh": token}, format="json")
                .status_code,
                401,
            )
