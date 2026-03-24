const { useEffect, useState } = React;

function StatusPanel({ state }) {
  return (
    <div className="panel">
      <div className="kv"><span className="label">Visit ID</span>{state.visit_id || '-'}</div>
      <div className="kv"><span className="label">Slice State</span>{state.slice_state}</div>
      <div className="kv"><span className="label">Captured Observation</span>{state.captured_observation || '-'}</div>
      <div className="kv"><span className="label">Local Save</span>{state.local_save_status}</div>
      <div className="kv"><span className="label">Sync Status</span>{state.sync_status}</div>
      <div className="kv"><span className="label">Retrieval Summary</span>{state.retrieval_summary || '-'}</div>
      <div className="kv"><span className="label">Recommendation</span>{state.recommendation || '-'}</div>
      <div className="kv"><span className="label">Decision</span>{state.decision || '-'}</div>
    </div>
  );
}

function App() {
  const [state, setState] = useState({
    visit_id: "", slice_state: "idle", captured_observation: "", corrected_observation: "",
    local_save_status: "not_saved", sync_status: "not_synced", retrieval_summary: "",
    retrieval_event_id: "", recommendation: "", decision: "", last_error: "",
  });
  const [observation, setObservation] = useState("");
  const [correctedObservation, setCorrectedObservation] = useState("");
  const [retrieveQ, setRetrieveQ] = useState("");
  const [askQ, setAskQ] = useState("");
  const [online, setOnline] = useState(true);
  const [decision, setDecision] = useState("accepted");
  const [status, setStatus] = useState("Ready");

  async function action(name, payload = {}, okText = "Done", failText = "Failed") {
    const res = await fetch('/api/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, ...payload }),
    });
    const data = await res.json();
    setState(data.state);
    setStatus(data.ok ? okText : failText);
  }

  useEffect(() => { fetch('/api/state').then(r => r.json()).then(data => setState(data.state)); }, []);

  return (
    <div>
      <h1>Slice-A React Cockpit</h1>
      <div className="muted">start visit → capture → review/correct → save local → sync → retrieve → ask/reason → decide → result summary</div>
      <StatusPanel state={state} />

      <div className="panel">
        <div className="row"><button onClick={() => action('start_visit', {}, 'Visit started', 'Start failed')}>1) Start Visit</button></div>
        <div className="row"><input value={observation} onChange={e => setObservation(e.target.value)} placeholder="2) Observation" /><button onClick={() => action('capture', { observation }, 'Captured', 'Capture failed')}>Capture</button></div>
        <div className="row"><input value={correctedObservation} onChange={e => setCorrectedObservation(e.target.value)} placeholder="3) Corrected observation" /><button onClick={() => action('review_correct', { corrected_observation: correctedObservation }, 'Reviewed', 'Review failed')}>Review+Correct</button></div>
        <div className="row"><button onClick={() => action('save_local', {}, 'Saved locally', 'Save failed')}>4) Save Local</button></div>
        <div className="row"><label><input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} /> Online sync</label><button onClick={() => action('sync', { online }, 'Sync updated', 'Sync failed')}>5) Sync</button></div>
        <div className="row"><input value={retrieveQ} onChange={e => setRetrieveQ(e.target.value)} placeholder="6) Retrieval question" /><button onClick={() => action('retrieve', { question: retrieveQ }, 'Context retrieved', 'Retrieve failed')}>Retrieve</button></div>
        <div className="row"><input value={askQ} onChange={e => setAskQ(e.target.value)} placeholder="7) Ask question" /><button onClick={() => action('ask', { question: askQ }, 'Recommendation ready', 'Ask failed')}>Ask</button></div>
        <div className="row"><select value={decision} onChange={e => setDecision(e.target.value)}><option value="accepted">accepted</option><option value="modified">modified</option><option value="rejected">rejected</option></select><button onClick={() => action('decide', { decision }, 'Decision recorded', 'Decision failed')}>8) Decide</button></div>
      </div>

      <div className="panel">
        <strong>Result Summary</strong>
        <div className="kv"><span className="label">Visit ID</span>{state.visit_id || '-'}</div>
        <div className="kv"><span className="label">Final State</span>{state.slice_state}</div>
        <div className="kv"><span className="label">Sync</span>{state.sync_status}</div>
      </div>

      <div><strong>Status:</strong> {status}</div>
      <div className="error">{state.last_error || ''}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
