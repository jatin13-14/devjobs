from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.accounts.models import User
from apps.accounts.throttles import RefreshRateThrottle, RegistrationRateThrottle


class AuthHardeningTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.addCleanup(cache.clear)
        for throttle in (RegistrationRateThrottle, RefreshRateThrottle):
            clock = patch.object(throttle, "timer", return_value=120)
            clock.start()
            self.addCleanup(clock.stop)

    def register(self, role="candidate", **changes):
        payload = {
            "email": "synthetic-identity@example.test",
            "password": "Independent-random-98!",
            "full_name" if role == "candidate" else "name": "Synthetic Fixture",
        }
        payload.update(changes)
        return self.client.post(f"/api/v1/auth/{role}/register/", payload, format="json")

    def test_both_registration_routes_share_ip_bucket_and_expire(self):
        with patch.object(RegistrationRateThrottle, "timer", return_value=120):
            for index in range(5):
                response = self.register(
                    "candidate" if index % 2 else "recruiter",
                    email=f"invalid-{index}",
                )
                self.assertEqual(response.status_code, 400)
            for role in ("candidate", "recruiter"):
                blocked = self.register(role)
                self.assertEqual(blocked.status_code, 429)
                self.assertEqual(blocked["Retry-After"], "60")
            self.assertEqual(self.client.get("/api/v1/jobs/").status_code, 200)
            self.assertEqual(self.client.post("/api/v1/auth/login/", {}).status_code, 400)
        with patch.object(RegistrationRateThrottle, "timer", return_value=180):
            self.assertEqual(self.register(email="invalid").status_code, 400)

    def test_forwarded_headers_do_not_bypass_and_other_clients_have_own_bucket(self):
        for index in range(6):
            self.client.defaults["HTTP_X_FORWARDED_FOR"] = f"192.0.2.{index}"
            self.assertEqual(self.register(email="invalid").status_code, 400 if index < 5 else 429)
        self.client.defaults["REMOTE_ADDR"] = "192.0.2.100"
        self.assertEqual(self.register(email="invalid").status_code, 400)

    def test_independent_throttle_instances_share_counter_without_sensitive_keys(self):
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory

        request = Request(APIRequestFactory().post("/", REMOTE_ADDR="192.0.2.8"))
        with patch.object(cache, "add", wraps=cache.add) as added:
            self.assertEqual(
                [RegistrationRateThrottle().allow_request(request, None) for _ in range(6)],
                [True] * 5 + [False],
            )
        key = added.call_args.args[0]
        self.assertNotIn("192.0.2.8", key)
        self.assertNotIn("example.test", key)

    def test_cache_failure_does_not_allow_registration(self):
        with (
            patch.object(cache, "add", side_effect=ConnectionError("cache unavailable")),
            self.assertRaises(ConnectionError),
        ):
            self.register()
        self.assertFalse(User.objects.exists())

    def test_refresh_valid_shape_lifetime_invalid_attempts_and_separate_login_bucket(self):
        user = User.objects.create_user("refresh-fixture@example.test", password="Unrelated-98!")
        token = RefreshToken.for_user(user)
        response = self.client.post(
            "/api/v1/auth/token/refresh/", {"refresh": str(token)}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {"access"})
        access = AccessToken(response.data["access"])
        self.assertEqual(
            access["exp"] - access["iat"], api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()
        )
        self.assertEqual(
            token["exp"] - token["iat"], api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()
        )
        for _ in range(29):
            self.assertEqual(
                self.client.post(
                    "/api/v1/auth/token/refresh/", {"refresh": "invalid"}, format="json"
                ).status_code,
                401,
            )
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/token/refresh/", {"refresh": str(token)}, format="json"
            ).status_code,
            429,
        )
        self.assertEqual(self.client.post("/api/v1/auth/login/", {}).status_code, 400)
        self.assertEqual(self.register(email="invalid").status_code, 400)

    def test_refresh_new_window_accepts_requests(self):
        with patch.object(RefreshRateThrottle, "timer", return_value=120):
            for _ in range(30):
                self.assertEqual(
                    self.client.post("/api/v1/auth/token/refresh/", {}).status_code, 400
                )
            self.assertEqual(self.client.post("/api/v1/auth/token/refresh/", {}).status_code, 429)
        with patch.object(RefreshRateThrottle, "timer", return_value=180):
            self.assertEqual(self.client.post("/api/v1/auth/token/refresh/", {}).status_code, 400)

    def test_similarity_uses_canonical_identity_for_both_roles_without_creating_user(self):
        for role in ("candidate", "recruiter"):
            with self.subTest(role=role):
                response = self.register(
                    role, email=" SYNTHETIC-IDENTITY@EXAMPLE.TEST ", password="synthetic-identity"
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn("password", response.data)
                self.assertFalse(User.objects.exists())
                accepted = self.register(role)
                self.assertEqual(accepted.status_code, 201)
                User.objects.all().delete()
