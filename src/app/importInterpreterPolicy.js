export function shouldTryAiInterpretationFallback({ review = null, parsed = null } = {}) {
  const score = Number(review?.score || 0);
  const warnings = Array.isArray(review?.warnings) ? review.warnings : [];
  const weekCount = Number(review?.weekCount || parsed?.stats?.weekCount || 0);
  const dayCount = Number(review?.dayCount || parsed?.stats?.dayCount || 0);
  if (!weekCount) return true;
  if (score < 68) return true;
  if (dayCount <= 1 && score < 82) return true;
  return warnings.some((item) => /revis|escaneado|pouco|curto/i.test(String(item || '')));
}
