from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    workspace = Path(sys.argv[1])
    markers = sorted(path.stem for path in workspace.glob("*.txt"))
    print(json.dumps({"lineage": markers, "summary": {"status": "success"}}))


if __name__ == "__main__":
    main()
