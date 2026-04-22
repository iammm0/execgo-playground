from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    project_dir = Path(sys.argv[1])
    target = project_dir / "math_ops.py"
    source = target.read_text(encoding="utf-8")
    target.write_text(source.replace("return a - b", "return a + b"), encoding="utf-8")
    print(json.dumps({"patched_files": ["math_ops.py"], "workspace_dir": str(project_dir)}))


if __name__ == "__main__":
    main()
