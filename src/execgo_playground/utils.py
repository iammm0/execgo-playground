from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def ensure_dir(path: str | Path) -> Path:
    target = Path(path)
    target.mkdir(parents=True, exist_ok=True)
    return target


def write_json(path: str | Path, data: Any) -> Path:
    output = Path(path)
    ensure_dir(output.parent)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def write_jsonl(path: str | Path, rows: list[dict[str, Any]]) -> Path:
    output = Path(path)
    ensure_dir(output.parent)
    with output.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return output


def write_text(path: str | Path, content: str) -> Path:
    output = Path(path)
    ensure_dir(output.parent)
    output.write_text(content, encoding="utf-8")
    return output


def read_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(64 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def deep_get(payload: Any, path: str) -> Any:
    current = payload
    if not path:
        return current
    for raw_part in path.split("."):
        if raw_part == "":
            continue
        if isinstance(current, list):
            current = current[int(raw_part)]
            continue
        if not isinstance(current, dict):
            raise KeyError(path)
        current = current[raw_part]
    return current


def deep_set(payload: dict[str, Any], path: str, value: Any) -> None:
    parts = [part for part in path.split(".") if part]
    if not parts:
        raise ValueError("target path must not be empty")
    current: Any = payload
    for part in parts[:-1]:
        if isinstance(current, list):
            current = current[int(part)]
            continue
        next_value = current.get(part)
        if next_value is None:
            next_value = {}
            current[part] = next_value
        current = next_value
    final = parts[-1]
    if isinstance(current, list):
        current[int(final)] = value
    else:
        current[final] = value


def copytree(src: str | Path, dst: str | Path) -> None:
    src_path = Path(src)
    dst_path = Path(dst)
    if dst_path.exists():
        shutil.rmtree(dst_path)
    shutil.copytree(src_path, dst_path)


def env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}
