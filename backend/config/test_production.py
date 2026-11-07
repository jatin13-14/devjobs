import tempfile
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from config.settings.production_validation import production_config


class ProductionConfigurationTests(SimpleTestCase):
    def config(self):
        return {
            "DJANGO_SECRET_KEY": "synthetic-production-test-key-1234567890-abcdefghijklmnop",
            "DATABASE_URL": "postgresql://synthetic:synthetic@db.invalid/app",
            "DJANGO_ALLOWED_HOSTS": "api.example.test",
            "DJANGO_CACHE_URL": "redis://cache.invalid:6379/0",
            "PRIVATE_RESUME_ROOT": "/private/resumes",
        }

    def test_secure_defaults(self):
        config = production_config(self.config())
        self.assertTrue(config["SECURE_SSL_REDIRECT"])
        self.assertIsNone(config["SECURE_PROXY_SSL_HEADER"])
        self.assertEqual(config["CORS_ALLOWED_ORIGINS"], [])

    def test_required_configuration(self):
        for key in self.config():
            env = self.config()
            del env[key]
            with self.subTest(key=key), self.assertRaises(ImproperlyConfigured):
                production_config(env)

    def test_rejects_insecure_values(self):
        for key, value in (
            ("DATABASE_URL", "sqlite:///local.sqlite3"),
            ("DJANGO_ALLOWED_HOSTS", "*"),
            ("DJANGO_ALLOWED_HOSTS", "api.example.test,"),
            ("DJANGO_DEBUG", "true"),
            ("DJANGO_SECURE_SSL_REDIRECT", "false"),
            ("DJANGO_SECURE_PROXY_SSL_HEADER", "yes"),
            ("CORS_ALLOWED_ORIGINS", "http://example.test"),
            ("CSRF_TRUSTED_ORIGINS", "https://example.test/path"),
            ("DJANGO_SECURE_HSTS_SECONDS", "-1"),
            ("DJANGO_SECURE_HSTS_PRELOAD", "true"),
            ("PRIVATE_RESUME_ROOT", "relative"),
            ("DJANGO_SECRET_KEY", "x" * 60),
        ):
            with self.subTest(key=key), self.assertRaises(ImproperlyConfigured):
                production_config(self.config() | {key: value})

    def test_configurable_private_storage(self):
        from django.core.files.storage import InMemoryStorage

        from apps.candidates.resumes import storage

        with override_settings(PRIVATE_RESUME_STORAGE_BACKEND="django.core.files.storage.InMemoryStorage"):
            self.assertIsInstance(storage(), InMemoryStorage)

    def test_actual_production_settings_import(self):
        import os
        import subprocess
        import sys

        env = os.environ | self.config() | {"DJANGO_SETTINGS_MODULE": "config.settings.prod", "DJANGO_DEBUG": "false"}
        result = subprocess.run(
            [sys.executable, "-c", "import django; django.setup(); from django.conf import settings; assert settings.DATABASES['default']['ENGINE'] == 'django.db.backends.postgresql'; assert settings.SESSION_COOKIE_SECURE"],
            env=env, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_explicit_edge_https(self):
        env = self.config() | {"DJANGO_SECURE_SSL_REDIRECT": "false", "DJANGO_HTTPS_ENFORCED_AT_EDGE": "true"}
        self.assertFalse(production_config(env)["SECURE_SSL_REDIRECT"])


class ReadinessTests(APITestCase):
    def test_probes_ignore_invalid_bearer(self):
        with tempfile.TemporaryDirectory() as root, override_settings(PRIVATE_RESUME_ROOT=root):
            self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid")
            self.assertEqual(self.client.get("/api/v1/health/").status_code, 200)
            response = self.client.get("/api/v1/ready/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, {"status": "ready"})
            self.assertEqual(response["Cache-Control"], "no-store")

    def test_dependency_failures_are_generic(self):
        for target in ("config.health.connection.cursor", "config.health.cache.set", "config.health.storage"):
            with self.subTest(target=target), patch(target, side_effect=RuntimeError("sensitive")):
                response = self.client.get("/api/v1/ready/")
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.data, {"status": "unavailable"})
                self.assertEqual(self.client.get("/api/v1/health/").status_code, 200)

    def test_protected_routes_still_require_authentication(self):
        self.assertEqual(self.client.get("/api/v1/candidates/me/resume/").status_code, 401)
        self.assertEqual(self.client.get("/api/v1/admin/overview/").status_code, 401)
