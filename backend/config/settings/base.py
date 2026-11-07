import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR.parent / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured(
        'DJANGO_SECRET_KEY is required. Generate a separate key for each environment.'
    )
if len(SECRET_KEY) < 32:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be at least 32 characters long.')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'django_filters',
    'apps.accounts',
    'apps.candidates',
    'apps.recruiters',
    'apps.companies',
    'apps.jobs',
    'apps.applications',
    'apps.moderation',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL', f'sqlite:///{BASE_DIR / "local.sqlite3"}'),
        conn_max_age=600,
    )
}

# Local development and tests intentionally use process-local cache storage.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'devjobs-local',
    }
}

AUTH_USER_MODEL = 'accounts.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

def jwt_token_rate_from_env(value):
    """Return a valid DRF rate; empty values use the secure default."""
    rate = (value or '').strip() or '5/minute'
    count, separator, period = rate.partition('/')
    if not separator or not count.isdecimal() or int(count) < 1 or period not in {
        'second', 'minute', 'hour', 'day', 's', 'm', 'h', 'd'
    }:
        raise ImproperlyConfigured(
            'JWT_TOKEN_RATE must use DRF rate syntax such as 5/minute.'
        )
    return rate

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    # Ignore client-supplied X-Forwarded-For unless an operator sets the trusted hop count.
    'NUM_PROXIES': int(os.getenv('DRF_NUM_PROXIES', '0')),
    'DEFAULT_THROTTLE_RATES': {
        'jwt_token': jwt_token_rate_from_env(os.getenv('JWT_TOKEN_RATE'))
    },
}
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(',')

# Private documents are deliberately separate from public media/static assets.
PRIVATE_RESUME_ROOT = Path(os.getenv("PRIVATE_RESUME_ROOT", BASE_DIR / "private-resumes"))
RESUME_MAX_BYTES = int(os.getenv("RESUME_MAX_BYTES", str(5 * 1024 * 1024)))
if RESUME_MAX_BYTES <= 0:
    raise ImproperlyConfigured("RESUME_MAX_BYTES must be positive.")

# Optional Django Storage implementation; custom backends must remain private.
PRIVATE_RESUME_STORAGE_BACKEND = os.getenv("PRIVATE_RESUME_STORAGE_BACKEND", "")
FILE_UPLOAD_MAX_MEMORY_SIZE = min(RESUME_MAX_BYTES, 1024 * 1024)
DATA_UPLOAD_MAX_MEMORY_SIZE = RESUME_MAX_BYTES + 64 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES = 1
