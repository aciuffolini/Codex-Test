const EMPTY_STATE = {
  visit_id: "",
  slice_state: "idle",
  captured_observation: "",
  corrected_observation: "",
  local_save_status: "not_saved",
  sync_status: "not_synced",
  retrieval_summary: "",
  retrieval_event_id: "",
  recommendation: "",
  decision: "",
  last_error: "",
};

export function getEmptyState() {
  return { ...EMPTY_STATE };
}

export async function fetchState() {
  const response = await fetch("/api/state");
  if (!response.ok) {
    throw new Error(`state request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.state ?? getEmptyState();
}

export async function postAction(action, payload = {}) {
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!response.ok) {
    throw new Error(`action request failed: ${response.status}`);
  }

  return response.json();
}
