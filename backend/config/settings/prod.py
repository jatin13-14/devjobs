import os
from urllib.parse import urlsplit

import redis
from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

if not os.getenv("DJANGO_SECRET_KEY") or SECRET_KEY in {
    "unsafe-local-only-change-me",
    "replace-for-local-development",
}:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to a production secret.")
if not os.getenv("DJANGO_ALLOWED_HOSTS"):
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set for production.")

shared_cache_url = os.getenv("DJANGO_CACHE_URL", "").strip()
parsed_cache_url = urlsplit(shared_cache_url)
if parsed_cache_url.scheme not in {"redis", "rediss"} or not parsed_cache_url.hostname:
    raise ImproperlyConfigured(
        "DJANGO_CACHE_URL must be a reachable Redis URL (redis:// or rediss://) "
        "for production shared throttling."
    )
try:
    redis.Redis.from_url(shared_cache_url, socket_connect_timeout=2).ping()
except Exception as error:
    raise ImproperlyConfigured(
        "DJANGO_CACHE_URL Redis service is unreachable or misconfigured."
    ) from error
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": shared_cache_url,
        "KEY_PREFIX": "devjobs",
    }
}

SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_REFERRER_POLICY = "same-origin"

SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "false").lower() == "true"
SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.getenv("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", "false").lower() == "true"
)
SECURE_HSTS_PRELOAD = os.getenv("DJANGO_SECURE_HSTS_PRELOAD", "false").lower() == "true"
if os.getenv("DJANGO_SECURE_PROXY_SSL_HEADER", "false").lower() == "true":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
