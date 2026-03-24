// Baseline-shaped cockpit view container for Adoption Slice A only.
window.CockpitSliceA = function CockpitSliceA() {
  const [state, setState] = React.useState({
    visit_id: '', slice_state: 'idle', captured_observation: '', corrected_observation: '',
    local_save_status: 'not_saved', sync_status: 'not_synced', retrieval_summary: '',
    retrieval_event_id: '', recommendation: '', decision: '', last_error: '',
  });
  const [status, setStatus] = React.useState('Ready');
  const [observation, setObservation] = React.useState('');
  const [corr, setCorr] = React.useState('');
  const [q1, setQ1] = React.useState('');
  const [q2, setQ2] = React.useState('');
  const [online, setOnline] = React.useState(true);
  const [decision, setDecision] = React.useState('accepted');

  React.useEffect(() => {
    window.CockpitAdapter.getState().then(setState);
  }, []);

  async function run(action, payload, okText, failText) {
    const data = await window.CockpitAdapter.action(action, payload);
    setState(data.state);
    setStatus(data.ok ? okText : failText);
  }

  return React.createElement('div', null,
    React.createElement('div', { className: 'panel' },
      React.createElement('div', { className: 'kv' }, React.createElement('span', { className: 'label' }, 'Visit ID'), state.visit_id || '-'),
      React.createElement('div', { className: 'kv' }, React.createElement('span', { className: 'label' }, 'State'), state.slice_state),
      React.createElement('div', { className: 'kv' }, React.createElement('span', { className: 'label' }, 'Sync'), state.sync_status),
      React.createElement('div', { className: 'kv' }, React.createElement('span', { className: 'label' }, 'Retrieval'), state.retrieval_summary || '-'),
      React.createElement('div', { className: 'kv' }, React.createElement('span', { className: 'label' }, 'Recommendation'), state.recommendation || '-')
    ),
    React.createElement('div', { className: 'panel' },
      React.createElement('div', { className: 'row' }, React.createElement('button', { onClick: () => run('start_visit', {}, 'Visit started', 'Start failed') }, '1) Start Visit')),
      React.createElement('div', { className: 'row' }, React.createElement('input', { value: observation, onChange: e => setObservation(e.target.value), placeholder: '2) Observation' }), React.createElement('button', { onClick: () => run('capture', { observation }, 'Captured', 'Capture failed') }, 'Capture')),
      React.createElement('div', { className: 'row' }, React.createElement('input', { value: corr, onChange: e => setCorr(e.target.value), placeholder: '3) Corrected observation' }), React.createElement('button', { onClick: () => run('review_correct', { corrected_observation: corr }, 'Reviewed', 'Review failed') }, 'Review+Correct')),
      React.createElement('div', { className: 'row' }, React.createElement('button', { onClick: () => run('save_local', {}, 'Saved locally', 'Save failed') }, '4) Save Local')),
      React.createElement('div', { className: 'row' }, React.createElement('label', null, React.createElement('input', { type: 'checkbox', checked: online, onChange: e => setOnline(e.target.checked) }), ' Online sync'), React.createElement('button', { onClick: () => run('sync', { online }, 'Sync updated', 'Sync failed') }, '5) Sync')),
      React.createElement('div', { className: 'row' }, React.createElement('input', { value: q1, onChange: e => setQ1(e.target.value), placeholder: '6) Retrieve question' }), React.createElement('button', { onClick: () => run('retrieve', { question: q1 }, 'Context retrieved', 'Retrieve failed') }, 'Retrieve')),
      React.createElement('div', { className: 'row' }, React.createElement('input', { value: q2, onChange: e => setQ2(e.target.value), placeholder: '7) Ask question' }), React.createElement('button', { onClick: () => run('ask', { question: q2 }, 'Recommendation ready', 'Ask failed') }, 'Ask')),
      React.createElement('div', { className: 'row' },
        React.createElement('select', { value: decision, onChange: e => setDecision(e.target.value) },
          React.createElement('option', { value: 'accepted' }, 'accepted'),
          React.createElement('option', { value: 'modified' }, 'modified'),
          React.createElement('option', { value: 'rejected' }, 'rejected')
        ),
        React.createElement('button', { onClick: () => run('decide', { decision }, 'Decision recorded', 'Decision failed') }, '8) Decide')
      )
    ),
    React.createElement('div', null, React.createElement('strong', null, 'Status: '), status),
    React.createElement('div', { className: 'error' }, state.last_error || '')
  );
};
