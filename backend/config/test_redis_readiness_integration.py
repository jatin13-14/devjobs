"""Opt-in real Redis readiness checks, using only runner-owned resources."""

import os
import shutil
import socket
import subprocess
import tempfile
import time
from unittest import skipUnless
from unittest.mock import patch

import redis
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient


@skipUnless(os.environ.get("DEVJOBS_REAL_REDIS_TESTS") == "1", "requires disposable Redis runner")
class RealRedisReadinessTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.database = patch("config.health.check_database")
        self.database.start()
        self.addCleanup(self.database.stop)

    def probe(self, location, timeout=0.3):
        caches = {
            "default": {
                "BACKEND": "django.core.cache.backends.redis.RedisCache",
                "LOCATION": location,
                "OPTIONS": {"socket_connect_timeout": timeout, "socket_timeout": timeout},
            }
        }
        with override_settings(CACHES=caches):
            started = time.monotonic()
            response = self.client.get("/api/v1/ready/")
            return response.status_code, time.monotonic() - started

    def test_real_ping_preserves_keys_and_recovers_from_refusal(self):
        executable = shutil.which("redis-server")
        self.assertIsNotNone(executable, "redis-server is required for this opt-in test")
        with tempfile.TemporaryDirectory(prefix="devjobs-redis-") as directory:
            path = os.path.join(directory, "redis.sock")
            process = subprocess.Popen(
                [
                    executable,
                    "--port",
                    "0",
                    "--unixsocket",
                    path,
                    "--save",
                    "",
                    "--appendonly",
                    "no",
                    "--dir",
                    directory,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            try:
                client = redis.Redis(unix_socket_path=path, socket_timeout=0.3)
                for _ in range(100):
                    try:
                        if client.ping():
                            break
                    except redis.exceptions.ConnectionError:
                        time.sleep(0.05)
                else:
                    self.fail("disposable Redis did not start")
                client.set("sentinel", "synthetic")
                before = client.dump("sentinel"), client.dbsize()
                stats_before = client.info("commandstats")
                dirty_before = client.info("persistence")["rdb_changes_since_last_save"]
                for _ in range(5):
                    self.assertEqual(self.probe(f"unix://{path}?db=0")[0], 200)
                self.assertEqual((client.dump("sentinel"), client.dbsize()), before)
                stats_after = client.info("commandstats")
                for command in ("cmdstat_set", "cmdstat_del", "cmdstat_unlink"):
                    self.assertEqual(stats_before.get(command), stats_after.get(command))
                self.assertEqual(
                    client.info("persistence")["rdb_changes_since_last_save"], dirty_before
                )
                self.test_real_connect_timeout()
                self.assertEqual(self.probe(f"unix://{path}?db=0")[0], 200)
                self.test_real_read_timeout()
                self.assertEqual(self.probe(f"unix://{path}?db=0")[0], 200)
                with socket.socket() as closed:
                    closed.bind(("127.0.0.1", 0))
                    port = closed.getsockname()[1]
                self.assertEqual(self.probe(f"redis://127.0.0.1:{port}/0")[0], 503)
                self.assertEqual(self.probe(f"unix://{path}?db=0")[0], 200)
                self.assertEqual((client.dump("sentinel"), client.dbsize()), before)
                client.close()
            finally:
                process.terminate()
                process.wait(timeout=5)
            self.assertIsNotNone(process.returncode)
        self.assertFalse(os.path.exists(directory))

    def test_real_read_timeout(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            port = listener.getsockname()[1]
            status, elapsed = self.probe(f"redis://127.0.0.1:{port}/0")
            self.assertEqual(status, 503)
            self.assertGreaterEqual(elapsed, 0.25)
            self.assertLess(elapsed, 2.0)
            print(f"real Redis read timeout: {elapsed:.3f}s (configured 0.3s)")

    def test_real_connect_timeout(self):
        # A full local TCP listen queue drops subsequent SYNs without an external host.
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            port = listener.getsockname()[1]
            peers = []
            try:
                for _ in range(8):
                    try:
                        peer = socket.create_connection(("127.0.0.1", port), timeout=0.3)
                    except TimeoutError:
                        break
                    peers.append(peer)
                else:
                    self.fail("could not saturate the disposable listen queue")
                self.assertTrue(peers)
                status, elapsed = self.probe(f"redis://127.0.0.1:{port}/0")
                self.assertEqual(status, 503)
                self.assertGreaterEqual(elapsed, 0.25)
                self.assertLess(elapsed, 2.0)
                print(f"real Redis connect timeout: {elapsed:.3f}s (configured 0.3s)")
            finally:
                for peer in peers:
                    peer.close()
