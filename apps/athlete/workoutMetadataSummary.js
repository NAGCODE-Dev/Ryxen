function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function typeLabel(type) {
  const value = String(type || '').trim().toUpperCase();
  if (!value || value === 'DEFAULT') return '';
  if (value === 'WOD') return 'WOD';
  if (value === 'ENGINE') return 'Engine';
  if (value === 'STRENGTH') return 'Strength';
  if (value === 'ACCESSORIES') return 'Accessories';
  if (value === 'GYMNASTICS') return 'Gymnastics';
  return value;
}

function titleCaseWords(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCanonicalName(item = {}) {
  return item.displayName || item.canonicalName || item.name || item.modality || '';
}

function collectMovementNames(block = {}, limit = 3) {
  const items = Array.isArray(block?.parsed?.items) ? block.parsed.items : [];
  const names = uniqueStrings(
    items
      .filter((item) => item?.type === 'movement' || item?.type === 'recovery')
      .map((item) => formatCanonicalName(item))
  );
  return names.slice(0, limit);
}

export function summarizeWorkoutBlock(block = {}) {
  const parsed = block?.parsed || {};
  const summary = [];
  const details = [];
  const normalizedNames = [];

  if (parsed.format === 'amrap' && parsed.timeCapMinutes) summary.push(`AMRAP ${parsed.timeCapMinutes}min`);
  if (parsed.format === 'emom' && parsed.timeCapMinutes) summary.push(`EMOM ${parsed.timeCapMinutes}min`);
  if (parsed.format === 'for_time') summary.push(parsed.timeCapMinutes ? `For time · cap ${parsed.timeCapMinutes}min` : 'For time');
  if (parsed.rounds) summary.push(`${parsed.rounds} rounds`);

  if (parsed.goal) details.push(`Objetivo: ${parsed.goal}`);

  if (parsed.engine) {
    const parts = [parsed.engine.rounds ? `${parsed.engine.rounds} rounds` : '', parsed.engine.workMinutes ? `${parsed.engine.workMinutes}min trabalho` : '', parsed.engine.restMinutes ? `${parsed.engine.restMinutes}min descanso` : '']
      .filter(Boolean)
      .join(' · ');
    if (parts) details.push(parts);
    if (parsed.engine.modality) details.push(titleCaseWords(parsed.engine.modality));
  }

  if (parsed.strength) {
    const firstSet = parsed.strength.sets?.[0] || null;
    const strengthBits = [
      parsed.strength.sets?.length ? `${parsed.strength.sets.length} séries` : '',
      firstSet?.scheme || '',
      firstSet?.percent ? `${firstSet.percent}%` : '',
      parsed.strength.cadenceSeconds ? `a cada ${parsed.strength.cadenceSeconds}s` : '',
    ].filter(Boolean).join(' · ');
    if (strengthBits) details.push(strengthBits);
  }

  if (Array.isArray(parsed.accessories) && parsed.accessories.length) {
    details.push(`Acessórios: ${parsed.accessories.slice(0, 3).map((item) => formatCanonicalName(item)).join(', ')}`);
  }

  if (parsed.gymnastics) {
    const gymBits = [
      parsed.gymnastics.rounds ? `${parsed.gymnastics.rounds} rounds` : '',
      parsed.gymnastics.quality ? 'qualidade' : '',
    ].filter(Boolean).join(' · ');
    if (gymBits) details.push(`Gymnastics: ${gymBits}`);
  }

  normalizedNames.push(...collectMovementNames(block));
  if (Array.isArray(parsed.accessories)) {
    normalizedNames.push(...parsed.accessories.slice(0, 3).map((item) => formatCanonicalName(item)));
  }

  return {
    summary: uniqueStrings(summary).slice(0, 3),
    details: uniqueStrings(details).slice(0, 3),
    normalizedNames: uniqueStrings(normalizedNames).slice(0, 4),
  };
}

export function summarizeWorkoutForDisplay(workout = {}) {
  const blocks = Array.isArray(workout?.blocks) ? workout.blocks : [];
  const periods = uniqueStrings(blocks.map((block) => block?.period)).slice(0, 3);
  const goals = uniqueStrings(blocks.map((block) => block?.parsed?.goal)).slice(0, 2);
  const blockTypes = uniqueStrings(blocks.map((block) => typeLabel(block?.type))).slice(0, 4);
  const normalizedNames = uniqueStrings(blocks.flatMap((block) => summarizeWorkoutBlock(block).normalizedNames)).slice(0, 5);
  const titles = uniqueStrings(blocks.map((block) => block?.title)).slice(0, 3);

  const primaryTitle = titles[0] || normalizedNames[0] || firstUsefulLine(workout) || 'Treino pronto';
  const highlights = [];
  if (periods.length) highlights.push(`Períodos: ${periods.join(' · ')}`);
  if (blockTypes.length) highlights.push(`Blocos: ${blockTypes.join(' · ')}`);
  if (goals.length) highlights.push(`Objetivo: ${goals[0]}`);
  if (normalizedNames.length) highlights.push(`Movimentos: ${normalizedNames.slice(0, 3).join(', ')}`);

  return {
    primaryTitle,
    periods,
    goals,
    blockTypes,
    normalizedNames,
    highlights: highlights.slice(0, 3),
  };
}

function firstUsefulLine(workout = {}) {
  return (workout?.blocks || [])
    .flatMap((block) => block?.lines || [])
    .map((line) => (typeof line === 'string' ? line : (line?.raw || line?.text || '')))
    .map((line) => String(line || '').trim())
    .find((line) => line && !line.startsWith('*') && !line.includes('@gmail') && !line.includes('@hotmail')) || '';
}
