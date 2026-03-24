// Baseline-shaped app shell mounting single canonical cockpit view.
window.AppShell = function AppShell() {
  return React.createElement('div', null,
    React.createElement('h1', null, 'Baseline-Shaped Slice A Cockpit'),
    React.createElement('div', { className: 'muted' }, 'Canonical flow only; thin UI over adapter/controller boundary.'),
    React.createElement(window.CockpitSliceA, null)
  );
};
