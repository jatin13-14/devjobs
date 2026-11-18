"""Clear inherited signal mask before exec; keep PID and explicitly passed FDs."""

import os
import signal
import sys

signal.pthread_sigmask(signal.SIG_UNBLOCK, {signal.SIGINT, signal.SIGTERM})
os.execvpe(sys.argv[1], sys.argv[1:], os.environ)
