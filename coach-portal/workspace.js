import React, { useEffect, useMemo, useState } from 'react';
import '../coach/styles.css';

const STORAGE_KEYS = {
  token: 'crossapp-auth-token',
  profile: 'crossapp-user-profile',
  runtime: 'crossapp-runtime-config',
};

const SPORT_OPTIONS = [
  { value: 'cross', label: 'Cross' },
  { value: 'running', label: 'Running' },
  { value: 'strength', label: 'Strength' },
];

export default function CoachWorkspace({ profile: initialProfile = null, onLogout = null } = {}) {
  const token = readToken();
  const profile = initialProfile || readProfile();
  const availableSportOptions = getAvailableSportOptions(readRuntimeConfig());
  const [compactPortal, setCompactPortal] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [publishStep, setPublishStep] = useState('basics');
  const [dashboard, setDashboard] = useState({
    subscription: null,
    entitlements: [],
    gymAccess: [],
    gyms: [],
    feed: [],
    competitions: [],
    benchmarks: [],
    benchmarkPagination: { total: 0, page: 1, limit: 30, pages: 1 },
    leaderboard: { benchmark: null, results: [] },
    competitionLeaderboard: { competition: null, summary: null, leaderboard: [], events: [] },
    eventLeaderboard: { competition: null, event: null, benchmark: null, results: [] },
    members: [],
    groups: [],
    selectedGymId: null,
    selectedSportType: 'cross',
    insights: null,
  });
  const [forms, setForms] = useState({
    gymName: '',
    gymSlug: '',
    memberEmail: '',
    memberRole: 'athlete',
    groupName: '',
    groupDescription: '',
    selectedGroupMemberIds: [],
    workoutTitle: '',
    workoutDate: '',
    workoutBenchmarkSlug: '',
    workoutLines: '',
    runningSessionType: 'easy',
    runningDistanceKm: '',
    runningDurationMin: '',
    runningTargetPace: '',
    runningZone: '',
    runningNotes: '',
    runningSegments: [{ label: '', distanceMeters: '', targetPace: '', restSeconds: '' }],
    strengthFocus: '',
    strengthLoadGuidance: '',
    strengthRir: '',
    strengthRestSeconds: '',
    strengthExercises: [{ name: '', sets: '', reps: '', load: '', rir: '' }],
    workoutAudienceMode: 'all',
    targetMembershipIds: [],
    targetGroupIds: [],
    benchmarkQuery: '',
    benchmarkCategory: '',
    benchmarkSource: '',
    benchmarkSort: 'year_desc',
    competitionTitle: '',
    competitionDate: '',
    competitionLocation: '',
    competitionVisibility: 'gym',
    eventCompetitionId: '',
    eventTitle: '',
    eventDate: '',
    eventBenchmarkSlug: '',
    leaderboardSlug: 'fran',
    competitionLeaderboardId: '',
    eventLeaderboardId: '',
    resultBenchmarkSlug: '',
    resultScore: '',
    resultNotes: '',
  });

  const selectedGym = useMemo(
    () => dashboard.gyms.find((gym) => gym.id === dashboard.selectedGymId) || null,
    [dashboard.gyms, dashboard.selectedGymId],
  );

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncViewport = () => setCompactPortal(window.innerWidth <= 900);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  async function loadDashboard(nextGymId = null, nextSportType = null) {
    setLoading(true);
    setError('');
    try {
      const preferredSportType = nextSportType || dashboard.selectedSportType || 'cross';
      const selectedSportType = availableSportOptions.some((sport) => sport.value === preferredSportType)
        ? preferredSportType
        : (availableSportOptions[0]?.value || 'cross');
      const [subscription, entitlementsRes, gymsRes, feedRes, benchmarksRes, competitionsRes] = await Promise.all([
        apiRequest('/billing/status'),
        apiRequest('/billing/entitlements'),
        apiRequest('/gyms/me'),
        apiRequest(`/workouts/feed?sportType=${encodeURIComponent(selectedSportType)}`),
        apiRequest('/benchmarks?limit=30&sort=year_desc'),
        apiRequest(`/competitions/calendar?sportType=${encodeURIComponent(selectedSportType)}`),
      ]);

      const gyms = gymsRes?.gyms || [];
      const selectedGymId = nextGymId || dashboard.selectedGymId || gyms[0]?.id || null;
      let members = [];
      let groups = [];
      let insights = null;
      if (selectedGymId) {
        const [membersRes, groupsRes, insightsRes] = await Promise.all([
          apiRequest(`/gyms/${selectedGymId}/memberships`),
          apiRequest(`/gyms/${selectedGymId}/groups?sportType=${encodeURIComponent(selectedSportType)}`),
          apiRequest(`/gyms/${selectedGymId}/insights?sportType=${encodeURIComponent(selectedSportType)}`),
        ]);
        members = membersRes?.memberships || [];
        groups = groupsRes?.groups || [];
        insights = insightsRes || null;
      }

      setDashboard({
        subscription,
        entitlements: entitlementsRes?.entitlements || [],
        gymAccess: entitlementsRes?.gymAccess || [],
        gyms,
        feed: feedRes?.workouts || [],
        competitions: competitionsRes?.competitions || [],
        benchmarks: benchmarksRes?.benchmarks || [],
        benchmarkPagination: benchmarksRes?.pagination || { total: 0, page: 1, limit: 30, pages: 1 },
        leaderboard: dashboard.leaderboard || { benchmark: null, results: [] },
        competitionLeaderboard: dashboard.competitionLeaderboard || { competition: null, summary: null, leaderboard: [], events: [] },
        eventLeaderboard: dashboard.eventLeaderboard || { competition: null, event: null, benchmark: null, results: [] },
        members,
        groups,
        selectedGymId,
        selectedSportType,
        insights,
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar portal');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGym(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/gyms', {
        method: 'POST',
        body: { name: forms.gymName, slug: forms.gymSlug },
      });
      setForms((prev) => ({ ...prev, gymName: '', gymSlug: '' }));
      setMessage(`Gym criado: ${res?.gym?.name || ''}`);
      await loadDashboard(res?.gym?.id || null, dashboard.selectedSportType);
    } catch (err) {
      setError(err.message || 'Erro ao criar gym');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectGym(gymId) {
    await loadDashboard(gymId, dashboard.selectedSportType);
  }

  async function handleSelectSportType(sportType) {
    await loadDashboard(dashboard.selectedGymId, sportType);
  }

  async function handleRefreshDashboard() {
    setMessage('');
    setError('');
    try {
      await loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType);
      setMessage('Dados atualizados');
    } catch (err) {
      setError(err.message || 'Erro ao atualizar dados');
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    if (!dashboard.selectedGymId) return;
    setLoading(true);
    setError('');
    try {
      await apiRequest(`/gyms/${dashboard.selectedGymId}/memberships`, {
        method: 'POST',
        body: {
          email: forms.memberEmail,
          role: forms.memberRole,
        },
      });
      setForms((prev) => ({ ...prev, memberEmail: '', memberRole: 'athlete' }));
      setMessage('Membro adicionado');
      await loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType);
    } catch (err) {
      setError(err.message || 'Erro ao adicionar membro');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    if (!dashboard.selectedGymId) return;
    setLoading(true);
    setError('');
    try {
      await apiRequest(`/gyms/${dashboard.selectedGymId}/groups`, {
        method: 'POST',
        body: {
          name: forms.groupName,
          description: forms.groupDescription,
          sportType: dashboard.selectedSportType,
          memberIds: forms.selectedGroupMemberIds,
        },
      });
      setForms((prev) => ({
        ...prev,
        groupName: '',
        groupDescription: '',
        selectedGroupMemberIds: [],
      }));
      setMessage('Grupo criado');
      await loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType);
    } catch (err) {
      setError(err.message || 'Erro ao criar grupo');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(key, value) {
    setForms((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const exists = current.includes(value);
      return {
        ...prev,
        [key]: exists ? current.filter((item) => item !== value) : [...current, value],
      };
    });
  }

  function updateCollectionItem(key, index, field, value) {
    setForms((prev) => {
      const nextItems = Array.isArray(prev[key]) ? [...prev[key]] : [];
      nextItems[index] = { ...(nextItems[index] || {}), [field]: value };
      return { ...prev, [key]: nextItems };
    });
  }

  function addCollectionItem(key, factory) {
    setForms((prev) => ({
      ...prev,
      [key]: [...(Array.isArray(prev[key]) ? prev[key] : []), factory()],
    }));
  }

  function removeCollectionItem(key, index) {
    setForms((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        [key]: current.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  async function handlePublishWorkout(event) {
    event.preventDefault();
    if (!dashboard.selectedGymId) return;
    setLoading(true);
    setError('');
    try {
      const lines = forms.workoutLines
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      let payload;

      if (dashboard.selectedSportType === 'running') {
        const segments = (forms.runningSegments || [])
          .map((segment) => ({
            label: String(segment.label || '').trim(),
            distanceMeters: segment.distanceMeters ? Number(segment.distanceMeters) : null,
            targetPace: String(segment.targetPace || '').trim(),
            restSeconds: segment.restSeconds ? Number(segment.restSeconds) : null,
          }))
          .filter((segment) => segment.label || segment.distanceMeters || segment.targetPace || segment.restSeconds);

        payload = {
          session: {
            type: forms.runningSessionType || 'easy',
            distanceKm: forms.runningDistanceKm ? Number(forms.runningDistanceKm) : null,
            durationMin: forms.runningDurationMin ? Number(forms.runningDurationMin) : null,
            targetPace: forms.runningTargetPace || '',
            zone: forms.runningZone || '',
            notes: forms.runningNotes || '',
            segments,
          },
          blocks: lines.length ? [{ type: 'RUNNING', lines }] : [],
        };
      } else if (dashboard.selectedSportType === 'strength') {
        const exercises = (forms.strengthExercises || [])
          .map((exercise) => ({
            name: String(exercise.name || '').trim(),
            sets: exercise.sets ? Number(exercise.sets) : null,
            reps: String(exercise.reps || '').trim(),
            load: String(exercise.load || '').trim(),
            rir: exercise.rir ? Number(exercise.rir) : null,
          }))
          .filter((exercise) => exercise.name);

        payload = {
          strength: {
            focus: forms.strengthFocus || '',
            loadGuidance: forms.strengthLoadGuidance || '',
            rir: forms.strengthRir ? Number(forms.strengthRir) : null,
            restSeconds: forms.strengthRestSeconds ? Number(forms.strengthRestSeconds) : null,
            exercises,
          },
          blocks: lines.length ? [{ type: 'STRENGTH', lines }] : [],
        };
      } else {
        payload = {
          blocks: [{ type: 'PROGRAMMING', lines }],
          ...(forms.workoutBenchmarkSlug ? { benchmarkSlug: forms.workoutBenchmarkSlug.trim() } : {}),
        };
      }

      await apiRequest(`/gyms/${dashboard.selectedGymId}/workouts`, {
        method: 'POST',
        body: {
          sportType: dashboard.selectedSportType,
          title: forms.workoutTitle,
          scheduledDate: forms.workoutDate,
          audienceMode: forms.workoutAudienceMode,
          targetMembershipIds: forms.targetMembershipIds,
          targetGroupIds: forms.targetGroupIds,
          payload,
        },
      });
      setForms((prev) => ({
        ...prev,
        workoutTitle: '',
        workoutDate: '',
        workoutBenchmarkSlug: '',
        workoutLines: '',
        runningSessionType: 'easy',
        runningDistanceKm: '',
        runningDurationMin: '',
        runningTargetPace: '',
        runningZone: '',
        runningNotes: '',
        runningSegments: [{ label: '', distanceMeters: '', targetPace: '', restSeconds: '' }],
        strengthFocus: '',
        strengthLoadGuidance: '',
        strengthRir: '',
        strengthRestSeconds: '',
        strengthExercises: [{ name: '', sets: '', reps: '', load: '', rir: '' }],
        workoutAudienceMode: 'all',
        targetMembershipIds: [],
        targetGroupIds: [],
      }));
      setMessage('Treino publicado');
      await loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType);
    } catch (err) {
      setError(err.message || 'Erro ao publicar treino');
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchBenchmarks({
    category = forms.benchmarkCategory,
    source = forms.benchmarkSource,
    sort = forms.benchmarkSort,
    page = 1,
  } = {}) {
    setLoading(true);
    setError('');
    try {
      const search = new URLSearchParams();
      if (forms.benchmarkQuery) search.set('q', forms.benchmarkQuery);
      if (category) search.set('category', category);
      if (source) search.set('source', source);
      if (sort) search.set('sort', sort);
      search.set('page', String(page));
      search.set('limit', '30');
      const res = await apiRequest(`/benchmarks?${search.toString()}`);
      setDashboard((prev) => ({
        ...prev,
        benchmarks: res?.benchmarks || [],
        benchmarkPagination: res?.pagination || { total: 0, page: 1, limit: 30, pages: 1 },
      }));
      setForms((prev) => ({
        ...prev,
        benchmarkCategory: category,
        benchmarkSource: source,
        benchmarkSort: sort,
      }));
    } catch (err) {
      setError(err.message || 'Erro ao buscar benchmarks');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(planId = 'coach') {
    setLoading(true);
    setError('');
    try {
      const provider = resolveBillingProvider();
      if (provider === 'kiwify_link') {
        const checkoutUrl = resolveKiwifyCheckoutUrl(planId);
        if (!checkoutUrl) {
          throw new Error(`Link da Kiwify não configurado para o plano ${String(planId).toUpperCase()}`);
        }
        window.location.href = checkoutUrl;
        return;
      }

      const res = await apiRequest('/billing/checkout', {
        method: 'POST',
        body: {
          planId,
          provider,
          successUrl: `${window.location.origin}/coach/?billing=success`,
          cancelUrl: `${window.location.origin}/coach/?billing=cancel`,
        },
      });
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      throw new Error('Checkout indisponível');
    } catch (err) {
      setError(err.message || 'Erro ao abrir checkout');
      setLoading(false);
    }
  }

  async function handleActivateLocalPlan() {
    setLoading(true);
    setError('');
    try {
      await apiRequest('/billing/mock/activate', {
        method: 'POST',
        body: { planId: 'coach', provider: 'mock' },
      });
      setMessage('Plano Coach local ativado');
      await loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType);
    } catch (err) {
      setError(err.message || 'Erro ao ativar plano local');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCompetition(event) {
    event.preventDefault();
    if (!dashboard.selectedGymId) return;
    setLoading(true);
    setError('');
    try {
      await apiRequest(`/gyms/${dashboard.selectedGymId}/competitions`, {
        method: 'POST',
        body: {
          sportType: dashboard.selectedSportType,
          title: forms.competitionTitle,
          startsAt: forms.competitionDate,
          location: forms.competitionLocation,
          visibility: forms.competitionVisibility,
        },
      });
      setForms((prev) => ({ ...prev, competitionTitle: '', competitionDate: '', competitionLocation: '', competitionVisibility: 'gym' }));
      setMessage('Competição criada');
      await loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType);
    } catch (err) {
      setError(err.message || 'Erro ao criar competição');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEvent(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiRequest(`/competitions/${forms.eventCompetitionId}/events`, {
        method: 'POST',
        body: {
          title: forms.eventTitle,
          eventDate: forms.eventDate,
          benchmarkSlug: forms.eventBenchmarkSlug,
        },
      });
      setForms((prev) => ({ ...prev, eventCompetitionId: '', eventTitle: '', eventDate: '', eventBenchmarkSlug: '' }));
      setMessage('Evento criado');
      await loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType);
    } catch (err) {
      setError(err.message || 'Erro ao criar evento');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadLeaderboard() {
    if (!forms.leaderboardSlug) return;
    setLoading(true);
    setError('');
    try {
      const search = new URLSearchParams({ limit: '20', sportType: dashboard.selectedSportType || 'cross' });
      if (dashboard.selectedGymId) search.set('gymId', String(dashboard.selectedGymId));
      const res = await apiRequest(`/leaderboards/benchmarks/${forms.leaderboardSlug}?${search.toString()}`);
      setDashboard((prev) => ({
        ...prev,
        leaderboard: {
          benchmark: res?.benchmark || null,
          results: res?.results || [],
        },
      }));
    } catch (err) {
      setError(err.message || 'Erro ao carregar leaderboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitResult(event) {
    event.preventDefault();
    if (!forms.resultBenchmarkSlug || !forms.resultScore) return;
    setLoading(true);
    setError('');
    try {
      await apiRequest(`/benchmarks/${forms.resultBenchmarkSlug}/results`, {
        method: 'POST',
        body: {
          gymId: dashboard.selectedGymId || null,
          sportType: dashboard.selectedSportType,
          scoreDisplay: forms.resultScore,
          notes: forms.resultNotes,
        },
      });
      setForms((prev) => ({ ...prev, resultBenchmarkSlug: '', resultScore: '', resultNotes: '' }));
      setMessage('Resultado registrado');
      if (forms.leaderboardSlug) {
        await handleLoadLeaderboard();
      }
    } catch (err) {
      setError(err.message || 'Erro ao registrar resultado');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadCompetitionLeaderboard() {
    if (!forms.competitionLeaderboardId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest(`/leaderboards/competitions/${forms.competitionLeaderboardId}`);
      setDashboard((prev) => ({
        ...prev,
        competitionLeaderboard: {
          competition: res?.competition || null,
          summary: res?.summary || null,
          leaderboard: res?.leaderboard || [],
          events: res?.events || [],
        },
      }));
    } catch (err) {
      setError(err.message || 'Erro ao carregar ranking da competição');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadEventLeaderboard() {
    if (!forms.eventLeaderboardId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest(`/leaderboards/events/${forms.eventLeaderboardId}?limit=30`);
      setDashboard((prev) => ({
        ...prev,
        eventLeaderboard: {
          competition: res?.competition || null,
          event: res?.event || null,
          benchmark: res?.benchmark || null,
          results: res?.results || [],
        },
      }));
    } catch (err) {
      setError(err.message || 'Erro ao carregar ranking do evento');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    if (typeof onLogout === 'function') onLogout();
  }

  const canCoachManage = dashboard.entitlements.includes('coach_portal');
  const canAthleteUseApp = dashboard.entitlements.includes('athlete_app');
  const subscription = dashboard.subscription || null;
  const planName = subscription?.plan || subscription?.plan_id || 'free';
  const planStatus = subscription?.status || 'inactive';
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const daysRemaining = getDaysRemaining(renewAt);
  const billingTone = daysRemaining !== null && daysRemaining <= 7 ? 'warn' : (canCoachManage ? 'ok' : 'warn');
  const canUseDeveloperTools = String(profile?.email || '').toLowerCase() === 'nagcode.contact@gmail.com';
  const athleteMembers = dashboard.members.filter((member) => member.role === 'athlete' && member.status === 'active');
  const showSkeleton = loading && !dashboard.gyms.length && !dashboard.feed.length && !dashboard.benchmarks.length;
  const isRunning = dashboard.selectedSportType === 'running';
  const isStrength = dashboard.selectedSportType === 'strength';
  const publishSteps = [
    ['basics', 'Base'],
    ['content', 'Conteúdo'],
    ['audience', 'Audiência'],
    ['review', 'Revisão'],
  ];

  function goToPublishStep(step) {
    setPublishStep(step);
  }

  function renderPublishWorkoutFlow() {
    const canGoContent = !!forms.workoutTitle && !!forms.workoutDate;
    const canGoAudience = canGoContent;
    const canGoReview = canGoAudience;
    const canSubmit = !loading && !!selectedGym && !!canCoachManage;

    if (!compactPortal) {
      return React.createElement('form', { className: 'stack', onSubmit: handlePublishWorkout },
        React.createElement('input', {
          className: 'field',
          placeholder: 'Título do treino',
          value: forms.workoutTitle,
          onChange: (e) => setForms((prev) => ({ ...prev, workoutTitle: e.target.value })),
        }),
        React.createElement('input', {
          className: 'field',
          type: 'date',
          value: forms.workoutDate,
          onChange: (e) => setForms((prev) => ({ ...prev, workoutDate: e.target.value })),
        }),
        renderSportSpecificWorkoutFields(),
        React.createElement('textarea', {
          className: 'field textarea',
          placeholder: isRunning
            ? 'Uma linha por bloco/intervalo (ex: 6x400m @ 4:20/km / 1:30 trote)'
            : isStrength
              ? 'Uma linha por exercício (ex: Back Squat | 5x5 | 100kg)'
              : 'Uma linha por exercício',
          value: forms.workoutLines,
          onChange: (e) => setForms((prev) => ({ ...prev, workoutLines: e.target.value })),
        }),
        renderAudienceSection(),
        React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: !canSubmit }, 'Publicar treino')
      );
    }

    return React.createElement('form', { className: 'stack publish-flow', onSubmit: handlePublishWorkout },
      React.createElement('div', { className: 'publish-steps' },
        publishSteps.map(([value, label]) =>
          React.createElement('button', {
            key: value,
            type: 'button',
            className: `btn btn-chip ${publishStep === value ? 'is-active' : ''}`,
            onClick: () => goToPublishStep(value),
          }, label)
        )
      ),
      React.createElement('div', { className: 'publish-stepCopy' },
        publishStep === 'basics' ? 'Defina título e data antes de montar o treino.' : null,
        publishStep === 'content' ? 'Monte o conteúdo e ajuste o template da modalidade ativa.' : null,
        publishStep === 'audience' ? 'Escolha quem recebe: todos, atletas específicos ou grupos.' : null,
        publishStep === 'review' ? 'Revise o payload antes de publicar.' : null,
      ),
      publishStep === 'basics' ? React.createElement(React.Fragment, null,
        React.createElement('input', {
          className: 'field',
          placeholder: 'Título do treino',
          value: forms.workoutTitle,
          onChange: (e) => setForms((prev) => ({ ...prev, workoutTitle: e.target.value })),
        }),
        React.createElement('input', {
          className: 'field',
          type: 'date',
          value: forms.workoutDate,
          onChange: (e) => setForms((prev) => ({ ...prev, workoutDate: e.target.value })),
        }),
        React.createElement('div', { className: 'publish-stepActions' },
          React.createElement('button', {
            type: 'button',
            className: 'btn btn-primary',
            disabled: !canGoContent,
            onClick: () => goToPublishStep('content'),
          }, 'Continuar')
        )
      ) : null,
      publishStep === 'content' ? React.createElement(React.Fragment, null,
        renderSportSpecificWorkoutFields(),
        React.createElement('textarea', {
          className: 'field textarea',
          placeholder: isRunning
            ? 'Uma linha por bloco/intervalo (ex: 6x400m @ 4:20/km / 1:30 trote)'
            : isStrength
              ? 'Uma linha por exercício (ex: Back Squat | 5x5 | 100kg)'
              : 'Uma linha por exercício',
          value: forms.workoutLines,
          onChange: (e) => setForms((prev) => ({ ...prev, workoutLines: e.target.value })),
        }),
        React.createElement('div', { className: 'publish-stepActions' },
          React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: () => goToPublishStep('basics') }, 'Voltar'),
          React.createElement('button', {
            type: 'button',
            className: 'btn btn-primary',
            disabled: !canGoAudience,
            onClick: () => goToPublishStep('audience'),
          }, 'Continuar')
        )
      ) : null,
      publishStep === 'audience' ? React.createElement(React.Fragment, null,
        renderAudienceSection(),
        React.createElement('div', { className: 'publish-stepActions' },
          React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: () => goToPublishStep('content') }, 'Voltar'),
          React.createElement('button', {
            type: 'button',
            className: 'btn btn-primary',
            disabled: !canGoReview,
            onClick: () => goToPublishStep('review'),
          }, 'Revisar')
        )
      ) : null,
      publishStep === 'review' ? React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'stack nested-card publish-reviewCard' },
          React.createElement('div', { className: 'eyebrow' }, 'Resumo'),
          React.createElement('div', { className: 'list-item static' },
            React.createElement('strong', null, forms.workoutTitle || 'Sem título'),
            React.createElement('span', null, forms.workoutDate ? formatDateLabel(forms.workoutDate) : 'Sem data definida')
          ),
          React.createElement('div', { className: 'list-item static' },
            React.createElement('strong', null, 'Conteúdo'),
            React.createElement('span', null, forms.workoutLines ? `${String(forms.workoutLines).split('\n').filter(Boolean).length} linha(s)` : 'Sem linhas preenchidas')
          ),
          React.createElement('div', { className: 'list-item static' },
            React.createElement('strong', null, 'Audiência'),
            React.createElement('span', null,
              forms.workoutAudienceMode === 'all'
                ? 'Todos os atletas'
                : forms.workoutAudienceMode === 'selected'
                  ? `${forms.targetMembershipIds.length} atleta(s) selecionado(s)`
                  : `${forms.targetGroupIds.length} grupo(s) selecionado(s)`
            )
          )
        ),
        React.createElement('div', { className: 'publish-stepActions' },
          React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: () => goToPublishStep('audience') }, 'Voltar'),
          React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: !canSubmit }, 'Publicar treino')
        )
      ) : null,
    );
  }

  function renderAudienceSection() {
    return React.createElement('div', { className: 'stack nested-card audience-card' },
      React.createElement('strong', null, 'Audiência'),
      React.createElement('div', { className: 'tabs' },
        [
          ['all', 'Todos os atletas'],
          ['selected', 'Atletas específicos'],
          ['groups', 'Grupos'],
        ].map(([value, label]) =>
          React.createElement('button', {
            key: value,
            type: 'button',
            className: `btn btn-chip ${forms.workoutAudienceMode === value ? 'is-active' : ''}`,
            onClick: () => setForms((prev) => ({ ...prev, workoutAudienceMode: value })),
          }, label)
        )
      ),
      React.createElement('div', { className: 'selection-panels' },
        React.createElement('div', { className: 'selection-panel' },
          React.createElement('div', { className: 'eyebrow' }, 'Atletas'),
          React.createElement('div', { className: 'selection-grid' },
            athleteMembers.length
              ? athleteMembers.map((member) =>
                  React.createElement('label', { key: member.id, className: 'check-row' },
                    React.createElement('input', {
                      type: 'checkbox',
                      checked: forms.targetMembershipIds.includes(member.id),
                      onChange: () => toggleSelection('targetMembershipIds', member.id),
                    }),
                    React.createElement('span', null,
                      React.createElement('strong', null, member.name || member.email || member.pending_email || 'Atleta'),
                      React.createElement('small', null, member.email || member.pending_email || '')
                    )
                  )
                )
              : React.createElement('p', { className: 'muted' }, 'Sem atletas ativos.')
          )
        ),
        React.createElement('div', { className: 'selection-panel' },
          React.createElement('div', { className: 'eyebrow' }, 'Grupos'),
          React.createElement('div', { className: 'selection-grid' },
            dashboard.groups.length
              ? dashboard.groups.map((group) =>
                  React.createElement('label', { key: group.id, className: 'check-row' },
                    React.createElement('input', {
                      type: 'checkbox',
                      checked: forms.targetGroupIds.includes(group.id),
                      onChange: () => toggleSelection('targetGroupIds', group.id),
                    }),
                    React.createElement('span', null,
                      React.createElement('strong', null, group.name),
                      React.createElement('small', null, `${group.member_count || group.members?.length || 0} atleta(s)`)
                    )
                  )
                )
              : React.createElement('p', { className: 'muted' }, 'Sem grupos criados.')
          )
        )
      )
    );
  }

  function renderSportSpecificWorkoutFields() {
    if (isRunning) {
      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'grid dual-grid' },
          React.createElement('select', {
            className: 'field',
            value: forms.runningSessionType,
            onChange: (e) => setForms((prev) => ({ ...prev, runningSessionType: e.target.value })),
          },
            React.createElement('option', { value: 'easy' }, 'Easy run'),
            React.createElement('option', { value: 'interval' }, 'Intervalado'),
            React.createElement('option', { value: 'tempo' }, 'Tempo run'),
            React.createElement('option', { value: 'long' }, 'Longão'),
            React.createElement('option', { value: 'recovery' }, 'Recovery')
          ),
          React.createElement('input', {
            className: 'field',
            type: 'number',
            min: '0',
            step: '0.1',
            placeholder: 'Distância (km)',
            value: forms.runningDistanceKm,
            onChange: (e) => setForms((prev) => ({ ...prev, runningDistanceKm: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            type: 'number',
            min: '0',
            step: '1',
            placeholder: 'Duração (min)',
            value: forms.runningDurationMin,
            onChange: (e) => setForms((prev) => ({ ...prev, runningDurationMin: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            placeholder: 'Pace alvo (ex: 5:00/km)',
            value: forms.runningTargetPace,
            onChange: (e) => setForms((prev) => ({ ...prev, runningTargetPace: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            placeholder: 'Zona (ex: Z2, Threshold)',
            value: forms.runningZone,
            onChange: (e) => setForms((prev) => ({ ...prev, runningZone: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            placeholder: 'Notas rápidas',
            value: forms.runningNotes,
            onChange: (e) => setForms((prev) => ({ ...prev, runningNotes: e.target.value })),
          }),
        ),
        React.createElement('div', { className: 'stack nested-card' },
          React.createElement('div', { className: 'eyebrow' }, 'Segmentos / intervalos'),
          (forms.runningSegments || []).map((segment, index) =>
            React.createElement('div', { key: `seg-${index}`, className: 'grid dual-grid' },
              React.createElement('input', {
                className: 'field',
                placeholder: 'Bloco (ex: 6x400m)',
                value: segment.label,
                onChange: (e) => updateCollectionItem('runningSegments', index, 'label', e.target.value),
              }),
              React.createElement('input', {
                className: 'field',
                type: 'number',
                min: '0',
                step: '50',
                placeholder: 'Distância (m)',
                value: segment.distanceMeters,
                onChange: (e) => updateCollectionItem('runningSegments', index, 'distanceMeters', e.target.value),
              }),
              React.createElement('input', {
                className: 'field',
                placeholder: 'Pace alvo',
                value: segment.targetPace,
                onChange: (e) => updateCollectionItem('runningSegments', index, 'targetPace', e.target.value),
              }),
              React.createElement('div', { className: 'stack' },
                React.createElement('input', {
                  className: 'field',
                  type: 'number',
                  min: '0',
                  step: '15',
                  placeholder: 'Descanso (seg)',
                  value: segment.restSeconds,
                  onChange: (e) => updateCollectionItem('runningSegments', index, 'restSeconds', e.target.value),
                }),
                React.createElement('button', {
                  type: 'button',
                  className: 'btn btn-secondary',
                  onClick: () => removeCollectionItem('runningSegments', index),
                  disabled: (forms.runningSegments || []).length <= 1,
                }, 'Remover segmento')
              )
            )
          ),
          React.createElement('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => addCollectionItem('runningSegments', () => ({ label: '', distanceMeters: '', targetPace: '', restSeconds: '' })),
          }, 'Adicionar segmento')
        ),
      );
    }

    if (isStrength) {
      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'grid dual-grid' },
          React.createElement('input', {
            className: 'field',
            placeholder: 'Foco (ex: Lower, Push, Pull)',
            value: forms.strengthFocus,
            onChange: (e) => setForms((prev) => ({ ...prev, strengthFocus: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            placeholder: 'Carga/guia (ex: 75-80% RM)',
            value: forms.strengthLoadGuidance,
            onChange: (e) => setForms((prev) => ({ ...prev, strengthLoadGuidance: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            type: 'number',
            min: '0',
            step: '0.5',
            placeholder: 'RIR',
            value: forms.strengthRir,
            onChange: (e) => setForms((prev) => ({ ...prev, strengthRir: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            type: 'number',
            min: '0',
            step: '15',
            placeholder: 'Descanso (seg)',
            value: forms.strengthRestSeconds,
            onChange: (e) => setForms((prev) => ({ ...prev, strengthRestSeconds: e.target.value })),
          }),
        ),
        React.createElement('div', { className: 'stack nested-card' },
          React.createElement('div', { className: 'eyebrow' }, 'Exercícios estruturados'),
          (forms.strengthExercises || []).map((exercise, index) =>
            React.createElement('div', { key: `ex-${index}`, className: 'grid dual-grid' },
              React.createElement('input', {
                className: 'field',
                placeholder: 'Exercício',
                value: exercise.name,
                onChange: (e) => updateCollectionItem('strengthExercises', index, 'name', e.target.value),
              }),
              React.createElement('input', {
                className: 'field',
                type: 'number',
                min: '1',
                step: '1',
                placeholder: 'Sets',
                value: exercise.sets,
                onChange: (e) => updateCollectionItem('strengthExercises', index, 'sets', e.target.value),
              }),
              React.createElement('input', {
                className: 'field',
                placeholder: 'Reps (ex: 5 ou 8-10)',
                value: exercise.reps,
                onChange: (e) => updateCollectionItem('strengthExercises', index, 'reps', e.target.value),
              }),
              React.createElement('input', {
                className: 'field',
                placeholder: 'Carga (ex: 100kg ou 75%)',
                value: exercise.load,
                onChange: (e) => updateCollectionItem('strengthExercises', index, 'load', e.target.value),
              }),
              React.createElement('input', {
                className: 'field',
                type: 'number',
                min: '0',
                step: '0.5',
                placeholder: 'RIR',
                value: exercise.rir,
                onChange: (e) => updateCollectionItem('strengthExercises', index, 'rir', e.target.value),
              }),
              React.createElement('button', {
                type: 'button',
                className: 'btn btn-secondary',
                onClick: () => removeCollectionItem('strengthExercises', index),
                disabled: (forms.strengthExercises || []).length <= 1,
              }, 'Remover exercício')
            )
          ),
          React.createElement('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => addCollectionItem('strengthExercises', () => ({ name: '', sets: '', reps: '', load: '', rir: '' })),
          }, 'Adicionar exercício')
        ),
      );
    }

    return [
      React.createElement('input', {
        key: 'benchmark',
        className: 'field',
        placeholder: 'benchmark slug opcional (ex: fran)',
        value: forms.workoutBenchmarkSlug,
        onChange: (e) => setForms((prev) => ({ ...prev, workoutBenchmarkSlug: e.target.value })),
      }),
    ];
  }

  function renderPortalSection(title, children, options = {}) {
    const {
      openMobile = false,
      wide = false,
      className = '',
      eyebrow = '',
      summary = '',
    } = options;
    const cardClassName = ['card', wide ? 'wide' : '', className].filter(Boolean).join(' ');

    if (!compactPortal) {
      return React.createElement('div', { className: cardClassName },
        eyebrow ? React.createElement('div', { className: 'eyebrow' }, eyebrow) : null,
        React.createElement('h3', null, title),
        summary ? React.createElement('p', { className: 'muted portal-sectionSummary' }, summary) : null,
        children
      );
    }

    return React.createElement('details', { className: `${cardClassName} portal-fold`, open: openMobile },
      React.createElement('summary', { className: 'portal-foldSummary' },
        React.createElement('div', { className: 'portal-foldSummaryText' },
          eyebrow ? React.createElement('span', { className: 'eyebrow' }, eyebrow) : null,
          React.createElement('strong', null, title),
          summary ? React.createElement('span', { className: 'muted' }, summary) : null
        ),
        React.createElement('span', { className: 'portal-foldChevron', 'aria-hidden': 'true' }, '▾')
      ),
      React.createElement('div', { className: 'portal-foldBody' }, children)
    );
  }

  return React.createElement('div', { className: 'portal-shell' },
    React.createElement('aside', { className: 'sidebar' },
      compactPortal
        ? React.createElement('div', { className: 'sidebar-compactHeader' },
            React.createElement('div', { className: 'eyebrow' }, 'CrossApp Coach'),
            React.createElement('div', { className: 'sidebar-compactTop' },
              React.createElement('div', null,
                React.createElement('h1', { className: 'sidebar-title' }, 'Coach Portal'),
                React.createElement('div', { className: 'sidebar-compactMeta' }, `${profile?.name || profile?.email || 'Coach'} • ${planName}`)
              ),
              React.createElement('span', { className: `pill ${billingTone}` },
                renewAt
                  ? (daysRemaining !== null ? `${daysRemaining} dia(s)` : formatDateLabel(renewAt))
                  : 'Sem renovação'
              )
            ),
            React.createElement('div', { className: 'sidebar-actions sidebar-actions-compact' },
              React.createElement('button', { className: 'btn btn-secondary', onClick: handleRefreshDashboard, disabled: loading }, loading ? 'Atualizando...' : 'Atualizar'),
              React.createElement('button', { className: 'btn btn-secondary', onClick: handleLogout }, 'Sair'),
              React.createElement('a', { className: 'btn btn-link', href: '/' }, 'App')
            )
          )
        : React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'eyebrow' }, 'CrossApp Coach'),
            React.createElement('h1', { className: 'sidebar-title' }, 'Coach Portal'),
            React.createElement('p', { className: 'sidebar-copy' }, 'Portal separado para operação do box, publicação, benchmarks e assinatura.'),
            React.createElement('div', { className: 'profile-box' },
              React.createElement('strong', null, profile?.name || profile?.email || 'Coach'),
              React.createElement('span', null, profile?.email || '')
            ),
            React.createElement('div', { className: 'sidebar-plan' },
              React.createElement('span', { className: 'stat-label' }, 'Plano atual'),
              React.createElement('strong', { className: 'sidebar-planValue' }, planName),
              React.createElement('span', { className: `pill ${billingTone}` },
                renewAt
                  ? (daysRemaining !== null ? `${daysRemaining} dia(s) restantes` : formatDateLabel(renewAt))
                  : 'Sem renovação'
              )
            ),
            React.createElement('div', { className: 'sidebar-actions' },
              React.createElement('button', { className: 'btn btn-secondary', onClick: handleRefreshDashboard, disabled: loading }, loading ? 'Atualizando...' : 'Atualizar dados'),
              React.createElement('button', { className: 'btn btn-secondary', onClick: handleLogout }, 'Sair'),
              React.createElement('a', { className: 'btn btn-link', href: '/' }, 'Voltar ao app do atleta')
            )
          )
    ),
    React.createElement('main', { className: 'portal-main' },
      React.createElement('section', { className: 'hero' },
        React.createElement('div', null,
          React.createElement('div', { className: 'eyebrow' }, 'Operação do coach'),
          React.createElement('h2', null, 'Gyms, membros, benchmarks e billing em um portal pronto para escala'),
          React.createElement('p', { className: 'hero-copy' }, 'Gerencie publicação, atletas, grupos, benchmarks e assinatura do box sem contaminar o fluxo diário do app do atleta.')
        ),
        React.createElement('div', { className: 'hero-pills' },
          React.createElement('span', { className: `pill ${canCoachManage ? 'ok' : 'warn'}` }, canCoachManage ? 'Coach liberado' : 'Coach bloqueado'),
          React.createElement('span', { className: `pill ${canAthleteUseApp ? 'ok' : 'warn'}` }, canAthleteUseApp ? 'Atletas com acesso' : 'Atletas limitados')
        )
      ),
      React.createElement('section', { className: 'card' },
        React.createElement('div', { className: 'stack' },
          React.createElement('div', { className: 'eyebrow' }, 'Modalidade ativa'),
          React.createElement('strong', null, 'Troque o contexto do portal para publicar e gerenciar por esporte'),
          React.createElement('div', { className: 'tabs' },
            availableSportOptions.map((sport) =>
              React.createElement('button', {
                key: sport.value,
                type: 'button',
                className: `btn btn-chip ${dashboard.selectedSportType === sport.value ? 'is-active' : ''}`,
                onClick: () => handleSelectSportType(sport.value),
              }, sport.label)
            )
          )
        )
      ),
      error ? React.createElement('div', { className: 'notice error' }, error) : null,
      message ? React.createElement('div', { className: 'notice success' }, message) : null,
      React.createElement('section', { className: `billing-banner billing-banner-${billingTone}` },
        React.createElement('div', null,
          React.createElement('div', { className: 'eyebrow' }, 'Assinatura'),
          React.createElement('strong', { className: 'billing-bannerTitle' },
            planStatus === 'active'
              ? `Plano ${planName} ativo`
              : `Plano ${planName} ${planStatus}`
          ),
          React.createElement('p', { className: 'muted' },
            renewAt
              ? `Renovação em ${formatDateLabel(renewAt)}${daysRemaining !== null ? ` • ${daysRemaining} dia(s) restantes` : ''}`
              : 'Sem renovação cadastrada. O box entra em modo limitado se a assinatura não estiver ativa.'
          )
        ),
        React.createElement('div', { className: 'billing-bannerActions' },
          React.createElement('a', { className: 'btn btn-primary', href: '/pricing.html' }, 'Assinar Coach'),
          canUseDeveloperTools ? React.createElement('button', { className: 'btn btn-secondary', onClick: handleActivateLocalPlan, disabled: loading }, 'Ativar local') : null,
          React.createElement('a', { className: 'btn btn-link', href: '/terms.html' }, 'Termos')
        )
      ),
      React.createElement('section', { className: 'grid stats-grid' },
        showSkeleton
          ? Array.from({ length: 6 }, (_, index) => portalSkeletonCard(`stat-${index}`))
          : [
              statCard('Plano', planName),
              statCard('Status', planStatus),
              statCard('Gyms', String(dashboard.gyms.length)),
              statCard('Modalidade', sportLabel(dashboard.selectedSportType)),
              statCard('Treinos no feed', String(dashboard.feed.length)),
              statCard('Atletas ativos', String(dashboard.insights?.stats?.athletes || 0)),
              statCard('Resultados', String(dashboard.insights?.stats?.results || 0)),
            ]
      ),
      React.createElement('section', { className: 'grid portal-grid' },
        renderPortalSection(`Feed do app • ${sportLabel(dashboard.selectedSportType)}`,
          React.createElement('div', { className: 'stack list-block portal-feedList' },
            showSkeleton
              ? portalSkeletonList(4)
              : dashboard.feed.map((item) =>
              React.createElement('div', { key: item.id, className: 'list-item static' },
                React.createElement('strong', null, item.title),
                React.createElement('span', null, `${item.gym_name || ''} • ${sportLabel(item.sport_type || dashboard.selectedSportType)}${item.benchmark?.name ? ` • ${item.benchmark.name}` : ''}`)
              )
              ),
            dashboard.feed.length === 0 ? React.createElement('p', { className: 'muted' }, 'Sem treinos publicados ainda.') : null
          ),
          {
            wide: true,
            openMobile: true,
            eyebrow: 'Feed',
            summary: dashboard.feed.length ? `${dashboard.feed.length} treino(s) publicados` : 'Sem treinos publicados ainda.',
          }
        ),
        renderPortalSection('Gyms',
          React.createElement('div', { className: 'stack list-block' },
            showSkeleton
              ? portalSkeletonList(3)
              : dashboard.gyms.map((gym) =>
              React.createElement('button', {
                key: gym.id,
                className: `list-item ${dashboard.selectedGymId === gym.id ? 'selected' : ''}`,
                onClick: () => handleSelectGym(gym.id),
              },
                React.createElement('strong', null, gym.name),
                React.createElement('span', null, `${gym.role} • ${gym.access?.warning || 'Acesso OK'}`)
              )
              ),
            dashboard.gyms.length === 0 ? React.createElement('p', { className: 'muted' }, 'Nenhum gym criado ainda.') : null
          ),
          React.createElement('form', { className: 'stack', onSubmit: handleCreateGym },
            React.createElement('input', {
              className: 'field',
              placeholder: 'Nome do gym',
              value: forms.gymName,
              onChange: (e) => setForms((prev) => ({ ...prev, gymName: e.target.value })),
            }),
            React.createElement('input', {
              className: 'field',
              placeholder: 'slug-do-gym',
              value: forms.gymSlug,
              onChange: (e) => setForms((prev) => ({ ...prev, gymSlug: e.target.value })),
            }),
            React.createElement('button', { className: 'btn btn-secondary', type: 'submit', disabled: loading }, 'Criar gym')
          ),
          {
            summary: dashboard.gyms.length ? `${dashboard.gyms.length} gym(s) no workspace` : 'Nenhum gym criado ainda.',
          }
        ),
        renderPortalSection(selectedGym ? `Membros de ${selectedGym.name}` : 'Membros',
          React.createElement('div', { className: 'stack list-block' },
            showSkeleton
              ? portalSkeletonList(3)
              : dashboard.members.map((member) =>
              React.createElement('div', { key: member.id, className: 'list-item static' },
                React.createElement('strong', null, member.name || member.email || member.pending_email || 'Convidado'),
                React.createElement('span', null, `${member.role} • ${member.status}`)
              )
              ),
            dashboard.members.length === 0 ? React.createElement('p', { className: 'muted' }, 'Selecione um gym para carregar membros.') : null
          ),
          React.createElement('form', { className: 'stack', onSubmit: handleAddMember },
            React.createElement('input', {
              className: 'field',
              type: 'email',
              placeholder: 'Email do membro',
              value: forms.memberEmail,
              onChange: (e) => setForms((prev) => ({ ...prev, memberEmail: e.target.value })),
            }),
            React.createElement('select', {
              className: 'field',
              value: forms.memberRole,
              onChange: (e) => setForms((prev) => ({ ...prev, memberRole: e.target.value })),
            },
              React.createElement('option', { value: 'athlete' }, 'athlete'),
              React.createElement('option', { value: 'coach' }, 'coach')
            ),
            React.createElement('button', { className: 'btn btn-secondary', type: 'submit', disabled: loading || !selectedGym }, 'Adicionar membro')
          ),
          {
            summary: dashboard.members.length ? `${dashboard.members.length} membro(s) carregados` : 'Selecione um gym para carregar membros.',
          }
        ),
        renderPortalSection(selectedGym ? `Grupos de ${selectedGym.name}` : 'Grupos',
          React.createElement('p', { className: 'muted' }, `Mostrando grupos de ${sportLabel(dashboard.selectedSportType)}.`),
          React.createElement('div', { className: 'stack list-block' },
            showSkeleton
              ? portalSkeletonList(2)
              : dashboard.groups.map((group) =>
              React.createElement('div', { key: group.id, className: 'list-item static' },
                React.createElement('strong', null, group.name),
                React.createElement('span', null, `${group.member_count || group.members?.length || 0} atleta(s) • ${sportLabel(group.sport_type || dashboard.selectedSportType)}${group.description ? ` • ${group.description}` : ''}`)
              )
              ),
            dashboard.groups.length === 0 ? React.createElement('p', { className: 'muted' }, 'Crie grupos para blocos especiais e planilhas separadas.') : null
          ),
          React.createElement('form', { className: 'stack' , onSubmit: handleCreateGroup },
            React.createElement('input', {
              className: 'field',
              placeholder: 'Nome do grupo',
              value: forms.groupName,
              onChange: (e) => setForms((prev) => ({ ...prev, groupName: e.target.value })),
            }),
            React.createElement('input', {
              className: 'field',
              placeholder: 'Descrição curta',
              value: forms.groupDescription,
              onChange: (e) => setForms((prev) => ({ ...prev, groupDescription: e.target.value })),
            }),
            React.createElement('div', { className: 'selection-grid' },
              athleteMembers.length
                ? athleteMembers.map((member) =>
                    React.createElement('label', { key: member.id, className: 'check-row' },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: forms.selectedGroupMemberIds.includes(member.id),
                        onChange: () => toggleSelection('selectedGroupMemberIds', member.id),
                      }),
                      React.createElement('span', null,
                        React.createElement('strong', null, member.name || member.email || member.pending_email || 'Atleta'),
                        React.createElement('small', null, member.email || member.pending_email || '')
                      )
                    )
                  )
                : React.createElement('p', { className: 'muted' }, 'Nenhum atleta ativo disponível.')
            ),
            React.createElement('button', { className: 'btn btn-secondary', type: 'submit', disabled: loading || !selectedGym || !forms.groupName }, 'Criar grupo')
          ),
          {
            summary: dashboard.groups.length
              ? `${dashboard.groups.length} grupo(s) em ${sportLabel(dashboard.selectedSportType)}`
              : 'Crie grupos para blocos especiais e planilhas separadas.',
          }
        ),
        renderPortalSection(selectedGym ? `Insights de ${selectedGym.name}` : 'Insights do gym',
          React.createElement('p', { className: 'muted' }, `Métricas filtradas em ${sportLabel(dashboard.selectedSportType)}.`),
          showSkeleton
            ? React.createElement('div', { className: 'stack list-block' }, portalSkeletonList(4))
            : dashboard.insights
            ? React.createElement('div', { className: 'stack list-block' },
                React.createElement('div', { className: 'list-item static' },
                  React.createElement('strong', null, 'Programação'),
                  React.createElement('span', null, `${dashboard.insights.stats?.workouts || 0} treino(s) no total • ${dashboard.insights.stats?.workoutsNext7Days || 0} nos próximos 7 dias`)
                ),
                React.createElement('div', { className: 'list-item static' },
                  React.createElement('strong', null, 'Competições'),
                  React.createElement('span', null, `${dashboard.insights.stats?.competitions || 0} no total • ${dashboard.insights.stats?.upcomingCompetitions || 0} próximas`)
                ),
                React.createElement('div', { className: 'list-item static' },
                  React.createElement('strong', null, 'Grupos'),
                  React.createElement('span', null, `${dashboard.insights.stats?.groups || 0} grupo(s) ativos`)
                ),
                React.createElement('div', { className: 'list-item static' },
                  React.createElement('strong', null, 'Benchmarks mais usados'),
                  React.createElement('span', null, (dashboard.insights.topBenchmarks || []).length ? dashboard.insights.topBenchmarks.map((item) => `${item.name} (${item.total})`).join(' • ') : 'Sem volume suficiente ainda')
                )
              )
            : React.createElement('p', { className: 'muted' }, 'Selecione um gym para carregar métricas operacionais.'),
          {
            summary: dashboard.insights
              ? `${dashboard.insights.stats?.workouts || 0} treino(s) • ${dashboard.insights.stats?.results || 0} resultado(s)`
              : 'Métricas operacionais do gym.',
          }
        ),
        renderPortalSection(`Publicar treino • ${sportLabel(dashboard.selectedSportType)}`,
          renderPublishWorkoutFlow(),
          {
            wide: true,
            openMobile: true,
            summary: compactPortal ? `Etapa ${publishSteps.findIndex(([value]) => value === publishStep) + 1} de ${publishSteps.length}` : 'Publicação de treino e segmentação de audiência.',
          }
        ),
        renderPortalSection('Benchmark Library',
          React.createElement('div', { className: 'toolbar' },
            React.createElement('input', {
              className: 'field',
              placeholder: 'Buscar benchmark',
              value: forms.benchmarkQuery,
              onChange: (e) => setForms((prev) => ({ ...prev, benchmarkQuery: e.target.value })),
            }),
            React.createElement('select', {
              className: 'field',
              value: forms.benchmarkSource,
              onChange: (e) => setForms((prev) => ({ ...prev, benchmarkSource: e.target.value })),
            },
              React.createElement('option', { value: '' }, 'Todas as fontes'),
              React.createElement('option', { value: 'benchmark' }, 'Benchmarks'),
              React.createElement('option', { value: 'hero' }, 'Hero'),
              React.createElement('option', { value: 'open' }, 'Open')
            ),
            React.createElement('select', {
              className: 'field',
              value: forms.benchmarkSort,
              onChange: (e) => setForms((prev) => ({ ...prev, benchmarkSort: e.target.value })),
            },
              React.createElement('option', { value: 'year_desc' }, 'Ano desc'),
              React.createElement('option', { value: 'year_asc' }, 'Ano asc'),
              React.createElement('option', { value: 'name_asc' }, 'Nome A-Z'),
              React.createElement('option', { value: 'name_desc' }, 'Nome Z-A'),
              React.createElement('option', { value: 'category_asc' }, 'Categoria')
            ),
            React.createElement('button', { className: 'btn btn-secondary', onClick: () => handleSearchBenchmarks(), disabled: loading }, 'Buscar')
          ),
          React.createElement('div', { className: 'tabs' },
            ['', 'girls', 'hero', 'open'].map((category) =>
              React.createElement('button', {
                key: category || 'all',
                className: 'btn btn-chip',
                onClick: () => handleSearchBenchmarks({ category }),
              }, category || 'todos')
            )
          ),
          React.createElement('div', { className: 'benchmark-meta' },
            React.createElement('span', { className: 'muted' }, `${dashboard.benchmarkPagination.total || 0} benchmarks`),
            React.createElement('span', { className: 'muted' }, `Página ${dashboard.benchmarkPagination.page || 1} de ${dashboard.benchmarkPagination.pages || 1}`)
          ),
          React.createElement('div', { className: 'stack list-block benchmark-libraryList' },
            showSkeleton
              ? portalSkeletonList(4)
              : dashboard.benchmarks.map((benchmark) =>
              React.createElement('div', { key: benchmark.id, className: 'list-item static' },
                React.createElement('strong', null, benchmark.name),
                React.createElement('span', null, `${benchmark.category}${benchmark.year ? ` • ${benchmark.year}` : ''}${benchmark.official_source ? ` • ${benchmark.official_source}` : ''}`),
                React.createElement('code', { className: 'inline-code' }, benchmark.slug)
              )
              ),
            dashboard.benchmarks.length === 0 ? React.createElement('p', { className: 'muted' }, 'Nenhum benchmark encontrado para esse filtro.') : null
          ),
          React.createElement('div', { className: 'pager' },
            React.createElement('button', {
              className: 'btn btn-secondary',
              disabled: loading || (dashboard.benchmarkPagination.page || 1) <= 1,
              onClick: () => handleSearchBenchmarks({ page: Math.max(1, (dashboard.benchmarkPagination.page || 1) - 1) }),
            }, 'Anterior'),
            React.createElement('button', {
              className: 'btn btn-secondary',
              disabled: loading || (dashboard.benchmarkPagination.page || 1) >= (dashboard.benchmarkPagination.pages || 1),
              onClick: () => handleSearchBenchmarks({ page: Math.min((dashboard.benchmarkPagination.pages || 1), (dashboard.benchmarkPagination.page || 1) + 1) }),
            }, 'Próxima')
          ),
          {
            summary: `${dashboard.benchmarkPagination.total || 0} benchmark(s) indexados`,
            className: 'benchmark-libraryCard',
          }
        ),
        renderPortalSection('Calendário de competições',
          React.createElement('div', { className: 'stack list-block competition-list' },
            dashboard.competitions.map((competition) =>
              React.createElement('div', { key: competition.id, className: 'list-item static competition-item' },
                React.createElement('strong', null, competition.title),
                React.createElement('span', null, `${competition.gym_name || ''} • ${formatDateLabel(competition.starts_at || competition.startsAt)}`),
                competition.location ? React.createElement('span', null, competition.location) : null,
                Array.isArray(competition.events) && competition.events.length
                  ? React.createElement('div', { className: 'competition-events' },
                      competition.events.map((eventItem) =>
                        React.createElement('span', { key: eventItem.id, className: 'plan-feature' }, `${eventItem.title}${eventItem.benchmarkSlug ? ` • ${eventItem.benchmarkSlug}` : ''}`)
                      )
                    )
                  : null
              )
            ),
            dashboard.competitions.length === 0 ? React.createElement('p', { className: 'muted' }, 'Nenhuma competição cadastrada.') : null
          ),
          React.createElement('div', { className: 'grid dual-grid' },
            React.createElement('form', { className: 'card nested-card stack', onSubmit: handleCreateCompetition },
              React.createElement('h4', null, 'Nova competição'),
              React.createElement('input', {
                className: 'field',
                placeholder: 'Nome da competição',
                value: forms.competitionTitle,
                onChange: (e) => setForms((prev) => ({ ...prev, competitionTitle: e.target.value })),
              }),
              React.createElement('input', {
                className: 'field',
                type: 'datetime-local',
                value: forms.competitionDate,
                onChange: (e) => setForms((prev) => ({ ...prev, competitionDate: e.target.value })),
              }),
              React.createElement('input', {
                className: 'field',
                placeholder: 'Local',
                value: forms.competitionLocation,
                onChange: (e) => setForms((prev) => ({ ...prev, competitionLocation: e.target.value })),
              }),
              React.createElement('select', {
                className: 'field',
                value: forms.competitionVisibility,
                onChange: (e) => setForms((prev) => ({ ...prev, competitionVisibility: e.target.value })),
              },
                React.createElement('option', { value: 'gym' }, 'Gym'),
                React.createElement('option', { value: 'public' }, 'Público')
              ),
              React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: loading || !dashboard.selectedGymId || !canCoachManage }, 'Criar competição')
            ),
            React.createElement('form', { className: 'card nested-card stack', onSubmit: handleCreateEvent },
              React.createElement('h4', null, 'Novo evento'),
              React.createElement('select', {
                className: 'field',
                value: forms.eventCompetitionId,
                onChange: (e) => setForms((prev) => ({ ...prev, eventCompetitionId: e.target.value })),
              },
                React.createElement('option', { value: '' }, 'Selecionar competição'),
                dashboard.competitions.map((competition) =>
                  React.createElement('option', { key: competition.id, value: competition.id }, competition.title)
                )
              ),
              React.createElement('input', {
                className: 'field',
                placeholder: 'Título do evento',
                value: forms.eventTitle,
                onChange: (e) => setForms((prev) => ({ ...prev, eventTitle: e.target.value })),
              }),
              React.createElement('input', {
                className: 'field',
                type: 'datetime-local',
                value: forms.eventDate,
                onChange: (e) => setForms((prev) => ({ ...prev, eventDate: e.target.value })),
              }),
              React.createElement('input', {
                className: 'field',
                placeholder: 'benchmark slug (ex: fran)',
                value: forms.eventBenchmarkSlug,
                onChange: (e) => setForms((prev) => ({ ...prev, eventBenchmarkSlug: e.target.value })),
              }),
              React.createElement('button', { className: 'btn btn-secondary', type: 'submit', disabled: loading || !forms.eventCompetitionId }, 'Adicionar evento')
            )
          ),
          {
            wide: true,
            summary: dashboard.competitions.length ? `${dashboard.competitions.length} competição(ões) cadastradas` : 'Nenhuma competição cadastrada.',
          }
        ),
        renderPortalSection('Leaderboard e resultados',
          React.createElement('div', { className: 'grid dual-grid' },
            React.createElement('div', { className: 'card nested-card stack' },
              React.createElement('h4', null, 'Leaderboard'),
              React.createElement('input', {
                className: 'field',
                placeholder: 'benchmark slug',
                value: forms.leaderboardSlug,
                onChange: (e) => setForms((prev) => ({ ...prev, leaderboardSlug: e.target.value })),
              }),
              React.createElement('button', { className: 'btn btn-secondary', onClick: handleLoadLeaderboard, disabled: loading || !forms.leaderboardSlug }, 'Carregar leaderboard'),
              dashboard.leaderboard?.benchmark
                ? React.createElement('div', { className: 'stack list-block' },
                    React.createElement('strong', null, dashboard.leaderboard.benchmark.name),
                    (dashboard.leaderboard.results || []).map((result, index) =>
                      React.createElement('div', { key: result.id, className: 'list-item static leaderboard-item' },
                        React.createElement('strong', null, `#${index + 1} ${result.name || result.email}`),
                        React.createElement('span', null, result.score_display)
                      )
                    ),
                    !(dashboard.leaderboard.results || []).length ? React.createElement('p', { className: 'muted' }, 'Sem resultados para esse benchmark.') : null
                  )
                : React.createElement('p', { className: 'muted' }, 'Informe um benchmark para ver o ranking.')
            ),
            React.createElement('form', { className: 'card nested-card stack', onSubmit: handleSubmitResult },
              React.createElement('h4', null, 'Registrar resultado'),
              React.createElement('input', {
                className: 'field',
                placeholder: 'benchmark slug',
                value: forms.resultBenchmarkSlug,
                onChange: (e) => setForms((prev) => ({ ...prev, resultBenchmarkSlug: e.target.value })),
              }),
              React.createElement('input', {
                className: 'field',
                placeholder: 'score (ex: 02:31, 125, 10+12)',
                value: forms.resultScore,
                onChange: (e) => setForms((prev) => ({ ...prev, resultScore: e.target.value })),
              }),
              React.createElement('input', {
                className: 'field',
                placeholder: 'observações',
                value: forms.resultNotes,
                onChange: (e) => setForms((prev) => ({ ...prev, resultNotes: e.target.value })),
              }),
              React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: loading || !forms.resultBenchmarkSlug || !forms.resultScore }, 'Salvar resultado')
            )
          ),
          React.createElement('div', { className: 'grid dual-grid' },
            React.createElement('div', { className: 'card nested-card stack' },
              React.createElement('h4', null, 'Ranking da competição'),
              React.createElement('select', {
                className: 'field',
                value: forms.competitionLeaderboardId,
                onChange: (e) => setForms((prev) => ({ ...prev, competitionLeaderboardId: e.target.value })),
              },
                React.createElement('option', { value: '' }, 'Selecionar competição'),
                dashboard.competitions.map((competition) =>
                  React.createElement('option', { key: competition.id, value: competition.id }, competition.title)
                )
              ),
              React.createElement('button', { className: 'btn btn-secondary', onClick: handleLoadCompetitionLeaderboard, disabled: loading || !forms.competitionLeaderboardId }, 'Carregar ranking'),
              dashboard.competitionLeaderboard?.competition
                ? React.createElement('div', { className: 'stack list-block' },
                    React.createElement('strong', null, dashboard.competitionLeaderboard.competition.title),
                    React.createElement('span', { className: 'muted' }, `${dashboard.competitionLeaderboard.summary?.events || 0} evento(s) • ${dashboard.competitionLeaderboard.summary?.athletesRanked || 0} atleta(s)`),
                    (dashboard.competitionLeaderboard.leaderboard || []).map((result) =>
                      React.createElement('div', { key: result.userId, className: 'list-item static leaderboard-item' },
                        React.createElement('strong', null, `#${result.rank} ${result.name || result.email}`),
                        React.createElement('span', null, `${result.totalPoints} pts • ${result.eventsCompleted} evento(s)`)
                      )
                    ),
                    !(dashboard.competitionLeaderboard.leaderboard || []).length ? React.createElement('p', { className: 'muted' }, 'Sem resultados para esta competição.') : null
                  )
                : React.createElement('p', { className: 'muted' }, 'Selecione uma competição para ver o ranking agregado.')
            ),
            React.createElement('div', { className: 'card nested-card stack' },
              React.createElement('h4', null, 'Ranking do evento'),
              React.createElement('select', {
                className: 'field',
                value: forms.eventLeaderboardId,
                onChange: (e) => setForms((prev) => ({ ...prev, eventLeaderboardId: e.target.value })),
              },
                React.createElement('option', { value: '' }, 'Selecionar evento'),
                dashboard.competitions.flatMap((competition) =>
                  Array.isArray(competition.events)
                    ? competition.events.map((eventItem) =>
                        React.createElement('option', { key: eventItem.id, value: eventItem.id }, `${competition.title} • ${eventItem.title}`)
                      )
                    : []
                )
              ),
              React.createElement('button', { className: 'btn btn-secondary', onClick: handleLoadEventLeaderboard, disabled: loading || !forms.eventLeaderboardId }, 'Carregar evento'),
              dashboard.eventLeaderboard?.event
                ? React.createElement('div', { className: 'stack list-block' },
                    React.createElement('strong', null, dashboard.eventLeaderboard.event.title),
                    React.createElement('span', { className: 'muted' }, `${dashboard.eventLeaderboard.competition?.title || ''}${dashboard.eventLeaderboard.benchmark?.name ? ` • ${dashboard.eventLeaderboard.benchmark.name}` : ''}`),
                    (dashboard.eventLeaderboard.results || []).map((result) =>
                      React.createElement('div', { key: result.id, className: 'list-item static leaderboard-item' },
                        React.createElement('strong', null, `#${result.rank} ${result.name || result.email}`),
                        React.createElement('span', null, `${result.score_display}${result.points ? ` • ${result.points} pts` : ''}`)
                      )
                    ),
                    !(dashboard.eventLeaderboard.results || []).length ? React.createElement('p', { className: 'muted' }, 'Sem resultados para este evento.') : null
                  )
                : React.createElement('p', { className: 'muted' }, 'Selecione um evento para ver o ranking.')
            )
          ),
          {
            wide: true,
            summary: 'Rankings de benchmark, competição e evento.',
          }
        )
      )
    )
  );
}

function statCard(label, value) {
  return React.createElement('div', { className: 'stat-card card' },
    React.createElement('span', { className: 'stat-label' }, label),
    React.createElement('strong', { className: 'stat-value' }, value)
  );
}

function portalSkeletonCard(key) {
  return React.createElement('div', { key, className: 'stat-card card is-skeleton' },
    React.createElement('div', { className: 'skeleton skeleton-line skeleton-line-sm' }),
    React.createElement('div', { className: 'skeleton skeleton-line skeleton-line-lg' })
  );
}

function portalSkeletonList(count = 3) {
  return Array.from({ length: count }, (_, index) =>
    React.createElement('div', { key: `sk-${index}`, className: 'list-item static is-skeleton' },
      React.createElement('div', { className: 'skeleton skeleton-line skeleton-line-lg' }),
      React.createElement('div', { className: 'skeleton skeleton-line' })
    )
  );
}

function getDaysRemaining(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function formatDateLabel(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sportLabel(value) {
  switch (String(value || 'cross').toLowerCase()) {
    case 'running':
      return 'Running';
    case 'strength':
      return 'Strength';
    default:
      return 'Cross';
  }
}

async function apiRequest(path, options = {}) {
  const cfg = readRuntimeConfig();
  const base = cfg.apiBaseUrl || '/api';
  const url = `${base.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
  const token = options.token !== undefined ? options.token : readToken();

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `Erro API (${response.status})`);
  }

  return data;
}

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.token) || '';
  } catch {
    return '';
  }
}

function writeToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token || '');
}

function readProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile || null));
}

function readRuntimeConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.runtime);
    const fromStorage = raw ? JSON.parse(raw) : {};
    return {
      ...(window.__CROSSAPP_CONFIG__ || {}),
      ...fromStorage,
      billing: {
        ...((window.__CROSSAPP_CONFIG__ || {}).billing || {}),
        ...(fromStorage.billing || {}),
      },
    };
  } catch {
    return window.__CROSSAPP_CONFIG__ || { apiBaseUrl: '/api' };
  }
}

function resolveBillingProvider() {
  const cfg = readRuntimeConfig();
  return cfg?.billing?.provider || 'kiwify_link';
}

function resolveKiwifyCheckoutUrl(planId) {
  const cfg = readRuntimeConfig();
  const links = cfg?.billing?.links || {};
  return links[String(planId || 'coach').trim().toLowerCase()] || '';
}

function getAvailableSportOptions(config) {
  const rollout = config?.app?.rollout || {};
  const coreSports = Array.isArray(rollout.coreSports) && rollout.coreSports.length ? rollout.coreSports : ['cross'];
  const betaSports = rollout.showBetaSports ? (Array.isArray(rollout.betaSports) ? rollout.betaSports : []) : [];
  const allowed = new Set([...coreSports, ...betaSports]);
  return SPORT_OPTIONS.filter((sport) => allowed.has(sport.value));
}
