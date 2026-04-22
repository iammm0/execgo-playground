from __future__ import annotations

import json
import os
import signal
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_json(value: str) -> Any:
    try:
        return json.loads(value)
    except Exception:
        return None


class RuntimeTask:
    def __init__(self, task_id: str, execution: dict[str, Any]) -> None:
        self.task_id = task_id
        self.handle_id = f"{task_id}-{uuid.uuid4().hex[:8]}"
        self.execution = execution
        self.status = "accepted"
        self.output: Any = None
        self.error: dict[str, Any] | None = None
        self.started_at: str | None = None
        self.finished_at: str | None = None
        self.duration_ms = 0
        self.created_at = time.time()
        self.events: list[dict[str, Any]] = [
            {"type": "task_accepted", "task_id": self.task_id, "handle_id": self.handle_id, "timestamp": utc_now()}
        ]
        self.process: subprocess.Popen[str] | None = None
        self.lock = threading.Lock()

    def add_event(self, event_type: str, message: str = "", data: dict[str, Any] | None = None) -> None:
        self.events.append(
            {
                "type": event_type,
                "task_id": self.task_id,
                "handle_id": self.handle_id,
                "timestamp": utc_now(),
                "message": message,
                "data": data or {},
            }
        )

    def as_dict(self) -> dict[str, Any]:
        payload = {
            "task_id": self.task_id,
            "handle_id": self.handle_id,
            "status": self.status,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
        }
        if self.output is not None:
            payload["output"] = self.output
        if self.error is not None:
            payload["error"] = self.error
        return payload


class RuntimeStore:
    def __init__(self) -> None:
        self.tasks: dict[str, RuntimeTask] = {}
        self.handle_to_task: dict[str, str] = {}
        self.lock = threading.Lock()

    def create(self, task_id: str, execution: dict[str, Any]) -> RuntimeTask:
        task = RuntimeTask(task_id, execution)
        with self.lock:
            self.tasks[task_id] = task
            self.handle_to_task[task.handle_id] = task_id
        return task

    def get(self, ref: str) -> RuntimeTask | None:
        with self.lock:
            task_id = self.handle_to_task.get(ref, ref)
            return self.tasks.get(task_id)


STORE = RuntimeStore()


def run_task(task: RuntimeTask) -> None:
    started = time.time()
    task.status = "running"
    task.started_at = utc_now()
    task.add_event("task_started")
    kind = task.execution.get("kind")
    try:
        if kind == "command":
            run_command(task)
        elif kind == "emit":
            time.sleep(task.execution.get("delay_ms", 0) / 1000)
            task.output = task.execution.get("payload", {})
            task.status = "success"
        elif kind == "sleep":
            time.sleep(task.execution.get("duration_ms", 0) / 1000)
            task.output = {"slept_ms": task.execution.get("duration_ms", 0)}
            task.status = "success"
        elif kind == "fail":
            time.sleep(task.execution.get("delay_ms", 0) / 1000)
            task.error = {
                "code": task.execution.get("code", "external_failure"),
                "message": task.execution.get("message", "runtime requested failure"),
            }
            task.status = "failed"
        else:
            task.error = {"code": "invalid_input", "message": f"unsupported execution kind: {kind}"}
            task.status = "failed"
    except TimeoutError as exc:
        task.error = {"code": "timeout", "message": str(exc)}
        task.status = "failed"
    except Exception as exc:
        task.error = {"code": "external_failure", "message": str(exc)}
        task.status = "failed"
    finally:
        task.duration_ms = int((time.time() - started) * 1000)
        task.finished_at = utc_now()
        task.add_event(
            "task_succeeded" if task.status == "success" else "task_failed",
            data={"duration_ms": task.duration_ms},
        )


def run_command(task: RuntimeTask) -> None:
    program = task.execution["program"]
    args = [str(arg) for arg in task.execution.get("args", [])]
    cwd = task.execution.get("cwd") or None
    timeout_ms = int(task.execution.get("timeout_ms", 15000))
    env = os.environ.copy()
    env.update({key: str(value) for key, value in task.execution.get("env", {}).items()})
    Path(cwd or "/workspace").mkdir(parents=True, exist_ok=True)
    proc = subprocess.Popen(
        [program, *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=cwd,
        env=env,
    )
    task.process = proc
    try:
        stdout, stderr = proc.communicate(timeout=timeout_ms / 1000)
    except subprocess.TimeoutExpired as exc:
        proc.kill()
        proc.communicate()
        raise TimeoutError(f"command timed out after {timeout_ms} ms") from exc

    parsed = parse_json(stdout.strip()) if stdout.strip() else None
    if proc.returncode != 0:
        task.error = {
            "code": "exit_nonzero",
            "message": stderr.strip() or f"process exited with code {proc.returncode}",
            "details": {"stdout": stdout, "stderr": stderr, "exit_code": proc.returncode},
        }
        task.status = "failed"
        return

    task.output = parsed if parsed is not None else {"stdout": stdout, "stderr": stderr, "exit_code": proc.returncode}
    task.status = "success"


class Handler(BaseHTTPRequestHandler):
    server_version = "execgo-runtime-stub/0.1"

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/readyz":
            return self._json({"status": "ok"})
        if path == "/api/v1/runtime/info":
            return self._json({"name": "runtime-stub", "version": "0.1.0"})
        if path == "/api/v1/runtime/capabilities":
            return self._json({"execution_kinds": ["command", "emit", "sleep", "fail"]})
        if path == "/api/v1/runtime/resources":
            return self._json({"workspace": "/workspace", "cpu_count": os.cpu_count()})
        if path == "/api/v1/runtime/config":
            return self._json({"read_only_mount": "/playground", "workspace_mount": "/workspace"})
        if path.startswith("/api/v1/tasks/") and path.endswith("/events"):
            ref = path.removeprefix("/api/v1/tasks/").removesuffix("/events")
            task = STORE.get(ref)
            if task is None:
                return self._json({"error": {"code": "not_found", "message": "task not found"}}, status=404)
            return self._json({"events": task.events})
        if path.startswith("/api/v1/tasks/"):
            ref = path.removeprefix("/api/v1/tasks/")
            task = STORE.get(ref)
            if task is None:
                return self._json({"error": {"code": "not_found", "message": "task not found"}}, status=404)
            return self._json(task.as_dict())
        return self._json({"error": {"code": "not_found", "message": "unknown route"}}, status=404)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/v1/tasks":
            body = self._read_json()
            execution = body.get("execution")
            task_id = body.get("task_id")
            if not task_id or not isinstance(execution, dict):
                return self._json({"error": {"code": "invalid_input", "message": "task_id and execution are required"}}, status=400)
            task = STORE.create(task_id, execution)
            threading.Thread(target=run_task, args=(task,), daemon=True).start()
            return self._json({"task_id": task.task_id, "handle_id": task.handle_id, "status": task.status}, status=202)
        if path == "/control/fail-fast":
            os.kill(os.getpid(), signal.SIGTERM)
            return self._json({"status": "terminating"})
        if path.startswith("/api/v1/tasks/") and path.endswith("/kill"):
            ref = path.removeprefix("/api/v1/tasks/").removesuffix("/kill")
            task = STORE.get(ref)
            if task is None:
                return self._json({"error": {"code": "not_found", "message": "task not found"}}, status=404)
            if task.process and task.process.poll() is None:
                task.process.terminate()
            task.status = "cancelled"
            task.finished_at = utc_now()
            task.error = {"code": "cancelled", "message": "task cancelled"}
            task.add_event("task_cancelled")
            return self._json(task.as_dict())
        return self._json({"error": {"code": "not_found", "message": "unknown route"}}, status=404)

    def log_message(self, *_args: Any) -> None:
        return

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

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
