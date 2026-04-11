export function handleExerciseHelpAction(element) {
  const label = String(element.dataset.exercise || '').trim();
  const directUrl = String(element.dataset.url || '').trim();
  const fallbackUrl = label
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${label} exercise tutorial`)}`
    : '';
  const url = directUrl || fallbackUrl;
  if (!url) throw new Error('Vídeo de execução indisponível para este movimento');

  if (isNativeLikeRuntime()) {
    window.location.assign(url);
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function isNativeLikeRuntime() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const protocol = String(window.location?.protocol || '').toLowerCase();
    return protocol === 'capacitor:' || protocol === 'file:';
  } catch {
    return false;
  }
}
