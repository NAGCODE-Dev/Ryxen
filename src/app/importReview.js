export function scoreToConfidenceLabel(score = 0) {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  if (safe >= 85) return 'alta';
  if (safe >= 65) return 'média';
  return 'baixa';
}

export function buildImportReview({ file = null, source = '', reader = '', rawText = '', weeks = [], analysis = {} } = {}) {
  const text = String(rawText || '').trim();
  const safeWeeks = Array.isArray(weeks) ? weeks : [];
  const weekNumbers = safeWeeks.map((week) => Number(week?.weekNumber || 0)).filter(Boolean);
  const workoutCount = safeWeeks.reduce((acc, week) => acc + (Array.isArray(week?.workouts) ? week.workouts.length : 0), 0);
  const daysDetected = new Set();
  safeWeeks.forEach((week) => {
    (week?.workouts || []).forEach((workout) => {
      if (workout?.day) daysDetected.add(String(workout.day));
    });
  });

  const warnings = [];
  let score = Number.isFinite(analysis?.confidenceScore) ? analysis.confidenceScore : baseConfidenceForSource(source);

  if (!text || text.length < 40) {
    score -= 30;
    warnings.push('Texto extraído muito curto');
  }

  if (!safeWeeks.length) {
    score -= 35;
    warnings.push('Nenhuma semana identificada');
  }

  if (safeWeeks.length === 1 && daysDetected.size <= 1) {
    score -= 10;
    warnings.push('Conteúdo curto, revise o treino antes de usar');
  }

  if (analysis?.usedOcrFallback) {
    score -= 8;
    warnings.push('Arquivo escaneado, revisão recomendada');
  }

  if (analysis?.warnings && Array.isArray(analysis.warnings)) {
    warnings.push(...analysis.warnings.map((item) => String(item || '').trim()).filter(Boolean));
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const confidenceLabel = scoreToConfidenceLabel(score);

  return {
    fileName: String(file?.name || ''),
    source: String(source || 'text'),
    sourceLabel: labelForSource(source),
    reader: String(reader || source || 'text'),
    textLength: text.length,
    score,
    confidenceLabel,
    weekCount: safeWeeks.length,
    weekNumbers,
    workoutCount,
    dayCount: daysDetected.size,
    warnings: uniqueStrings(warnings).slice(0, 4),
    summary: buildSummary({ source, safeWeeks, daysDetected, confidenceLabel, analysis }),
    details: {
      sheetCount: Number(analysis?.sheetCount || 0) || null,
      rowCount: Number(analysis?.rowCount || 0) || null,
      pageCount: Number(analysis?.pageCount || 0) || null,
      usedOcrFallback: !!analysis?.usedOcrFallback,
    },
  };
}

function buildSummary({ source, safeWeeks, daysDetected, confidenceLabel, analysis }) {
  const parts = [];
  if (source === 'spreadsheet' && analysis?.sheetCount) {
    parts.push(`${analysis.sheetCount} aba(s)`);
  }
  if (source === 'pdf' && analysis?.pageCount) {
    parts.push(`${analysis.pageCount} página(s)`);
  }
  if (source === 'video' && analysis?.frameCount) {
    parts.push(`${analysis.usefulFrameCount || 0}/${analysis.frameCount} frame(s) úteis`);
  }
  if (safeWeeks.length) {
    parts.push(`${safeWeeks.length} semana(s)`);
  }
  if (daysDetected.size) {
    parts.push(`${daysDetected.size} dia(s) com treino`);
  }
  if (!parts.length) {
    return `Leitura com confiança ${confidenceLabel}`;
  }
  return `${parts.join(' • ')} • confiança ${confidenceLabel}`;
}

function baseConfidenceForSource(source) {
  switch (String(source || '').toLowerCase()) {
    case 'spreadsheet':
      return 92;
    case 'pdf':
      return 88;
    case 'image':
      return 72;
    case 'video':
      return 64;
    default:
      return 84;
  }
}

function labelForSource(source) {
  switch (String(source || '').toLowerCase()) {
    case 'spreadsheet': return 'Planilha';
    case 'pdf': return 'PDF';
    case 'image': return 'Imagem';
    case 'video': return 'Vídeo';
    default: return 'Texto';
  }
}

function uniqueStrings(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}
