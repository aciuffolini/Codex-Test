# VNEXT_FOLDER_PLAN

## Objective
Define the minimum folder/module structure for an isolated vNext implementation workspace while preserving baseline as reference.

## Proposed minimal structure

next-version/
├── architecture/
│   ├── NORTH_STAR_SUMMARY.md
│   ├── NEXT_VERSION_ARCHITECTURE.md
│   ├── CANONICAL_WORKFLOW.md
│   ├── HUMAN_UI_STRATEGY.md
│   ├── TWIN_STATE_MODEL.md
│   ├── TWIN_API_CONTRACT.md
│   ├── LOCAL_RAG_VS_FRONTIER_REASONING.md
│   ├── BASELINE_TO_VNEXT_MAPPING.md
│   ├── VERTICAL_SLICE_1.md
│   └── IMPLEMENTATION_ROADMAP.md
├── contracts/
│   ├── twin-events.md
│   ├── sync-contract.md
│   ├── retrieval-contract.md
│   └── capability-api.md
├── decisions/
│   ├── ADR-001-canonical-flow.md
│   ├── ADR-002-single-sync-engine.md
│   └── ADR-003-retrieval-before-reasoning.md
├── validation/
│   ├── slice-1-acceptance-checklist.md
│   └── failure-scenarios.md
└── notes/
    └── baseline-observations.md

## Module responsibilities
- `architecture/`: canonical product/technical blueprint.
- `contracts/`: implementable interface definitions used by UI and API layers.
- `decisions/`: immutable rationale records to prevent architecture drift.
- `validation/`: acceptance criteria and scenario matrices.
- `notes/`: non-normative working observations.

## Minimal implementation workspace plan (future)
When coding begins, keep it thin:
- `vnext_ui/` (cockpit experience only)
- `vnext_twin_core/` (events + local state + sync engine)
- `vnext_api/` (capability façade over backend primitives)

Do not split further until slice 1 is stable.

## What not to build yet in folder structure
- No dedicated orchestration/agent framework module.
- No separate model-provider abstraction package beyond what slice 1 needs.
- No analytics/data-lake folder.
- No plugin ecosystem folder.

## Guardrails
1. Every new folder must map to a canonical workflow step.
2. Every contract file must map to at least one slice-1 acceptance criterion.
3. No folder created for speculative future features.
