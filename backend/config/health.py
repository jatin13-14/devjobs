"""Public probes return only aggregate state; never dependency diagnostics."""
import uuid

from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.candidates.resumes import storage


class ReadinessView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = ()

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                if cursor.fetchone() != (1,):
                    raise RuntimeError
            key = f"readiness-{uuid.uuid4().hex}"
            try:
                cache.set(key, "ok", timeout=10)
                if cache.get(key) != "ok":
                    raise RuntimeError
            finally:
                cache.delete(key)
            backend = storage()
            key = backend.save(f"probe-{uuid.uuid4().hex}", ContentFile(b"ok"))
            try:
                with backend.open(key, "rb") as handle:
                    if handle.read(3) != b"ok":
                        raise RuntimeError
            finally:
                backend.delete(key)
        except Exception:  # noqa: BLE001 - arbitrary storage backends; public probe must redact errors
            return Response({"status": "unavailable"}, status=503, headers={"Cache-Control": "no-store"})
        return Response({"status": "ready"}, headers={"Cache-Control": "no-store"})
