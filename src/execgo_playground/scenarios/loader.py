from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any, Callable

from ..models import PromptPack, ScenarioExpected, ScenarioSpec, VerifierResult
from ..utils import read_json, repo_root


def load_scenario(scenario_id: str) -> ScenarioSpec:
    base = repo_root() / "scenarios" / scenario_id
    raw = read_json(base / "scenario.json")
    expected = read_json(base / "expected.json")
    prompt_dir = base / "prompt_pack"
    prompt_pack = PromptPack(
        system_prompt=(prompt_dir / "system.txt").read_text(encoding="utf-8").strip(),
        user_prompt=(prompt_dir / "user.txt").read_text(encoding="utf-8").strip(),
        constraints_prompt=(prompt_dir / "constraints.txt").read_text(encoding="utf-8").strip(),
    )
    return ScenarioSpec(
        id=raw["id"],
        description=raw["description"],
        seed=raw.get("seed", 7),
        input=raw.get("input", {}),
        prompt_pack=prompt_pack,
        expected=ScenarioExpected(checks=expected),
        verifier_ref=raw["verifier_ref"],
        allowed_chaos=raw.get("allowed_chaos", []),
        fixtures_dir=str(base / "fixtures"),
        scenario_dir=str(base),
    )


def load_verifier(ref: str) -> Callable[[ScenarioSpec, dict[str, Any]], VerifierResult]:
    module_name, attr = ref.split(":", maxsplit=1)
    module = importlib.import_module(module_name)
    verifier = getattr(module, attr)
    return verifier
