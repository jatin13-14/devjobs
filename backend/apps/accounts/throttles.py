"""Bounded fixed-window counters using the shared default cache."""

import math

from django.core.cache import cache
from django.core.cache.backends.redis import RedisCache
from django.utils.crypto import salted_hmac
from rest_framework.throttling import SimpleRateThrottle

# One Redis command boundary: deletion/expiry cannot interleave with creation,
# increment or TTL repair. Saturation avoids unbounded growth and INCR overflow.
COUNTER_SCRIPT = """
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
if not ttl or ttl <= 0 or not limit or limit < 1 then
    return redis.error_reply('invalid throttle configuration')
end
local raw = redis.call('GET', KEYS[1])
if not raw then
    redis.call('SET', KEYS[1], 1, 'EX', ttl)
    return 1
end
local count = tonumber(raw)
if not count or count < 1 or count ~= math.floor(count) then
    return redis.error_reply('invalid throttle counter')
end
if redis.call('PTTL', KEYS[1]) < 0 then
    redis.call('EXPIRE', KEYS[1], ttl)
end
if count >= limit then
    return limit + 1
end
return redis.call('INCR', KEYS[1])
"""


def increment_window(key, timeout, limit):
    backend = cache._connections[cache._alias]
    if isinstance(backend, RedisCache):
        key = backend.make_and_validate_key(key)
        # Use Django's configured primary pool, prefix/version and timeouts.
        client = backend._cache.get_client(key, write=True)
        return client.eval(COUNTER_SCRIPT, 1, key, timeout, limit)
    # Development/test caches retain their configured behavior. Redis exceptions
    # propagate above; an outage must never select a process-local fallback.
    return 1 if cache.add(key, 1, timeout=timeout) else cache.incr(key)


class ClientWindowThrottle(SimpleRateThrottle):
    def allow_request(self, request, view):
        now = self.timer()
        window = math.floor(now / self.duration)
        identity = salted_hmac("auth-throttle", self.get_ident(request)).hexdigest()
        key = f"auth-window:{self.scope}:{identity}:{window}"
        self.remaining = (window + 1) * self.duration - now
        # Keep counters beyond the window; normal expiration cannot reset an
        # active bucket. Cache errors propagate rather than admitting requests.
        count = increment_window(key, int(self.duration * 2), self.num_requests)
        return count <= self.num_requests

    def wait(self):
        return self.remaining


class RegistrationRateThrottle(ClientWindowThrottle):
    scope = "registration"


class RefreshRateThrottle(ClientWindowThrottle):
    scope = "jwt_refresh"
