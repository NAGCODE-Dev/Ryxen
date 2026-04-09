export function getWorkoutTimerConfig(block) {
  const parsed = block?.parsed || {};
  const engine = parsed.engine || null;
  const sequence = buildTimedSequence(parsed);
  const title = String(block?.title || parsed?.title || '').trim();
  const lines = Array.isArray(block?.lines) ? block.lines.map(toLineText).filter(Boolean) : [];
  const upperLines = lines.map((line) => line.toUpperCase());
  const format = String(parsed?.format || '').toLowerCase();
  const timeCapMinutes = Number(parsed?.timeCapMinutes) || findTimedMinutes(upperLines);

  if (engine?.rounds && engine?.workMinutes) {
    return {
      kind: 'interval',
      label: title || 'Engine',
      detail: `${engine.rounds} rounds · ${engine.workMinutes}min trabalho${engine.restMinutes ? ` + ${engine.restMinutes}min descanso` : ''}`,
      rounds: Number(engine.rounds),
      workSeconds: Number(engine.workMinutes) * 60,
      restSeconds: Number(engine.restMinutes || 0) * 60,
      completionMessage: `${title || 'Engine'} finalizado`,
    };
  }

  if (sequence && sequence.rounds > 0 && sequence.segments.length > 0) {
    return {
      kind: 'sequence',
      label: title || 'Intervalado',
      detail: `${sequence.rounds} rounds · ${sequence.segments.map((segment) => formatSegmentDetail(segment)).join(' · ')}`,
      rounds: sequence.rounds,
      segments: sequence.segments,
      completionMessage: `${title || 'Intervalado'} finalizado`,
    };
  }

  if (format === 'amrap' && timeCapMinutes > 0) {
    return {
      kind: 'countdown',
      label: title || 'AMRAP',
      detail: `AMRAP ${timeCapMinutes}min`,
      totalSeconds: timeCapMinutes * 60,
      completionMessage: `${title || 'AMRAP'} finalizado`,
    };
  }

  if ((format === 'emom' || hasKeyword(upperLines, 'EMOM')) && timeCapMinutes > 0) {
    return {
      kind: 'countdown',
      label: title || 'EMOM',
      detail: `EMOM ${timeCapMinutes}min`,
      totalSeconds: timeCapMinutes * 60,
      completionMessage: `${title || 'EMOM'} finalizado`,
    };
  }

  if ((format === 'for_time' || hasKeyword(upperLines, 'FOR TIME')) && timeCapMinutes > 0) {
    return {
      kind: 'countdown',
      label: title || 'For time',
      detail: `For time · cap ${timeCapMinutes}min`,
      totalSeconds: timeCapMinutes * 60,
      completionMessage: `${title || 'For time'} finalizado`,
    };
  }

  if (format === 'for_time' || hasKeyword(upperLines, 'FOR TIME')) {
    return {
      kind: 'countup',
      label: title || 'For time',
      detail: 'Cronômetro livre até completar o treino',
      completionMessage: `${title || 'For time'} encerrado`,
    };
  }

  if (timeCapMinutes > 0 && (String(block?.type || '').toUpperCase() === 'WOD' || title)) {
    return {
      kind: 'countdown',
      label: title || 'Workout',
      detail: `Cap ${timeCapMinutes}min`,
      totalSeconds: timeCapMinutes * 60,
      completionMessage: `${title || 'Workout'} finalizado`,
    };
  }

  return null;
}

function buildTimedSequence(parsed = {}) {
  const rounds = Number(parsed?.rounds || 0);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  if (!rounds || !items.length) return null;

  const segments = items
    .filter((item) => Number(item?.durationSeconds) > 0)
    .map((item) => ({
      kind: item.type === 'rest' ? 'rest' : 'work',
      seconds: Number(item.durationSeconds),
      label: item.type === 'rest'
        ? 'Descanso'
        : String(item.displayName || item.canonicalName || item.name || item.modality || 'Trabalho').trim(),
    }));

  if (!segments.length || !segments.some((segment) => segment.kind === 'work')) return null;
  return { rounds, segments };
}

function formatSegmentDetail(segment) {
  return `${segment.seconds}s ${segment.kind === 'rest' ? 'rest' : segment.label}`;
}

function toLineText(line) {
  return typeof line === 'string' ? line : (line?.raw || line?.text || '');
}

function hasKeyword(lines, keyword) {
  return lines.some((line) => line.includes(keyword));
}

function findTimedMinutes(lines) {
  for (const line of lines) {
    const amrap = line.match(/^(\d+)\s*['’]?\s*AMRAP\b/);
    if (amrap) return Number(amrap[1]);

    const emom = line.match(/^(\d+)\s*['’]?\s*EMOM\b/);
    if (emom) return Number(emom[1]);

    const cap = line.match(/(?:TIME\s*CAP|CAP)\s*(\d+)\s*['’]?/);
    if (cap) return Number(cap[1]);

    const forTime = line.match(/^(\d+)\s*['’]?\s*FOR TIME\b/);
    if (forTime) return Number(forTime[1]);
  }

  return null;
}
