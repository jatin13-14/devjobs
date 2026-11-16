"""Own a fresh container, verify cluster identity, run E2E, then remove only it."""

import argparse
import json
import os
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

from config.e2e_runtime import Resources, reserve_listener, uninterrupted, verify_peer, wait_owned

ROOT = Path(__file__).resolve().parent


def docker(*args, **kwargs):
    return subprocess.check_output(["docker", *args], text=True, **kwargs).strip()


def stop_run(signum, frame):
    raise SystemExit(128 + signum)


def main(*, backend_only=False):
    signal.signal(signal.SIGTERM, stop_run)
    signal.signal(signal.SIGINT, stop_run)
    if not shutil.which("docker"):
        raise RuntimeError("Docker is required; no existing database will be used")
    docker("info", "--format", "{{.ServerVersion}}")
    run = uuid.uuid4().hex
    name = f"devjobs-e2e-{run}"
    password = secrets.token_urlsafe(32)
    environment = {**os.environ, "POSTGRES_PASSWORD": password}
    container = None
    resources = Resources(run, docker)
    result = None
    with tempfile.TemporaryDirectory(prefix="devjobs-e2e-") as directory:
        try:
            with uninterrupted():
                backend_socket = reserve_listener()
                resources.listeners.append(backend_socket)
                frontend_socket = reserve_listener()
                resources.listeners.append(frontend_socket)
            backend_url = f"http://127.0.0.1:{backend_socket.getsockname()[1]}"
            frontend_url = f"http://127.0.0.1:{frontend_socket.getsockname()[1]}"
            # Block signals through daemon creation and assignment. Children inherit
            # this mask, so terminal SIGINT cannot interrupt the Docker CLI either.
            with uninterrupted():
                resources.creation_attempted = True
                container = docker(
                    "create",
                    "--name",
                    name,
                    "--label",
                    f"devjobs.e2e={run}",
                    "--publish",
                    "127.0.0.1::5432",
                    "--tmpfs",
                    "/var/lib/postgresql/data",
                    "--env",
                    "POSTGRES_PASSWORD",
                    "--env",
                    "POSTGRES_USER=e2e_owner",
                    "--env",
                    "POSTGRES_DB=devjobs_e2e_disposable",
                    "postgres:17.5",
                    env=environment,
                )
            with uninterrupted():
                docker("start", container)
            info = json.loads(docker("inspect", container))[0]
            if info["Config"]["Labels"].get("devjobs.e2e") != run or any(
                mount["Type"] != "tmpfs" for mount in info["Mounts"]
            ):
                raise RuntimeError("Unexpected container ownership or persistent mounts")
            binding = info["NetworkSettings"]["Ports"]["5432/tcp"][0]
            if binding["HostIp"] != "127.0.0.1":
                raise RuntimeError("Database must be bound to loopback only")
            for _ in range(120):
                ready = subprocess.run(
                    [
                        "docker",
                        "exec",
                        container,
                        "pg_isready",
                        "-h",
                        "127.0.0.1",
                        "-U",
                        "e2e_owner",
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
                if ready.returncode == 0:
                    break
                time.sleep(0.5)
            else:
                raise RuntimeError("Disposable PostgreSQL did not become ready")
            identifier = docker(
                "exec",
                container,
                "psql",
                "-U",
                "e2e_owner",
                "-d",
                "devjobs_e2e_disposable",
                "-Atc",
                "SELECT system_identifier FROM pg_control_system()",
            )
            for key in tuple(os.environ):
                if key == "DATABASE_URL" or key.startswith("PG"):
                    os.environ.pop(key)
            os.environ.update(
                PYTHON_DOTENV_DISABLED="1",
                DEVJOBS_E2E="1",
                E2E_RUN_ID=run,
                E2E_SYSTEM_IDENTIFIER=identifier,
                E2E_DATABASE_URL=(
                    f"postgresql://e2e_owner:{password}@127.0.0.1:"
                    f"{binding['HostPort']}/devjobs_e2e_disposable"
                ),
                DJANGO_SETTINGS_MODULE="config.settings.e2e",
                DJANGO_SECRET_KEY=secrets.token_urlsafe(48),
                PRIVATE_RESUME_ROOT=directory,
                PRIVATE_RESUME_STORAGE_BACKEND="",
                JWT_TOKEN_RATE="5/minute",
                E2E_BACKEND_URL=backend_url,
                E2E_FRONTEND_URL=frontend_url,
                E2E_READY_TOKEN=secrets.token_urlsafe(48),
                E2E_ARTIFACT_ROOT=directory,
                E2E_FIXTURE_PASSWORD=secrets.token_urlsafe(24),
            )
            import django

            django.setup()
            from django.db import connection

            from config.e2e_safety import verify_connection

            verify_connection(connection, os.environ)
            print(
                f"Verified owned container={container[:12]} run={run} "
                f"cluster={identifier} database=devjobs_e2e_disposable "
                f"host=127.0.0.1:{binding['HostPort']} PostgreSQL=17",
                flush=True,
            )

            def checked(command):
                child = resources.spawn(
                    [sys.executable, str(ROOT / "e2e_exec.py"), *command],
                    cwd=ROOT,
                    start_new_session=True,
                )
                if child.wait():
                    raise RuntimeError("E2E verification command failed")

            checked([sys.executable, "manage.py", "migrate", "--noinput"])
            for command in (
                [sys.executable, "manage.py", "check"],
                [sys.executable, "manage.py", "makemigrations", "--check", "--dry-run"],
                [sys.executable, "-m", "pytest", "--ds=config.settings.e2e"],
            ):
                checked(command)
            if backend_only:
                print("Backend-only owned PostgreSQL verification PASS", flush=True)
                return 0
            from apps.accounts.models import User

            email = f"e2e-admin-{run}@example.test"
            User.objects.create_superuser(email, os.environ["E2E_FIXTURE_PASSWORD"])
            os.environ.update(
                E2E_ADMIN_EMAIL=email, E2E_ADMIN_PASSWORD=os.environ["E2E_FIXTURE_PASSWORD"]
            )
            # Skills scenarios must not consume the anonymous login/registration
            # quota used by the authentication regression scenarios in this run.
            from rest_framework_simplejwt.tokens import RefreshToken

            from apps.candidates.models import CandidateProfile

            skills_accounts = {}
            for suffix in ("workflow", "tab-a", "tab-b"):
                candidate = User.objects.create_user(f"skills-{suffix}-{run}@example.test")
                CandidateProfile.objects.create(
                    user=candidate, full_name=f"Synthetic skills {suffix}"
                )
                refresh = RefreshToken.for_user(candidate)
                skills_accounts[suffix] = {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": {"id": str(candidate.pk), "role": candidate.role},
                }
            os.environ["E2E_SKILLS_ACCOUNTS"] = json.dumps(skills_accounts)
            connection.close()
            identities = {}
            for role, listener, command, cwd in (
                ("backend", backend_socket, [sys.executable, str(ROOT / "e2e_server.py")], ROOT),
                (
                    "frontend",
                    frontend_socket,
                    ["node", "scripts/e2e-server.mjs"],
                    ROOT.parent / "frontend",
                ),
            ):
                environment = {
                    **os.environ,
                    "E2E_LISTEN_FD": str(listener.fileno()),
                    "VITE_API_BASE_URL": f"{backend_url}/api/v1",
                }
                child = resources.spawn(
                    [sys.executable, str(ROOT / "e2e_exec.py"), *command],
                    cwd=cwd,
                    env=environment,
                    pass_fds=(listener.fileno(),),
                    start_new_session=True,
                )
                identities[f"{role}_pid"] = child.pid
                wait_owned(
                    child,
                    backend_url if role == "backend" else frontend_url,
                    os.environ["E2E_READY_TOKEN"],
                    run,
                    role,
                )
                print(
                    f"Verified {role} ownership run={run} pid={child.pid} endpoint={backend_url if role == 'backend' else frontend_url}",
                    flush=True,
                )
            if os.environ.get("E2E_CONCURRENCY_DIRECTORY"):
                verify_peer(
                    os.environ["E2E_CONCURRENCY_DIRECTORY"],
                    {
                        "run": run,
                        "cluster": identifier,
                        "backend": backend_url,
                        "frontend": frontend_url,
                        "database": f"http://127.0.0.1:{binding['HostPort']}",
                        **identities,
                    },
                    os.environ["E2E_READY_TOKEN"],
                    connection,
                    os.environ,
                )
                connection.close()
            browser = resources.spawn(
                [sys.executable, str(ROOT / "e2e_exec.py"), "npm", "run", "test:e2e"],
                cwd=ROOT.parent / "frontend",
                start_new_session=True,
            )
            result = browser.wait()
            return result
        finally:
            original_failure = sys.exc_info()[0] is not None or result not in (None, 0)
            try:
                resources.cleanup()
                print(f"Cleaned owned resources run={run}", flush=True)
            except Exception:
                if not original_failure:
                    raise
                print(f"Cleanup failed for run={run}; original failure preserved", file=sys.stderr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend-only",
        action="store_true",
        help="Verify owned PostgreSQL without browser fixtures or services",
    )
    raise SystemExit(main(backend_only=parser.parse_args().backend_only))
