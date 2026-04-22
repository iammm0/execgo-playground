from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    workspace = Path(sys.argv[1])
    marker = sys.argv[2]
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / f"{marker}.txt").write_text(marker, encoding="utf-8")
    print(json.dumps({"marker": marker}))


if __name__ == "__main__":
    main()
