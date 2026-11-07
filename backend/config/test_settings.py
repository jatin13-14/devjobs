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


class PostgreSQLIdentityTests(SimpleTestCase):
    def test_exact_version_and_container_build_suffix_are_supported(self):
        from config.settings.test import is_expected_database_identity

        for version in ("17.5", "17.5 (Debian build)"):
            self.assertTrue(is_expected_database_identity("devjobs_test", 5433, version))

    def test_other_servers_ports_databases_and_test_targets_are_rejected(self):
        from config.settings.test import is_expected_database_identity

        for database, port, version, test_name in (
            ("devjobs_test", 5432, "17.5", "test_devjobs_test"),
            ("devjobs_test", 5433, "17.4", "test_devjobs_test"),
            ("devjobs_test", 5433, "17.6", "test_devjobs_test"),
            ("devjobs_test", 5433, "14.0", "test_devjobs_test"),
            ("devjobs_test", 5433, "18.0", "test_devjobs_test"),
            ("devjobs", 5433, "17.5", "test_devjobs_test"),
            ("devjobs_test", 5433, "17.5", "devjobs_test"),
        ):
            with self.subTest(database=database, port=port, version=version, test_name=test_name):
                self.assertFalse(is_expected_database_identity(database, port, version, test_name))
