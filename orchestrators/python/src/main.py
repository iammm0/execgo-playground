import argparse
import json
import time
from dataclasses import dataclass, field
from typing import Any

import requests


@dataclass
class TrainingState:
    request: dict[str, Any]
    taskGraph: dict[str, Any] = field(default_factory=dict)
    submission: dict[str, Any] = field(default_factory=dict)
    taskStates: list[dict[str, Any]] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)
    finalReport: dict[str, Any] = field(default_factory=dict)


def build_plan(st: TrainingState) -> None:
    st.taskGraph = {"tasks": st.request["tasks"]}


def validate_plan(st: TrainingState) -> None:
    if not st.request.get("tasks"):
        raise ValueError("tasks is empty")


def submit_to_execgo(st: TrainingState) -> None:
    endpoint = st.request["execgo_endpoint"].rstrip("/")
    resp = requests.post(f"{endpoint}/tasks", json={"tasks": st.request["tasks"]}, timeout=15)
    resp.raise_for_status()
    st.submission = resp.json() if resp.content else {}


def poll_until_done(st: TrainingState) -> None:
    endpoint = st.request["execgo_endpoint"].rstrip("/")
    poll = st.request.get("poll", {})
    interval = int(poll.get("interval_ms", 1000))
    max_attempts = int(poll.get("max_attempts", 120))

    for _ in range(max_attempts):
        resp = requests.get(f"{endpoint}/tasks", timeout=15)
        resp.raise_for_status()
        actual = resp.json() if resp.content else []
        st.taskStates = collect_task_states(st.request["tasks"], actual)
        if is_terminal(st.taskStates):
            return
        time.sleep(interval / 1000.0)
    raise TimeoutError("poll timeout")


def analyze_failure(st: TrainingState) -> None:
    for t in st.taskStates:
        if t["status"] == "failed" and not t.get("failure_reason"):
            t["failure_reason"] = "execgo_task_failed"
        if t["status"] == "skipped" and not t.get("failure_reason"):
            t["failure_reason"] = "blocked_by_dependency"


def finalize_report(st: TrainingState) -> None:
    count = {"pending": 0, "running": 0, "success": 0, "failed": 0, "skipped": 0}
    for t in st.taskStates:
        if t["status"] in count:
            count[t["status"]] += 1

    final_status = "success"
    if count["failed"] > 0:
        final_status = "failed"
    elif count["pending"] > 0 or count["running"] > 0:
        final_status = "partial_failure"

    st.finalReport = {
        "result_version": "v1",
        "request_id": st.request["request_id"],
        "summary": {"final_status": final_status, "status_count": count},
        "tasks": st.taskStates,
        "diagnostics": st.diagnostics,
        "repro": {
            "execgo_endpoint": st.request["execgo_endpoint"],
            "request_hash": st.request["request_id"],
        },
    }


def collect_task_states(expect: list[dict[str, Any]], actual: list[dict[str, Any]]) -> list[dict[str, Any]]:
    idx = {a.get("id", ""): a for a in actual}
    out: list[dict[str, Any]] = []
    for e in expect:
        a = idx.get(e["id"], {})
        out.append(
            {
                "id": e["id"],
                "status": a.get("status", "pending"),
                "failure_reason": str(a.get("error", "")) if a.get("error") else "",
                "output_preview": str(a.get("result", "")) if a.get("result") else "",
            }
        )
    return out


def is_terminal(tasks: list[dict[str, Any]]) -> bool:
    if not tasks:
        return False
    return all(t["status"] not in {"pending", "running"} for t in tasks)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", required=True, help="path to request json")
    args = parser.parse_args()

    with open(args.request, "r", encoding="utf-8") as f:
        req = json.load(f)

    st = TrainingState(request=req)
    build_plan(st)
    validate_plan(st)
    submit_to_execgo(st)
    try:
        poll_until_done(st)
    except Exception as e:
        st.diagnostics.append(str(e))
    analyze_failure(st)
    finalize_report(st)
    print(json.dumps(st.finalReport, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
