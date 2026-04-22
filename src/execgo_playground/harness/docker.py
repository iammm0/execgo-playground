from __future__ import annotations

import json
import subprocess
import urllib.request
from pathlib import Path
from typing import Any

from ..utils import ensure_dir, repo_root


class DockerHarness:
    def __init__(self, project_name: str = "execgo-playground") -> None:
        self.project_name = project_name
        self.repo_root = repo_root()
        self.compose_file = self.repo_root / "harness" / "docker-compose.yml"
        self.workspace_dir = ensure_dir(self.repo_root / "var" / "workspace")
        self.run_root = ensure_dir(self.repo_root / "var" / "runs")
        self.execgo_url = "http://127.0.0.1:18080"
        self.runtime_url = "http://127.0.0.1:18081"
        self.fixture_url = "http://127.0.0.1:18082"

    def up(self, build: bool = False) -> None:
        args = self._compose_args("up", "-d")
        if build:
            args.append("--build")
        self._run(args)

    def down(self) -> None:
        self._run(self._compose_args("down", "--remove-orphans", "--volumes"))

    def restart_service(self, service: str) -> None:
        self._run(self._compose_args("restart", service))

    def kill_service(self, service: str) -> None:
        self._run(self._compose_args("kill", service))

    def update_service_resources(self, service: str, *, cpus: str | None = None, memory: str | None = None) -> None:
        container_id = self._run(self._compose_args("ps", "-q", service), capture_output=True).strip()
        if not container_id:
            raise RuntimeError(f"service {service} is not running")
        args = ["docker", "update"]
        if cpus:
            args.extend(["--cpus", cpus])
        if memory:
            args.extend(["--memory", memory])
        args.append(container_id)
        self._run(args)

    def status(self) -> dict[str, Any]:
        return {
            "execgo": self._get_json(f"{self.execgo_url}/health"),
            "runtime": self._get_json(f"{self.runtime_url}/readyz"),
            "fixtures": self._get_json(f"{self.fixture_url}/healthz"),
        }

    def reset_fixture_mode(self) -> None:
        self.configure_fixture_mode(latency_ms=0, fail_mode="none")

    def configure_fixture_mode(self, *, latency_ms: int = 0, fail_mode: str = "none") -> None:
        data = json.dumps({"latency_ms": latency_ms, "fail_mode": fail_mode}).encode("utf-8")
        request = urllib.request.Request(
            f"{self.fixture_url}/control",
            data=data,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=10):
            pass

    def _compose_args(self, *parts: str) -> list[str]:
        return [
            "docker",
            "compose",
            "-p",
            self.project_name,
            "-f",
            str(self.compose_file),
            *parts,
        ]

    def _run(self, args: list[str], *, capture_output: bool = False) -> str:
        result = subprocess.run(
            args,
            cwd=self.repo_root,
            check=True,
            text=True,
            capture_output=capture_output,
        )
        return result.stdout if capture_output else ""

    def _get_json(self, url: str) -> dict[str, Any]:
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
