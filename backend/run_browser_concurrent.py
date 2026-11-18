"""Run two complete isolated runners and verify cross-run ownership rejection."""

import os
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

from config.e2e_runtime import uninterrupted
from run_browser import stop_run

ROOT = Path(__file__).resolve().parent


def main():
    signal.signal(signal.SIGINT, stop_run)
    signal.signal(signal.SIGTERM, stop_run)
    processes = []
    with tempfile.TemporaryDirectory(prefix="devjobs-concurrent-") as directory:
        try:
            for _ in range(2):
                with uninterrupted():
                    processes.append(
                        subprocess.Popen(
                            [
                                sys.executable,
                                str(ROOT / "e2e_exec.py"),
                                sys.executable,
                                str(ROOT / "run_browser.py"),
                            ],
                            env={**os.environ, "E2E_CONCURRENCY_DIRECTORY": directory},
                        )
                    )
            results = [process.wait() for process in processes]
            if len(list(Path(directory).glob("*.checked"))) != 2:
                raise RuntimeError("Both concurrent identity checks must complete")
            return 0 if results == [0, 0] else 1
        finally:
            with uninterrupted(ignore=True):
                for process in processes:
                    if process.poll() is None:
                        process.terminate()
                for process in processes:
                    if process.poll() is None:
                        process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
