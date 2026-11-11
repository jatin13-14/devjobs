"""POSIX-only E2E ownership primitives; never imported by production settings."""

import contextlib
import hashlib
import hmac
import json
import os
import secrets
import signal
import socket
import subprocess
import time
from urllib.request import ProxyHandler, Request, build_opener

LABEL = "devjobs.e2e"
SIGNALS = {signal.SIGINT, signal.SIGTERM}


@contextlib.contextmanager
def uninterrupted(ignore=False):
    """Children inherit the blocked mask; deliver pending signals after tracking."""
    previous = signal.pthread_sigmask(signal.SIG_BLOCK, SIGNALS)
    handlers = {sig: signal.getsignal(sig) for sig in SIGNALS} if ignore else {}
    for sig in handlers:
        signal.signal(sig, lambda signum, frame: None)
    try:
        yield
    finally:
        try:
            signal.pthread_sigmask(signal.SIG_SETMASK, previous)
        finally:
            for sig, handler in handlers.items():
                signal.signal(sig, handler)


def reserve_listener(port=0):
    listener = socket.socket()
    try:
        # No SO_REUSEPORT: bind is the OS-backed exclusive ownership lock.
        listener.bind(("127.0.0.1", port))
        listener.listen(128)
        return listener
    except BaseException:
        listener.close()
        raise


def signature(token, run, role, pid, challenge):
    return hmac.new(
        token.encode(), f"{run}:{role}:{pid}:{challenge}".encode(), hashlib.sha256
    ).hexdigest()


def wait_owned(process, url, token, run, role, attempts=200):
    opener = build_opener(ProxyHandler({}))
    for _ in range(attempts):
        if process.poll() is not None:
            raise RuntimeError(f"E2E {role} exited before readiness")
        challenge = secrets.token_hex(32)
        request = Request(f"{url}/__e2e_ready__", headers={"X-E2E-Challenge": challenge})
        try:
            with opener.open(request, timeout=0.5) as response:
                data = json.loads(response.read(4096))
            expected = signature(token, run, role, process.pid, challenge)
            if (data.get("run"), data.get("role"), data.get("pid")) != (
                run,
                role,
                process.pid,
            ) or not hmac.compare_digest(data.get("signature", ""), expected):
                raise RuntimeError(f"E2E {role} readiness ownership mismatch")
            if process.poll() is not None:
                raise RuntimeError(f"E2E {role} exited during readiness")
            return
        except (OSError, ValueError):
            time.sleep(0.1)
    raise RuntimeError(f"E2E {role} readiness failed")


class Resources:
    def __init__(self, run, docker):
        self.run = run
        self.docker = docker
        self.processes = []
        self.listeners = []
        self.creation_attempted = False

    def spawn(self, command, **kwargs):
        with uninterrupted():
            process = subprocess.Popen(command, **kwargs)
            self.processes.append(process)
        return process

    def cleanup(self):
        errors = []
        with uninterrupted(ignore=True):
            for process in reversed(self.processes):
                try:
                    # Reaped PIDs may be reused; never signal a finished child.
                    if process.poll() is not None:
                        continue
                    # Each live child owns a new session, including descendants.
                    try:
                        os.killpg(process.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    if process.poll() is None:
                        try:
                            process.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            os.killpg(process.pid, signal.SIGKILL)
                            process.wait(timeout=10)
                except (
                    OSError,
                    subprocess.SubprocessError,
                    RuntimeError,
                    ValueError,
                    KeyError,
                ) as error:
                    errors.append(type(error).__name__)
            for listener in self.listeners:
                listener.close()
            if self.creation_attempted:
                try:
                    owned = self.docker(
                        "ps", "-aq", "--filter", f"label={LABEL}={self.run}"
                    ).split()
                    for container in owned:
                        info = json.loads(self.docker("inspect", container))[0]
                        if info["Config"]["Labels"].get(LABEL) != self.run:
                            raise RuntimeError("Container ownership changed; refusing removal")
                        self.docker("rm", "--force", container)
                    if self.docker("ps", "-aq", "--filter", f"label={LABEL}={self.run}"):
                        raise RuntimeError("Owned container remains after cleanup")
                except (
                    OSError,
                    subprocess.SubprocessError,
                    RuntimeError,
                    ValueError,
                    KeyError,
                ) as error:
                    errors.append(type(error).__name__)
        if errors:
            raise RuntimeError("E2E cleanup failed: " + ", ".join(errors))


def child_environment():
    """An inherited blocked mask is cleared by each owned service at entry."""
    signal.pthread_sigmask(signal.SIG_UNBLOCK, SIGNALS)
    if os.environ.get("DEVJOBS_E2E") != "1" or not os.environ.get("E2E_READY_TOKEN"):
        raise RuntimeError("Owned E2E service environment required")


def verify_peer(directory, own, token, connection, env):
    """Optional two-run regression barrier; exchanges only public identities."""
    from pathlib import Path

    from django.core.exceptions import ImproperlyConfigured

    from config.e2e_safety import verify_connection

    path = Path(directory)
    temporary = path / f"{own['run']}.tmp"
    temporary.write_text(json.dumps(own))
    temporary.rename(path / f"{own['run']}.json")
    for _ in range(1200):
        peers = [item for item in path.glob("*.json") if item.stem != own["run"]]
        if peers:
            peer = json.loads(peers[0].read_text())
            break
        time.sleep(0.1)
    else:
        raise RuntimeError("Concurrent peer did not become ready")
    if (
        own["cluster"] == peer["cluster"]
        or len(
            {own[key] for key in ("backend", "frontend", "database")}
            | {peer[key] for key in ("backend", "frontend", "database")}
        )
        != 6
    ):
        raise RuntimeError("Concurrent resources overlap")
    for role in ("backend", "frontend"):
        # Real peer service must reject this runner's expected identity/token.
        process = type("Peer", (), {"pid": peer[f"{role}_pid"], "poll": lambda self: None})()
        try:
            wait_owned(process, peer[role], token, own["run"], role, attempts=1)
        except RuntimeError as error:
            if "ownership mismatch" not in str(error):
                raise
        else:
            raise RuntimeError("Cross-run service accepted")
    try:
        verify_connection(connection, {**env, "E2E_SYSTEM_IDENTIFIER": peer["cluster"]})
    except ImproperlyConfigured:
        pass
    else:
        raise RuntimeError("Cross-run database identity accepted")
    # Peer TCP endpoints are reachable on loopback, but per-run credentials must
    # not authenticate to the peer cluster. No query or write is issued there.
    from urllib.parse import urlsplit, urlunsplit

    import psycopg

    target = urlsplit(env["E2E_DATABASE_URL"])
    peer_port = urlsplit(peer["database"]).port
    peer_url = urlunsplit(
        target._replace(netloc=f"{target.username}:{target.password}@127.0.0.1:{peer_port}")
    )
    try:
        with psycopg.connect(peer_url, connect_timeout=3):
            raise RuntimeError("Cross-run database credentials accepted")
    except psycopg.OperationalError as error:
        if "password authentication failed" not in str(error):
            raise RuntimeError("Peer database credential rejection unverified") from None
    print(
        f"Concurrent isolation PASS run={own['run']} peer={peer['run']} services and cluster distinct",
        flush=True,
    )
    (path / f"{own['run']}.checked").touch()
    for _ in range(1200):
        if (path / f"{peer['run']}.checked").exists():
            return
        time.sleep(0.1)
    raise RuntimeError("Concurrent peer verification did not complete")
