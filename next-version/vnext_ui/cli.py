"""Minimal human UI flow for Vertical Slice 1 (CLI cockpit)."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from vnext_api.capabilities import TwinCapabilities  # noqa: E402
from vnext_twin_core.models import ContractError  # noqa: E402


def run_slice(online: bool) -> int:
    caps = TwinCapabilities(ROOT / "data" / "slice1-events.json")

    try:
        visit_id = caps.ingest_visit()
        caps.twin.capture(visit_id, "Leaf discoloration observed on north block", "local://photo-001.jpg", 45.1, 9.2)
        caps.twin.review_and_correct(visit_id, "Leaf discoloration likely fungal; corrected note")
        caps.twin.save_local(visit_id)

        sync_event = caps.sync_event(visit_id, online=online)
        retrieval = caps.retrieve_context(visit_id, "What should I do next?")
        recommendation = caps.ask_twin(visit_id, retrieval.event_id, "Recommend immediate next action")
        decision = caps.twin.decide(visit_id, "accepted")

        print("visit_id:", visit_id)
        print("sync_status:", sync_event.payload["status"])
        print("retrieval_event_id:", retrieval.event_id)
        print("recommendation:", recommendation.payload["recommendation"])
        print("decision_event_id:", decision.event_id)
        print("history_events:", len(caps.get_entity_history(visit_id)))
        return 0
    except ContractError as err:
        print(f"contract_error: {err}")
        return 2
    except Exception as err:  # noqa: BLE001 - explicit safe fallback for CLI boundary
        print(f"unexpected_error: {err}")
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Vertical Slice 1 cockpit flow")
    parser.add_argument("--offline", action="store_true", help="Simulate offline mode (sync queued)")
    args = parser.parse_args()
    raise SystemExit(run_slice(online=not args.offline))


if __name__ == "__main__":
    main()
