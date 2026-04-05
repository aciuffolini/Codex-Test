"""Retrieval context contract — unified agentic context enrichment.

Each retrieval_context event enriches the agent's context with an
auditable trace of:
- What was queried (question, query_hash)
- What was found (scored items with per-item provenance)
- How it was found (strategies_used, source modalities)
- Confidence assessment (max_score, low_confidence_warning)

Contract rules:
1. Every retrieval_context MUST have grounded=True
2. Every recommendation_event MUST reference a valid retrieval_context id
3. Items MUST include score, source, and modality for auditability
4. If max_score < threshold, low_confidence_warning MUST be set
5. Empty results are valid (grounded with warning, not an error)
"""
from __future__ import annotations

from typing import Any


def validate_retrieval_context(payload: dict[str, Any]) -> list[str]:
    """Validate a retrieval_context payload against the contract.

    Returns list of contract violations (empty = valid).
    """
    violations = []

    if not payload.get("question"):
        violations.append("question is required")

    if payload.get("grounded") is not True:
        violations.append("grounded must be True")

    if "query_hash" not in payload:
        violations.append("query_hash is required for audit trail")

    items = payload.get("items", [])
    for i, item in enumerate(items):
        if "score" not in item:
            violations.append(f"item[{i}] missing score")
        if "source" not in item:
            violations.append(f"item[{i}] missing source provenance")
        if "modality" not in item:
            violations.append(f"item[{i}] missing modality")

    if payload.get("max_score", 1.0) < 0.2 and not payload.get("low_confidence_warning"):
        violations.append("low_confidence_warning must be set when max_score < threshold")

    return violations
