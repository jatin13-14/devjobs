"""Pure production configuration validation (no network I/O)."""
import ipaddress
import re
from pathlib import Path
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import Storage
from django.utils.module_loading import import_string


def boolean(env, name, default=False):
    value = env.get(name, str(default)).strip().lower()
    if value not in {"true", "false"}:
        raise ImproperlyConfigured(f"{name} must be true or false.")
    return value == "true"


def production_config(env):
    def required(name):
        value = env.get(name, "").strip()
        if not value:
            raise ImproperlyConfigured(f"{name} is required in production.")
        return value

    secret = required("DJANGO_SECRET_KEY")
    if len(secret) < 50 or len(set(secret)) < 5 or any(
        word in secret.lower() for word in ("replace", "unsafe", "change-me", "django-insecure")
    ):
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be a strong unique production secret.")
    if boolean(env, "DJANGO_DEBUG"):
        raise ImproperlyConfigured("DJANGO_DEBUG must be false in production.")
    database = urlsplit(required("DATABASE_URL"))
    if database.scheme not in {"postgres", "postgresql"} or not database.hostname or not database.path.strip("/"):
        raise ImproperlyConfigured("DATABASE_URL must explicitly identify a PostgreSQL server and database.")
    hosts = [value.strip() for value in required("DJANGO_ALLOWED_HOSTS").split(",")]
    for host in hosts:
        try:
            ipaddress.ip_address(host.strip("[]"))
        except ValueError:
            if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?", host):
                raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS requires explicit hosts without wildcards or ports.")
    result = {"ALLOWED_HOSTS": hosts}
    for name in ("CORS_ALLOWED_ORIGINS", "CSRF_TRUSTED_ORIGINS"):
        values = [v.strip() for v in env.get(name, "").split(",") if v.strip()]
        for value in values:
            parsed = urlsplit(value)
            if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
                    or parsed.path or parsed.query or parsed.fragment or "*" in value):
                raise ImproperlyConfigured(f"{name} requires exact HTTPS origins without paths.")
            try:
                _ = parsed.port
            except ValueError:
                raise ImproperlyConfigured(f"{name} contains an invalid port.") from None
        result[name] = values
    cache = urlsplit(required("DJANGO_CACHE_URL"))
    if cache.scheme not in {"redis", "rediss"} or not cache.hostname:
        raise ImproperlyConfigured("DJANGO_CACHE_URL must identify Redis for shared throttling.")
    result["SECURE_SSL_REDIRECT"] = boolean(env, "DJANGO_SECURE_SSL_REDIRECT", True)
    if not result["SECURE_SSL_REDIRECT"] and not boolean(env, "DJANGO_HTTPS_ENFORCED_AT_EDGE"):
        raise ImproperlyConfigured("HTTPS must be enforced by Django or explicitly at the edge.")
    result["SECURE_PROXY_SSL_HEADER"] = (
        ("HTTP_X_FORWARDED_PROTO", "https") if boolean(env, "DJANGO_SECURE_PROXY_SSL_HEADER") else None
    )
    try:
        seconds = int(env.get("DJANGO_SECURE_HSTS_SECONDS", "0"))
    except ValueError:
        raise ImproperlyConfigured("DJANGO_SECURE_HSTS_SECONDS must be a nonnegative integer.") from None
    if seconds < 0:
        raise ImproperlyConfigured("DJANGO_SECURE_HSTS_SECONDS must be nonnegative.")
    result["SECURE_HSTS_SECONDS"] = seconds
    for suffix in ("INCLUDE_SUBDOMAINS", "PRELOAD"):
        result[f"SECURE_HSTS_{suffix}"] = boolean(env, f"DJANGO_SECURE_HSTS_{suffix}")
    if result["SECURE_HSTS_PRELOAD"] and (seconds < 31536000 or not result["SECURE_HSTS_INCLUDE_SUBDOMAINS"]):
        raise ImproperlyConfigured("HSTS preload requires one year and includeSubDomains.")
    backend = env.get("PRIVATE_RESUME_STORAGE_BACKEND", "").strip()
    if backend:
        try:
            backend_class = import_string(backend)
            if not isinstance(backend_class, type) or not issubclass(backend_class, Storage):
                raise TypeError
        except (ImportError, AttributeError, TypeError, ValueError):
            raise ImproperlyConfigured("PRIVATE_RESUME_STORAGE_BACKEND must identify an installed Django Storage class.") from None
    if not backend:
        root = required("PRIVATE_RESUME_ROOT")
        if not root.startswith("/"):
            raise ImproperlyConfigured("PRIVATE_RESUME_ROOT must be absolute in production.")
    if not backend:
        resolved = Path(root).resolve()
        base = Path(__file__).resolve().parents[2]
        for public in (base / "staticfiles", base / "media"):
            if resolved == public or public in resolved.parents:
                raise ImproperlyConfigured("Private resumes must be outside public static/media roots.")
    return result
