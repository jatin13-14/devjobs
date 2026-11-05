import os

from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

if not os.getenv('DJANGO_SECRET_KEY') or SECRET_KEY in {
    'unsafe-local-only-change-me',
    'replace-for-local-development',
}:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set to a production secret.')
if not os.getenv('DJANGO_ALLOWED_HOSTS'):
    raise ImproperlyConfigured('DJANGO_ALLOWED_HOSTS must be set for production.')

SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_REFERRER_POLICY = 'same-origin'
