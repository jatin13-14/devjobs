"""Only the owned disposable runner supplies these values; never use .env DBs."""
import os

import dj_database_url
import psycopg

from config.e2e_safety import validate_environment, verify_connection

validate_environment(os.environ)
from .base import *

DATABASES = {"default": dj_database_url.parse(os.environ["E2E_DATABASE_URL"], conn_max_age=0)}
DEBUG = False
ALLOWED_HOSTS = ["127.0.0.1"]
CORS_ALLOWED_ORIGINS = [os.environ["E2E_FRONTEND_URL"]]

# Guard every settings entry point, including direct manage.py migrate invocations.
with psycopg.connect(os.environ["E2E_DATABASE_URL"]) as identity_connection:
    verify_connection(identity_connection, os.environ)
