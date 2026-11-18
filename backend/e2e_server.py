"""Test-only WSGI server adopting the runner's continuously reserved socket."""

import json
import os
import socket
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer

from config.e2e_runtime import child_environment, signature


class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class QuietHandler(WSGIRequestHandler):
    def log_message(self, format, *args):
        pass


def main():
    child_environment()
    from django.core.wsgi import get_wsgi_application

    application = get_wsgi_application()

    def owned_application(environ, start_response):
        if environ["PATH_INFO"] == "/__e2e_ready__":
            challenge = environ.get("HTTP_X_E2E_CHALLENGE", "")
            if len(challenge) != 64:
                start_response("404 Not Found", [])
                return [b""]
            run, token = os.environ["E2E_RUN_ID"], os.environ["E2E_READY_TOKEN"]
            body = json.dumps(
                {
                    "run": run,
                    "role": "backend",
                    "pid": os.getpid(),
                    "signature": signature(token, run, "backend", os.getpid(), challenge),
                }
            ).encode()
            start_response(
                "200 OK", [("Content-Type", "application/json"), ("Cache-Control", "no-store")]
            )
            return [body]
        return application(environ, start_response)

    listener = socket.socket(fileno=int(os.environ["E2E_LISTEN_FD"]))
    server = ThreadedServer(listener.getsockname(), QuietHandler, bind_and_activate=False)
    server.socket.close()
    server.socket = listener
    server.server_name = "127.0.0.1"
    server.server_port = listener.getsockname()[1]
    server.setup_environ()
    server.set_app(owned_application)
    server.serve_forever()


if __name__ == "__main__":
    main()
