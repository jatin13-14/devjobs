"""Real Redis regressions; URL must identify a disposable test-only Redis."""

import os
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from django.core.cache.backends.redis import RedisCache
from redis.exceptions import AuthenticationError, ConnectionError, NoPermissionError, ResponseError

from apps.accounts.throttles import (
    RefreshRateThrottle,
    RegistrationRateThrottle,
    increment_window,
)


@unittest.skipUnless(os.environ.get("REDIS_THROTTLE_TEST_URL"), "disposable Redis URL required")
class RedisThrottleTests(unittest.TestCase):
    def setUp(self):
        self.backend = RedisCache(
            os.environ["REDIS_THROTTLE_TEST_URL"],
            {"KEY_PREFIX": f"throttle-test-{uuid.uuid4().hex}"},
        )
        self.client = self.backend._cache.get_client(write=True)
        self.request = type("Request", (), {"headers": {}, "META": {"REMOTE_ADDR": "192.0.2.1"}})()
        # Match the cache proxy interface while preserving the real backend.
        proxy = type(
            "Proxy", (), {"_connections": {"default": self.backend}, "_alias": "default"}
        )()
        patched = patch("apps.accounts.throttles.cache", proxy)
        patched.start()
        self.addCleanup(patched.stop)
        self.addCleanup(self.clean_keys)

    def clean_keys(self):
        keys = list(self.client.scan_iter(f"{self.backend.key_prefix}:*"))
        if keys:
            self.client.delete(*keys)

    def key(self, key="counter"):
        return self.backend.make_and_validate_key(key)

    def test_creation_increment_fixed_ttl_saturation_and_repair(self):
        self.assertEqual(increment_window("counter", 120, 5), 1)
        self.assertTrue(0 < self.client.pttl(self.key()) <= 120000)
        self.client.pexpire(self.key(), 30000)
        self.assertEqual(increment_window("counter", 120, 5), 2)
        self.assertTrue(0 < self.client.pttl(self.key()) <= 30000)
        for _ in range(20):
            increment_window("counter", 120, 5)
        self.assertEqual(self.client.get(self.key()), b"5")
        self.client.persist(self.key())
        self.assertEqual(increment_window("counter", 120, 5), 6)
        self.assertTrue(0 < self.client.pttl(self.key()) <= 120000)
        self.client.set(self.key(), 9223372036854775807, ex=120)
        self.assertEqual(increment_window("counter", 120, 5), 6)

    def test_expiration_deletion_and_recreation(self):
        for _ in range(2):
            self.assertEqual(increment_window("counter", 120, 5), 1)
            self.client.delete(self.key())
        increment_window("counter", 120, 5)
        self.client.pexpire(self.key(), 1)
        deadline = time.monotonic() + 2
        while self.client.exists(self.key()) and time.monotonic() < deadline:
            time.sleep(0.002)
        self.assertFalse(self.client.exists(self.key()))
        self.assertEqual(increment_window("counter", 120, 5), 1)
        self.assertGreater(self.client.pttl(self.key()), 0)

    def test_exhausted_counter_deletion_recreates_with_expiry(self):
        for limit in (5, 30):
            self.client.delete(self.key())
            for _ in range(limit):
                increment_window("counter", 120, limit)
            self.assertEqual(increment_window("counter", 120, limit), limit + 1)
            self.client.delete(self.key())
            self.assertEqual(increment_window("counter", 120, limit), 1)
            self.assertGreater(self.client.pttl(self.key()), 0)

    def test_old_exists_incr_interleaving_is_never_used(self):
        # Reproduce the old backend defect with actual Redis, then exercise the
        # new path with the same destructive EXISTS hook armed.
        self.client.set(self.key(), 5, ex=120)
        original = self.client.exists

        def lost(key):
            present = original(key)
            self.client.delete(key)
            return present

        with patch.object(self.backend._cache, "get_client", return_value=self.client):
            with patch.object(self.client, "exists", side_effect=lost):
                self.assertEqual(self.backend.incr("counter"), 1)
                self.assertEqual(self.client.ttl(self.key()), -1)
            self.client.delete(self.key())
            with patch.object(self.client, "exists", side_effect=lost) as exists:
                self.assertEqual(increment_window("counter", 120, 5), 1)
                self.assertGreater(self.client.pttl(self.key()), 0)
                exists.assert_not_called()

    def test_concurrent_first_boundary_and_recreated_requests(self):
        for throttle, limit in ((RegistrationRateThrottle, 5), (RefreshRateThrottle, 30)):
            with patch.object(throttle, "timer", return_value=120):
                for _ in range(2):
                    self.clean_keys()
                    with ThreadPoolExecutor(max_workers=10) as pool:
                        admitted = list(
                            pool.map(
                                lambda _, cls=throttle: cls().allow_request(self.request, None),
                                range(100),
                            )
                        )
                    self.assertEqual(sum(admitted), limit)
                    keys = list(self.client.scan_iter(f"{self.backend.key_prefix}:*"))
                    self.assertEqual(len(keys), 1)
                    self.assertGreater(self.client.pttl(keys[0]), 0)

    def test_bucket_isolation_and_next_window(self):
        with (
            patch.object(RegistrationRateThrottle, "timer", return_value=120),
            patch.object(RefreshRateThrottle, "timer", return_value=120),
        ):
            self.assertEqual(
                sum(
                    RegistrationRateThrottle().allow_request(self.request, None) for _ in range(10)
                ),
                5,
            )
            self.assertEqual(
                sum(RefreshRateThrottle().allow_request(self.request, None) for _ in range(40)), 30
            )
        with patch.object(RegistrationRateThrottle, "timer", return_value=180):
            self.assertTrue(RegistrationRateThrottle().allow_request(self.request, None))

    def test_failures_propagate_without_memory_fallback(self):
        with (
            patch.object(self.backend._cache, "get_client", return_value=self.client),
            patch.object(self.client, "eval", side_effect=ConnectionError("unavailable")),
            self.assertRaises(ConnectionError),
        ):
            RegistrationRateThrottle().allow_request(self.request, None)
        self.client.set(self.key(), "invalid", ex=120)
        with self.assertRaises(ResponseError):
            increment_window("counter", 120, 5)

    def test_authentication_acl_and_script_errors_propagate(self):
        for error in (AuthenticationError, NoPermissionError, ResponseError):
            with (
                self.subTest(error=error.__name__),
                patch.object(self.backend._cache, "get_client", return_value=self.client),
                patch.object(self.client, "eval", side_effect=error("test failure")),
                self.assertRaises(error),
            ):
                RegistrationRateThrottle().allow_request(self.request, None)
