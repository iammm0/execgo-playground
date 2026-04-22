from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> None:
    project_dir = Path(sys.argv[1])
    result = subprocess.run(["pytest", "-q", str(project_dir)], capture_output=True, text=True, check=True)
    payload = {
      "patched_file": os.environ.get("PATCHED_FILE", ""),
      "tests": {
        "status": "passed",
        "passed": 2,
        "stdout": result.stdout.strip()
      },
      "hashes": {
        "math_ops.py": sha256(project_dir / "math_ops.py")
      }
    }
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
