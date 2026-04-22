from __future__ import annotations

import json
import os


def main() -> None:
    evidence = json.loads(os.environ["EVIDENCE_JSON"])
    normalized = {
        "items": [item["value"] for item in evidence["items"]],
        "count": len(evidence["items"]),
        "status": "normalized"
    }
    print(json.dumps(normalized))


if __name__ == "__main__":
    main()
