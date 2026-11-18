from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config.settings.base import jwt_token_rate_from_env


class JwtTokenRateConfigurationTests(SimpleTestCase):
    def test_local_tests_use_process_local_cache(self):
        self.assertEqual(
            settings.CACHES["default"]["BACKEND"],
            "django.core.cache.backends.locmem.LocMemCache",
        )

    def test_unset_or_blank_rate_uses_default(self):
        for value in (None, "", "   "):
            with self.subTest(value=value):
                self.assertEqual(jwt_token_rate_from_env(value), "5/minute")

    def test_valid_rate_is_preserved(self):
        self.assertEqual(jwt_token_rate_from_env("12/hour"), "12/hour")

    def test_invalid_rate_fails_clearly(self):
        for value in ("five/minute", "5/month", "5", "0/minute", "-1/second"):
            with (
                self.subTest(value=value),
                self.assertRaisesMessage(
                    ImproperlyConfigured,
                    "JWT_TOKEN_RATE must use DRF rate syntax",
                ),
            ):
                jwt_token_rate_from_env(value)
