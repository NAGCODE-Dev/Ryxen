import {
  formatMeasurementValue,
  getMeasurementTypeMeta,
  listMeasurementTypes,
  summarizeMeasurements,
} from '../profileMeasurements.js';

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

export function renderHistoryPage(state, helpers) {
  const {
    renderPageHero,
    renderSummaryTile,
    renderPageFold,
    renderTrendSkeletons,
    renderSparkline,
    formatTrendValue,
    formatNumber,
    escapeHtml,
  } = helpers;

  const athleteOverview = state?.__ui?.athleteOverview || {};
  const athleteProfile = state?.__ui?.athleteProfile || {};
  const isAuthenticated = !!state?.__ui?.auth?.profile?.email;
  const benchmarkBrowser = state?.__ui?.benchmarkBrowser || {};
  const benchmarkHistory = athleteOverview?.benchmarkHistory || [];
  const prHistory = athleteOverview?.prHistory || [];
  const upcomingCompetitions = athleteOverview?.upcomingCompetitions || [];
  const recentResults = athleteOverview?.recentResults || [];
  const runningHistory = athleteOverview?.runningHistory || [];
  const strengthHistory = athleteOverview?.strengthHistory || [];
  const isBusy = !!state?.__ui?.isBusy;
  const isDetailLoading = isAuthenticated && athleteOverview?.detailLevel !== 'full';
  const benchmarkPoints = benchmarkHistory.reduce((sum, item) => sum + Number(item?.points?.length || 0), 0);
  const prPoints = prHistory.reduce((sum, item) => sum + Number(item?.points?.length || 0), 0);
  const measurements = Array.isArray(athleteProfile?.measurements) ? athleteProfile.measurements : [];
  const measurementSummary = summarizeMeasurements(measurements, 6);

  return `
    <div class="workout-container page-stack page-stack-history">
      ${renderPageHero({
        eyebrow: 'Perfil do atleta',
        title: 'Sua evolução em um só lugar',
        subtitle: 'Veja seus registros, benchmarks e próximas competições sem espalhar desempenho pela conta.',
        actions: `
          <button class="btn-secondary" data-action="modal:open" data-modal="prs" type="button">Gerenciar registros</button>
          <button class="btn-secondary" data-action="modal:open" data-modal="import" type="button">Importar treino</button>
          ${isAuthenticated
            ? '<button class="btn-secondary" data-action="page:set" data-page="account" type="button">Ver conta</button>'
            : '<button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>'
          }
        `,
      })}

      <div class="summary-strip summary-strip-3">
        ${renderSummaryTile('Resumo', isBusy || isDetailLoading ? '...' : String(recentResults.length), 'resultados recentes')}
        ${renderSummaryTile('Medidas', isBusy ? '...' : String(measurements.length), 'peso, cintura e mais')}
        ${renderSummaryTile('Registros', isBusy || isDetailLoading ? '...' : String(prHistory.length), 'marcas e referências')}
      </div>

      <div class="profile-analyticsDesktop">
        <div class="profile-analyticsMain">
          ${renderPageFold({
            title: 'Resumo',
            subtitle: 'Leitura rápida da sua rotina recente.',
            content: `
        <div class="coach-list coach-listCompact">
          ${(isBusy || isDetailLoading) ? renderTrendSkeletons(3) : `
            <div class="coach-listItem static">
              <strong>Resultados recentes</strong>
              <span>${recentResults.length ? `${recentResults.length} registro(s) recente(s)` : 'Nenhum resultado recente ainda.'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Próximas competições</strong>
              <span>${upcomingCompetitions.length ? `${upcomingCompetitions.length} competição(ões) no radar` : 'Sem competição próxima no momento.'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Total de registros</strong>
              <span>${benchmarkPoints + prPoints} entrada(s) acumulada(s)</span>
            </div>
          `}
        </div>
        `,
          })}

          ${renderPageFold({
            title: 'Registros',
            subtitle: 'Cargas, reps, tempos e outras marcas de referência.',
            content: `
        <div class="page-actions">
          <button class="btn-secondary" data-action="modal:open" data-modal="prs" type="button">Gerenciar registros</button>
        </div>
        <div class="trend-grid">
          ${isBusy || isDetailLoading ? renderTrendSkeletons(3) : prHistory.length ? prHistory.map((item) => `
            <div class="trend-card">
              <div class="trend-cardHead">
                <strong>${escapeHtml(item.exercise)}</strong>
                <span>${escapeHtml(String(item.latestValue ?? '—'))} ${escapeHtml(item.unit || 'kg')}</span>
              </div>
              ${renderSparkline(item.points.map((point) => Number(point.value || 0)), false)}
              <div class="trend-meta">
                <span>${item.delta === null ? 'Sem histórico suficiente' : `${item.delta > 0 ? '+' : ''}${formatNumber(item.delta)} ${escapeHtml(item.unit || 'kg')}`}</span>
                <span>${item.points.length} atualização(ões)</span>
              </div>
            </div>
          `).join('') : '<p class="account-hint">Cadastre suas cargas de referência para o app calcular porcentagens e mostrar progresso real.</p>'}
        </div>

        <div class="coach-list coach-listCompact">
          ${runningHistory.length ? runningHistory.slice(0, 3).map((item) => `
            <div class="coach-listItem static">
              <strong>${escapeHtml(item.title || item.session_type || 'Corrida')}</strong>
              <span>${escapeHtml(describeRunningLog(item))}</span>
            </div>
          `).join('') : ''}
          ${strengthHistory.length ? strengthHistory.slice(0, 3).map((item) => `
            <div class="coach-listItem static">
              <strong>${escapeHtml(item.exercise || 'Treino de força')}</strong>
              <span>${escapeHtml(describeStrengthLog(item))}</span>
            </div>
          `).join('') : ''}
          ${!runningHistory.length && !strengthHistory.length ? '<p class="account-hint">Outros registros como tempos, corrida e sessões de força também aparecem aqui quando forem salvos.</p>' : ''}
        </div>
        `,
          })}

          ${renderPageFold({
            title: 'Benchmarks',
            subtitle: 'Progressão dos benchmarks mais registrados.',
            content: `
        <div class="trend-grid">
          ${isBusy || isDetailLoading ? renderTrendSkeletons(4) : benchmarkHistory.length ? benchmarkHistory.map((item) => `
            <div class="trend-card">
              <div class="trend-cardHead">
                <strong>${escapeHtml(item.name || item.slug || 'Benchmark')}</strong>
                <span>${escapeHtml(item.latestLabel || 'Sem marca')}</span>
              </div>
              ${renderSparkline(item.points.map((point) => Number(point.value || 0)), item.scoreType === 'for_time')}
              <div class="trend-meta">
                <span>${item.improvement === null ? 'Sem histórico suficiente' : `${item.improvement > 0 ? '+' : ''}${formatTrendValue(item.improvement, item.scoreType)}`}</span>
                <span>${item.points.length} registro(s)</span>
              </div>
            </div>
          `).join('') : `<p class="account-hint">${isAuthenticated ? 'Finalize benchmarks para começar a curva de evolução.' : 'Finalize benchmarks ou entre na conta para começar a curva de evolução.'}</p>`}
        </div>
        `,
          })}

          ${renderPageFold({
            title: 'Biblioteca de benchmarks',
            subtitle: 'Girls, hero, open e envio do seu próprio resultado.',
            content: renderBenchmarkLibrarySection({
              isAuthenticated,
              isBusy,
              benchmarkBrowser,
              benchmarkHistory,
              helpers,
            }),
          })}
        </div>

        <div class="profile-analyticsRail">
          ${renderPageFold({
            title: 'Medidas',
            subtitle: 'Peso, cintura, braço e outras medidas reunidas no seu perfil.',
            content: `
        <div class="trend-grid measurement-grid">
          ${measurementSummary.length ? measurementSummary.map((item) => `
            <div class="trend-card measurement-card">
              <div class="trend-cardHead">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(formatMeasurementValue(item))}</span>
              </div>
              <div class="trend-meta">
                <span>${escapeHtml(formatMeasurementDate(item.recordedAt))}</span>
                <span>${escapeHtml(getMeasurementTypeMeta(item.type).label)}</span>
              </div>
            </div>
          `).join('') : `<p class="account-hint">Adicione medidas do seu corpo para acompanhar mudanças ao longo do tempo.</p>`}
        </div>

        <div class="measurement-form">
          <div class="measurement-formGrid">
            <select id="measurement-type" class="add-input">
              ${listMeasurementTypes().map((type) => `
                <option value="${escapeAttribute(type.value)}">${escapeHtml(type.label)}${type.unit ? ` (${escapeHtml(type.unit)})` : ''}</option>
              `).join('')}
            </select>
            <input id="measurement-label" class="add-input" type="text" placeholder="Nome da medida (opcional)" />
            <input id="measurement-value" class="add-input" type="number" step="0.1" min="0" placeholder="Valor" />
            <input id="measurement-date" class="add-input" type="date" />
          </div>
          <textarea id="measurement-notes" class="add-input" rows="3" placeholder="Observações opcionais"></textarea>
          <div class="page-actions">
            <button class="btn-secondary" data-action="measurement:add" type="button">Salvar medida</button>
          </div>
        </div>

        <div class="coach-list coach-listCompact">
          ${measurements.length ? measurements.slice(0, 8).map((item) => `
            <div class="coach-listItem static leaderboard-item">
              <div class="measurement-listHead">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(formatMeasurementValue(item))}</span>
              </div>
              <div class="measurement-listMeta">
                <span>${escapeHtml(formatMeasurementDate(item.recordedAt))}</span>
                <button class="btn-secondary measurement-removeBtn" data-action="measurement:remove" data-measurement-id="${escapeAttribute(item.id)}" type="button">Remover</button>
              </div>
            </div>
          `).join('') : ''}
        </div>
        `,
          })}

          ${renderPageFold({
            title: 'Competições',
            subtitle: 'Eventos ligados ao seu perfil e acesso rápido aos leaderboards.',
            open: false,
            content: `
        <div class="coach-list coach-listCompact">
          ${isBusy || isDetailLoading ? renderListSkeletons(3) : upcomingCompetitions.length ? upcomingCompetitions.slice(0, 4).map((item) => `
            <div class="coach-listItem static">
              <strong>${escapeHtml(item.title || 'Competição')}</strong>
              <span>${escapeHtml(item.startDate || item.eventDate || 'Sem data definida')}</span>
            </div>
          `).join('') : '<p class="account-hint">Sem competição vinculada no momento.</p>'}
        </div>
        <div class="page-actions">
          <button class="btn-secondary" data-action="page:set" data-page="competitions" type="button">Abrir competições</button>
        </div>
        `,
          })}
        </div>
      </div>
    </div>
  `;
}

function renderBenchmarkLibrarySection({ isAuthenticated, isBusy, benchmarkBrowser, benchmarkHistory, helpers }) {
  const {
    renderListSkeletons,
    escapeHtml,
    escapeAttribute,
  } = helpers;

  if (!isAuthenticated) {
    return `
      <p class="account-hint">Entre na conta para explorar benchmarks do módulo Train, ver leaderboards e registrar seus próprios resultados.</p>
      <div class="page-actions">
        <button class="btn-secondary" data-action="modal:open" data-modal="auth" type="button">Entrar</button>
      </div>
    `;
  }

  const items = benchmarkBrowser?.items || [];
  const pagination = benchmarkBrowser?.pagination || { total: 0, page: 1, pages: 1 };
  const selectedBenchmark = benchmarkBrowser?.selectedBenchmark || null;
  const leaderboard = benchmarkBrowser?.leaderboard || [];
  const currentUserResult = benchmarkBrowser?.currentUserResult || null;
  const selectedHistory = benchmarkHistory.find((item) => item?.slug === selectedBenchmark?.slug) || null;
  const isLoading = !!benchmarkBrowser?.loading;
  const isLeaderboardLoading = !!benchmarkBrowser?.leaderboardLoading;
  const activeCategory = String(benchmarkBrowser?.category || 'girls');

  return `
    <div class="coach-list benchmark-filterChips">
      ${[
        { value: 'girls', label: 'girls' },
        { value: 'hero', label: 'hero' },
        { value: 'open', label: 'open' },
        { value: '', label: 'todos' },
      ].map((item) => `
        <button
          class="coach-pill ${activeCategory === item.value ? 'isActive' : ''}"
          data-action="benchmark:category"
          data-category="${escapeHtml(item.value)}"
          type="button"
        >
          ${escapeHtml(item.label)}
        </button>
      `).join('')}
    </div>

    <div class="benchmark-browserGrid">
      <div class="coach-list coach-listCompact">
        <div class="benchmark-libraryMeta">
          <span class="muted">${isLoading || isBusy ? '...' : `${pagination.total || 0} benchmark(s)`}</span>
          <span class="muted">Página ${pagination.page || 1} de ${pagination.pages || 1}</span>
        </div>
        ${isLoading || isBusy ? renderListSkeletons(6) : items.length ? items.map((benchmark) => `
          <button
            class="coach-listItem ${selectedBenchmark?.slug === benchmark.slug ? 'selected' : ''}"
            data-action="benchmark:select"
            data-slug="${escapeHtml(benchmark.slug)}"
            type="button"
          >
            <strong>${escapeHtml(benchmark.name)}</strong>
            <span>${escapeHtml(benchmark.category || 'benchmark')}${benchmark.year ? ` • ${escapeHtml(String(benchmark.year))}` : ''}${benchmark.official_source ? ` • ${escapeHtml(benchmark.official_source)}` : ''}</span>
          </button>
        `).join('') : '<p class="account-hint">Nenhum benchmark encontrado para esse filtro.</p>'}
        <div class="page-actions">
          <button class="btn-secondary" data-action="benchmark:page" data-direction="prev" type="button" ${Number(pagination.page || 1) <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn-secondary" data-action="benchmark:page" data-direction="next" type="button" ${Number(pagination.page || 1) >= Number(pagination.pages || 1) ? 'disabled' : ''}>Próxima</button>
        </div>
      </div>

      <div class="trend-card benchmark-detailCard">
        ${selectedBenchmark ? `
          <div class="trend-cardHead">
            <strong>${escapeHtml(selectedBenchmark.name)}</strong>
            <span>${escapeHtml(formatBenchmarkScoreType(selectedBenchmark.score_type))}</span>
          </div>
          <p class="account-hint">${escapeHtml(selectedBenchmark.description || 'Sem descrição oficial cadastrada.')}</p>
          <div class="coach-list coach-listCompact">
            <div class="coach-listItem static">
              <strong>Estrutura</strong>
              <span>${escapeHtml(describeBenchmarkPayload(selectedBenchmark))}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Sua melhor marca</strong>
              <span>${selectedHistory?.latestLabel ? escapeHtml(selectedHistory.latestLabel) : 'Ainda sem resultado registrado'}</span>
            </div>
            <div class="coach-listItem static">
              <strong>Sua posição</strong>
              <span>${currentUserResult?.rank ? `#${escapeHtml(String(currentUserResult.rank))} • ${escapeHtml(currentUserResult.score_display || '—')}` : 'Ainda fora do ranking deste benchmark'}</span>
            </div>
          </div>

          ${selectedHistory?.points?.length ? `
            <div class="benchmark-historyDetail">
              <strong>Seu histórico neste benchmark</strong>
              <div class="coach-list coach-listCompact">
                ${selectedHistory.points.slice().reverse().slice(0, 6).map((point, index) => `
                  <div class="coach-listItem static leaderboard-item">
                    <strong>${escapeHtml(point.label || `Registro ${index + 1}`)}</strong>
                    <span>${escapeHtml(String(point.display || point.raw || point.value || '—'))}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="benchmark-form">
            <input
              id="benchmark-score-input"
              class="field"
              placeholder="${escapeAttribute(getBenchmarkScorePlaceholder(selectedBenchmark.score_type))}"
              inputmode="${escapeAttribute(getBenchmarkScoreInputMode(selectedBenchmark.score_type))}"
              type="text"
            />
            <div class="account-hint benchmark-scoreHint">${escapeHtml(getBenchmarkScoreHelpText(selectedBenchmark.score_type))}</div>
            <textarea
              id="benchmark-notes-input"
              class="field"
              rows="3"
              placeholder="Observações opcionais"
            ></textarea>
            <div class="page-actions">
              <button class="btn-primary" data-action="benchmark:submit" type="button">Salvar resultado</button>
            </div>
          </div>

          <div class="benchmark-leaderboard">
            <strong>Leaderboard</strong>
            <div class="coach-list coach-listCompact">
              ${isLeaderboardLoading ? renderListSkeletons(4) : leaderboard.length ? leaderboard.map((item, index) => `
                <div class="coach-listItem static leaderboard-item ${currentUserResult?.email && currentUserResult.email === item.email ? 'isActive' : ''}">
                  <strong>#${index + 1} ${escapeHtml(item.name || item.email || 'Atleta')}</strong>
                  <span>${escapeHtml(item.score_display || '—')}</span>
                </div>
              `).join('') : '<p class="account-hint">Ainda sem resultados públicos para este benchmark.</p>'}
            </div>
          </div>
        ` : `
          <p class="account-hint">Toque em um benchmark da lista para ver a descrição oficial, o leaderboard e registrar seu resultado.</p>
        `}
      </div>
    </div>
  `;
}

function formatMeasurementDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function describeRunningLog(item = {}) {
  const parts = [];
  if (item.distance_km) parts.push(`${Number(item.distance_km).toLocaleString('pt-BR')} km`);
  if (item.duration_min) parts.push(`${Number(item.duration_min).toLocaleString('pt-BR')} min`);
  if (item.avg_pace) parts.push(`pace ${item.avg_pace}`);
  return parts.join(' • ') || 'Registro de corrida';
}

function describeStrengthLog(item = {}) {
  const parts = [];
  if (item.sets_count) parts.push(`${item.sets_count} séries`);
  if (item.reps_text) parts.push(item.reps_text);
  if (item.load_text) parts.push(item.load_text);
  else if (item.load_value) parts.push(`${Number(item.load_value).toLocaleString('pt-BR')} kg`);
  return parts.join(' • ') || 'Registro de força';
}

export function formatBenchmarkScoreType(scoreType) {
  switch (String(scoreType || '').trim().toLowerCase()) {
    case 'for_time':
      return 'Tempo';
    case 'rounds_reps':
      return 'Rounds + reps';
    case 'reps':
      return 'Repetições';
    case 'load':
      return 'Carga';
    default:
      return 'Score';
  }
}

export function getBenchmarkScorePlaceholder(scoreType) {
  switch (String(scoreType || '').trim().toLowerCase()) {
    case 'for_time':
      return 'Ex.: 03:24';
    case 'rounds_reps':
      return 'Ex.: 15+12';
    case 'load':
      return 'Ex.: 100 kg';
    default:
      return 'Ex.: 75';
  }
}

export function getBenchmarkScoreInputMode(scoreType) {
  switch (String(scoreType || '').trim().toLowerCase()) {
    case 'for_time':
    case 'rounds_reps':
    case 'reps':
      return 'numeric';
    case 'load':
      return 'decimal';
    default:
      return 'text';
  }
}

export function getBenchmarkScoreHelpText(scoreType) {
  switch (String(scoreType || '').trim().toLowerCase()) {
    case 'for_time':
      return 'Tempo no formato mm:ss ou hh:mm:ss.';
    case 'rounds_reps':
      return 'Use rounds + reps no formato 15+12.';
    case 'load':
      return 'Informe a carga. Ex.: 100 kg.';
    case 'reps':
      return 'Informe apenas o total de repetições.';
    default:
      return 'Use o formato oficial desse benchmark.';
  }
}

function describeBenchmarkPayload(benchmark = {}) {
  const payload = benchmark?.payload && typeof benchmark.payload === 'object' ? benchmark.payload : {};
  const parts = [];

  if (Array.isArray(payload.reps) && payload.reps.length) {
    parts.push(`reps ${payload.reps.join('-')}`);
  } else if (payload.reps) {
    parts.push(`${payload.reps} reps`);
  }

  if (payload.rounds) parts.push(`${payload.rounds} round(s)`);
  if (payload.timeCapMinutes) parts.push(`${payload.timeCapMinutes} min`);
  if (Array.isArray(payload.movements) && payload.movements.length) parts.push(payload.movements.join(', '));
  if (payload.chipper) parts.push('chipper');
  if (payload.endurance) parts.push('endurance');

  return parts.join(' • ') || benchmark?.slug || 'Estrutura não detalhada';
}

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

  if (matched?.item) return buildExerciseHelpPayload(matched.item.label, matched.item.query, sourceLine);
  return null;
}

function buildExerciseHelpPayload(label, query, sourceLine = '') {
  return {
    label,
    query,
    sourceLine,
    youtubeUrl: buildSearchUrl(query),
  };
}

function buildSearchUrl(query) {
  const q = encodeURIComponent(String(query || '').trim());
  return `https://www.youtube.com/results?search_query=${q}%20exercise%20tutorial`;
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
