"""Validate the PostgreSQL target before pytest-django creates its test database."""

import pytest
from django.conf import settings
from django.db import OperationalError, connection
from django.test.utils import setup_databases, teardown_databases

from config.settings.test import is_expected_database_identity


def pytest_collection_modifyitems(items):
    if settings.SETTINGS_MODULE != "config.settings.test":
        pytest.exit(
            "Automated tests must use config.settings.test; development settings are not allowed.",
            returncode=2,
        )
    for item in items:
        item.add_marker(pytest.mark.django_db)


@pytest.fixture(scope="session")
def django_db_setup(django_db_blocker):
    config = settings.DATABASES["default"]
    if connection.vendor != "postgresql":
        pytest.exit("Automated tests require PostgreSQL; SQLite is not supported.", returncode=2)
    with django_db_blocker.unblock():
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT current_database(), inet_server_port(), current_setting('server_version')"
                )
                database, port, version = cursor.fetchone()
        except OperationalError as exc:
            pytest.exit(f"PostgreSQL 17 test target is unreachable: {exc}", returncode=2)
        test_name = config.get("TEST", {}).get("NAME")
        print(
            f"Test database target: engine=postgresql host={config['HOST']} port={port} "
            f"database={database} test_database={test_name} PostgreSQL={version}"
        )
        if not is_expected_database_identity(database, port, version, test_name):
            pytest.exit("PostgreSQL test target identity/version check failed.", returncode=2)

        old_config = setup_databases(verbosity=0, interactive=False, keepdb=True)
    yield
    with django_db_blocker.unblock():
        teardown_databases(old_config, verbosity=0, keepdb=True)
