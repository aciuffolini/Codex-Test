# Failure scenarios (Slice 1)

## Contract errors
- malformed/invalid event payloads
- invalid visit state transitions
- empty retrieval/reasoning questions
- reasoning without retrieval grounding
- duplicate event id append

## CLI handling
- contract errors return exit code `2`
- unexpected errors return exit code `1`

## Explicitly deferred
- remote network faults and partial write recovery
- advanced queue retries/backoff
- sync conflict reconciliation
