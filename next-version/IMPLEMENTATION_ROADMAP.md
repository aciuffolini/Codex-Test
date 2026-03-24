# IMPLEMENTATION_ROADMAP

## Milestone 0 — Isolated next-version workspace
- **Objective:** protect baseline while enabling focused convergence.
- **Likely folders:** `next-version/` (architecture + staged implementation scaffolding).
- **Reuse vs redefine:** reuse baseline as read-only reference; redefine contracts in docs.
- **Risks:** accidental baseline coupling.
- **Validation approach:** repository-level checks that baseline remains untouched.
- **Definition of done:** all vNext artifacts and changes occur only in next-version workspace.

## Milestone 1 — Contract and workflow freeze
- **Objective:** finalize canonical workflow + Twin/API contracts before coding.
- **Likely folders:** `next-version/*.md` (this package), plus decision log file.
- **Reuse vs redefine:** reuse proven baseline primitives; redefine boundaries.
- **Risks:** over-design without execution feedback.
- **Validation approach:** architecture review checklist against baseline reality.
- **Definition of done:** approved canonical flow, state model, and API capabilities.

## Milestone 2 — Choose single sync path
- **Objective:** plan migration to one queue/outbox engine.
- **Likely folders (future implementation):** `apps/web/src/lib/outbox*`, `apps/web/src/lib/queues/*`, capture/sync call sites.
- **Reuse vs redefine:** reuse strongest existing implementation; deprecate duplicate path.
- **Risks:** retry/conflict regressions.
- **Validation approach:** scenario matrix (offline capture, reconnect sync, conflict retry).
- **Definition of done:** one sync engine contract and migration plan with rollback steps.

## Milestone 3 — Choose single API client boundary
- **Objective:** one canonical client contract for chat/retrieval/sync calls.
- **Likely folders (future implementation):** `apps/web/src/lib/api*.ts`, assistant call sites.
- **Reuse vs redefine:** reuse stable parser/transport pieces; redefine public client interface.
- **Risks:** stream compatibility issues.
- **Validation approach:** API contract tests + end-to-end assistant smoke tests.
- **Definition of done:** one client module exported and consumed everywhere.

## Milestone 4 — Twin capability API façade
- **Objective:** map existing backend primitives to capability-centric endpoints.
- **Likely folders (future implementation):** backend route layer + typed contract docs.
- **Reuse vs redefine:** reuse current backend internals; redefine external contract names.
- **Risks:** endpoint churn and temporary duplication.
- **Validation approach:** capability test suite (`ingest_visit`, `retrieve_context`, `ask_twin`, etc.).
- **Definition of done:** stable vNext API surface with explicit side effects.

## Milestone 5 — Cockpit UX convergence
- **Objective:** implement calm UX loop (capture/review/correct/sync/ask/decide).
- **Likely folders (future implementation):** app shell, field visit screens, sync center, assistant panel.
- **Reuse vs redefine:** reuse existing components where behavior aligns; simplify navigation/state surfaces.
- **Risks:** UX scope creep.
- **Validation approach:** task-based walkthroughs + status visibility checklist.
- **Definition of done:** operators can complete core loop without ambiguous states.

## Milestone 6 — Release/runbook alignment
- **Objective:** reconcile docs/scripts with actual architecture.
- **Likely folders (future implementation):** startup scripts, deployment docs, status docs.
- **Reuse vs redefine:** reuse current scripts where possible; remove contradictory instructions.
- **Risks:** environment-specific script differences.
- **Validation approach:** clean-room setup verification on documented commands.
- **Definition of done:** one truthful runbook for dev/test/deploy and no doc-code drift.

## What NOT to do during roadmap execution
- Do not add new model providers before core flow convergence.
- Do not add new wearable integrations before contract stabilization.
- Do not rewrite stack layers that can be consolidated safely.
- Do not expose ungrounded reasoning outputs as operational truth.
