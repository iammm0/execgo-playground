# StandardPlan schema policy

## Current status

`StandardPlan` is currently a pre-1.0 contract.

- `schema_version` is required at the plan root.
- The current version is `0.1.0`.
- `annotations` is the approved extension slot on `StandardPlan`, `PlanStage`, and `ExecGoTask`.

## Pre-1.0 evolution rules

1. Any serialized plan must include `schema_version`.
2. Experimental or workflow-specific metadata should go into `annotations` before becoming a first-class field.
3. Until the workflow-level contract is stabilized, controlled task vocabularies and binding path syntax remain intentionally unspecified.
4. Changes to `src/execgo_playground/models.py` that affect `StandardPlan` must be followed by `python3 -m execgo_playground schema export --out shared/spec`.
5. When controlled vocabularies and binding path syntax are formalized, update this document and remove the temporary deferral note from the workspace `CLAUDE.md`.

## Compatibility intent

During `0.x`, compatibility is best-effort rather than guaranteed.
Breaking schema changes should increment the schema version and be reflected in regenerated artifacts under `shared/spec/`.
