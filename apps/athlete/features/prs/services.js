export function filterAthletePrs(root, query) {
  const q = String(query || '').trim().toUpperCase();
  const table = root.querySelector('#ui-prsTable');
  if (!table) return;

  const items = Array.from(table.querySelectorAll('.pr-item'));
  let visible = 0;

  for (const item of items) {
    const ex = String(item.getAttribute('data-exercise') || '').toUpperCase();
    const show = !q || ex.includes(q);
    item.style.display = show ? '' : 'none';
    if (show) visible += 1;
  }

  const countEl = root.querySelector('#ui-prsCount');
  if (countEl) countEl.textContent = `${visible} PRs`;
}
