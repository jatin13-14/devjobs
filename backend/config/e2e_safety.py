"""Fail-closed validation shared by the disposable runner and Django settings."""

from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured


def validate_environment(env):
    required = ("E2E_DATABASE_URL", "E2E_SYSTEM_IDENTIFIER", "E2E_RUN_ID")
    if env.get("DEVJOBS_E2E") != "1" or any(not env.get(key) for key in required):
        raise ImproperlyConfigured("Explicit disposable E2E environment is required")
    url = urlsplit(env["E2E_DATABASE_URL"])
    if (
        url.scheme != "postgresql"
        or url.hostname != "127.0.0.1"
        or not url.port
        or url.port in {5432, 5433}
        or url.path != "/devjobs_e2e_disposable"
        or not url.username
        or not url.password
        or url.query
        or url.fragment
    ):
        raise ImproperlyConfigured("E2E requires an explicit isolated loopback database target")
    return url


def verify_connection(connection, env):
    validate_environment(env)
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT current_database(), inet_server_port(), "
            "current_setting('server_version_num')::int, "
            "(SELECT system_identifier::text FROM pg_control_system())"
        )
        database, port, version, identifier = cursor.fetchone()
    if (database, port, identifier) != (
        "devjobs_e2e_disposable",
        5432,
        env["E2E_SYSTEM_IDENTIFIER"],
    ) or not 170012 <= version < 180000:
        raise ImproperlyConfigured("Disposable PostgreSQL identity mismatch; refusing writes")
    return version
