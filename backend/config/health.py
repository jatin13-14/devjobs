"""Public probes return only aggregate state; never dependency diagnostics."""

import psycopg
from django.core.cache import caches
from django.core.cache.backends.redis import RedisCache
from django.db import connection
from psycopg import generators, pq
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

PROBE_SQL = b"BEGIN READ ONLY; SET LOCAL statement_timeout = '1000ms'; SELECT 1; ROLLBACK"


def check_database():
    # A dedicated connection keeps timeout and transaction state out of business
    # queries. psycopg's wait deadline bounds both socket reads and writes.
    params = connection.get_connection_params()
    params.setdefault("connect_timeout", 3)
    with psycopg.connect(**params, autocommit=True) as probe:
        probe.pgconn.send_query(PROBE_SQL)
        results = probe.wait(generators.execute(probe.pgconn), timeout=2)
        if (
            len(results) != 4
            or any(
                result.status not in (pq.ExecStatus.COMMAND_OK, pq.ExecStatus.TUPLES_OK)
                for result in results
            )
            or results[2].get_value(0, 0) != b"1"
        ):
            raise RuntimeError("database probe failed")


class ReadinessView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = ()

    def get(self, request):
        try:
            check_database()
            # PING uses the configured Redis client's socket timeouts and does
            # not create a key; use the write endpoint when replicas exist.
            cache_backend = caches["default"]
            if (
                isinstance(cache_backend, RedisCache)
                and not cache_backend._cache.get_client(write=True).ping()
            ):
                raise RuntimeError
        except Exception:  # noqa: BLE001 - public probe must redact dependency errors
            return Response(
                {"status": "unavailable"}, status=503, headers={"Cache-Control": "no-store"}
            )
        return Response({"status": "ready"}, headers={"Cache-Control": "no-store"})
