# BASELINE_UI_ADOPTION_MAP

## Pre-write summary: what React cockpit proved vs unproven
### Proven
- Canonical Slice-1 flow can be executed through one thin React path.
- UI can stay thin by delegating behavior to controller/capability boundary.
- Required state/status surfaces are sufficient for operational clarity.
- Retrieval-before-reasoning remains enforceable through service path.

### Still unproven
- Production React/Vite integration details in the baseline app shell.
- Capacitor runtime behavior and mobile lifecycle interactions.
- Real baseline component reuse efficiency without introducing parallel flow.
- UX fit against existing baseline navigation and current module boundaries.

## Mapping from thin cockpit to baseline UI structure

| Thin cockpit surface | Baseline destination (conceptual) | Reuse opportunity |
|---|---|---|
| Status strip (visit id/state/save/sync/retrieval/recommendation) | existing app shell header/status region | reuse baseline shell layout + status components where available |
| Start Visit action | field-visit entry screen/action area | reuse existing route/screen container |
| Capture observation input | current field capture form section | reuse existing capture inputs/hooks; align labels to canonical flow |
| Review/correct input | existing review/confirm modal or review panel | reuse modal/panel scaffolding; keep logic in adapter/controller |
| Save Local + Sync controls | existing sync/outbox status area | reuse existing status widgets but wire to canonical contract surfaces |
| Retrieve/Ask actions | existing chat/assistant drawer area | reuse drawer container; constrain to retrieval-first sequence |
| Decide + Result summary | result/confirmation panel near chat/review | reuse card/summary components, keep minimal fields only |

## Where each cockpit surface should live in baseline React/Vite/Capacitor app
1. **App shell level**
   - persistent status strip and error banner.
2. **Field Visit route/view**
   - start/capture/review/save/sync interactions.
3. **Assistant/Ask panel**
   - retrieve then ask.
4. **Decision/summary area**
   - finalize decision and show compact run summary.

Capacitor-specific behavior should remain in device integration layer, not in cockpit business flow.

## Baseline UI pieces likely reusable first
- Existing React route/shell scaffold.
- Existing capture form components and input hooks.
- Existing sync status/outbox visual components.
- Existing assistant panel container and rendering shell.

## Baseline UI pieces to keep untouched for now
- Non-canonical experimental flows.
- Advanced analytics/reporting views.
- Non-slice wearable/integration-specific UI areas.
- Global design-system restyling work.

## Adoption guardrail
Never expose a second competing flow path in UI during adoption; map all visible actions to the canonical slice sequence.
