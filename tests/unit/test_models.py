from __future__ import annotations

import pytest

from execgo_playground.models import ExecGoTask, ExecGoTaskGraph


def test_task_graph_rejects_unknown_dependency() -> None:
    with pytest.raises(ValueError):
        ExecGoTaskGraph(
            tasks=[
                ExecGoTask(id="a", type="runtime"),
                ExecGoTask(id="b", type="runtime", depends_on=["missing"]),
            ]
        )


def test_task_graph_accepts_valid_dag() -> None:
    graph = ExecGoTaskGraph(
        tasks=[
            ExecGoTask(id="a", type="runtime"),
            ExecGoTask(id="b", type="runtime", depends_on=["a"]),
        ]
    )
    assert len(graph.tasks) == 2
