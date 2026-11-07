"""Strict PostgreSQL 17 settings for automated tests."""

import os
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

from .dev import *

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise ImproperlyConfigured("Automated tests require DATABASE_URL; SQLite fallback is disabled.")
parsed = urlsplit(database_url)
if parsed.scheme not in {"postgres", "postgresql", "postgresql+psycopg"}:
    raise ImproperlyConfigured("Automated tests require PostgreSQL; SQLite is not supported.")
if parsed.hostname != "127.0.0.1" or parsed.port != 5433 or parsed.path.lstrip("/") != "devjobs_test":
    raise ImproperlyConfigured(
        "Automated tests must target devjobs_test at 127.0.0.1:5433."
    )

DATABASES["default"]["TEST"] = {"NAME": "test_devjobs_test"}


def is_expected_database_identity(database, port, version, test_name="test_devjobs_test"):
    """Validate server identity independently of connection URL validation above."""
    return (
        database == "devjobs_test"
        and port == 5433
        and version.split()[0] == "17.5"
        and test_name == "test_devjobs_test"
    )
