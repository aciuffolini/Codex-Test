# INTEGRATION_BLUEPRINT

## Purpose
Define how the hardened vNext Slice 1 kernel can map into the real Multimodal-Agentic-Farm-Visit evolution path, while baseline remains unchanged for now.

## 1) Baseline-to-kernel mapping

### vNext kernel assets (current)
- `vnext_twin_core/`: event contracts, state transitions, sync semantics, retrieval-before-reasoning enforcement.
- `vnext_api/`: capability façade over the same Twin service.
- `vnext_ui/cli.py`: reference operational flow and contract behavior.

### Baseline areas that can adopt kernel ideas first
1. **Local persistence + sync semantics (apps/web/src/lib)**
   - Adopt event contract vocabulary and status semantics (`draft/reviewed/finalized`, `queued/succeeded`).
   - Converge duplicated outbox/queue logic to one contract-first sync path.
2. **App-layer orchestration (apps/web/src/components + hooks)**
   - Align to one canonical workflow: capture→review/correct→save→sync→retrieve→ask→decide.
3. **API boundary**
   - Add capability-level interface adapter over existing backend endpoints (`sync`, `rag`, chat), keeping retrieval-before-reasoning rule.
4. **Validation discipline**
   - Port Slice-1 acceptance checks into baseline CI/dev checks incrementally.

## 2) Baseline parts to keep untouched for now
- Existing Capacitor Android implementation internals.
- Existing backend runtime internals (`server/rag_service`) unless needed for contract alignment.
- Existing model/provider implementation details.
- Any Slice 2+ functionality and experimentation paths.

Reason: preserve delivery continuity while contracts and orchestration are stabilized.

## 3) Where future React/Capacitor UI sits
Future graphical UI should be a **thin shell over the same kernel semantics**:
- Presentation/UI state in React.
- Core workflow and contract logic delegated to a shared service boundary (frontend adapter of Twin capabilities).
- Capacitor layer remains transport/device integration only.

## 4) Where future real backend/RAG sits
- Backend remains implementation of persistence/sync/retrieval services.
- Retrieval endpoints provide grounded context snapshots.
- Model/reasoning calls happen only after retrieval contract is satisfied.
- Backend must not become source of truth that bypasses Twin event semantics.

## 5) Safest migration path
1. Keep kernel isolated as reference contract engine.
2. Adopt contracts in baseline docs + adapter interfaces first.
3. Introduce service boundary wrappers in baseline (without replacing internals initially).
4. Migrate one baseline workflow path to canonical flow behind feature flag.
5. Expand only after acceptance criteria pass repeatedly.

## 6) Non-negotiables
- One canonical workflow only.
- Twin core semantics as operational truth.
- Retrieval-before-reasoning always enforced.
- Staged adoption over rewrite.
