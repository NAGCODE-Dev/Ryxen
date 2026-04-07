import { getStrengthHistory, logStrengthSession } from '/packages/shared-web/athlete-services.js';
import { startAthleteModalityApp } from '/packages/shared-web/modality-shell.js';

const root = document.getElementById('strength-root');
let strengthViewState = { period: 'all' };
let strengthModel = null;

if (root) {
  startAthleteModalityApp({
    root,
    sportType: 'strength',
    loadHistory: getStrengthHistory,
    logSession: logStrengthSession,
    renderLoading,
    renderApp,
    setStatus,
    hydratePrefill: hydrateStrengthLogForm,
    buildLogPayload: (form) => ({
      workoutId: getFormValue(form, 'workoutId'),
      completionState: getFormValue(form, 'completionState'),
      sourceLabel: getFormValue(form, 'sourceLabel'),
      exercise: getFormValue(form, 'exercise'),
      setsCount: getOptionalNumber(form, 'setsCount'),
      repsText: getFormValue(form, 'repsText'),
      loadValue: getOptionalNumber(form, 'loadValue'),
      loadText: getFormValue(form, 'loadText'),
      rir: getOptionalNumber(form, 'rir'),
      notes: getFormValue(form, 'notes'),
    }),
    getModel: () => strengthModel,
    setModel: (nextModel) => {
      strengthModel = nextModel;
    },
    getViewState: () => strengthViewState,
    setViewState: (nextViewState) => {
      strengthViewState = nextViewState;
    },
    prefillAttribute: 'data-strength-prefill',
    actionAttribute: 'data-strength-action',
    periodAttribute: 'data-strength-period',
    loginFormId: 'strength-loginForm',
    logFormId: 'strength-logForm',
    logSuccessMessage: 'Sessão de força registrada.',
    historyKey: 'strengthHistory',
  });
}

function renderLoading() {
  root.innerHTML = `
    <main class="hub-shell">
      <section class="hub-hero">
        <div class="hub-kicker">Ryxen Strength</div>
        <h1>Carregando seu contexto de força.</h1>
        <p class="hub-lead">Buscando sessão, feed do coach e histórico da modalidade.</p>
      </section>
    </main>
  `;
}

function renderApp({ profile, dashboard, feed, strengthHistory }) {
  const stats = dashboard?.stats || {};
  const competitions = dashboard?.upcomingCompetitions || [];
  const gymAccess = dashboard?.gymAccess || [];
  const workouts = dashboard?.recentWorkouts || [];
  const historyLogs = strengthHistory?.logs || dashboard?.strengthHistory || [];
  const filteredHistoryLogs = filterLogsByPeriod(historyLogs, strengthViewState.period);
  const bests = buildStrengthBests(filteredHistoryLogs);
  const trendPoints = buildStrengthTrendSeries(filteredHistoryLogs);

  root.innerHTML = `
    <main class="hub-shell">
      <section class="hub-hero">
        <div class="hub-kicker">Ryxen Strength</div>
        <h1>Força e musculação com feed do coach e histórico por modalidade.</h1>
        <p class="hub-lead">Aqui você recebe sessões de força, registra exercícios concluídos e acompanha sua progressão sem misturar com Cross ou Running.</p>
        <div class="hub-actions">
          <a class="hub-primaryAction" href="/sports/cross/index.html">Abrir Cross</a>
          <a class="hub-secondaryAction" href="/index.html">Trocar esporte</a>
          ${profile ? '<button class="hub-secondaryAction" type="button" data-strength-action="refresh">Atualizar</button>' : ''}
          ${profile ? '<button class="hub-secondaryAction" type="button" data-strength-action="logout">Sair</button>' : ''}
        </div>
        <div class="hub-meta">
          <span>${profile ? `Sessão: ${escapeHtml(profile.name || profile.email)}` : 'Entre para sincronizar sua força'}</span>
          <span>${Number(stats.assignedWorkouts || 0)} sessão(ões) de força</span>
          <span>${historyLogs.length} log(s) registrados</span>
        </div>
      </section>

      ${profile ? `
        <section class="hub-grid">
          ${card('Feed de força', renderFeed(feed))}
          ${card('Agenda', renderCompetitions(competitions))}
          ${card('Acesso por gym', renderGymAccess(gymAccess))}
        </section>
        <section class="hub-grid" style="margin-top:18px;">
          ${card('Registrar sessão', renderStrengthLogForm())}
          ${card('Melhores cargas', renderStrengthBests(bests))}
          ${card('Sessões recentes', renderRecentWorkouts(workouts))}
        </section>
        <section class="hub-grid" style="margin-top:18px;">
          ${card('Histórico recente', renderStrengthHistory(filteredHistoryLogs))}
          ${card('Progressão de carga', renderStrengthTrend(trendPoints))}
          ${card('Progressão por exercício', renderStrengthProgressions(filteredHistoryLogs))}
        </section>
        <section class="hub-grid" style="margin-top:18px;">
          ${card('Indicadores', `
            <div class="hub-meta">
              <span>${Number(stats.activeGyms || 0)} gym(s) ativos</span>
              <span>${Number(stats.upcomingCompetitions || 0)} evento(s)</span>
              <span>${filteredHistoryLogs.length} log(s) no período</span>
            </div>
            <p class="hub-lead" style="font-size:0.98rem;margin-top:14px;">Próximo passo: progressão por movimento, volume e curvas de carga.</p>
          `)}
        </section>
      ` : `
        <section class="hub-grid">
          ${card('Entrar', `
            <form id="strength-loginForm" class="stack">
              <input class="field" type="email" name="email" placeholder="Seu email" />
              <input class="field" type="password" name="password" placeholder="Sua senha" />
              <button class="hub-primaryAction" type="submit">Entrar no Strength</button>
              <p class="hub-lead" style="font-size:0.96rem;">Use a mesma conta do app principal. O coach continua operando no portal separado.</p>
            </form>
          `)}
          ${card('O que entra aqui', `
            <p class="hub-lead" style="font-size:0.96rem;">Sessões de força, blocos de musculação, progressão por movimento e histórico por modalidade.</p>
          `)}
          ${card('Coach continua separado', `
            <p class="hub-lead" style="font-size:0.96rem;">O Coach Portal continua em <a href="/coach/index.html">/coach/</a>. Aqui o atleta só usa a experiência de força.</p>
          `)}
        </section>
      `}
      <div id="strength-status" class="hub-meta" style="margin-top:18px;"></div>
    </main>
  `;
}

function card(title, body) {
  return `
    <article class="hub-card">
      <div class="hub-cardTop">
        <span class="sport-badge">Strength</span>
      </div>
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </article>
  `;
}

function renderFeed(feed) {
  if (!feed.length) return '<p class="hub-lead" style="font-size:0.96rem;">Nenhuma sessão de força no feed ainda.</p>';
  return `
    <div class="stack">
      ${feed.slice(0, 6).map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.title)}</span><span>${escapeHtml(item.gym_name || '')}</span></div>
        ${renderStrengthPrescription(item)}
        ${renderStrengthLogAction(item)}
      `).join('')}
    </div>
  `;
}

function renderCompetitions(items) {
  if (!items.length) return '<p class="hub-lead" style="font-size:0.96rem;">Nenhum evento de força publicado para seus gyms.</p>';
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
  if (!items.length) return '<p class="hub-lead" style="font-size:0.96rem;">Sem sessões recentes nesta modalidade.</p>';
  return `
    <div class="stack">
      ${items.slice(0, 6).map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.title)}</span><span>${formatDate(item.scheduled_date)}</span></div>
        ${renderStrengthPrescription(item)}
        ${renderStrengthLogAction(item)}
      `).join('')}
    </div>
  `;
}

function renderStrengthLogForm() {
  return `
    <form id="strength-logForm" class="stack">
      <input type="hidden" name="workoutId" />
      <input type="hidden" name="completionState" value="manual" />
      <input type="hidden" name="sourceLabel" />
      <input class="field" type="text" name="exercise" placeholder="Exercício" />
      <div class="hub-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
        <input class="field" type="number" step="1" min="0" name="setsCount" placeholder="Sets" />
        <input class="field" type="text" name="repsText" placeholder="Reps" />
        <input class="field" type="number" step="0.5" min="0" name="rir" placeholder="RIR" />
      </div>
      <div class="hub-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <input class="field" type="number" step="0.5" min="0" name="loadValue" placeholder="Carga (kg)" />
        <input class="field" type="text" name="loadText" placeholder="Texto de carga opcional" />
      </div>
      <textarea class="field" name="notes" placeholder="Notas da sessão" rows="3"></textarea>
      <button class="hub-primaryAction" type="submit">Registrar exercício</button>
    </form>
  `;
}

function renderStrengthBests(items) {
  if (!items.length) {
    return '<p class="hub-lead" style="font-size:0.96rem;">Registre exercícios para começar seu histórico de cargas.</p>';
  }

  return `
    <div class="stack">
      ${items.slice(0, 8).map((item) => `
        <div class="hub-meta">
          <span>${escapeHtml(item.exercise)}</span>
          <span>${item.best_load ? `${escapeHtml(item.best_load)} kg` : 'Sem carga'} · ${escapeHtml(item.total_logs)} log(s)</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStrengthHistory(items) {
  if (!items.length) {
    return '<p class="hub-lead" style="font-size:0.96rem;">Registre sessões concluídas para construir seu histórico de força.</p>';
  }

  return `
    <div class="hub-toolbar">
      <span class="hub-lead" style="font-size:0.94rem;">Filtrar período</span>
      <select class="field" data-strength-period>
        ${renderPeriodOptions(strengthViewState.period)}
      </select>
    </div>
    <div class="stack">
      ${items.slice(0, 8).map((item) => `
        <div class="hub-meta"><span>${escapeHtml(item.exercise)}</span><span>${formatDate(item.logged_at)}</span></div>
        <div class="hub-meta">
          ${renderCompletionBadge(item)}
          ${item.sets_count ? `<span>${escapeHtml(item.sets_count)} sets</span>` : ''}
          ${item.reps_text ? `<span>${escapeHtml(item.reps_text)}</span>` : ''}
          ${item.load_value ? `<span>${escapeHtml(item.load_value)} kg</span>` : ''}
          ${item.rir !== null && item.rir !== undefined ? `<span>RIR ${escapeHtml(item.rir)}</span>` : ''}
        </div>
        ${item.notes ? `<p class="hub-lead" style="font-size:0.92rem;">${escapeHtml(item.notes)}</p>` : ''}
      `).join('')}
    </div>
  `;
}

function renderStrengthTrend(points) {
  if (!points.length) {
    return '<p class="hub-lead" style="font-size:0.96rem;">Registre cargas para gerar a curva de progressão.</p>';
  }

  return `
    <div class="hub-toolbar">
      <span class="hub-lead" style="font-size:0.94rem;">Melhor carga por log</span>
      <select class="field" data-strength-period>
        ${renderPeriodOptions(strengthViewState.period)}
      </select>
    </div>
    <div class="hub-chart">
      ${renderSparkline(points)}
      <div class="hub-chart-meta">
        <span>${escapeHtml(points[0].label)}</span>
        <span>${Number(points[points.length - 1].value || 0)} kg</span>
      </div>
    </div>
  `;
}

function renderStrengthProgressions(items) {
  const progressions = buildStrengthProgressions(items);
  if (!progressions.length) {
    return '<p class="hub-lead" style="font-size:0.96rem;">Registre mais de uma carga por exercício para acompanhar progressão real.</p>';
  }

  return `
    <div class="stack">
      ${progressions.slice(0, 8).map((item) => `
        <div class="hub-meta">
          <span>${escapeHtml(item.exercise)}</span>
          <span>${item.start} → ${item.best} kg (${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(1)} kg)</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStrengthPrescription(item) {
  const strength = item?.payload?.strength || {};
  const blocks = Array.isArray(item?.payload?.blocks) ? item.payload.blocks : [];
  const pills = [];

  if (strength.focus) pills.push(strength.focus);
  if (strength.loadGuidance) pills.push(strength.loadGuidance);
  if (strength.rir !== null && strength.rir !== undefined && strength.rir !== '') pills.push(`RIR ${strength.rir}`);
  if (strength.restSeconds) pills.push(`${strength.restSeconds}s rest`);

  const lines = blocks.flatMap((block) => Array.isArray(block?.lines) ? block.lines : []).slice(0, 4);
  const exercises = Array.isArray(strength?.exercises) ? strength.exercises.slice(0, 6) : [];

  return `
    ${pills.length ? `<div class="hub-meta">${pills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join('')}</div>` : ''}
    ${exercises.length ? `<div class="stack">${exercises.map((exercise) => `
      <div class="hub-meta">
        <span>${escapeHtml(exercise.name || 'Exercício')}</span>
        ${exercise.sets ? `<span>${escapeHtml(exercise.sets)} sets</span>` : ''}
        ${exercise.reps ? `<span>${escapeHtml(exercise.reps)} reps</span>` : ''}
        ${exercise.load ? `<span>${escapeHtml(exercise.load)}</span>` : ''}
        ${exercise.rir !== null && exercise.rir !== undefined && exercise.rir !== '' ? `<span>RIR ${escapeHtml(exercise.rir)}</span>` : ''}
      </div>
    `).join('')}</div>` : ''}
    ${lines.length ? `<div class="stack">${lines.map((line) => `<div class="hub-meta"><span>${escapeHtml(line)}</span></div>`).join('')}</div>` : ''}
  `;
}

function renderStrengthLogAction(item) {
  const strength = item?.payload?.strength || {};
  const firstExercise = Array.isArray(strength?.exercises) ? strength.exercises[0] : null;
  const payload = encodeURIComponent(JSON.stringify({
    workoutId: item?.id || '',
    exercise: firstExercise?.name || item?.title || '',
    setsCount: firstExercise?.sets || '',
    repsText: firstExercise?.reps || '',
    loadText: firstExercise?.load || strength.loadGuidance || '',
    rir: firstExercise?.rir ?? strength.rir ?? '',
    notes: '',
    completionState: 'completed_from_coach',
    sourceLabel: item?.title || '',
  }));

  return `
    <div class="hub-inlineActions">
      <button class="hub-miniAction" type="button" data-strength-prefill="${payload}">Registrar este treino</button>
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
  const node = document.getElementById('strength-status');
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

function hydrateStrengthLogForm(encodedPayload) {
  const form = document.getElementById('strength-logForm');
  if (!(form instanceof HTMLFormElement)) return;

  try {
    const payload = JSON.parse(decodeURIComponent(encodedPayload));
    setFormValue(form, 'workoutId', payload.workoutId);
    setFormValue(form, 'completionState', payload.completionState || 'manual');
    setFormValue(form, 'sourceLabel', payload.sourceLabel || '');
    setFormValue(form, 'exercise', payload.exercise);
    setFormValue(form, 'setsCount', payload.setsCount);
    setFormValue(form, 'repsText', payload.repsText);
    setFormValue(form, 'loadText', payload.loadText);
    setFormValue(form, 'rir', payload.rir);
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

function buildStrengthBests(items) {
  const map = new Map();
  for (const item of items) {
    const exercise = String(item.exercise || '').trim();
    if (!exercise) continue;
    const load = Number(item.load_value || 0);
    const current = map.get(exercise) || { exercise, best_load: 0, total_logs: 0 };
    current.best_load = Math.max(current.best_load, load);
    current.total_logs += 1;
    map.set(exercise, current);
  }
  return Array.from(map.values()).sort((a, b) => a.exercise.localeCompare(b.exercise));
}

function buildStrengthTrendSeries(items) {
  return items
    .filter((item) => Number(item.load_value || 0) > 0)
    .slice(0, 12)
    .reverse()
    .map((item, index) => ({
      x: index,
      value: Number(item.load_value || 0),
      label: formatDate(item.logged_at),
    }));
}

function buildStrengthProgressions(items) {
  const grouped = new Map();
  for (const item of items.slice().reverse()) {
    const exercise = String(item.exercise || '').trim();
    const load = Number(item.load_value || 0);
    if (!exercise || !(load > 0)) continue;
    const current = grouped.get(exercise) || { exercise, start: load, best: load };
    current.best = Math.max(current.best, load);
    grouped.set(exercise, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({ ...item, delta: item.best - item.start }))
    .filter((item) => item.best > 0)
    .sort((a, b) => b.delta - a.delta);
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
