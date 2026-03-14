import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

const STORAGE_KEYS = {
  token: 'crossapp-auth-token',
  profile: 'crossapp-user-profile',
  runtime: 'crossapp-runtime-config',
};

setupVercelObservability();

function App() {
  const [token, setToken] = useState(readToken());
  const [profile, setProfile] = useState(readProfile());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });
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
    if (token) return;
    const googleClientId = window.__CROSSAPP_CONFIG__?.auth?.googleClientId || '';
    const mount = document.getElementById('coach-google-signin');
    if (!googleClientId || !mount) return;

    let attempt = 0;
    const timer = window.setInterval(() => {
      if (!window.google?.accounts?.id) {
        attempt += 1;
        if (attempt > 8) window.clearInterval(timer);
        return;
      }

      window.clearInterval(timer);
      mount.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const result = await apiRequest('/auth/google', {
              method: 'POST',
              body: { credential: response.credential },
            });
            if (result?.token) writeToken(result.token);
            if (result?.user) writeProfile(result.user);
            setToken(result.token || '');
            setProfile(result.user || null);
            setMessage('Sessão iniciada com Google');
          } catch (err) {
            setError(err.message || 'Erro ao autenticar com Google');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(mount, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320,
      });
    }, 300);

    return () => window.clearInterval(timer);
  }, [token]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest('/auth/signin', {
        method: 'POST',
        body: login,
        token: '',
      });
      if (result?.token) writeToken(result.token);
      if (result?.user) writeProfile(result.user);
      setToken(result.token || '');
      setProfile(result.user || null);
      setMessage('Sessão iniciada');
    } catch (err) {
      setError(err.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard(nextGymId = null) {
    setLoading(true);
    setError('');
    try {
      const [subscription, entitlementsRes, gymsRes, feedRes, benchmarksRes, competitionsRes] = await Promise.all([
        apiRequest('/billing/status'),
        apiRequest('/billing/entitlements'),
        apiRequest('/gyms/me'),
        apiRequest('/workouts/feed'),
        apiRequest('/benchmarks?limit=30&sort=year_desc'),
        apiRequest('/competitions/calendar'),
      ]);

      const gyms = gymsRes?.gyms || [];
      const selectedGymId = nextGymId || dashboard.selectedGymId || gyms[0]?.id || null;
      let members = [];
      let groups = [];
      let insights = null;
      if (selectedGymId) {
        const [membersRes, groupsRes, insightsRes] = await Promise.all([
          apiRequest(`/gyms/${selectedGymId}/memberships`),
          apiRequest(`/gyms/${selectedGymId}/groups`),
          apiRequest(`/gyms/${selectedGymId}/insights`),
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
      await loadDashboard(res?.gym?.id || null);
    } catch (err) {
      setError(err.message || 'Erro ao criar gym');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectGym(gymId) {
    await loadDashboard(gymId);
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
      await loadDashboard(dashboard.selectedGymId);
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
      await loadDashboard(dashboard.selectedGymId);
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

      await apiRequest(`/gyms/${dashboard.selectedGymId}/workouts`, {
        method: 'POST',
        body: {
          title: forms.workoutTitle,
          scheduledDate: forms.workoutDate,
          audienceMode: forms.workoutAudienceMode,
          targetMembershipIds: forms.targetMembershipIds,
          targetGroupIds: forms.targetGroupIds,
          payload: {
            blocks: [{ type: 'PROGRAMMING', lines }],
            ...(forms.workoutBenchmarkSlug ? { benchmarkSlug: forms.workoutBenchmarkSlug.trim() } : {}),
          },
        },
      });
      setForms((prev) => ({
        ...prev,
        workoutTitle: '',
        workoutDate: '',
        workoutBenchmarkSlug: '',
        workoutLines: '',
        workoutAudienceMode: 'all',
        targetMembershipIds: [],
        targetGroupIds: [],
      }));
      setMessage('Treino publicado');
      await loadDashboard(dashboard.selectedGymId);
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

  async function handleCheckout() {
    setLoading(true);
    setError('');
    try {
      const provider = resolveBillingProvider();
      if (provider === 'kiwify_link') {
        const checkoutUrl = resolveKiwifyCheckoutUrl('coach');
        if (!checkoutUrl) {
          throw new Error('Link da Kiwify não configurado para o plano Coach');
        }
        window.location.href = checkoutUrl;
        return;
      }

      const res = await apiRequest('/billing/checkout', {
        method: 'POST',
        body: {
          planId: 'coach',
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
      await loadDashboard(dashboard.selectedGymId);
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
          title: forms.competitionTitle,
          startsAt: forms.competitionDate,
          location: forms.competitionLocation,
          visibility: forms.competitionVisibility,
        },
      });
      setForms((prev) => ({ ...prev, competitionTitle: '', competitionDate: '', competitionLocation: '', competitionVisibility: 'gym' }));
      setMessage('Competição criada');
      await loadDashboard(dashboard.selectedGymId);
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
      await loadDashboard(dashboard.selectedGymId);
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
      const search = new URLSearchParams({ limit: '20' });
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
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.profile);
    setToken('');
    setProfile(null);
      setDashboard({
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
        selectedGymId: null,
        insights: null,
      });
  }

  if (!token) {
    return React.createElement('div', { className: 'portal-shell auth-shell' },
      React.createElement('div', { className: 'auth-card' },
        React.createElement('div', { className: 'eyebrow' }, 'CrossApp'),
        React.createElement('h1', null, 'Coach Portal'),
        React.createElement('p', { className: 'muted' }, 'Portal separado do atleta, usando a mesma API e a mesma sessão.'),
        error ? React.createElement('div', { className: 'notice error' }, error) : null,
        React.createElement('form', { className: 'stack', onSubmit: handleLogin },
          React.createElement('input', {
            className: 'field',
            type: 'email',
            placeholder: 'Email',
            value: login.email,
            onChange: (e) => setLogin((prev) => ({ ...prev, email: e.target.value })),
          }),
          React.createElement('input', {
            className: 'field',
            type: 'password',
            placeholder: 'Senha',
            value: login.password,
            onChange: (e) => setLogin((prev) => ({ ...prev, password: e.target.value })),
          }),
          React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: loading }, loading ? 'Entrando...' : 'Entrar')
        ),
        React.createElement('div', { className: 'auth-google' },
          React.createElement('div', { className: 'muted auth-dividerText' }, 'ou'),
          React.createElement('div', { id: 'coach-google-signin' })
        ),
        React.createElement('a', { className: 'portal-link', href: '/' }, 'Abrir app do atleta')
      )
    );
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

  return React.createElement('div', { className: 'portal-shell' },
    React.createElement('aside', { className: 'sidebar' },
      React.createElement('div', { className: 'eyebrow' }, 'CrossApp Coach'),
      React.createElement('h1', { className: 'sidebar-title' }, 'Coach Portal'),
      React.createElement('p', { className: 'sidebar-copy' }, 'Operação do box, assinatura, benchmarks e programação em um workspace único.'),
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
      React.createElement('div', { className: 'stack' },
        React.createElement('button', { className: 'btn btn-secondary', onClick: () => loadDashboard(dashboard.selectedGymId) }, 'Atualizar dados'),
        React.createElement('button', { className: 'btn btn-secondary', onClick: handleLogout }, 'Sair'),
        React.createElement('a', { className: 'btn btn-link', href: '/' }, 'Voltar ao app do atleta')
      )
    ),
    React.createElement('main', { className: 'portal-main' },
      React.createElement('section', { className: 'hero' },
        React.createElement('div', null,
          React.createElement('div', { className: 'eyebrow' }, 'Operação do coach'),
          React.createElement('h2', null, 'Gyms, membros, benchmarks e billing em um portal pronto para escala'),
          React.createElement('p', { className: 'hero-copy' }, 'Gerencie a programação, monitore o acesso dos atletas e mantenha a assinatura do box sob controle.')
        ),
        React.createElement('div', { className: 'hero-pills' },
          React.createElement('span', { className: `pill ${canCoachManage ? 'ok' : 'warn'}` }, canCoachManage ? 'Coach liberado' : 'Coach bloqueado'),
          React.createElement('span', { className: `pill ${canAthleteUseApp ? 'ok' : 'warn'}` }, canAthleteUseApp ? 'Atletas com acesso' : 'Atletas limitados')
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
          React.createElement('button', { className: 'btn btn-primary', onClick: handleCheckout, disabled: loading }, 'Assinar Coach'),
          canUseDeveloperTools ? React.createElement('button', { className: 'btn btn-secondary', onClick: handleActivateLocalPlan, disabled: loading }, 'Ativar local') : null,
          React.createElement('a', { className: 'btn btn-link', href: '/terms.html', target: '_blank', rel: 'noreferrer' }, 'Termos')
        )
      ),
      React.createElement('section', { className: 'grid stats-grid' },
        showSkeleton
          ? Array.from({ length: 6 }, (_, index) => portalSkeletonCard(`stat-${index}`))
          : [
              statCard('Plano', planName),
              statCard('Status', planStatus),
              statCard('Gyms', String(dashboard.gyms.length)),
              statCard('Treinos no feed', String(dashboard.feed.length)),
              statCard('Atletas ativos', String(dashboard.insights?.stats?.athletes || 0)),
              statCard('Resultados', String(dashboard.insights?.stats?.results || 0)),
            ]
      ),
      React.createElement('section', { className: 'plan-grid' },
        planCard({
          name: 'Coach Starter',
          price: 'R$ 59/mês',
          description: 'Para começar a organizar treino, atletas e rotina do box.',
          features: ['Operação inicial', 'Treino e benchmarks', 'Atletas vinculados com mais recursos'],
          featured: false,
          action: () => handleCheckout(),
          loading,
        }),
        planCard({
          name: 'Coach Pro',
          price: 'R$ 119/mês',
          description: 'Plano principal para publicar programação e ampliar a experiência dos atletas.',
          features: ['Tudo do Starter', 'Gestão mais forte', 'Mais imports e histórico para atletas'],
          featured: true,
          action: () => handleCheckout(),
          loading,
        }),
        planCard({
          name: 'Coach Performance',
          price: 'R$ 199/mês',
          description: 'Para operação premium com mais folga, escala e experiência completa.',
          features: ['Tudo do Pro', 'Operação premium', 'Atletas com imports e histórico máximos'],
          featured: false,
          action: () => handleCheckout(),
          loading,
        })
      ),
      React.createElement('section', { className: 'grid portal-grid' },
        React.createElement('div', { className: 'card' },
          React.createElement('h3', null, 'Gyms'),
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
          )
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('h3', null, selectedGym ? `Membros de ${selectedGym.name}` : 'Membros'),
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
          )
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('h3', null, selectedGym ? `Grupos de ${selectedGym.name}` : 'Grupos'),
          React.createElement('div', { className: 'stack list-block' },
            showSkeleton
              ? portalSkeletonList(2)
              : dashboard.groups.map((group) =>
              React.createElement('div', { key: group.id, className: 'list-item static' },
                React.createElement('strong', null, group.name),
                React.createElement('span', null, `${group.member_count || group.members?.length || 0} atleta(s)${group.description ? ` • ${group.description}` : ''}`)
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
          )
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('h3', null, selectedGym ? `Insights de ${selectedGym.name}` : 'Insights do gym'),
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
            : React.createElement('p', { className: 'muted' }, 'Selecione um gym para carregar métricas operacionais.')
        ),
        React.createElement('div', { className: 'card wide' },
          React.createElement('h3', null, 'Publicar treino'),
          React.createElement('form', { className: 'stack', onSubmit: handlePublishWorkout },
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
            React.createElement('input', {
              className: 'field',
              placeholder: 'benchmark slug opcional (ex: fran)',
              value: forms.workoutBenchmarkSlug,
              onChange: (e) => setForms((prev) => ({ ...prev, workoutBenchmarkSlug: e.target.value })),
            }),
            React.createElement('textarea', {
              className: 'field textarea',
              placeholder: 'Uma linha por exercício',
              value: forms.workoutLines,
              onChange: (e) => setForms((prev) => ({ ...prev, workoutLines: e.target.value })),
            }),
            React.createElement('div', { className: 'stack nested-card audience-card' },
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
            ),
            React.createElement('button', { className: 'btn btn-primary', type: 'submit', disabled: loading || !selectedGym || !canCoachManage }, 'Publicar treino')
          )
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('h3', null, 'Benchmark Library'),
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
          React.createElement('div', { className: 'stack list-block' },
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
          )
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('h3', null, 'Feed do app'),
          React.createElement('div', { className: 'stack list-block' },
            showSkeleton
              ? portalSkeletonList(4)
              : dashboard.feed.map((item) =>
              React.createElement('div', { key: item.id, className: 'list-item static' },
                React.createElement('strong', null, item.title),
                React.createElement('span', null, `${item.gym_name || ''}${item.benchmark?.name ? ` • ${item.benchmark.name}` : ''}`)
              )
              ),
            dashboard.feed.length === 0 ? React.createElement('p', { className: 'muted' }, 'Sem treinos publicados ainda.') : null
          )
        ),
        React.createElement('div', { className: 'card wide' },
          React.createElement('h3', null, 'Calendário de competições'),
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
          )
        ),
        React.createElement('div', { className: 'card wide' },
          React.createElement('h3', null, 'Leaderboard e resultados'),
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
    React.createElement('span', { className: 'eyebrow' }, 'Plano'),
    React.createElement('h3', { className: 'plan-cardTitle' }, name),
    React.createElement('strong', { className: 'plan-cardPrice' }, price),
    React.createElement('p', { className: 'muted' }, description),
    React.createElement('div', { className: 'plan-cardFeatures' },
      features.map((feature) =>
        React.createElement('span', { key: feature, className: 'plan-feature' }, feature)
      )
    ),
    action
      ? React.createElement('button', { className: 'btn btn-primary', onClick: action, disabled: loading }, loading ? 'Abrindo...' : `Assinar ${name}`)
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
  return cfg?.billing?.provider || 'stripe';
}

function resolveKiwifyCheckoutUrl(planId) {
  const cfg = readRuntimeConfig();
  const links = cfg?.billing?.links || {};
  return links[String(planId || 'coach').trim().toLowerCase()] || '';
}

createRoot(document.getElementById('coach-root')).render(React.createElement(App));

function setupVercelObservability() {
  if (window.__CROSSAPP_VERCEL_OBSERVABILITY__) return;
  window.__CROSSAPP_VERCEL_OBSERVABILITY__ = true;

  inject();
  injectSpeedInsights();
}
