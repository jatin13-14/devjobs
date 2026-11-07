"""Run browser tests only against the dedicated PG17.5 database; never reset it."""
import os
import secrets
import subprocess
import sys
import tempfile
import time
import uuid
from urllib.error import HTTPError
from urllib.request import urlopen

os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.test"
os.environ["CORS_ALLOWED_ORIGINS"] = "http://127.0.0.1:5174"
os.environ["DJANGO_ALLOWED_HOSTS"] = "127.0.0.1,localhost"
os.environ["JWT_TOKEN_RATE"] = "100/minute"
os.environ["DJANGO_SECRET_KEY"] = secrets.token_urlsafe(48)

import django

django.setup()

from django.db import connection

from apps.accounts.models import User
from config.settings.test import is_expected_database_identity

with connection.cursor() as cursor:
    cursor.execute("SELECT current_database(), inet_server_port(), current_setting('server_version')")
    if not is_expected_database_identity(*cursor.fetchone()):
        raise RuntimeError("Browser tests require dedicated devjobs_test on PostgreSQL 17.5 port 5433")

resume_directory = tempfile.TemporaryDirectory(prefix="devjobs-e2e-resumes-")
os.environ["PRIVATE_RESUME_ROOT"] = resume_directory.name
subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"], check=True)
run_id = uuid.uuid4().hex
email = f"e2e-admin-{run_id}@example.test"
password = secrets.token_urlsafe(24)
admin = User.objects.create_superuser(email, password)
environment = {**os.environ, "E2E_ADMIN_EMAIL": email, "E2E_ADMIN_PASSWORD": password, "E2E_RUN_ID": run_id}
server = subprocess.Popen([sys.executable, 'manage.py', 'runserver', '127.0.0.1:8011', '--noreload'], env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for attempt in range(100):
        try:
            urlopen('http://127.0.0.1:8011/api/v1/health/', timeout=1).close()
            break
        except HTTPError as error:
            raise RuntimeError(f"Browser API readiness returned HTTP {error.code}") from None
        except OSError:
            if server.poll() is not None:
                raise RuntimeError('Dedicated browser API server failed to start')
            time.sleep(0.1)
    else:
        raise RuntimeError('Dedicated browser API server did not become ready')
    result = subprocess.run(['npm', 'run', 'test:e2e'], cwd='../frontend', env=environment, check=False)
finally:
    server.terminate()
    server.wait(timeout=10)
    resume_directory.cleanup()
    admin.is_active = False
    admin.set_unusable_password()
    admin.save(update_fields=["is_active", "password"])
raise SystemExit(result.returncode)
