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

export function inferExerciseHelp(rawText = '') {
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
