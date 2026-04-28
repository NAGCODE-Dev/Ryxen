import React, { useEffect, useMemo, useState } from 'react';
import { getRuntimeConfig } from '../packages/shared-web/runtime.js';
import { coachRequestOptional, createCoachApiRequest, resolveCoachKiwifyCheckoutUrl } from './apiClient.js';
import '../coach/styles.css';

const STORAGE_KEYS = {
  token: 'ryxen-auth-token',
  legacyToken: 'crossapp-auth-token',
  profile: 'ryxen-user-profile',
  legacyProfile: 'crossapp-user-profile',
  runtime: 'ryxen-runtime-config',
  legacyRuntime: 'crossapp-runtime-config',
  workoutDraft: 'ryxen-coach-workout-draft',
  legacyWorkoutDraft: 'crossapp-coach-workout-draft',
};

const DEFAULT_WORKOUT_DRAFT = {
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
};

const SPORT_OPTIONS = [
  { value: 'cross', label: 'Cross' },
  { value: 'running', label: 'Running' },
  { value: 'strength', label: 'Strength' },
];

const apiRequest = createCoachApiRequest({ readToken });

const BENCHMARK_SOURCE_OPTIONS = [
  { value: '', label: 'Todas as fontes' },
  { value: 'benchmark', label: 'Benchmark oficial' },
  { value: 'hero', label: 'Hero' },
  { value: 'open', label: 'Open' },
];

const BENCHMARK_CATEGORY_TABS = ['', 'girls', 'classic', 'hero', 'open'];

export default function CoachWorkspace({ profile: initialProfile = null, onLogout = null } = {}) {
  const token = readToken();
  const profile = initialProfile || readProfile();
  const availableSportOptions = getAvailableSportOptions(readRuntimeConfig());
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [draftStatus, setDraftStatus] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState({
    subscription: null,
    entitlements: [],
    gymAccess: [],
    features: {
      competitions: false,
      leaderboards: false,
    },
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
    ...DEFAULT_WORKOUT_DRAFT,
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
    const draft = readWorkoutDraft();
    if (!draft) return;
    setForms((prev) => ({ ...prev, ...draft }));
    setDraftStatus('Rascunho recuperado automaticamente');
  }, []);

  useEffect(() => {
    writeWorkoutDraft(forms);
    setDraftStatus(hasWorkoutDraftContent(forms) ? 'Rascunho salvo automaticamente' : '');
  }, [
    forms.workoutTitle,
    forms.workoutDate,
    forms.workoutBenchmarkSlug,
    forms.workoutLines,
    forms.runningSessionType,
    forms.runningDistanceKm,
    forms.runningDurationMin,
    forms.runningTargetPace,
    forms.runningZone,
    forms.runningNotes,
    forms.runningSegments,
    forms.strengthFocus,
    forms.strengthLoadGuidance,
    forms.strengthRir,
    forms.strengthRestSeconds,
    forms.strengthExercises,
    forms.workoutAudienceMode,
    forms.targetMembershipIds,
    forms.targetGroupIds,
  ]);

  useEffect(() => {
    if (activeSection === 'competition' && !dashboard.features?.competitions) {
      setActiveSection('overview');
      return;
    }
    if (activeSection === 'leaderboards' && !dashboard.features?.leaderboards) {
      setActiveSection('overview');
    }
  }, [activeSection, dashboard.features]);

  async function loadDashboard(nextGymId = null, nextSportType = null) {
    setLoading(true);
    setError('');
    try {
      const preferredSportType = nextSportType || dashboard.selectedSportType || 'cross';
      const selectedSportType = availableSportOptions.some((sport) => sport.value === preferredSportType)
        ? preferredSportType
        : (availableSportOptions[0]?.value || 'cross');
      const [subscription, entitlementsRes, gymsRes, feedRes, benchmarksRes, competitionsRes, leaderboardProbe] = await Promise.all([
        apiRequest('/billing/status'),
        apiRequest('/billing/entitlements'),
        apiRequest('/gyms/me'),
        apiRequest(`/workouts/feed?sportType=${encodeURIComponent(selectedSportType)}`),
        apiRequest('/benchmarks?limit=30&sort=year_desc'),
        coachRequestOptional(apiRequest, `/competitions/calendar?sportType=${encodeURIComponent(selectedSportType)}`, { competitions: [] }),
        coachRequestOptional(apiRequest, `/leaderboards/benchmarks/${encodeURIComponent(forms.leaderboardSlug || 'fran')}?limit=1&sportType=${encodeURIComponent(selectedSportType)}`, null),
      ]);

      const gyms = gymsRes?.gyms || [];
      const gymAccess = entitlementsRes?.gymAccess || [];
      const gymAccessById = new Map(
        gymAccess
          .filter((item) => item?.gymId !== null && item?.gymId !== undefined)
          .map((item) => [Number(item.gymId), item]),
      );
      const selectedGymId = nextGymId || dashboard.selectedGymId || gyms[0]?.id || null;
      let members = [];
      let groups = [];
      let insights = null;
      if (selectedGymId) {
        const selectedGymAccess = gymAccessById.get(Number(selectedGymId)) || null;
        const [membersRes, groupsRes, insightsRes] = await Promise.all([
          selectedGymAccess?.canCoachManage
            ? apiRequest(`/gyms/${selectedGymId}/memberships`)
            : coachRequestOptional(apiRequest, `/gyms/${selectedGymId}/memberships`, { memberships: [] }),
          selectedGymAccess?.canCoachManage
            ? apiRequest(`/gyms/${selectedGymId}/groups?sportType=${encodeURIComponent(selectedSportType)}`)
            : coachRequestOptional(apiRequest, `/gyms/${selectedGymId}/groups?sportType=${encodeURIComponent(selectedSportType)}`, { groups: [] }),
          selectedGymAccess?.canCoachManage
            ? apiRequest(`/gyms/${selectedGymId}/insights?sportType=${encodeURIComponent(selectedSportType)}`)
            : coachRequestOptional(apiRequest, `/gyms/${selectedGymId}/insights?sportType=${encodeURIComponent(selectedSportType)}`, null),
        ]);
        members = membersRes?.memberships || [];
        groups = groupsRes?.groups || [];
        insights = insightsRes || null;
      }

      setDashboard({
        subscription,
        entitlements: entitlementsRes?.entitlements || [],
        gymAccess,
        features: {
          competitions: !!competitionsRes,
          leaderboards: !!leaderboardProbe,
        },
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
        ...DEFAULT_WORKOUT_DRAFT,
      }));
      clearWorkoutDraft();
      setDraftStatus('');
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
        const checkoutUrl = resolveCoachKiwifyCheckoutUrl(planId);
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
      setMessage('Acesso local liberado');
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
    if (!dashboard.features?.competitions) {
      setError('Competições não estão disponíveis nesta versão do backend.');
      return;
    }
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
    if (!dashboard.features?.competitions) {
      setError('Eventos de competição não estão disponíveis nesta versão do backend.');
      return;
    }
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
    if (!dashboard.features?.leaderboards) {
      setError('Rankings não estão disponíveis nesta versão do backend.');
      return;
    }
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
    if (!dashboard.features?.leaderboards) {
      setError('Registro de resultados ainda não está disponível nesta versão do backend.');
      return;
    }
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
    if (!dashboard.features?.competitions || !dashboard.features?.leaderboards) {
      setError('Rankings de competição não estão disponíveis nesta versão do backend.');
      return;
    }
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
    if (!dashboard.features?.competitions || !dashboard.features?.leaderboards) {
      setError('Rankings de evento não estão disponíveis nesta versão do backend.');
      return;
    }
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

  function handleClearWorkoutDraft() {
    setForms((prev) => ({ ...prev, ...DEFAULT_WORKOUT_DRAFT }));
    clearWorkoutDraft();
    setDraftStatus('');
    setMessage('Rascunho limpo');
  }

  const canCoachManage = dashboard.entitlements.includes('coach_portal');
  const canAthleteUseApp = dashboard.entitlements.includes('athlete_app');
  const subscription = dashboard.subscription || null;
  const planName = subscription?.plan || subscription?.plan_id || 'free';
  const planStatus = subscription?.status || 'inactive';
  const renewAt = subscription?.renewAt || subscription?.renew_at || null;
  const daysRemaining = getDaysRemaining(renewAt);
  const billingTone = daysRemaining !== null && daysRemaining <= 7 ? 'warn' : (canCoachManage ? 'ok' : 'warn');
  const canUseDeveloperTools = (
    String(profile?.email || '').toLowerCase() === 'nagcode.contact@gmail.com'
    || profile?.isAdmin === true
    || profile?.is_admin === true
  );
  const athleteMembers = dashboard.members.filter((member) => member.role === 'athlete' && member.status === 'active');
  const showSkeleton = loading && !dashboard.gyms.length && !dashboard.feed.length && !dashboard.benchmarks.length;
  const isRunning = dashboard.selectedSportType === 'running';
  const isStrength = dashboard.selectedSportType === 'strength';
  const quickSections = [
    ['overview', 'Visão geral'],
    ['operation', 'Operação'],
    ['programming', 'Programação'],
    ['library', 'Biblioteca'],
    ...(dashboard.features?.competitions ? [['competition', 'Competições']] : []),
    ...(dashboard.features?.leaderboards ? [['leaderboards', 'Rankings']] : []),
  ];
  const isOverviewSection = activeSection === 'overview';
  const isOperationSection = activeSection === 'operation';
  const isProgrammingSection = activeSection === 'programming';
  const isLibrarySection = activeSection === 'library';
  const isCompetitionSection = activeSection === 'competition';
  const isLeaderboardsSection = activeSection === 'leaderboards';
  const publishAudienceMode = forms.workoutAudienceMode || 'all';
  const hasSelectedAthletes = forms.targetMembershipIds.length > 0;
  const hasSelectedGroups = forms.targetGroupIds.length > 0;
  const publishSummary = publishAudienceMode === 'groups'
    ? (hasSelectedGroups ? `${forms.targetGroupIds.length} grupo(s) selecionado(s)` : 'Nenhum grupo selecionado')
    : publishAudienceMode === 'selected'
      ? (hasSelectedAthletes ? `${forms.targetMembershipIds.length} atleta(s) selecionado(s)` : 'Nenhum atleta selecionado')
      : 'Todos os atletas do gym';
  const previewLines = String(forms.workoutLines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  const previewOverflow = Math.max(0, String(forms.workoutLines || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length - previewLines.length);
  const publishErrors = getPublishValidationErrors({
    forms,
    selectedGymId: dashboard.selectedGymId,
    athleteMembers,
    groups: dashboard.groups,
    canCoachManage,
  });
  const canPublishWorkout = !loading && publishErrors.length === 0;
  const shouldShowBillingAction = !canCoachManage || planStatus !== 'active';
  const overviewBenchmarks = (dashboard.insights?.topBenchmarks || []).length
    ? dashboard.insights.topBenchmarks
      .slice(0, 4)
      .map((item) => ({
        key: item.slug || item.name,
        title: item.name || 'Benchmark',
        detail: `${item.total || 0} registro(s) no gym`,
      }))
    : dashboard.benchmarks
      .slice(0, 4)
      .map((benchmark) => ({
        key: benchmark.slug || benchmark.id,
        title: benchmark.name || benchmark.slug || 'Benchmark',
        detail: `${benchmarkCategoryLabel(benchmark.category)}${benchmark.year ? ` • ${benchmark.year}` : ''}`,
      }));
  const overviewRecentPrs = dashboard.selectedSportType === 'cross'
    ? (dashboard.insights?.recentPrs || []).slice(0, 4)
    : [];
  const overviewFeed = (dashboard.feed || []).slice(0, 4);

  function renderSportSpecificWorkoutFields() {
    if (isRunning) {
      return React.createElement(React.Fragment, null,
        React.createElement('section', { className: 'stack nested-card publish-formSection' },
          React.createElement('div', { className: 'publish-formSectionHead' },
            React.createElement('div', { className: 'eyebrow' }, 'Resumo da corrida'),
            React.createElement('strong', null, 'Sessão estruturada')
          ),
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
          )
        ),
        React.createElement('section', { className: 'stack nested-card publish-formSection' },
          React.createElement('div', { className: 'publish-formSectionHead' },
            React.createElement('div', { className: 'eyebrow' }, 'Segmentos / intervalos'),
            React.createElement('span', { className: 'muted' }, 'Cada bloco ganha mais espaço no mobile para edição rápida.')
          ),
          (forms.runningSegments || []).map((segment, index) =>
            React.createElement('div', { key: `seg-${index}`, className: 'stack publish-collectionItem' },
              React.createElement('div', { className: 'publish-collectionHead' },
                React.createElement('strong', null, `Segmento ${index + 1}`),
                React.createElement('span', { className: 'muted' }, segment.label || 'Defina bloco, distância, pace e descanso')
              ),
              React.createElement('div', { className: 'grid dual-grid' },
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
                React.createElement('input', {
                  className: 'field',
                  type: 'number',
                  min: '0',
                  step: '15',
                  placeholder: 'Descanso (seg)',
                  value: segment.restSeconds,
                  onChange: (e) => updateCollectionItem('runningSegments', index, 'restSeconds', e.target.value),
                }),
              ),
              React.createElement('div', { className: 'publish-collectionActions' },
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
        React.createElement('section', { className: 'stack nested-card publish-formSection' },
          React.createElement('div', { className: 'publish-formSectionHead' },
            React.createElement('div', { className: 'eyebrow' }, 'Guia de força'),
            React.createElement('strong', null, 'Parâmetros da sessão')
          ),
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
          )
        ),
        React.createElement('section', { className: 'stack nested-card publish-formSection' },
          React.createElement('div', { className: 'publish-formSectionHead' },
            React.createElement('div', { className: 'eyebrow' }, 'Exercícios estruturados'),
            React.createElement('span', { className: 'muted' }, 'Bom para montar força por exercício sem ficar apertado no celular.')
          ),
          (forms.strengthExercises || []).map((exercise, index) =>
            React.createElement('div', { key: `ex-${index}`, className: 'stack publish-collectionItem' },
              React.createElement('div', { className: 'publish-collectionHead' },
                React.createElement('strong', null, `Exercício ${index + 1}`),
                React.createElement('span', { className: 'muted' }, exercise.name || 'Nome, sets, reps, carga e RIR')
              ),
              React.createElement('div', { className: 'grid dual-grid' },
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
              ),
              React.createElement('div', { className: 'publish-collectionActions' },
                React.createElement('button', {
                  type: 'button',
                  className: 'btn btn-secondary',
                  onClick: () => removeCollectionItem('strengthExercises', index),
                  disabled: (forms.strengthExercises || []).length <= 1,
                }, 'Remover exercício')
              )
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

  return React.createElement('div', { className: 'portal-shell' },
    React.createElement('aside', { className: 'sidebar' },
      React.createElement('div', { className: 'eyebrow' }, 'Ryxen Coach'),
      React.createElement('h1', { className: 'sidebar-title' }, 'Coach Portal'),
      React.createElement('p', { className: 'sidebar-copy' }, 'Operação, benchmarks, rankings e programação.'),
      React.createElement('div', { className: 'profile-box' },
        React.createElement('strong', null, profile?.name || profile?.email || 'Coach'),
        React.createElement('span', null, profile?.email || '')
      ),
      React.createElement('div', { className: 'sidebar-plan' },
        React.createElement('span', { className: 'stat-label' }, 'Acesso atual'),
        React.createElement('strong', { className: 'sidebar-planValue' }, planName),
        React.createElement('span', { className: `pill ${billingTone}` },
          renewAt
            ? (daysRemaining !== null ? `${daysRemaining} dia(s) restantes` : formatDateLabel(renewAt))
            : 'Sem renovação'
        )
      ),
      React.createElement('nav', { className: 'sidebar-nav', 'aria-label': 'Seções do portal' },
        quickSections.map(([id, label]) =>
          React.createElement('button', {
            key: id,
            type: 'button',
            className: `sidebar-navLink ${activeSection === id ? 'isActive' : ''}`,
            onClick: () => setActiveSection(id),
          }, label)
        )
      ),
      React.createElement('div', { className: 'stack' },
        React.createElement('button', { className: 'btn btn-secondary', onClick: () => loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType) }, 'Atualizar dados'),
        React.createElement('button', { className: 'btn btn-secondary', onClick: handleLogout }, 'Sair'),
        React.createElement('a', { className: 'btn btn-link', href: '/' }, 'Voltar ao app do atleta')
      )
    ),
    React.createElement('main', { className: 'portal-main' },
      React.createElement('section', { className: 'hero', id: 'overview' },
        React.createElement('div', null,
          React.createElement('div', { className: 'eyebrow' }, 'Operação do coach'),
          React.createElement('h2', null, selectedGym ? `Operação de ${selectedGym.name}` : 'Seu painel operacional do box'),
          React.createElement('p', { className: 'hero-copy' }, selectedGym
            ? `Publicação, grupos, atletas, benchmarks e rotina de ${selectedGym.name}.`
            : 'Escolha um gym para publicar, acompanhar atletas e usar o portal.')
        ),
        React.createElement('div', { className: 'hero-pills' },
          React.createElement('span', { className: 'pill' }, sportLabel(dashboard.selectedSportType)),
          React.createElement('span', { className: `pill ${canCoachManage ? 'ok' : 'warn'}` }, canCoachManage ? 'Portal disponível' : 'Portal indisponível'),
          React.createElement('span', { className: `pill ${canAthleteUseApp ? 'ok' : 'warn'}` }, canAthleteUseApp ? 'Atletas com acesso' : 'Atletas sem acesso')
        )
      ),
      React.createElement('section', { className: 'portal-toolbarCard card' },
        React.createElement('div', { className: 'stack' },
          React.createElement('div', { className: 'eyebrow' }, 'Modalidade ativa'),
          React.createElement('strong', null, 'Selecione a modalidade'),
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
      React.createElement('section', { className: 'portal-viewTabs', 'aria-label': 'Áreas do portal' },
        quickSections.map(([id, label]) =>
          React.createElement('button', {
            key: id,
            type: 'button',
            className: `btn btn-chip ${activeSection === id ? 'is-active' : ''}`,
            onClick: () => setActiveSection(id),
          }, label)
        )
      ),
      error ? React.createElement('div', { className: 'notice error' }, error) : null,
      message ? React.createElement('div', { className: 'notice success' }, message) : null,
      React.createElement('section', { className: `billing-banner billing-banner-${billingTone}`, hidden: !isOverviewSection },
        React.createElement('div', null,
          React.createElement('div', { className: 'eyebrow' }, 'Acesso'),
          React.createElement('strong', { className: 'billing-bannerTitle' },
            planStatus === 'active'
              ? `Acesso ${planName} ativo`
              : `${planName} • ${planStatus}`
          ),
          React.createElement('p', { className: 'muted' },
            renewAt
              ? `Renovação em ${formatDateLabel(renewAt)}${daysRemaining !== null ? ` • ${daysRemaining} dia(s) restantes` : ''}`
              : 'Sem renovação cadastrada. O portal segue em modo limitado enquanto o acesso não estiver ativo.'
          )
        ),
        React.createElement('div', { className: 'billing-bannerActions' },
          shouldShowBillingAction ? React.createElement('button', { className: 'btn btn-primary', onClick: () => handleCheckout('coach'), disabled: loading }, 'Abrir cobrança') : null,
          canUseDeveloperTools ? React.createElement('button', { className: 'btn btn-secondary', onClick: handleActivateLocalPlan, disabled: loading }, 'Ativar local') : null,
          React.createElement('a', { className: 'btn btn-link', href: '/terms.html', target: '_blank', rel: 'noreferrer' }, 'Termos')
        )
      ),
      React.createElement('section', { className: 'grid stats-grid', hidden: !isOverviewSection },
        showSkeleton
          ? Array.from({ length: 6 }, (_, index) => portalSkeletonCard(`stat-${index}`))
          : [
              statCard('Acesso', planName),
              statCard('Status', planStatus),
              statCard('Gyms', String(dashboard.gyms.length)),
              statCard('Modalidade', sportLabel(dashboard.selectedSportType)),
              statCard('Treinos no feed', String(dashboard.feed.length)),
              statCard('Atletas ativos', String(dashboard.insights?.stats?.athletes || 0)),
              statCard('Resultados', String(dashboard.insights?.stats?.results || 0)),
              statCard('PRs ativos', String(dashboard.insights?.stats?.activePrs || 0)),
              statCard('Atletas com PR', String(dashboard.insights?.stats?.athletesWithPrs || 0)),
            ]
      ),
      React.createElement('section', { className: 'portal-sectionHeader', id: 'operation', hidden: !isOperationSection },
        React.createElement('div', { className: 'eyebrow' }, 'Operação'),
        React.createElement('h3', null, 'Estrutura do box'),
        React.createElement('p', { className: 'muted' }, 'Gyms, membros, grupos e indicadores operacionais em leitura direta.')
      ),
      React.createElement('section', { className: 'grid portal-grid', hidden: !isOverviewSection },
        !dashboard.gyms.length
          ? React.createElement('div', { className: 'card wide' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Primeiros passos'),
                React.createElement('strong', null, 'Começar pelo básico')
              ),
              React.createElement('p', { className: 'muted' }, 'Crie um gym, convide membros e publique um treino.'),
              React.createElement('div', { className: 'stack list-block' },
                React.createElement('div', { className: 'list-item static' },
                  React.createElement('strong', null, '1. Criar gym'),
                  React.createElement('span', null, 'Abra Operação para cadastrar o box e definir o contexto inicial.')
                ),
                React.createElement('div', { className: 'list-item static' },
                  React.createElement('strong', null, '2. Convidar membros'),
                  React.createElement('span', null, 'Adicione atletas e coaches para montar a estrutura de trabalho.')
                ),
                React.createElement('div', { className: 'list-item static' },
                  React.createElement('strong', null, '3. Publicar treino'),
                  React.createElement('span', null, 'Use Programação para enviar o primeiro treino ao feed do atleta.')
                )
              ),
              React.createElement('div', { className: 'billing-bannerActions' },
                React.createElement('button', { className: 'btn btn-secondary', type: 'button', onClick: () => setActiveSection('operation') }, 'Abrir operação'),
                React.createElement('button', { className: 'btn btn-secondary', type: 'button', onClick: () => setActiveSection('programming') }, 'Abrir programação'),
                React.createElement('button', { className: 'btn btn-secondary', type: 'button', onClick: () => setActiveSection('library') }, 'Ver benchmarks')
              )
            )
          : [
              React.createElement('div', { className: 'card', key: 'overview-actions' },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Próximas ações'),
                  React.createElement('strong', null, selectedGym ? `Fluxo de ${selectedGym.name}` : 'Fluxo operacional')
                ),
                React.createElement('div', { className: 'stack list-block' },
                  React.createElement('button', { className: 'list-item', type: 'button', onClick: () => setActiveSection('programming') },
                    React.createElement('strong', null, 'Publicar treino'),
                    React.createElement('span', null, selectedGym ? `Enviar treino para ${selectedGym.name}` : 'Abrir publicação')
                  ),
                  React.createElement('button', { className: 'list-item', type: 'button', onClick: () => setActiveSection('operation') },
                    React.createElement('strong', null, 'Revisar membros e grupos'),
                    React.createElement('span', null, `${dashboard.members.length} membro(s) • ${dashboard.groups.length} grupo(s)`)
                  ),
                  React.createElement('button', { className: 'list-item', type: 'button', onClick: () => setActiveSection('library') },
                    React.createElement('strong', null, 'Consultar benchmarks'),
                    React.createElement('span', null, `${dashboard.benchmarkPagination.total || dashboard.benchmarks.length || 0} benchmark(s) disponíveis`)
                  )
                )
              ),
              React.createElement('div', { className: 'card', key: 'overview-access' },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Leitura rápida'),
                  React.createElement('strong', null, 'Estado atual do portal')
                ),
                React.createElement('div', { className: 'stack list-block' },
                  React.createElement('div', { className: 'list-item static' },
                    React.createElement('strong', null, 'Gym selecionado'),
                    React.createElement('span', null, selectedGym ? `${selectedGym.name} • ${selectedGym.role || 'membro'}` : 'Nenhum gym ativo')
                  ),
                  React.createElement('div', { className: 'list-item static' },
                    React.createElement('strong', null, 'Portal do coach'),
                    React.createElement('span', null, canCoachManage ? 'Disponível para operar' : 'Indisponível no estado atual')
                  ),
                  React.createElement('div', { className: 'list-item static' },
                    React.createElement('strong', null, 'App do atleta'),
                    React.createElement('span', null, canAthleteUseApp ? 'Disponível para os atletas vinculados' : 'Sem liberação para atletas')
                  ),
                  React.createElement('div', { className: 'list-item static' },
                    React.createElement('strong', null, 'Renovação'),
                    React.createElement('span', null, renewAt ? formatDateLabel(renewAt) : 'Sem data cadastrada')
                  )
                )
              ),
              React.createElement('div', { className: 'card', key: 'overview-benchmarks' },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Benchmarks'),
                  React.createElement('strong', null, 'Referências em destaque')
                ),
                overviewBenchmarks.length
                  ? React.createElement('div', { className: 'stack list-block' },
                      overviewBenchmarks.map((item) =>
                        React.createElement('div', { key: item.key, className: 'list-item static' },
                          React.createElement('strong', null, item.title),
                          React.createElement('span', null, item.detail)
                        )
                      )
                    )
                  : React.createElement('p', { className: 'muted' }, 'Abra a biblioteca para ver benchmarks.'),
                React.createElement('div', { className: 'billing-bannerActions' },
                  React.createElement('button', { className: 'btn btn-secondary', type: 'button', onClick: () => setActiveSection('library') }, 'Abrir biblioteca')
                )
              ),
              React.createElement('div', { className: 'card', key: 'overview-prs' },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'PRs'),
                  React.createElement('strong', null, 'Últimos registros')
                ),
                dashboard.selectedSportType !== 'cross'
                  ? React.createElement('p', { className: 'muted' }, 'Troque para Cross para ver PRs.')
                  : overviewRecentPrs.length
                    ? React.createElement('div', { className: 'stack list-block' },
                        overviewRecentPrs.map((record, index) =>
                          React.createElement('div', { key: `${record.id || record.exercise || 'pr'}-${index}`, className: 'list-item static' },
                            React.createElement('strong', null, record.athlete_name || record.athlete_email || 'Atleta'),
                            React.createElement('span', null, `${record.exercise} • ${formatNumericValue(record.value)} ${record.unit || 'kg'}`)
                          )
                        )
                      )
                    : React.createElement('p', { className: 'muted' }, 'Nenhum PR sincronizado recentemente.'),
                React.createElement('div', { className: 'billing-bannerActions' },
                  React.createElement('button', { className: 'btn btn-secondary', type: 'button', onClick: () => setActiveSection('operation') }, 'Abrir operação')
                )
              ),
              React.createElement('div', { className: 'card wide', key: 'overview-feed' },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Feed'),
                  React.createElement('strong', null, 'Treinos recentes publicados')
                ),
                overviewFeed.length
                  ? React.createElement('div', { className: 'stack list-block' },
                      overviewFeed.map((item) =>
                        React.createElement('div', { key: item.id, className: 'list-item static' },
                          React.createElement('strong', null, item.title || 'Treino'),
                          React.createElement('span', null, `${item.gym_name || selectedGym?.name || 'Gym'} • ${sportLabel(item.sport_type || dashboard.selectedSportType)}${item.benchmark?.name ? ` • ${item.benchmark.name}` : ''}`)
                        )
                      )
                    )
                  : React.createElement('p', { className: 'muted' }, 'Sem treinos publicados ainda para este contexto.'),
                React.createElement('div', { className: 'billing-bannerActions' },
                  React.createElement('button', { className: 'btn btn-secondary', type: 'button', onClick: () => setActiveSection('programming') }, 'Abrir programação'),
                  React.createElement('button', { className: 'btn btn-secondary', type: 'button', onClick: () => loadDashboard(dashboard.selectedGymId, dashboard.selectedSportType) }, 'Atualizar visão geral')
                )
              ),
            ]
      ),
      React.createElement('section', { className: 'grid portal-grid', hidden: !(isOperationSection || isProgrammingSection || isLibrarySection) },
        React.createElement('div', { className: 'card wide operation-shellLayout', hidden: !isOperationSection },
          React.createElement('div', { className: 'stack operation-primaryRail' },
            React.createElement('div', { className: 'card nested-card operation-card' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Gyms'),
                React.createElement('strong', null, 'Estrutura principal')
              ),
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
              React.createElement('form', { className: 'stack operation-form', onSubmit: handleCreateGym },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Novo gym'),
                  React.createElement('span', { className: 'muted' }, 'Crie um box sem sair da operação.')
                ),
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
              )
            ),
            React.createElement('div', { className: 'card nested-card operation-card' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Membros'),
                React.createElement('strong', null, selectedGym ? `Equipe de ${selectedGym.name}` : 'Equipe do gym')
              ),
              React.createElement('div', { className: 'stack list-block' },
                showSkeleton
                  ? portalSkeletonList(3)
                  : dashboard.members.map((member) =>
                  React.createElement('div', { key: member.id, className: 'list-item static member-item' },
                    React.createElement('strong', null, member.name || member.email || member.pending_email || 'Convidado'),
                    React.createElement('span', null, `${member.role} • ${member.status}`)
                  )
                  ),
                dashboard.members.length === 0 ? React.createElement('p', { className: 'muted' }, 'Selecione um gym para carregar membros.') : null
              ),
              React.createElement('form', { className: 'stack operation-form', onSubmit: handleAddMember },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Adicionar membro'),
                  React.createElement('span', { className: 'muted' }, 'Convide atleta ou coach em poucos toques.')
                ),
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
              )
            )
          ),
          React.createElement('div', { className: 'stack operation-secondaryRail' },
            React.createElement('div', { className: 'card nested-card operation-card' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Grupos'),
                React.createElement('strong', null, selectedGym ? `Grupos de ${selectedGym.name}` : 'Grupos')
              ),
              React.createElement('p', { className: 'muted' }, `Mostrando grupos de ${sportLabel(dashboard.selectedSportType)}.`),
              React.createElement('div', { className: 'stack list-block' },
                showSkeleton
                  ? portalSkeletonList(2)
                  : dashboard.groups.map((group) =>
                  React.createElement('div', { key: group.id, className: 'list-item static group-item' },
                    React.createElement('strong', null, group.name),
                    React.createElement('span', null, `${group.member_count || group.members?.length || 0} atleta(s) • ${sportLabel(group.sport_type || dashboard.selectedSportType)}${group.description ? ` • ${group.description}` : ''}`)
                  )
                  ),
                dashboard.groups.length === 0 ? React.createElement('p', { className: 'muted' }, 'Crie grupos para blocos especiais e planilhas separadas.') : null
              ),
              React.createElement('form', { className: 'stack operation-form', onSubmit: handleCreateGroup },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Novo grupo'),
                  React.createElement('span', { className: 'muted' }, 'Selecione atletas sem apertar a interface no celular.')
                ),
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
                React.createElement('div', { className: 'selection-grid operation-selectionGrid' },
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
              )
            ),
            React.createElement('div', { className: 'card nested-card operation-card' },
              React.createElement('h3', null, selectedGym ? `Insights de ${selectedGym.name}` : 'Insights do gym'),
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
                      React.createElement(
                        'span',
                        null,
                        dashboard.features?.competitions
                          ? `${dashboard.insights.stats?.competitions || 0} no total • ${dashboard.insights.stats?.upcomingCompetitions || 0} próximas`
                          : 'Agenda de competições indisponível nesta versão'
                      )
                    ),
                    React.createElement('div', { className: 'list-item static' },
                      React.createElement('strong', null, 'Grupos'),
                      React.createElement('span', null, `${dashboard.insights.stats?.groups || 0} grupo(s) ativos`)
                    ),
                    React.createElement('div', { className: 'list-item static' },
                      React.createElement('strong', null, 'PRs sincronizados'),
                      React.createElement(
                        'span',
                        null,
                        dashboard.selectedSportType === 'cross'
                          ? `${dashboard.insights.stats?.activePrs || 0} PR(s) ativos em ${dashboard.insights.stats?.athletesWithPrs || 0} atleta(s)`
                          : 'Disponível ao visualizar o modo Cross'
                      )
                    ),
                    React.createElement('div', { className: 'list-item static' },
                      React.createElement('strong', null, 'Benchmarks mais usados'),
                      React.createElement('span', null, (dashboard.insights.topBenchmarks || []).length ? dashboard.insights.topBenchmarks.map((item) => `${item.name} (${item.total})`).join(' • ') : 'Sem volume suficiente ainda')
                    ),
                    React.createElement('div', { className: 'list-item static' },
                      React.createElement('strong', null, 'Últimos PRs'),
                      React.createElement(
                        'span',
                        null,
                        dashboard.selectedSportType === 'cross'
                          ? ((dashboard.insights.recentPrs || []).length
                            ? dashboard.insights.recentPrs
                              .map((record) => `${record.athlete_name || record.athlete_email || 'Atleta'} • ${record.exercise} ${formatNumericValue(record.value)} ${record.unit || 'kg'}`)
                              .join(' • ')
                            : 'Nenhum PR sincronizado recentemente')
                          : 'Troque para Cross para revisar PRs'
                      )
                    )
                  )
                : React.createElement('p', { className: 'muted' }, 'Selecione um gym para carregar métricas operacionais.')
            )
          )
        ),
        React.createElement('div', { className: 'card wide', hidden: !isProgrammingSection },
        React.createElement('div', { className: 'portal-sectionHeader portal-sectionHeader-inline', id: 'programming' },
          React.createElement('div', { className: 'eyebrow' }, 'Programação'),
          React.createElement('h3', null, `Publicar treino • ${sportLabel(dashboard.selectedSportType)}`),
          React.createElement('p', { className: 'muted' }, 'Monte a sessão, escolha a audiência e publique sem sair do portal.')
        ),
          React.createElement('form', { className: 'stack publish-form', onSubmit: handlePublishWorkout },
            React.createElement('div', { className: 'publish-shellLayout' },
              React.createElement('div', { className: 'stack publish-editorRail' },
                React.createElement('section', { className: 'stack nested-card publish-formSection' },
                  React.createElement('div', { className: 'publish-formSectionHead' },
                    React.createElement('div', { className: 'eyebrow' }, 'Sessão'),
                    React.createElement('strong', null, 'Base da publicação')
                  ),
                  React.createElement('div', { className: 'grid dual-grid' },
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
                  ),
                  renderSportSpecificWorkoutFields(),
                  React.createElement('textarea', {
                    className: 'field textarea publish-workoutTextarea',
                    placeholder: isRunning
                      ? 'Uma linha por bloco/intervalo (ex: 6x400m @ 4:20/km / 1:30 trote)'
                      : isStrength
                        ? 'Uma linha por exercício (ex: Back Squat | 5x5 | 100kg)'
                        : 'Uma linha por exercício',
                    value: forms.workoutLines,
                    onChange: (e) => setForms((prev) => ({ ...prev, workoutLines: e.target.value })),
                  })
                ),
                React.createElement('section', { className: 'stack nested-card audience-card publish-formSection' },
                  React.createElement('div', { className: 'publish-formSectionHead' },
                    React.createElement('div', { className: 'eyebrow' }, 'Audiência'),
                    React.createElement('strong', null, 'Destino da publicação')
                  ),
                  React.createElement('span', { className: 'muted' }, 'Escolha só o destino que precisa publicar agora.'),
                  React.createElement('div', { className: 'tabs audience-modeTabs' },
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
                  React.createElement('div', { className: 'publish-audienceSummary' },
                    React.createElement('strong', null, 'Resumo da audiência'),
                    React.createElement('span', { className: 'muted' }, publishSummary)
                  ),
                  React.createElement('div', { className: 'selection-panels', hidden: publishAudienceMode === 'all' },
                    React.createElement('div', { className: 'selection-panel' },
                      publishAudienceMode === 'groups' ? null : React.createElement(React.Fragment, null,
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
                      )
                    ),
                    React.createElement('div', { className: 'selection-panel' },
                      publishAudienceMode === 'selected' ? null : React.createElement(React.Fragment, null,
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
                  )
                )
              ),
              React.createElement('div', { className: 'stack publish-summaryRail' },
                React.createElement('div', { className: 'publish-flow' },
                  React.createElement('div', { className: 'publish-step isActive' },
                    React.createElement('span', { className: 'publish-stepIndex' }, '1'),
                    React.createElement('div', null,
                      React.createElement('strong', null, 'Sessão'),
                      React.createElement('span', null, 'Título, data e estrutura do treino')
                    )
                  ),
                  React.createElement('div', { className: 'publish-step' },
                    React.createElement('span', { className: 'publish-stepIndex' }, '2'),
                    React.createElement('div', null,
                      React.createElement('strong', null, 'Audiência'),
                      React.createElement('span', null, publishSummary)
                    )
                  ),
                  React.createElement('div', { className: 'publish-step' },
                    React.createElement('span', { className: 'publish-stepIndex' }, '3'),
                    React.createElement('div', null,
                      React.createElement('strong', null, 'Publicação'),
                      React.createElement('span', null, selectedGym ? `Vai para ${selectedGym.name}` : 'Selecione um gym')
                    )
                  )
                ),
                React.createElement('div', { className: 'publish-metaCard' },
                  React.createElement('strong', null, 'Resumo rápido'),
                  React.createElement('span', null, selectedGym ? `${selectedGym.name} • ${sportLabel(dashboard.selectedSportType)}` : 'Escolha um gym para publicar'),
                  React.createElement('span', null, publishSummary)
                ),
                React.createElement('div', { className: 'publish-previewCard' },
                  React.createElement('div', { className: 'publish-previewHead' },
                    React.createElement('strong', null, 'Prévia do atleta'),
                    React.createElement('span', null, forms.workoutTitle || 'Título do treino')
                  ),
                  React.createElement('div', { className: 'publish-previewMeta' },
                    React.createElement('span', null, forms.workoutDate ? formatDateLabel(forms.workoutDate) : 'Sem data definida'),
                    React.createElement('span', null, publishSummary)
                  ),
                  previewLines.length
                    ? React.createElement('div', { className: 'publish-previewList' },
                        previewLines.map((line, index) =>
                          React.createElement('div', { key: `preview-line-${index}`, className: 'publish-previewLine' },
                            React.createElement('span', { className: 'publish-previewDot', 'aria-hidden': 'true' }),
                            React.createElement('span', null, line)
                          )
                        ),
                        previewOverflow > 0
                          ? React.createElement('span', { className: 'muted' }, `+${previewOverflow} linha(s) na publicação`)
                          : null
                      )
                    : React.createElement('p', { className: 'muted' }, 'A prévia aparece conforme você preenche o treino.')
                ),
                publishErrors.length
                  ? React.createElement('div', { className: 'publish-validationCard' },
                      React.createElement('strong', null, 'Falta ajustar antes de publicar'),
                      React.createElement('div', { className: 'publish-validationList' },
                        publishErrors.map((item) =>
                          React.createElement('span', { key: item, className: 'publish-validationItem' }, item)
                        )
                      )
                    )
                  : React.createElement('div', { className: 'publish-validationCard isReady' },
                      React.createElement('strong', null, 'Pronto para publicar'),
                      React.createElement('span', { className: 'muted' }, 'O treino já tem o mínimo necessário para ser enviado.')
                    ),
                draftStatus ? React.createElement('div', { className: 'draft-statusRow' },
                  React.createElement('span', { className: 'muted' }, draftStatus),
                  React.createElement('button', {
                    type: 'button',
                    className: 'btn btn-secondary',
                    onClick: handleClearWorkoutDraft,
                  }, 'Limpar rascunho')
                ) : null
              )
            ),
            React.createElement('div', { className: 'publish-actionBar' },
              React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: !canPublishWorkout }, loading ? 'Publicando...' : 'Publicar treino')
            )
          )
        ),
        React.createElement('div', { className: 'card', id: 'library', hidden: !isLibrarySection },
          React.createElement('div', { className: 'portal-sectionHeader portal-sectionHeader-inline' },
            React.createElement('div', { className: 'eyebrow' }, 'Biblioteca'),
            React.createElement('h3', null, 'Benchmarks'),
            React.createElement('p', { className: 'muted' }, 'Busque e filtre a biblioteca oficial em leitura rápida.')
          ),
          React.createElement('div', { className: 'library-shellLayout' },
            React.createElement('section', { className: 'stack nested-card library-filterCard' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Busca'),
                React.createElement('strong', null, 'Filtros de benchmark')
              ),
              React.createElement('div', { className: 'toolbar library-toolbar' },
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
                  BENCHMARK_SOURCE_OPTIONS.map((option) =>
                    React.createElement('option', { key: option.value || 'all', value: option.value }, option.label)
                  )
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
              React.createElement('div', { className: 'tabs library-categoryTabs' },
                BENCHMARK_CATEGORY_TABS.map((category) =>
                  React.createElement('button', {
                    key: category || 'all',
                    className: 'btn btn-chip',
                    onClick: () => handleSearchBenchmarks({ category }),
                  }, benchmarkCategoryLabel(category || 'all'))
                )
              ),
              React.createElement('div', { className: 'benchmark-meta' },
                React.createElement('span', { className: 'muted' }, `${dashboard.benchmarkPagination.total || 0} benchmarks`),
                React.createElement('span', { className: 'muted' }, `Página ${dashboard.benchmarkPagination.page || 1} de ${dashboard.benchmarkPagination.pages || 1}`)
              )
            ),
            React.createElement('section', { className: 'stack nested-card library-resultsCard' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Resultados'),
                React.createElement('strong', null, 'Lista de benchmarks')
              ),
              React.createElement('div', { className: 'stack list-block' },
                showSkeleton
                  ? portalSkeletonList(4)
                  : dashboard.benchmarks.map((benchmark) =>
                  React.createElement('div', { key: benchmark.id, className: 'list-item static benchmark-item' },
                    React.createElement('strong', null, benchmark.name),
                    React.createElement('span', null, `${benchmarkCategoryLabel(benchmark.category)}${benchmark.year ? ` • ${benchmark.year}` : ''}${benchmark.official_source ? ` • ${benchmarkSourceLabel(benchmark.official_source)}` : ''}`),
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
              )
            )
          )
        ),
        React.createElement('div', { className: 'card', hidden: !isProgrammingSection },
          React.createElement('h3', null, `Feed do app • ${sportLabel(dashboard.selectedSportType)}`),
          React.createElement('div', { className: 'stack list-block' },
            showSkeleton
              ? portalSkeletonList(4)
              : dashboard.feed.map((item) =>
              React.createElement('div', { key: item.id, className: 'list-item static' },
                React.createElement('strong', null, item.title),
                React.createElement('span', null, `${item.gym_name || ''} • ${sportLabel(item.sport_type || dashboard.selectedSportType)}${item.benchmark?.name ? ` • ${item.benchmark.name}` : ''}`)
              )
              ),
            dashboard.feed.length === 0 ? React.createElement('p', { className: 'muted' }, 'Sem treinos publicados ainda.') : null
          )
        ),
        React.createElement('div', { className: 'card wide', id: 'competition', hidden: !isCompetitionSection || !dashboard.features?.competitions },
          React.createElement('div', { className: 'portal-sectionHeader portal-sectionHeader-inline' },
            React.createElement('div', { className: 'eyebrow' }, 'Competições'),
            React.createElement('h3', null, 'Calendário e eventos'),
            React.createElement('p', { className: 'muted' }, 'Crie competições e eventos.')
          ),
          React.createElement('div', { className: 'competition-shellLayout' },
            React.createElement('section', { className: 'stack nested-card competition-calendarCard' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Calendário'),
                React.createElement('strong', null, 'Competições cadastradas')
              ),
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
              )
            ),
            React.createElement('div', { className: 'grid dual-grid competition-formGrid' },
              React.createElement('form', { className: 'card nested-card stack', onSubmit: handleCreateCompetition },
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Nova competição'),
                  React.createElement('strong', null, 'Criar calendário')
                ),
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
                React.createElement('div', { className: 'publish-formSectionHead' },
                  React.createElement('div', { className: 'eyebrow' }, 'Novo evento'),
                  React.createElement('strong', null, 'Adicionar prova')
                ),
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
            )
          )
        ),
        React.createElement('div', { className: 'card wide', id: 'leaderboards', hidden: !isLeaderboardsSection || !dashboard.features?.leaderboards },
          React.createElement('div', { className: 'portal-sectionHeader portal-sectionHeader-inline' },
            React.createElement('div', { className: 'eyebrow' }, 'Rankings'),
            React.createElement('h3', null, 'Leaderboards e resultados'),
            React.createElement('p', { className: 'muted' }, 'Consulte rankings e registre resultados sem trocar de contexto.')
          ),
          React.createElement('div', { className: 'grid dual-grid leaderboard-grid' },
            React.createElement('div', { className: 'card nested-card stack leaderboard-card' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Benchmark'),
                React.createElement('strong', null, 'Leaderboard')
              ),
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
            React.createElement('form', { className: 'card nested-card stack leaderboard-card', onSubmit: handleSubmitResult },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Resultado'),
                React.createElement('strong', null, 'Registrar score')
              ),
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
          React.createElement('div', { className: 'grid dual-grid leaderboard-grid' },
            React.createElement('div', { className: 'card nested-card stack leaderboard-card' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Competição'),
                React.createElement('strong', null, 'Ranking agregado')
              ),
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
            React.createElement('div', { className: 'card nested-card stack leaderboard-card' },
              React.createElement('div', { className: 'publish-formSectionHead' },
                React.createElement('div', { className: 'eyebrow' }, 'Evento'),
                React.createElement('strong', null, 'Ranking por prova')
              ),
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
          )
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

function planCard({ name, price, description, features = [], featured = false, action = null, loading = false }) {
  return React.createElement('div', { className: `plan-card ${featured ? 'plan-card-featured' : ''}` },
    React.createElement('span', { className: 'eyebrow' }, 'Acesso'),
    React.createElement('h3', { className: 'plan-cardTitle' }, name),
    React.createElement('strong', { className: 'plan-cardPrice' }, price),
    React.createElement('p', { className: 'muted' }, description),
    React.createElement('div', { className: 'plan-cardFeatures' },
      features.map((feature) =>
        React.createElement('span', { key: feature, className: 'plan-feature' }, feature)
      )
    ),
    action
      ? React.createElement('button', { className: 'btn btn-primary', onClick: action, disabled: loading }, loading ? 'Abrindo...' : 'Abrir cobrança')
      : React.createElement('span', { className: 'plan-cardGhost' }, 'Em breve')
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

function formatNumericValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value || '');
  return Number.isInteger(numeric) ? String(numeric) : numeric.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function benchmarkCategoryLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'girls':
      return 'Girls';
    case 'classic':
      return 'Classics';
    case 'hero':
      return 'Hero';
    case 'open':
      return 'Open';
    case 'all':
    case '':
      return 'Todos';
    default:
      return String(value || 'Todos');
  }
}

function benchmarkSourceLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'benchmark':
      return 'Benchmark oficial';
    case 'hero':
      return 'Hero';
    case 'open':
      return 'Open';
    default:
      return String(value || 'Sem fonte');
  }
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

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem(STORAGE_KEYS.legacyToken) || '';
  } catch {
    return '';
  }
}

function writeToken(token) {
  localStorage.setItem(STORAGE_KEYS.token, token || '');
  localStorage.setItem(STORAGE_KEYS.legacyToken, token || '');
}

function readProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profile) || localStorage.getItem(STORAGE_KEYS.legacyProfile);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getWorkoutDraftPayload(forms = {}) {
  return {
    ...DEFAULT_WORKOUT_DRAFT,
    workoutTitle: String(forms.workoutTitle || ''),
    workoutDate: String(forms.workoutDate || ''),
    workoutBenchmarkSlug: String(forms.workoutBenchmarkSlug || ''),
    workoutLines: String(forms.workoutLines || ''),
    runningSessionType: String(forms.runningSessionType || 'easy'),
    runningDistanceKm: String(forms.runningDistanceKm || ''),
    runningDurationMin: String(forms.runningDurationMin || ''),
    runningTargetPace: String(forms.runningTargetPace || ''),
    runningZone: String(forms.runningZone || ''),
    runningNotes: String(forms.runningNotes || ''),
    runningSegments: Array.isArray(forms.runningSegments) && forms.runningSegments.length
      ? forms.runningSegments.map((segment) => ({
          label: String(segment?.label || ''),
          distanceMeters: String(segment?.distanceMeters || ''),
          targetPace: String(segment?.targetPace || ''),
          restSeconds: String(segment?.restSeconds || ''),
        }))
      : DEFAULT_WORKOUT_DRAFT.runningSegments,
    strengthFocus: String(forms.strengthFocus || ''),
    strengthLoadGuidance: String(forms.strengthLoadGuidance || ''),
    strengthRir: String(forms.strengthRir || ''),
    strengthRestSeconds: String(forms.strengthRestSeconds || ''),
    strengthExercises: Array.isArray(forms.strengthExercises) && forms.strengthExercises.length
      ? forms.strengthExercises.map((exercise) => ({
          name: String(exercise?.name || ''),
          sets: String(exercise?.sets || ''),
          reps: String(exercise?.reps || ''),
          load: String(exercise?.load || ''),
          rir: String(exercise?.rir || ''),
        }))
      : DEFAULT_WORKOUT_DRAFT.strengthExercises,
    workoutAudienceMode: String(forms.workoutAudienceMode || 'all'),
    targetMembershipIds: Array.isArray(forms.targetMembershipIds) ? forms.targetMembershipIds.filter(Boolean) : [],
    targetGroupIds: Array.isArray(forms.targetGroupIds) ? forms.targetGroupIds.filter(Boolean) : [],
  };
}

function hasWorkoutDraftContent(forms = {}) {
  const draft = getWorkoutDraftPayload(forms);
  return !!(
    draft.workoutTitle
    || draft.workoutDate
    || draft.workoutBenchmarkSlug
    || draft.workoutLines
    || draft.runningDistanceKm
    || draft.runningDurationMin
    || draft.runningTargetPace
    || draft.runningZone
    || draft.runningNotes
    || draft.runningSegments.some((segment) => segment.label || segment.distanceMeters || segment.targetPace || segment.restSeconds)
    || draft.strengthFocus
    || draft.strengthLoadGuidance
    || draft.strengthRir
    || draft.strengthRestSeconds
    || draft.strengthExercises.some((exercise) => exercise.name || exercise.sets || exercise.reps || exercise.load || exercise.rir)
    || draft.workoutAudienceMode !== 'all'
    || draft.targetMembershipIds.length
    || draft.targetGroupIds.length
  );
}

function readWorkoutDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.workoutDraft) || localStorage.getItem(STORAGE_KEYS.legacyWorkoutDraft);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return getWorkoutDraftPayload(parsed);
  } catch {
    return null;
  }
}

function writeWorkoutDraft(forms = {}) {
  try {
    if (!hasWorkoutDraftContent(forms)) {
      localStorage.removeItem(STORAGE_KEYS.workoutDraft);
      localStorage.removeItem(STORAGE_KEYS.legacyWorkoutDraft);
      return;
    }
    const serialized = JSON.stringify(getWorkoutDraftPayload(forms));
    localStorage.setItem(STORAGE_KEYS.workoutDraft, serialized);
    localStorage.setItem(STORAGE_KEYS.legacyWorkoutDraft, serialized);
  } catch {
    // no-op
  }
}

function clearWorkoutDraft() {
  try {
    localStorage.removeItem(STORAGE_KEYS.workoutDraft);
    localStorage.removeItem(STORAGE_KEYS.legacyWorkoutDraft);
  } catch {
    // no-op
  }
}

function getPublishValidationErrors({ forms = {}, selectedGymId = '', athleteMembers = [], groups = [], canCoachManage = false } = {}) {
  const errors = [];
  const title = String(forms.workoutTitle || '').trim();
  const date = String(forms.workoutDate || '').trim();
  const lines = String(forms.workoutLines || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const audienceMode = String(forms.workoutAudienceMode || 'all');
  const selectedAthletes = Array.isArray(forms.targetMembershipIds) ? forms.targetMembershipIds.filter(Boolean) : [];
  const selectedGroups = Array.isArray(forms.targetGroupIds) ? forms.targetGroupIds.filter(Boolean) : [];

  if (!selectedGymId) errors.push('Selecione um gym');
  if (!canCoachManage) errors.push('Seu acesso atual não libera publicação no portal');
  if (!title) errors.push('Defina um título para o treino');
  if (!date) errors.push('Escolha a data da publicação');
  if (!lines.length) errors.push('Adicione pelo menos uma linha no treino');
  if (audienceMode === 'selected' && !selectedAthletes.length) errors.push('Escolha pelo menos um atleta');
  if (audienceMode === 'groups' && !selectedGroups.length) errors.push('Escolha pelo menos um grupo');
  if (audienceMode === 'selected' && !athleteMembers.length) errors.push('Não há atletas ativos para selecionar');
  if (audienceMode === 'groups' && !groups.length) errors.push('Não há grupos disponíveis para esse gym');

  return errors;
}

function writeProfile(profile) {
  const serialized = JSON.stringify(profile || null);
  localStorage.setItem(STORAGE_KEYS.profile, serialized);
  localStorage.setItem(STORAGE_KEYS.legacyProfile, serialized);
}

function readRuntimeConfig() {
  return getRuntimeConfig();
}

function resolveBillingProvider() {
  const cfg = readRuntimeConfig();
  return cfg?.billing?.provider || 'kiwify_link';
}

function getAvailableSportOptions(config) {
  const rollout = config?.app?.rollout || {};
  const coreSports = Array.isArray(rollout.coreSports) && rollout.coreSports.length ? rollout.coreSports : ['cross'];
  const betaSports = rollout.showBetaSports ? (Array.isArray(rollout.betaSports) ? rollout.betaSports : []) : [];
  const allowed = new Set([...coreSports, ...betaSports]);
  return SPORT_OPTIONS.filter((sport) => allowed.has(sport.value));
}
