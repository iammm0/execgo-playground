from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any

from .models import SubmitPolicy


class ExecGoClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def adapter_capabilities(self) -> dict[str, Any]:
        return self._request("GET", "/adapters/capabilities")

    def adapter_tools(self) -> dict[str, Any]:
        return self._request("GET", "/adapters/tools")

    def adapter_translate(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/adapters/translate", payload)

    def adapter_actions(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/adapters/actions", payload)

    def submit_tasks(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/tasks", payload)

    def get_task(self, task_id: str) -> dict[str, Any]:
        return self._request("GET", f"/tasks/{task_id}")

    def metrics(self) -> dict[str, Any]:
        return self._request("GET", "/metrics")

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def wait_for_tasks(self, task_ids: list[str], policy: SubmitPolicy) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        snapshots: list[dict[str, Any]] = []
        terminal = {"success", "failed", "skipped"}
        tasks: list[dict[str, Any]] = []
        for _ in range(policy.max_attempts):
            tasks = []
            for task_id in task_ids:
                try:
                    task = self.get_task(task_id)
                except urllib.error.HTTPError as exc:
                    if exc.code == 404:
                        task = {"id": task_id, "status": "pending", "error": "not yet visible"}
                    else:
                        raise
                tasks.append(task)
            snapshots.append(
                {
                    "tasks": tasks,
                    "metrics": self.metrics(),
                    "timestamp_ms": int(time.time() * 1000),
                }
            )
            if tasks and all(task.get("status") in terminal for task in tasks):
                return tasks, snapshots
            time.sleep(policy.poll_interval_ms / 1000)
        return tasks, snapshots

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        raw: bytes | None = None
        headers = {}
        if payload is not None:
            raw = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(f"{self.base_url}{path}", data=raw, method=method, headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
        if not body:
            return {}
        return json.loads(body.decode("utf-8"))
