import { getRunningHistory, logRunningSession } from '/packages/shared-web/athlete-services.js';
import { startAthleteModalityApp } from '/packages/shared-web/modality-shell.js';

const root = document.getElementById('running-root');
let runningViewState = { period: 'all' };
let runningModel = null;

if (root) {
  startAthleteModalityApp({
    root,
    sportType: 'running',
    loadHistory: getRunningHistory,
    logSession: logRunningSession,
    renderLoading,
    renderApp,
    setStatus,
    hydratePrefill: hydrateRunningLogForm,
    buildLogPayload: (form) => ({
      workoutId: getFormValue(form, 'workoutId'),
      completionState: getFormValue(form, 'completionState'),
      sourceLabel: getFormValue(form, 'sourceLabel'),
      title: getFormValue(form, 'title'),
      sessionType: getFormValue(form, 'sessionType'),
      distanceKm: getOptionalNumber(form, 'distanceKm'),
      durationMin: getOptionalNumber(form, 'durationMin'),
      avgPace: getFormValue(form, 'avgPace'),
      targetPace: getFormValue(form, 'targetPace'),
      zone: getFormValue(form, 'zone'),
      notes: getFormValue(form, 'notes'),
    }),
    getModel: () => runningModel,
    setModel: (nextModel) => {
      runningModel = nextModel;
    },
    getViewState: () => runningViewState,
    setViewState: (nextViewState) => {
      runningViewState = nextViewState;
    },
    prefillAttribute: 'data-running-prefill',
    actionAttribute: 'data-running-action',
    periodAttribute: 'data-running-period',
    loginFormId: 'running-loginForm',
    logFormId: 'running-logForm',
    logSuccessMessage: 'Sessão de corrida registrada.',
    historyKey: 'runningHistory',
  });
}

function renderLoading() {
  root.innerHTML = `
    <main class="hub-shell">
      <section class="hub-hero">
        <div class="hub-kicker">Ryxen Running</div>
        <h1>Carregando seu contexto de corrida.</h1>
        <p class="hub-lead">Buscando sessão, feed do coach e histórico da modalidade.</p>
      </section>
    </main>
  `;
}

function renderApp({ profile, dashboard, feed, runningHistory }) {
  const stats = dashboard?.stats || {};
  const competitions = dashboard?.upcomingCompetitions || [];
  const gymAccess = dashboard?.gymAccess || [];
  const workouts = dashboard?.recentWorkouts || [];
  const historyLogs = runningHistory?.logs || dashboard?.runningHistory || [];
  const historySummary = runningHistory?.summary || {};
  const filteredHistoryLogs = filterLogsByPeriod(historyLogs, runningViewState.period);
  const chartPoints = buildRunningDistanceSeries(filteredHistoryLogs);
  const filteredSummary = summarizeRunningLogs(filteredHistoryLogs);

  root.innerHTML = `
    <main class="hub-shell">
      <section class="hub-hero">
        <div class="hub-kicker">Ryxen Running</div>
        <h1>Corrida com feed do coach, agenda e histórico por modalidade.</h1>
        <p class="hub-lead">Aqui você recebe treinos de corrida, registra sessões concluídas e acompanha o volume da modalidade sem misturar com Cross ou Strength.</p>
        <div class="hub-actions">
          <a class="hub-primaryAction" href="/sports/cross/index.html">Abrir Cross</a>
          <a class="hub-secondaryAction" href="/index.html">Trocar esporte</a>
          ${profile ? '<button class="hub-secondaryAction" type="button" data-running-action="refresh">Atualizar</button>' : ''}
          ${profile ? '<button class="hub-secondaryAction" type="button" data-running-action="logout">Sair</button>' : ''}
        </div>
        <div class="hub-meta">
          <span>${profile ? `Sessão: ${escapeHtml(profile.name || profile.email)}` : 'Entre para sincronizar sua corrida'}</span>
          <span>${Number(stats.assignedWorkouts || 0)} treino(s) de corrida</span>
          <span>${Number(historySummary.total_sessions || 0)} sessão(ões) registradas</span>
        </div>
      </section>

      ${profile ? `
        <section class="hub-grid">
          ${card('Feed de corrida', renderFeed(feed))}
          ${card('Agenda', renderCompetitions(competitions))}
          ${card('Acesso por gym', renderGymAccess(gymAccess))}
        </section>
        <section class="hub-grid" style="margin-top:18px;">
          ${card('Registrar sessão', renderRunningLogForm())}
          ${card('Resumo da modalidade', renderRunningSummary(filteredSummary))}
          ${card('Treinos recentes', renderRecentWorkouts(workouts))}
        </section>
        <section class="hub-grid" style="margin-top:18px;">
          ${card('Histórico recente', renderRunningHistory(filteredHistoryLogs))}
          ${card('Evolução de volume', renderRunningTrend(chartPoints))}
          ${card('Melhores marcas por distância', renderRunningRecords(filteredHistoryLogs))}
        </section>
        <section class="hub-grid" style="margin-top:18px;">
          ${card('Indicadores', `
            <div class="hub-meta">
              <span>${Number(stats.activeGyms || 0)} gym(s) ativos</span>
              <span>${Number(stats.upcomingCompetitions || 0)} competição(ões)</span>
              <span>${Number(filteredSummary.total_distance_km || 0)} km no período</span>
            </div>
            <p class="hub-lead" style="font-size:0.98rem;margin-top:14px;">Próximo passo: pace por prova, zonas de treino e recordes por distância.</p>
          `)}
        </section>
      ` : `
        <section class="hub-grid">
          ${card('Entrar', `
            <form id="running-loginForm" class="stack">
              <input class="field" type="email" name="email" placeholder="Seu email" />
              <input class="field" type="password" name="password" placeholder="Sua senha" />
              <button class="hub-primaryAction" type="submit">Entrar no Running</button>
              <p class="hub-lead" style="font-size:0.96rem;">Use a mesma conta do app principal. O coach continua operando no portal separado.</p>
            </form>
          `)}
          ${card('O que entra aqui', `
            <p class="hub-lead" style="font-size:0.96rem;">Treinos de corrida, agenda, longões, intervalados e histórico por modalidade.</p>
          `)}
          ${card('Coach continua separado', `
            <p class="hub-lead" style="font-size:0.96rem;">O Coach Portal continua em <a href="/coach/index.html">/coach/</a>. Aqui o atleta só usa a experiência de corrida.</p>
          `)}
        </section>
      `}
      <div id="running-status" class="hub-meta" style="margin-top:18px;"></div>
    </main>
  `;
}

function card(title, body) {
  return `
    <article class="hub-card">
      <div class="hub-cardTop">
        <span class="sport-badge">Running</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </article>
  `;
}

function renderFeed(feed) {
  if (!feed.length) return '<p class="hub-lead" style="font-size:0.96rem;">Nenhum treino de corrida no feed ainda.</p>';
  return `
    <div class="stack">
      ${feed.slice(0, 6).map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.title)}</span><span>${escapeHtml(item.gym_name || '')}</span></div>
        ${renderRunningPrescription(item)}
        ${renderRunningLogAction(item)}
      `).join('')}
    </div>
  `;
}

function renderCompetitions(items) {
  if (!items.length) return '<p class="hub-lead" style="font-size:0.96rem;">Nenhuma competição de corrida publicada para seus gyms.</p>';
  return `
    <div class="stack">
      ${items.slice(0, 6).map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.title)}</span><span>${formatDate(item.starts_at)}</span></div>
      `).join('')}
    </div>
  `;
}

function renderGymAccess(items) {
  if (!items.length) return '<p class="hub-lead" style="font-size:0.96rem;">Nenhum gym vinculado à sua conta.</p>';
  return `
    <div class="stack">
      ${items.map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.gymName)}</span><span>${item.canAthletesUseApp ? 'Acesso liberado' : escapeHtml(item.warning || 'Limitado')}</span></div>
      `).join('')}
    </div>
  `;
}

function renderRecentWorkouts(items) {
  if (!items.length) return '<p class="hub-lead" style="font-size:0.96rem;">Sem treinos recentes nesta modalidade.</p>';
  return `
    <div class="stack">
      ${items.slice(0, 6).map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.title)}</span><span>${formatDate(item.scheduled_date)}</span></div>
        ${renderRunningPrescription(item)}
        ${renderRunningLogAction(item)}
      `).join('')}
    </div>
  `;
}

function renderRunningLogForm() {
  return `
    <form id="running-logForm" class="stack">
      <input type="hidden" name="workoutId" />
      <input type="hidden" name="completionState" value="manual" />
      <input type="hidden" name="sourceLabel" />
      <input class="field" type="text" name="title" placeholder="Título da sessão" />
      <input class="field" type="text" name="sessionType" placeholder="Tipo de sessão: intervalado, longão, recovery..." />
      <div class="hub-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <input class="field" type="number" step="0.1" min="0" name="distanceKm" placeholder="Distância (km)" />
        <input class="field" type="number" step="1" min="0" name="durationMin" placeholder="Duração (min)" />
      </div>
      <div class="hub-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <input class="field" type="text" name="avgPace" placeholder="Pace médio" />
        <input class="field" type="text" name="targetPace" placeholder="Pace alvo" />
      </div>
      <input class="field" type="text" name="zone" placeholder="Zona ou intensidade" />
      <textarea class="field" name="notes" placeholder="Notas da sessão" rows="3"></textarea>
      <button class="hub-primaryAction" type="submit">Registrar corrida</button>
    </form>
  `;
}

function renderRunningSummary(summary) {
  return `
    <div class="stack">
      <div class="hub-meta"><span>Sessões</span><span>${Number(summary?.total_sessions || 0)}</span></div>
      <div class="hub-meta"><span>Distância acumulada</span><span>${Number(summary?.total_distance_km || 0)} km</span></div>
      <div class="hub-meta"><span>Duração média</span><span>${Number(summary?.avg_duration_min || 0).toFixed(1)} min</span></div>
    </div>
  `;
}

function renderRunningHistory(items) {
  if (!items.length) {
    return '<p class="hub-lead" style="font-size:0.96rem;">Registre sessões concluídas para construir seu histórico de corrida.</p>';
  }

  return `
    <div class="hub-toolbar">
      <span class="hub-lead" style="font-size:0.94rem;">Filtrar período</span>
      <select class="field" data-running-period>
        ${renderPeriodOptions(runningViewState.period)}
      </select>
    </div>
    <div class="stack">
      ${items.slice(0, 8).map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.title || item.session_type || 'Sessão')}</span><span>${formatDate(item.logged_at)}</span></div>
        <div class="hub-meta">
          ${renderCompletionBadge(item)}
          ${item.distance_km ? `<span>${escapeHtml(item.distance_km)} km</span>` : ''}
          ${item.duration_min ? `<span>${escapeHtml(item.duration_min)} min</span>` : ''}
          ${item.avg_pace ? `<span>${escapeHtml(item.avg_pace)}</span>` : ''}
          ${item.zone ? `<span>${escapeHtml(item.zone)}</span>` : ''}
        </div>
        ${item.notes ? `<p class="hub-lead" style="font-size:0.92rem;">${escapeHtml(item.notes)}</p>` : ''}
      `).join('')}
    </div>
  `;
}

function renderRunningTrend(points) {
  if (!points.length) {
    return '<p class="hub-lead" style="font-size:0.96rem;">Registre sessões com distância para gerar a curva de evolução.</p>';
  }

  return `
    <div class="hub-toolbar">
      <span class="hub-lead" style="font-size:0.94rem;">Distância por sessão</span>
      <select class="field" data-running-period>
        ${renderPeriodOptions(runningViewState.period)}
      </select>
    </div>
    <div class="hub-chart">
      ${renderSparkline(points)}
      <div class="hub-chart-meta">
        <span>${escapeHtml(points[0].label)}</span>
        <span>${Number(points[points.length - 1].value || 0)} km</span>
      </div>
    </div>
  `;
}

function renderRunningRecords(items) {
  const records = buildRunningRecords(items);
  if (!records.length) {
    return '<p class="hub-lead" style="font-size:0.96rem;">Registre sessões com distância e pace para construir suas melhores marcas.</p>';
  }

  return `
    <div class="stack">
      ${records.slice(0, 8).map((item) => `
        <div class="hub-meta">
          <span>${escapeHtml(item.distanceLabel)}</span>
          <span>${escapeHtml(item.display)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRunningPrescription(item) {
  const session = item?.payload?.session || {};
  const blocks = Array.isArray(item?.payload?.blocks) ? item.payload.blocks : [];
  const pills = [];

  if (session.type) pills.push(session.type);
  if (session.distanceKm) pills.push(`${session.distanceKm} km`);
  if (session.durationMin) pills.push(`${session.durationMin} min`);
  if (session.targetPace) pills.push(session.targetPace);
  if (session.zone) pills.push(session.zone);

  const lines = blocks.flatMap((block) => Array.isArray(block?.lines) ? block.lines : []).slice(0, 3);
  const segments = Array.isArray(session?.segments) ? session.segments.slice(0, 6) : [];

  return `
    ${pills.length ? `<div class="hub-meta">${pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join('')}</div>` : ''}
    ${segments.length ? `<div class="stack">${segments.map((segment) => `
      <div class="hub-meta">
        <span>${escapeHtml(segment.label || 'Segmento')}</span>
        ${segment.distanceMeters ? `<span>${escapeHtml(segment.distanceMeters)} m</span>` : ''}
        ${segment.targetPace ? `<span>${escapeHtml(segment.targetPace)}</span>` : ''}
        ${segment.restSeconds ? `<span>${escapeHtml(segment.restSeconds)}s rest</span>` : ''}
      </div>
    `).join('')}</div>` : ''}
    ${lines.length ? `<div class="stack">${lines.map((line) => `<div class="hub-meta"><span>${escapeHtml(line)}</span></div>`).join('')}</div>` : ''}
    ${session.notes ? `<p class="hub-lead" style="font-size:0.94rem;">${escapeHtml(session.notes)}</p>` : ''}
  `;
}

function renderRunningLogAction(item) {
  const session = item?.payload?.session || {};
  const payload = encodeURIComponent(JSON.stringify({
    workoutId: item?.id || '',
    title: item?.title || '',
    sessionType: session.type || '',
    distanceKm: session.distanceKm || '',
    durationMin: session.durationMin || '',
    targetPace: session.targetPace || '',
    zone: session.zone || '',
    notes: session.notes || '',
    completionState: 'completed_from_coach',
    sourceLabel: item?.title || '',
  }));

  return `
    <div class="hub-inlineActions">
      <button class="hub-miniAction" type="button" data-running-prefill="${payload}">Registrar este treino</button>
    </div>
  `;
}

function renderCompletionBadge(item) {
  if (item?.completion_state === 'completed_from_coach') {
    return `<span>Treino do coach${item?.source_label ? ` · ${escapeHtml(item.source_label)}` : ''}</span>`;
  }
  return '<span>Log manual</span>';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function setStatus(message, isError = false) {
  const node = document.getElementById('running-status');
  if (!node) return;
  node.innerHTML = message ? `<span style="border-color:${isError ? 'rgba(220,38,38,.3)' : 'rgba(255,255,255,.08)'}">${escapeHtml(message)}</span>` : '';
}

function getFormValue(form, name) {
  return String(form.querySelector(`[name="${name}"]`)?.value || '').trim();
}

function getOptionalNumber(form, name) {
  const raw = getFormValue(form, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function setFormValue(form, name, value) {
  const field = form.querySelector(`[name="${name}"]`);
  if (field) field.value = value ?? '';
}

function hydrateRunningLogForm(encodedPayload) {
  const form = document.getElementById('running-logForm');
  if (!(form instanceof HTMLFormElement)) return;

  try {
    const payload = JSON.parse(decodeURIComponent(encodedPayload));
    setFormValue(form, 'workoutId', payload.workoutId);
    setFormValue(form, 'completionState', payload.completionState || 'manual');
    setFormValue(form, 'sourceLabel', payload.sourceLabel || '');
    setFormValue(form, 'title', payload.title);
    setFormValue(form, 'sessionType', payload.sessionType);
    setFormValue(form, 'distanceKm', payload.distanceKm);
    setFormValue(form, 'durationMin', payload.durationMin);
    setFormValue(form, 'targetPace', payload.targetPace);
    setFormValue(form, 'zone', payload.zone);
    setFormValue(form, 'notes', payload.notes);
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setStatus('Treino do coach carregado no formulário.');
  } catch {
    setStatus('Falha ao carregar o treino para registro.', true);
  }
}

function filterLogsByPeriod(items, period) {
  if (period === 'all') return items;
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return items.filter((item) => {
    const value = new Date(item.logged_at).getTime();
    return Number.isFinite(value) && value >= cutoff;
  });
}

function summarizeRunningLogs(items) {
  const totalDistance = items.reduce((sum, item) => sum + Number(item.distance_km || 0), 0);
  const totalDuration = items.reduce((sum, item) => sum + Number(item.duration_min || 0), 0);
  return {
    total_sessions: items.length,
    total_distance_km: totalDistance.toFixed(1),
    avg_duration_min: items.length ? totalDuration / items.length : 0,
  };
}

function buildRunningDistanceSeries(items) {
  return items
    .filter((item) => Number(item.distance_km || 0) > 0)
    .slice(0, 12)
    .reverse()
    .map((item, index) => ({
      x: index,
      value: Number(item.distance_km || 0),
      label: formatDate(item.logged_at),
    }));
}

function buildRunningRecords(items) {
  const grouped = new Map();
  for (const item of items) {
    const distance = Number(item.distance_km || 0);
    if (!(distance > 0)) continue;
    const distanceLabel = `${distance.toFixed(1)} km`;
    const paceSeconds = parsePaceToSeconds(item.avg_pace || item.target_pace || '');
    const durationSeconds = Number(item.duration_min || 0) * 60;
    const score = paceSeconds || durationSeconds || Number.POSITIVE_INFINITY;
    const current = grouped.get(distanceLabel);

    if (!current || score < current.score) {
      grouped.set(distanceLabel, {
        distanceLabel,
        score,
        display: item.avg_pace || item.target_pace || `${Number(item.duration_min || 0)} min`,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => parseFloat(a.distanceLabel) - parseFloat(b.distanceLabel));
}

function parsePaceToSeconds(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
}

function renderPeriodOptions(selected) {
  return [
    ['7d', '7 dias'],
    ['30d', '30 dias'],
    ['90d', '90 dias'],
    ['all', 'Tudo'],
  ].map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function renderSparkline(points) {
  const width = 320;
  const height = 92;
  const padding = 8;
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const d = points.map((point, index) => {
    const x = padding + (step * index);
    const y = height - padding - (((point.value || 0) / max) * (height - padding * 2));
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <line class="hub-chart-grid" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      <path d="${d}"></path>
    </svg>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}
