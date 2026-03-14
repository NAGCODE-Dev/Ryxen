const API_BASE_URL = String(process.env.CROSSAPP_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const COACH_EMAIL = String(process.env.CROSSAPP_COACH_EMAIL || 'nagcode.contact@gmail.com').trim().toLowerCase();
const COACH_PASSWORD = String(process.env.CROSSAPP_COACH_PASSWORD || 'CoachTrial123').trim();
const COACH_NAME = String(process.env.CROSSAPP_COACH_NAME || 'Coach Trial').trim();
const GYM_NAME = String(process.env.CROSSAPP_GYM_NAME || 'CrossApp Test Box').trim();
const GYM_SLUG = String(process.env.CROSSAPP_GYM_SLUG || 'crossapp-test-box').trim();

const ATHLETES = [
  { email: 'athlete1.test@crossapp.local', password: 'Athlete123', name: 'Athlete One' },
  { email: 'athlete2.test@crossapp.local', password: 'Athlete123', name: 'Athlete Two' },
  { email: 'athlete3.test@crossapp.local', password: 'Athlete123', name: 'Athlete Three' },
];

async function main() {
  const coachAuth = await ensureUser({
    email: COACH_EMAIL,
    password: COACH_PASSWORD,
    name: COACH_NAME,
  });

  const gym = await ensureGym(coachAuth.token);
  const memberships = [];

  for (const athlete of ATHLETES) {
    await ensureUser(athlete);
    const membership = await addMembership(coachAuth.token, gym.id, athlete.email, 'athlete');
    if (membership) memberships.push(membership);
  }

  const group = await createGroup(coachAuth.token, gym.id, memberships.slice(0, 2).map((item) => item.id));
  await publishWorkouts(coachAuth.token, gym.id, memberships, group?.id || null);
  const competition = await createCompetition(coachAuth.token, gym.id);
  if (competition?.id) {
    await createCompetitionEvent(coachAuth.token, competition.id);
  }

  console.log(JSON.stringify({
    ok: true,
    apiBaseUrl: API_BASE_URL,
    coach: { email: COACH_EMAIL, password: COACH_PASSWORD },
    gym,
    athletes: ATHLETES.map(({ email, password, name }) => ({ email, password, name })),
    notes: [
      'Se o coach não tiver assinatura ativa e a conta não for de desenvolvimento, o publish pode falhar.',
      'Use este seed principalmente em staging/local antes da semana de teste.',
    ],
  }, null, 2));
}

async function ensureUser({ email, password, name }) {
  try {
    const signup = await apiRequest('/auth/signup', {
      method: 'POST',
      body: { email, password, name },
    });
    return signup;
  } catch (error) {
    if (!String(error.message || '').includes('Email já cadastrado')) throw error;
    return apiRequest('/auth/signin', {
      method: 'POST',
      body: { email, password },
    });
  }
}

async function ensureGym(token) {
  const current = await apiRequest('/gyms/me', { token });
  const existing = (current.gyms || []).find((gym) => gym.slug === GYM_SLUG || gym.name === GYM_NAME);
  if (existing) return existing;

  const created = await apiRequest('/gyms', {
    method: 'POST',
    token,
    body: { name: GYM_NAME, slug: GYM_SLUG },
  });
  return created.gym;
}

async function addMembership(token, gymId, email, role) {
  try {
    const result = await apiRequest(`/gyms/${gymId}/memberships`, {
      method: 'POST',
      token,
      body: { email, role },
    });
    return result.membership;
  } catch (error) {
    if (!String(error.message || '').includes('já pertence')) throw error;
    const list = await apiRequest(`/gyms/${gymId}/memberships`, { token });
    return (list.memberships || []).find((item) => (item.email || item.pending_email || '').toLowerCase() === email.toLowerCase()) || null;
  }
}

async function createGroup(token, gymId, memberIds) {
  if (!memberIds.length) return null;
  try {
    const result = await apiRequest(`/gyms/${gymId}/groups`, {
      method: 'POST',
      token,
      body: {
        name: 'Trial RX',
        description: 'Grupo de teste para envio segmentado',
        memberIds,
      },
    });
    return result.group;
  } catch {
    const groups = await apiRequest(`/gyms/${gymId}/groups`, { token });
    return (groups.groups || []).find((group) => group.name === 'Trial RX') || null;
  }
}

async function publishWorkouts(token, gymId, memberships, groupId) {
  const today = new Date();
  const date = (offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const templates = [
    {
      title: 'Força + Metcon',
      scheduledDate: date(0),
      audienceMode: 'all',
      payload: {
        blocks: [
          { type: 'STRENGTH', lines: ['BACK SQUAT', '5x5 @80%'] },
          { type: 'METCON', lines: ['12 MIN AMRAP', '10 BURPEES', '12 TOES TO BAR'] },
        ],
      },
    },
    {
      title: 'Planilha especial',
      scheduledDate: date(1),
      audienceMode: 'selected',
      targetMembershipIds: memberships.slice(0, 1).map((item) => item.id),
      payload: {
        blocks: [
          { type: 'ACCESSORY', lines: ['ROMANIAN DEADLIFT', '4x10 leve'] },
        ],
      },
    },
  ];

  if (groupId) {
    templates.push({
      title: 'Treino grupo RX',
      scheduledDate: date(2),
      audienceMode: 'groups',
      targetGroupIds: [groupId],
      payload: {
        blocks: [
          { type: 'GYMNASTICS', lines: ['EMOM 12', '3 CHEST TO BAR', '6 HANDSTAND PUSH UPS'] },
        ],
      },
    });
  }

  for (const template of templates) {
    try {
      await apiRequest(`/gyms/${gymId}/workouts`, {
        method: 'POST',
        token,
        body: template,
      });
    } catch (error) {
      console.warn(`[seed] publish skipped: ${template.title} -> ${error.message}`);
    }
  }
}

async function createCompetition(token, gymId) {
  try {
    const result = await apiRequest(`/gyms/${gymId}/competitions`, {
      method: 'POST',
      token,
      body: {
        title: 'Trial Throwdown',
        description: 'Competição de teste da semana do coach',
        location: 'Box Floor',
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        visibility: 'gym',
      },
    });
    return result.competition;
  } catch (error) {
    console.warn(`[seed] competition skipped -> ${error.message}`);
    return null;
  }
}

async function createCompetitionEvent(token, competitionId) {
  try {
    await apiRequest(`/competitions/${competitionId}/events`, {
      method: 'POST',
      token,
      body: {
        title: 'Open Style Test',
        benchmarkSlug: 'open-24-1',
        scoreType: 'reps',
        eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.warn(`[seed] event skipped -> ${error.message}`);
  }
}

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data;
}

main().catch((error) => {
  console.error('[seed-coach-trial] failed', error);
  process.exit(1);
});
