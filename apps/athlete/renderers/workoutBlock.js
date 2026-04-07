export function renderWorkoutBlock(block, blockIndex, ui, helpers = {}) {
  const { escapeHtml } = helpers;
  const lines = block?.lines || [];
  return `
    <div class="workout-block">
      ${lines.map((line, lineIndex) => {
        const lineId = `b${blockIndex}-l${lineIndex}`;
        return renderWorkoutLine(line, lineId, ui, { escapeHtml });
      }).join('')}
    </div>
  `;
}

const EXERCISE_VIDEO_LIBRARY = [
  { label: 'Back Squat', query: 'back squat', aliases: ['back squat', 'backsquat', 'agachamento livre', 'agachamento costas'] },
  { label: 'Front Squat', query: 'front squat', aliases: ['front squat', 'agachamento frontal'] },
  { label: 'Deadlift', query: 'deadlift', aliases: ['deadlift', 'levantamento terra', 'terra'] },
  { label: 'Romanian Deadlift', query: 'romanian deadlift', aliases: ['romanian deadlift', 'rdl', 'stiff'] },
  { label: 'Bench Press', query: 'bench press', aliases: ['bench press', 'supino reto', 'supino'] },
  { label: 'Overhead Press', query: 'overhead press', aliases: ['strict press', 'overhead press', 'shoulder press', 'desenvolvimento'] },
  { label: 'Push Press', query: 'push press', aliases: ['push press'] },
  { label: 'Push Jerk', query: 'push jerk', aliases: ['push jerk'] },
  { label: 'Split Jerk', query: 'split jerk', aliases: ['split jerk', 'jerk'] },
  { label: 'Thruster', query: 'thruster', aliases: ['thruster'] },
  { label: 'Snatch', query: 'snatch', aliases: ['snatch', 'arranco'] },
  { label: 'Power Snatch', query: 'power snatch', aliases: ['power snatch'] },
  { label: 'Hang Power Snatch', query: 'hang power snatch', aliases: ['hang power snatch'] },
  { label: 'Squat Snatch', query: 'squat snatch', aliases: ['squat snatch'] },
  { label: 'Clean', query: 'clean', aliases: ['clean'] },
  { label: 'Power Clean', query: 'power clean', aliases: ['power clean'] },
  { label: 'Hang Power Clean', query: 'hang power clean', aliases: ['hang power clean'] },
  { label: 'Squat Clean', query: 'squat clean', aliases: ['squat clean'] },
  { label: 'Clean and Jerk', query: 'clean and jerk', aliases: ['clean and jerk'] },
  { label: 'Overhead Squat', query: 'overhead squat', aliases: ['overhead squat', 'ohs'] },
  { label: 'Wall Ball', query: 'wall ball', aliases: ['wall ball', 'wallball'] },
  { label: 'Box Jump', query: 'box jump', aliases: ['box jump', 'box jump over'] },
  { label: 'Walking Lunge', query: 'walking lunge', aliases: ['walking lunge', 'lunge walk', 'passada', 'afundo andando'] },
  { label: 'Burpee', query: 'burpee', aliases: ['burpee'] },
  { label: 'Pull-Up', query: 'pull up', aliases: ['pull up', 'pull-up'] },
  { label: 'Chest to Bar', query: 'chest to bar pull up', aliases: ['chest to bar', 'c2b'] },
  { label: 'Bar Muscle-Up', query: 'bar muscle up', aliases: ['bar muscle up', 'bmup'] },
  { label: 'Ring Muscle-Up', query: 'ring muscle up', aliases: ['ring muscle up', 'rmu'] },
  { label: 'Toes to Bar', query: 'toes to bar', aliases: ['toes to bar', 't2b'] },
  { label: 'Handstand Push-Up', query: 'handstand push up', aliases: ['handstand push up', 'hspu', 'shspu'] },
  { label: 'Handstand Walk', query: 'handstand walk', aliases: ['handstand walk', 'hs walk'] },
  { label: 'Double Under', query: 'double under', aliases: ['double under', 'du'] },
  { label: 'Row', query: 'rowing technique', aliases: ['row', 'rowing', 'remo'] },
  { label: 'Bike Erg', query: 'bike erg technique', aliases: ['bike erg', 'bikeerg', 'assault bike'] },
  { label: 'Rope Climb', query: 'rope climb', aliases: ['rope climb', 'subida na corda'] },
  { label: 'Kettlebell Swing', query: 'kettlebell swing', aliases: ['kettlebell swing', 'kb swing'] },
  { label: 'Goblet Squat', query: 'goblet squat', aliases: ['goblet squat'] },
  { label: 'Dumbbell Snatch', query: 'dumbbell snatch', aliases: ['db snatch', 'dumbbell snatch'] },
  { label: 'Dumbbell Clean and Jerk', query: 'dumbbell clean and jerk', aliases: ['db clean and jerk', 'dumbbell clean and jerk'] },
];

function renderWorkoutLine(line, lineId, ui, { escapeHtml }) {
  const rawText = typeof line === 'string' ? line : (line?.raw || line?.text || '');
  const display = typeof line === 'object' ? (line.calculated ?? '') : '';
  const hasLoad = !!String(display).trim();
  const isWarning = !!(typeof line === 'object' && line.hasWarning);
  const isHeader = !!(typeof line === 'object' && line.isHeader);
  const isRest = !!(typeof line === 'object' && line.isRest);

  const text = escapeHtml(rawText);
  const exerciseHelp = !hasLoad ? inferExerciseHelp(rawText) : null;

  if (
    rawText.includes('#garanta') ||
    rawText.includes('#treine') ||
    rawText.toLowerCase().includes('@hotmail') ||
    rawText.toLowerCase().includes('@gmail')
  ) {
    return '';
  }

  if (isHeader) {
    return `
      <div class="workout-section-header" data-line-id="${escapeHtml(lineId)}">
        <h3 class="section-title">${text}</h3>
      </div>
    `;
  }

  if (isRest) {
    const restMatch = rawText.match(/(\d+)['`´]/);
    const restSeconds = restMatch ? parseInt(restMatch[1]) * 60 : null;

    return `
      <div class="workout-rest" data-line-id="${escapeHtml(lineId)}">
        <div class="rest-badge">Descanso</div>
        <div class="rest-content">
          <span class="rest-text">${text}</span>
          ${restSeconds ? `
            <button
              class="btn-timer"
              data-action="timer:start"
              data-seconds="${restSeconds}"
              type="button"
            >
              Timer ${Math.floor(restSeconds / 60)}min
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  if (rawText.startsWith('*')) {
    return `
      <div class="workout-note" data-line-id="${escapeHtml(lineId)}">
        <span class="note-badge">Nota</span>
        <span class="note-text">${text.replace(/^\*+\s*/, '')}</span>
      </div>
    `;
  }

  const loadHtml = hasLoad ? `
    <div class="load-calc ${isWarning ? 'load-warning' : ''}">
      ${escapeHtml(display)}
    </div>
  ` : '';
  const helpActionHtml = exerciseHelp ? `
    <button
      class="exercise-helpBtn"
      type="button"
      data-action="exercise:help"
      data-exercise="${escapeHtml(exerciseHelp.label)}"
      data-url="${escapeHtml(exerciseHelp.youtubeUrl)}"
      title="Ver execução"
      aria-label="Ver execução de ${escapeHtml(exerciseHelp.label)}"
    >
      Executar
    </button>
  ` : '';

  return `
    <div class="workout-line" data-line-id="${escapeHtml(lineId)}">
      <span class="workout-lineMarker" aria-hidden="true"></span>
      <div class="exercise-main">
        <div class="exercise-text">${text}</div>
        ${loadHtml}
      </div>
      ${helpActionHtml}
    </div>
  `;
}

function inferExerciseHelp(rawText = '') {
  const sourceLine = String(rawText || '').trim();
  if (!sourceLine) return null;
  const normalized = normalizeExerciseSearchText(sourceLine);
  if (!normalized || normalized.length < 3) return null;
  if (isProbablyLoadPrescription(sourceLine, normalized)) return null;

  const matched = EXERCISE_VIDEO_LIBRARY
    .flatMap((item) => item.aliases.map((alias) => ({ item, alias })))
    .sort((a, b) => b.alias.length - a.alias.length)
    .find(({ alias }) => normalized.includes(normalizeExerciseSearchText(alias)));

  if (matched?.item) {
    return {
      label: matched.item.label,
      query: matched.item.query,
      sourceLine,
      youtubeUrl: buildSearchUrl(matched.item.query),
    };
  }

  return null;
}

function buildSearchUrl(query) {
  const encoded = encodeURIComponent(String(query || '').trim());
  return `https://www.youtube.com/results?search_query=${encoded}%20exercise%20tutorial`;
}

function normalizeExerciseSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isProbablyLoadPrescription(rawText = '', normalized = '') {
  if (!rawText || !normalized) return true;
  if (/@\s*\d+%/.test(rawText)) return true;
  if (/^\s*\d+[\d+x+@%/\-() ]*$/.test(rawText)) return true;

  const tokens = normalized.split(' ').filter(Boolean);
  if (!tokens.length) return true;
  const alphaTokens = tokens.filter((token) => /[a-z]/.test(token));
  if (!alphaTokens.length) return true;
  const numberTokens = tokens.filter((token) => /\d/.test(token));

  return numberTokens.length > alphaTokens.length && alphaTokens.length <= 2;
}
