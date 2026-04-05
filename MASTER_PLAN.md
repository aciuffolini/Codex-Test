# Master Plan: Farm Visit vNext Platform (Twin + RAG + Agent API)

This document is the **implementation contract** for evolving the product **without modifying** the original baseline tree `7_farm_visit/`. All new work happens under **`farm_visit_ui_refactor/`** (this folder).

---

## 1. Non-negotiables

| Rule | Meaning |
|------|---------|
| **Baseline frozen** | Do not change files under `7_farm_visit/` for this program. Use it only as a **read-only reference** for behavior, URLs, data shapes, and integration points. |
| **Single evolution workspace** | Implement adapters, gateway, Twin core upgrades, retrieval, and agent API **here** (`farm_visit_ui_refactor/`). |
| **One canonical workflow** | Capture → review/correct → save local → sync → retrieve → ask/reason → decide → write-back (as in vNext architecture docs). |
| **Retrieval before reasoning** | No recommendation or frontier synthesis without a persisted `retrieval_context` (or equivalent) with provenance. |
| **Twin memory is truth** | Models and chat outputs are advisory until accepted as Twin events. |
| **Staged delivery** | Each phase has exit criteria and a rollback lever; no big-bang cutover. |

---

## 2. Where to build (folder decision)

**Agreed location: `farm_visit_ui_refactor/`** (this repository folder).

**Rationale**

- `next-version/` already holds contracts, kernel modules (`vnext_twin_core`, `vnext_api`, `vnext_ui`), and tests.
- A second top-level folder (e.g. `8_farm_visit_vnext`) would duplicate narrative and split CI/docs unless you later **rename** for release branding only.

**Optional later:** If you want a clean public repo name or monorepo package boundary, add a **symlink or re-export** from a new folder—still without touching `7_farm_visit/`.

**Legacy quarantine:** Treat `risksim/` and root `pyproject.toml` naming for `risksim` as **non-product**. Do not extend them for Twin/RAG/agent work. New runtime dependencies for vNext live under `next-version/` or a dedicated `platform/` subtree you add here.

---

## 3. Target architecture (summary)

| Layer | Responsibility | Lives in |
|-------|----------------|----------|
| **Experience (reference only)** | Current React/Capacitor UX in `7_farm_visit`—unchanged | `7_farm_visit/` (read-only) |
| **Compatibility / anti-corruption** | Map baseline HTTP payloads and (when you integrate a fork or proxy) JS module shapes to Twin capabilities | New code under `farm_visit_ui_refactor/` |
| **Twin core** | Event model, transitions, append-only store abstraction, audit | `next-version/vnext_twin_core/` (evolve) |
| **Capability API** | Agent-facing and UI-facing stable operations | `next-version/vnext_api/` (evolve) |
| **Retrieval** | Grounded context from indices + metadata (multimodal when wired) | New `retrieval/` or extend core + backend adapters here |
| **Reasoning** | Pluggable synthesis after retrieval; records `recommendation_event` | Adapter over providers; no bypass of retrieval gate |
| **Sync** | Single-path semantics: idempotent, visible failures, retries (eventually) | Evolve from Slice-1 stub toward real outbox semantics here |
| **RAG backend (reference)** | FastAPI + Chroma + SQLite in baseline | Copy patterns from `7_farm_visit/server/rag_service` **into new files here** if you need a server; do not edit baseline |

---

## 4. Phased implementation plan

Each phase **ends** with: tests or checklists, documented rollback, and no requirement to edit `7_farm_visit/`.

### Phase 0 — Baseline inventory and contract lock

**Goal:** Frozen map from baseline to vNext without changing baseline.

**Activities**

- Document every HTTP route and env var the baseline web app relies on (from `7_farm_visit` source, read-only).
- Document internal module boundaries the UI uses (`api`, `api-simple`, DB, outbox, queues, twin, agents)—for **future** adapter design; implementation still only in this folder.
- Align normative docs: `next-version/TWIN_API_CONTRACT.md`, `UI_BOUNDARY_CONTRACT.md`, `contracts/*.md`, `INTEGRATION_BLUEPRINT.md`, `MERGE_STRATEGY.md`.

**Exit criteria**

- Single “baseline → capability” mapping table checked into **this** repo (e.g. `next-version/notes/baseline-integration-map.md`).
- Slice-1 tests in `next-version/tests/` still green.

**Rollback:** N/A (docs only).

---

### Phase 1 — Twin store and event model hardening

**Goal:** Production-shaped persistence abstraction; stop depending on a single JSON file for long-term truth.

**Activities**

- Introduce a **store interface** (append, list by visit, idempotency, concurrency strategy) with at least one concrete backend **in this repo** (e.g. SQLite or equivalent suitable for server-side Twin log).
- Keep event types and validation aligned with `contracts/twin-events.md` and `TWIN_STATE_MODEL.md`.
- Migrate or dual-write from the current JSON prototype **inside** `farm_visit_ui_refactor` only.

**Exit criteria**

- All `next-version/tests/` pass against the new store.
- Documented migration path from JSON test fixtures.

**Rollback:** Feature flag or config to use legacy JSON store for dev only.

---

### Phase 2 — Compatibility gateway (HTTP)

**Goal:** A deployable service in **this** folder that exposes **stable** routes compatible with what the baseline web client expects, while internally emitting Twin events and calling retrieval/reasoning adapters.

**Activities**

- Implement proxy or standalone FastAPI/Node service **here** that forwards to a **copied** or **new** RAG stack (not editing `7_farm_visit/server`).
- Map `saveVisit`, `getVisits`, `/chat`, health, RAG endpoints to capability operations where possible.
- Preserve response shapes expected by baseline client **when you point the client at this gateway** (client change is **out of scope** for “never touch 7”; for local testing, use env/proxy **outside** the `7_farm_visit` tree, e.g. host file, separate clone, or deployment config not stored in `7_farm_visit`).

**Exit criteria**

- Contract tests: gateway responses match documented baseline shapes (golden fixtures generated from reading baseline, not from editing it).
- Retrieval-before-reasoning enforced on any “ask” path exposed by the gateway.

**Rollback:** Stop routing traffic to gateway; baseline unchanged.

---

### Phase 3 — Retrieval upgrade (real grounding)

**Goal:** Replace stub retrieval with ranked, provenance-rich `retrieval_context` events backed by real indices.

**Activities**

- Implement retrieval pipeline: query → candidates → scores → snapshot persisted as Twin event.
- Integrate multimodal strategy (text + image) consistent with baseline RAG design, implemented **here**.
- Define thresholds, empty-result behavior, and user/agent-visible summaries.

**Exit criteria**

- Every `recommendation_event` references a valid `retrieval_context` id.
- Failure modes documented (`validation/failure-scenarios.md` updated).

**Rollback:** Pin retrieval to “local event tail” fallback while keeping contract shape.

---

### Phase 4 — Reasoning adapter

**Goal:** Pluggable reasoning (local + cloud) **after** retrieval snapshot is fixed.

**Activities**

- Adapter interface: inputs = retrieval snapshot + question; outputs = recommendation payload + metadata (confidence, mode).
- No mutation of Twin history except via explicit events.

**Exit criteria**

- Property tests: impossible to obtain recommendation without retrieval id in the same visit scope.

**Rollback:** Stub reasoning provider returning fixed string for demos only.

---

### Phase 5 — Agent capability API (first-class)

**Goal:** HTTP (and optional MCP) surface for agents: same capabilities as human-oriented adapter.

**Activities**

- OpenAPI or equivalent schema published from **this** repo.
- Authn/authz placeholders (API keys, scopes) documented; implement minimal gate for dev.
- Align with `TWIN_API_CONTRACT.md` (`ingest_visit`, `upload_media`, `sync_event`, `retrieve_context`, `ask_twin`, `get_entity_history`, `generate_report`, `propose_next_action`).

**Exit criteria**

- External agent smoke test script (in this repo) completes happy path against local stack.
- Rate limits and payload size limits documented.

**Rollback:** Disable agent routes at gateway; Twin + UI paths unaffected.

---

### Phase 6 — Sync engine consolidation (semantic)

**Goal:** One clear sync story: queued / in progress / succeeded / failed, idempotent retries, visible to operators.

**Activities**

- Extend beyond Slice-1 `queued|succeeded` stub where product requires it; update **contracts** and ADRs before code.
- Reconcile with “single canonical outbox” from `NEXT_VERSION_ARCHITECTURE.md`.

**Exit criteria**

- Sync acceptance scenarios pass (offline capture, delayed sync, failure + retry).
- No silent drops: every attempt traceable as Twin or sync-subordinate events.

**Rollback:** Revert to Slice-1 sync contract for demos.

---

## 5. Guardrails (operational)

1. **Boundary leakage:** No business rules in UI-only demo code without a matching enforcement in Twin/capability layer.
2. **Duplicate workflows:** Do not ship two user-visible canonical flows; use feature flags for experiments **in the new app**, not in `7_farm_visit`.
3. **Doc–code drift:** Any contract change updates `contracts/` + a test or checklist in `validation/`.
4. **Baseline integrity:** PR review checklist includes “no files under `7_farm_visit/` modified.”
5. **Secrets:** No committed keys; templates only in **this** repo.
6. **Performance:** Retrieval and chat paths must have timeouts and payload caps documented before production.

---

## 6. Abort / rollback rules (hard stops)

Stop the line and fix before continuing if:

1. Ask/reason succeeds without a valid retrieval snapshot reference.
2. Sync status visible to users contradicts Twin event history.
3. Implementation requires editing `7_farm_visit/` to proceed—**stop** and redesign the adapter or gateway in **this** folder.
4. A second competing “source of truth” store appears without an explicit projection strategy.

---

## 7. Testing and quality gates

- **Unit:** Twin validation, store, idempotency, contract errors.
- **Integration:** Gateway + retrieval + reasoning chain; golden HTTP fixtures vs baseline shapes.
- **Acceptance:** `validation/slice-1-acceptance-checklist.md` extended for Phases 3–6 as features land.
- **CI (recommended):** Run tests only for `farm_visit_ui_refactor/` paths; exclude `7_farm_visit/` from this pipeline or treat as read-only submodule.

---

## 8. Git / PR convention

- **Branch naming:** `vnext/phase-N-short-topic`
- **PR title:** `[vNext Phase N] …`
- **PR description must state:** “Does not modify `7_farm_visit/`.”
- **Optional:** CODEOWNERS or path rules that reject PRs touching `../7_farm_visit/**` from this workstream.

---

## 9. Immediate next actions (when implementation starts)

1. Add `next-version/notes/baseline-integration-map.md` (Phase 0 deliverable).
2. Run `python -m unittest discover -s next-version/tests -p 'test_*.py'` and record baseline in this doc or CI.
3. Schedule Phase 1 store interface + SQLite (or chosen) implementation **only** under `farm_visit_ui_refactor/`.

---

## 10. Agreement record

- **Baseline:** `7_farm_visit/` — **frozen**, read-only reference.
- **Implementation root:** `farm_visit_ui_refactor/` — **all new code and docs for this program**.
- **Legacy:** `risksim/` — quarantined; not part of Twin/RAG/agent roadmap.

This master plan supersedes ad-hoc integration notes for execution order; detailed design remains in `next-version/*.md` and `next-version/contracts/*.md`.
