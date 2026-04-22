from __future__ import annotations

import json
import os


def main() -> None:
    normalized = json.loads(os.environ["NORMALIZED_JSON"])
    print(
        json.dumps(
            {
                "summary": {
                    "status": "success",
                    "items": normalized["count"]
                },
                "evidence_count": normalized["count"],
                "evidence": normalized["items"]
            }
        )
    )


if __name__ == "__main__":
    main()
