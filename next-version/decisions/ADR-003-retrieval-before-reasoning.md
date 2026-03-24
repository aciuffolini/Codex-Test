# ADR-003 retrieval before reasoning
Accepted: reasoning must reference an existing retrieval context for the same visit.
If missing, raise contract error and do not emit recommendation events.
