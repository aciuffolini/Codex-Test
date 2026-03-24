import { useEffect, useMemo, useState } from "react";
import { fetchState, getEmptyState, postAction } from "./api";

const WORKFLOW = [
  "start_visit",
  "capture",
  "review_correct",
  "save_local",
  "sync",
  "retrieve",
  "ask",
  "decide",
];

function Field({ label, value }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value || "-"}</span>
    </div>
  );
}

function ActionButton({ action, onClick, disabled }) {
  return (
    <button type="button" onClick={() => onClick(action)} disabled={disabled}>
      {action}
    </button>
  );
}

export default function App() {
  const [state, setState] = useState(getEmptyState);
  const [requestError, setRequestError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [observation, setObservation] = useState("");
  const [correctedObservation, setCorrectedObservation] = useState("");
  const [retrieveQuestion, setRetrieveQuestion] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [online, setOnline] = useState(true);
  const [decision, setDecision] = useState("accepted");

  useEffect(() => {
    let mounted = true;

    fetchState()
      .then((nextState) => {
        if (mounted) {
          setState(nextState);
        }
      })
      .catch((error) => {
        if (mounted) {
          setRequestError(error.message);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const actionPayloads = useMemo(
    () => ({
      start_visit: {},
      capture: { observation },
      review_correct: { corrected_observation: correctedObservation },
      save_local: {},
      sync: { online },
      retrieve: { question: retrieveQuestion },
      ask: { question: askQuestion },
      decide: { decision },
    }),
    [askQuestion, correctedObservation, decision, observation, online, retrieveQuestion],
  );

  async function handleAction(action) {
    setPendingAction(action);
    setRequestError("");

    try {
      const response = await postAction(action, actionPayloads[action]);
      setState(response.state ?? getEmptyState());
      if (response.error) {
        setRequestError(response.error);
      }
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setPendingAction("");
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>vNext React Cockpit</h1>
        <p className="subtitle">
          Thin Vite shell over the existing Twin workflow and API contract.
        </p>
        <div className="workflow">{WORKFLOW.join(" -> ")}</div>
      </header>

      <section className="card">
        <h2>Current State</h2>
        <div className="field-grid">
          <Field label="Visit ID" value={state.visit_id} />
          <Field label="Slice State" value={state.slice_state} />
          <Field label="Save Status" value={state.local_save_status} />
          <Field label="Sync Status" value={state.sync_status} />
          <Field label="Retrieval Summary" value={state.retrieval_summary} />
          <Field label="Recommendation" value={state.recommendation} />
          <Field label="Error" value={state.last_error || requestError} />
        </div>
      </section>

      <section className="card">
        <h2>Workflow Actions</h2>
        <div className="controls">
          <label>
            Capture observation
            <input
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Observation for capture"
            />
          </label>

          <label>
            Review correction
            <input
              value={correctedObservation}
              onChange={(event) => setCorrectedObservation(event.target.value)}
              placeholder="Corrected observation"
            />
          </label>

          <label>
            Retrieve question
            <input
              value={retrieveQuestion}
              onChange={(event) => setRetrieveQuestion(event.target.value)}
              placeholder="Question for retrieve"
            />
          </label>

          <label>
            Ask question
            <input
              value={askQuestion}
              onChange={(event) => setAskQuestion(event.target.value)}
              placeholder="Question for ask"
            />
          </label>

          <label className="inline-label">
            <span>Sync online</span>
            <input
              type="checkbox"
              checked={online}
              onChange={(event) => setOnline(event.target.checked)}
            />
          </label>

          <label>
            Decision
            <select value={decision} onChange={(event) => setDecision(event.target.value)}>
              <option value="accepted">accepted</option>
              <option value="modified">modified</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
        </div>

        <div className="action-list">
          {WORKFLOW.map((action) => (
            <ActionButton
              key={action}
              action={action}
              onClick={handleAction}
              disabled={pendingAction !== ""}
            />
          ))}
        </div>

        <div className="status-line">
          Pending action: <strong>{pendingAction || "-"}</strong>
        </div>
      </section>
    </main>
  );
}
