export function normalizeSportType(value) {
  const raw = String(value || 'cross').trim().toLowerCase();
  return ['cross', 'running', 'strength'].includes(raw) ? raw : 'cross';
}
