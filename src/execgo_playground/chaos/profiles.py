from __future__ import annotations

from pathlib import Path

from ..models import ChaosProfile
from ..utils import read_json, repo_root


def load_chaos_profile(profile_id: str) -> ChaosProfile:
    path = repo_root() / "chaos" / "profiles" / f"{profile_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"missing chaos profile: {profile_id}")
    return ChaosProfile.model_validate(read_json(path))
