# Retrieval + Reasoning Boundary Contract (Slice 1)

## Retrieval input
- `visit_id`
- non-empty `question`

## Retrieval output
- `retrieval_context` event with:
  - `question`
  - compact event context
  - `grounded=true`
  - `source=local_twin_memory`

## Reasoning precondition
Reasoning (`ask_twin` / `propose_next_action`) requires a valid prior `retrieval_context.event_id` for the same visit.

## Failure behavior
- Missing/invalid retrieval context -> contract error.
- Empty reasoning question -> contract error.
