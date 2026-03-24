// Thin baseline-aligned adapter for Slice A (UI boundary only).
window.CockpitAdapter = {
  async getState() {
    const res = await fetch('/api/state');
    const data = await res.json();
    return data.state;
  },
  async action(action, payload = {}) {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    return res.json();
  },
};
