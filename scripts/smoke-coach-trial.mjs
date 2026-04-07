const API_BASE_URL = String(process.env.RYXEN_API_BASE_URL || process.env.CROSSAPP_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const COACH_EMAIL = String(process.env.RYXEN_COACH_EMAIL || process.env.CROSSAPP_COACH_EMAIL || 'nagcode.contact@gmail.com').trim().toLowerCase();
const COACH_PASSWORD = String(process.env.RYXEN_COACH_PASSWORD || process.env.CROSSAPP_COACH_PASSWORD || 'CoachTrial123').trim();
const ATHLETE_EMAIL = String(process.env.RYXEN_ATHLETE_EMAIL || process.env.CROSSAPP_ATHLETE_EMAIL || 'athlete1.test@ryxen.local').trim().toLowerCase();
const ATHLETE_PASSWORD = String(process.env.RYXEN_ATHLETE_PASSWORD || process.env.CROSSAPP_ATHLETE_PASSWORD || 'Athlete123').trim();

async function main() {
  const coach = await apiRequest('/auth/signin', {
    method: 'POST',
    body: { email: COACH_EMAIL, password: COACH_PASSWORD },
  });
  const athlete = await apiRequest('/auth/signin', {
    method: 'POST',
    body: { email: ATHLETE_EMAIL, password: ATHLETE_PASSWORD },
  });

  const [health, gyms, feed, athleteSummary, athleteResults, athleteWorkouts, access] = await Promise.all([
    rawJson('/health'),
    apiRequest('/gyms/me', { token: coach.token }),
    apiRequest('/workouts/feed', { token: athlete.token }),
    apiRequest('/athletes/me/summary?sportType=cross', { token: athlete.token }),
    apiRequest('/athletes/me/results/summary?sportType=cross', { token: athlete.token }),
    apiRequest('/athletes/me/workouts/recent?sportType=cross', { token: athlete.token }),
    apiRequest('/access/context', { token: athlete.token }),
  ]);

  const gym = (gyms.gyms || [])[0];
  if (!gym) throw new Error('Coach sem gym para smoke test');

  const [members, groups, insights, benchmarks, entitlements] = await Promise.all([
    apiRequest(`/gyms/${gym.id}/memberships`, { token: coach.token }),
    apiRequest(`/gyms/${gym.id}/groups`, { token: coach.token }),
    apiRequest(`/gyms/${gym.id}/insights`, { token: coach.token }),
    apiRequest('/benchmarks?limit=5', { token: coach.token }),
    apiRequest('/billing/entitlements', { token: coach.token }),
  ]);

  const checks = [
    ['health ok', !!health.ok],
    ['coach gym exists', !!gym],
    ['members loaded', Array.isArray(members.memberships)],
    ['groups loaded', Array.isArray(groups.groups)],
    ['insights loaded', typeof insights === 'object' && !!insights.stats],
    ['benchmarks loaded', Array.isArray(benchmarks.benchmarks)],
    ['feed loaded', Array.isArray(feed.workouts)],
    ['athlete summary loaded', typeof athleteSummary === 'object' && !!athleteSummary.stats],
    ['athlete results loaded', typeof athleteResults === 'object' && Array.isArray(athleteResults.recentResults)],
    ['athlete workouts loaded', typeof athleteWorkouts === 'object' && Array.isArray(athleteWorkouts.recentWorkouts)],
    ['access context loaded', Array.isArray(access.gyms)],
    ['billing entitlements loaded', Array.isArray(entitlements.entitlements)],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(JSON.stringify({ ok: false, failed }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    apiBaseUrl: API_BASE_URL,
    summary: {
      gym: gym.name,
      memberCount: members.memberships.length,
      groupCount: groups.groups.length,
      feedCount: feed.workouts.length,
      resultsLogged: athleteSummary.stats?.resultsLogged || 0,
      assignedWorkouts: athleteSummary.stats?.assignedWorkouts || 0,
      recentResults: athleteResults.recentResults?.length || 0,
      recentWorkouts: athleteWorkouts.recentWorkouts?.length || 0,
    },
    checks: checks.map(([label]) => label),
  }, null, 2));
}

async function rawJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
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
  console.error('[smoke-coach-trial] failed', error);
  process.exit(1);
});
