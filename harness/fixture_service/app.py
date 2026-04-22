from __future__ import annotations

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


STATE = {"latency_ms": 0, "fail_mode": "none"}
LOCK = threading.Lock()

ADVISORIES = [
    {"package": "flask", "affected_below": "2.0.0", "id": "CVE-2023-0001", "severity": "high"},
    {"package": "requests", "affected_below": "2.31.0", "id": "CVE-2024-0002", "severity": "medium"},
]


class Handler(BaseHTTPRequestHandler):
    server_version = "fixture-service/0.1"

    def do_GET(self) -> None:
        if self.path == "/healthz":
            return self._json({"status": "ok", "mode": STATE.copy()})
        if self.path == "/vuln/advisories":
            self._maybe_delay()
            if self._mode() == "error":
                return self._json({"error": "fixture service failure"}, status=503)
            return self._json({"advisories": ADVISORIES})
        return self._json({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        if self.path != "/control":
            return self._json({"error": "not found"}, status=404)
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        with LOCK:
            STATE["latency_ms"] = int(payload.get("latency_ms", 0))
            STATE["fail_mode"] = payload.get("fail_mode", "none")
        return self._json({"status": "updated", "mode": STATE.copy()})

    def log_message(self, *_args: Any) -> None:
        return

    def _mode(self) -> str:
        with LOCK:
            return str(STATE["fail_mode"])

    def _maybe_delay(self) -> None:
        with LOCK:
            latency_ms = int(STATE["latency_ms"])
        if latency_ms > 0:
            time.sleep(latency_ms / 1000)

    def _json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    server.serve_forever()
