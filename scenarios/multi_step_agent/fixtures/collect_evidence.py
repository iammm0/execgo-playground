from __future__ import annotations

import json


def main() -> None:
    print(
        json.dumps(
            {
                "items": [
                    {"kind": "observation", "value": "runtime health is green"},
                    {"kind": "artifact", "value": "fixture scan emitted 2 findings"},
                    {"kind": "diagnostic", "value": "timeline captured every stage"}
                ]
            }
        )
    )


if __name__ == "__main__":
    main()
