import os

from .base import *
from .production_validation import production_config

# Validate before starting workers; dependency availability belongs to readiness.
globals().update(production_config(os.environ))
DEBUG = False
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.environ["DJANGO_CACHE_URL"],
        "KEY_PREFIX": "devjobs",
        "OPTIONS": {"socket_connect_timeout": 2, "socket_timeout": 2},
    }
}
DATABASES["default"].setdefault("OPTIONS", {}).setdefault("connect_timeout", 3)
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
