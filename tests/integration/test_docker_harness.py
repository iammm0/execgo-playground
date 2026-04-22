from __future__ import annotations

import pytest

from execgo_playground.models import ModelProfile
from execgo_playground.runner import ExperimentRunner
from execgo_playground.utils import env_flag


pytestmark = pytest.mark.skipif(
    not env_flag("EXECGO_PLAYGROUND_RUN_DOCKER_TESTS"),
    reason="Set EXECGO_PLAYGROUND_RUN_DOCKER_TESTS=1 to run Docker integration tests",
)


def test_replay_smoke_with_docker_harness() -> None:
    runner = ExperimentRunner()
    result = runner.run(
        framework="langgraph",
        scenario_id="codegen_exec",
        mode="replay",
        chaos_profile_id="none",
        model_profile=ModelProfile(provider="mock"),
    )
    assert result.verdict.passed
