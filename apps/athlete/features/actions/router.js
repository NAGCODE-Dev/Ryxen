export function handleExerciseHelpAction(element) {
  const label = String(element.dataset.exercise || '').trim();
  const directUrl = String(element.dataset.url || '').trim();
  const fallbackUrl = label
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${label} exercise tutorial`)}`
    : '';
  const url = directUrl || fallbackUrl;
  if (!url) throw new Error('Vídeo de execução indisponível para este movimento');

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.href = url;
  }
}
