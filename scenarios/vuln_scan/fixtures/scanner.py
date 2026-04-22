from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path


def version_tuple(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in value.split("."))


def main() -> None:
    manifest_path = Path(sys.argv[1])
    advisory_url = sys.argv[2]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    with urllib.request.urlopen(advisory_url, timeout=10) as response:
        advisories = json.loads(response.read().decode("utf-8"))["advisories"]

    findings = []
    for dep in manifest["dependencies"]:
        for advisory in advisories:
            if dep["name"] != advisory["package"]:
                continue
            if version_tuple(dep["version"]) < version_tuple(advisory["affected_below"]):
                findings.append(
                    {
                        "id": advisory["id"],
                        "package": dep["name"],
                        "version": dep["version"],
                        "severity": advisory["severity"],
                    }
                )
    payload = {
        "findings": findings,
        "summary": {
            "total": len(findings),
            "high": sum(1 for item in findings if item["severity"] == "high"),
            "medium": sum(1 for item in findings if item["severity"] == "medium")
        }
    }
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
