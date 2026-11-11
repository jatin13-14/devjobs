"""Pure safety checks: run with unittest, without Django setup or a database."""
import unittest
from unittest.mock import MagicMock

from django.core.exceptions import ImproperlyConfigured

from config.e2e_safety import validate_environment, verify_connection


class E2ESafetyTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            "DEVJOBS_E2E": "1", "E2E_RUN_ID": "synthetic-run",
            "E2E_SYSTEM_IDENTIFIER": "12345",
            "E2E_DATABASE_URL": "postgresql://synthetic:synthetic@127.0.0.1:55439/devjobs_e2e_disposable",
        }

    def test_missing_flags_and_values_fail(self):
        for key in self.env:
            with self.subTest(key=key), self.assertRaises(ImproperlyConfigured):
                validate_environment({k: v for k, v in self.env.items() if k != key})

    def test_development_targets_and_url_overrides_fail(self):
        for url in (
            "postgresql://u:p@127.0.0.1:5433/devjobs_test",
            "postgresql://u:p@127.0.0.1:5432/devjobs_e2e_disposable",
            "postgresql://u:p@remote:55439/devjobs_e2e_disposable",
            "postgresql://u:p@127.0.0.1:55439/devjobs_e2e_disposable?host=remote",
            "postgresql://127.0.0.1:55439/devjobs_e2e_disposable",
        ):
            with self.subTest(url=url), self.assertRaises(ImproperlyConfigured):
                validate_environment({**self.env, "E2E_DATABASE_URL": url})

    def test_actual_cluster_identity_checked_independently(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = ("devjobs_e2e_disposable", 5432, 170005, "12345")
        verify_connection(connection, self.env)
        for row in (
            ("devjobs_test", 5432, 170005, "12345"),
            ("devjobs_e2e_disposable", 5433, 170005, "12345"),
            ("devjobs_e2e_disposable", 5432, 170005, "different-cluster"),
            ("devjobs_e2e_disposable", 5432, 180000, "12345"),
        ):
            cursor.fetchone.return_value = row
            with self.subTest(row=row), self.assertRaises(ImproperlyConfigured):
                verify_connection(connection, self.env)
