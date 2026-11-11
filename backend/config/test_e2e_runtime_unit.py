"""Deterministic ownership/failure tests; no Django setup or database access."""

import io
import json
import os
import signal
import socket
import subprocess
import threading
import unittest
from unittest.mock import MagicMock, patch

import run_browser
from config.e2e_runtime import Resources, reserve_listener, signature, wait_owned


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        self.process = MagicMock(pid=123)
        self.process.poll.return_value = None

    def response(self, data):
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value.read.return_value = json.dumps(
            data
        ).encode()
        return patch("config.e2e_runtime.build_opener", return_value=opener)

    def test_valid_identity_for_each_service(self):
        for role in ("backend", "frontend"):
            with (
                self.response(
                    {
                        "run": "run",
                        "role": role,
                        "pid": 123,
                        "signature": signature("secret", "run", role, 123, "challenge"),
                    }
                ),
                patch("config.e2e_runtime.secrets.token_hex", return_value="challenge"),
            ):
                wait_owned(self.process, "http://127.0.0.1:12345", "secret", "run", role)

    def test_wrong_tokens_other_runs_roles_pids_and_arbitrary_200_rejected(self):
        for role in ("backend", "frontend"):
            good = {
                "run": "run",
                "role": role,
                "pid": 123,
                "signature": signature("secret", "run", role, 123, "challenge"),
            }
            for data in (
                {},
                {**good, "signature": signature("wrong", "run", role, 123, "challenge")},
                {**good, "run": "another-run"},
                {**good, "pid": 999},
                {**good, "role": "development"},
            ):
                with (
                    self.subTest(role=role, data=data),
                    self.response(data),
                    patch("config.e2e_runtime.secrets.token_hex", return_value="challenge"),
                    self.assertRaisesRegex(RuntimeError, "ownership mismatch"),
                ):
                    wait_owned(self.process, "http://127.0.0.1:12345", "secret", "run", role)

    def test_failed_service_startup(self):
        self.process.poll.return_value = 1
        with self.assertRaisesRegex(RuntimeError, "exited before readiness"):
            wait_owned(self.process, "http://127.0.0.1:12345", "secret", "run", "backend")

    def test_unavailable_service_times_out(self):
        with (
            patch("config.e2e_runtime.build_opener") as opener,
            patch("config.e2e_runtime.time.sleep"),
        ):
            opener.return_value.open.side_effect = OSError("not listening")
            with self.assertRaisesRegex(RuntimeError, "readiness failed"):
                wait_owned(
                    self.process, "http://127.0.0.1:12345", "secret", "run", "frontend", attempts=2
                )


class PortTests(unittest.TestCase):
    def test_existing_development_listener_and_port_collision_are_preserved(self):
        with reserve_listener() as development:
            port = development.getsockname()[1]
            with self.assertRaises(OSError):
                reserve_listener(port)
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                pass

    def test_simultaneous_allocations_keep_distinct_reserved_ports(self):
        barrier = threading.Barrier(2)
        ports = []
        errors = []

        def allocate():
            try:
                with reserve_listener() as backend, reserve_listener() as frontend:
                    ports.extend([backend.getsockname()[1], frontend.getsockname()[1]])
                    barrier.wait(timeout=5)
                    for port in ports:
                        with self.assertRaises(OSError):
                            reserve_listener(port)
                    barrier.wait(timeout=5)
            except (OSError, AssertionError, threading.BrokenBarrierError) as error:
                errors.append(error)

        threads = [threading.Thread(target=allocate) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)
        self.assertEqual(errors, [])
        self.assertEqual(len(set(ports)), 4)


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.containers = {"unrelated": "other-run"}
        self.removed = []

    def docker(self, *args, **kwargs):
        if args[0] == "ps":
            run = args[-1].rsplit("=", 1)[1]
            return "\n".join(key for key, owner in self.containers.items() if owner == run)
        if args[0] == "inspect":
            return json.dumps([{"Config": {"Labels": {"devjobs.e2e": self.containers[args[1]]}}}])
        if args[0] == "rm":
            self.removed.append(args[-1])
            del self.containers[args[-1]]
        return ""

    def test_repeated_cleanup_only_removes_exact_owned_label(self):
        self.containers["owned"] = "this-run"
        resources = Resources("this-run", self.docker)
        resources.creation_attempted = True
        resources.cleanup()
        resources.cleanup()
        self.assertEqual(self.removed, ["owned"])
        self.assertEqual(self.containers, {"unrelated": "other-run"})

    def test_changed_ownership_refuses_removal(self):
        fake = MagicMock(
            side_effect=["foreign", json.dumps([{"Config": {"Labels": {"devjobs.e2e": "other"}}}])]
        )
        resources = Resources("this-run", fake)
        resources.creation_attempted = True
        with self.assertRaisesRegex(RuntimeError, "cleanup failed"):
            resources.cleanup()
        self.assertFalse(any(call.args[0] == "rm" for call in fake.call_args_list))

    def test_interrupt_during_creation_discovers_container_without_returned_id(self):
        for signum in (signal.SIGINT, signal.SIGTERM):
            old = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
            run = "synthetic-run"

            def create(*args, run=run, signum=signum, **kwargs):
                if args[0] == "create":
                    self.containers["new-owned"] = run
                    # Pending signal delivered when creation critical section exits.
                    os.kill(os.getpid(), signum)
                    return "new-owned"
                return self.docker(*args, **kwargs)

            try:
                with (
                    patch.object(run_browser, "docker", side_effect=create),
                    patch.object(run_browser.shutil, "which", return_value="/docker"),
                    patch.object(run_browser.uuid, "uuid4") as uuid,
                    patch("sys.stdout", new=io.StringIO()),
                ):
                    uuid.return_value.hex = run
                    with self.assertRaises(SystemExit) as result:
                        run_browser.main()
                    self.assertEqual(result.exception.code, 128 + signum)
                self.assertNotIn("new-owned", self.containers)
                self.assertIn("unrelated", self.containers)
            finally:
                for sig, handler in old.items():
                    signal.signal(sig, handler)

    def test_create_command_failure_still_discovers_owned_container(self):
        old = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}

        def create(*args, **kwargs):
            if args[0] == "create":
                self.containers["created-before-cli-failure"] = "synthetic-run"
                raise subprocess.CalledProcessError(1, ["docker", "create"])
            return self.docker(*args, **kwargs)

        try:
            with (
                patch.object(run_browser, "docker", side_effect=create),
                patch.object(run_browser.shutil, "which", return_value="/docker"),
                patch.object(run_browser.uuid, "uuid4") as uuid,
                patch("sys.stdout", new=io.StringIO()),
            ):
                uuid.return_value.hex = "synthetic-run"
                with self.assertRaises(subprocess.CalledProcessError):
                    run_browser.main()
            self.assertNotIn("created-before-cli-failure", self.containers)
            self.assertIn("unrelated", self.containers)
        finally:
            for sig, handler in old.items():
                signal.signal(sig, handler)

    def test_second_signal_during_cleanup_does_not_interrupt_removal(self):
        self.containers["owned"] = "this-run"
        resources = Resources("this-run", self.docker)
        resources.creation_attempted = True
        original = self.docker

        def interrupted_cleanup(*args, **kwargs):
            if args[0] == "rm":
                os.kill(os.getpid(), signal.SIGTERM)
                os.kill(os.getpid(), signal.SIGINT)
            return original(*args, **kwargs)

        resources.docker = interrupted_cleanup
        resources.cleanup()
        self.assertEqual(self.removed, ["owned"])

    def test_cleanup_failure_preserves_original_failure(self):
        old = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
        original = subprocess.CalledProcessError(42, ["docker", "create"])
        try:
            with (
                patch.object(run_browser, "docker", side_effect=["version", original]),
                patch.object(run_browser.shutil, "which", return_value="/docker"),
                patch.object(run_browser, "reserve_listener", return_value=MagicMock()),
                patch.object(
                    Resources, "cleanup", side_effect=RuntimeError("synthetic cleanup failure")
                ),
                patch("sys.stderr", new=io.StringIO()),
            ):
                with self.assertRaises(subprocess.CalledProcessError) as failure:
                    run_browser.main()
                self.assertIs(failure.exception, original)
                self.assertEqual(failure.exception.returncode, 42)
        finally:
            for sig, handler in old.items():
                signal.signal(sig, handler)

    def test_missing_docker_and_missing_daemon_fail_before_resources(self):
        old = {sig: signal.getsignal(sig) for sig in (signal.SIGINT, signal.SIGTERM)}
        try:
            with (
                patch.object(run_browser.shutil, "which", return_value=None),
                patch.object(run_browser, "docker") as docker,
            ):
                with self.assertRaisesRegex(RuntimeError, "Docker is required"):
                    run_browser.main()
                docker.assert_not_called()
            with (
                patch.object(run_browser.shutil, "which", return_value="/docker"),
                patch.object(
                    run_browser,
                    "docker",
                    side_effect=subprocess.CalledProcessError(1, ["docker", "info"]),
                ) as docker,
            ):
                with self.assertRaises(subprocess.CalledProcessError):
                    run_browser.main()
                self.assertEqual(docker.call_count, 1)
        finally:
            for sig, handler in old.items():
                signal.signal(sig, handler)
