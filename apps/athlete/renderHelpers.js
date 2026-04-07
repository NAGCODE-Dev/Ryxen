import { getAthleteImportUsage, normalizeAthleteBenefits } from '../../src/core/services/athleteBenefitUsage.js';
import { isDeveloperEmail } from '../../src/core/utils/devAccess.js';
import { renderWorkoutBlock } from './renderers/workoutBlock.js';

export function createAthleteRenderHelpers({ escapeHtml } = {}) {
  return {
    renderPageHero: ({ eyebrow, title, subtitle, actions = '', footer = '' }) => `
      <section class="page-hero">
        <div class="page-heroBody">
          ${eyebrow ? `<div class="page-heroEyebrow">${escapeHtml(eyebrow)}</div>` : ''}
          <h1 class="page-heroTitle">${escapeHtml(title || '')}</h1>
          ${subtitle ? `<p class="page-heroSubtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${actions ? `<div class="page-heroActions">${actions}</div>` : ''}
        ${footer ? `<div class="page-heroFooter">${footer}</div>` : ''}
      </section>
    `,
    renderPageFold: ({ title, subtitle = '', content = '', open = true }) => `
      <details class="page-fold page-section" ${open ? 'open' : ''}>
        <summary class="page-foldSummary">
          <div class="page-foldSummaryRow">
            <div class="page-foldHead">
              <strong class="page-foldTitle">${escapeHtml(title || '')}</strong>
              ${subtitle ? `<span class="page-foldSubtitle">${escapeHtml(subtitle)}</span>` : ''}
            </div>
            <span class="page-foldChevron">⌄</span>
          </div>
        </summary>
        <div class="page-foldBody">
          ${content}
        </div>
      </details>
    `,
    renderTrendSkeletons: (count = 3) => Array.from({ length: count }, () => `
      <div class="trend-card isSkeleton">
        <div class="trend-cardHead">
          <div class="skeleton skeleton-line skeleton-line-lg"></div>
          <div class="skeleton skeleton-line skeleton-line-sm"></div>
        </div>
        <div class="skeleton skeleton-chart"></div>
        <div class="trend-meta">
          <div class="skeleton skeleton-line skeleton-line-sm"></div>
          <div class="skeleton skeleton-line skeleton-line-sm"></div>
        </div>
      </div>
    `).join(''),
    renderSparkline,
    formatTrendValue,
    formatNumber,
    formatDateShort,
    renderBottomTools: (state) => renderBottomTools(state, { escapeHtml }),
    renderWorkoutBlock: (block, blockIndex, ui) => renderWorkoutBlock(block, blockIndex, ui, { escapeHtml }),
    renderAccountSkeleton,
    describeAthleteBenefitSource,
    formatSubscriptionPlanName,
    escapeHtml,
    isDeveloperEmail,
    normalizeAthleteBenefits,
    getAthleteImportUsage,
    formatDay,
  };
}

export { normalizeAthleteBenefits };
export { isDeveloperEmail };

export function formatSubscriptionPlanName(planId) {
  const normalized = String(planId || 'free').trim().toLowerCase();
  if (normalized === 'athlete_plus') return 'Atleta Plus';
  if (normalized === 'starter') return 'Coach Starter';
  if (normalized === 'pro' || normalized === 'coach') return 'Coach Pro';
  if (normalized === 'performance') return 'Coach Performance';
  return 'Free';
}

export function renderAccountSkeleton() {
  return `
    <div class="sheet-stack isSkeleton">
      <div class="skeleton skeleton-line skeleton-line-lg"></div>
      <div class="skeleton skeleton-line"></div>
    </div>
  `;
}

export function describeAthleteBenefitSource(benefits) {
  const normalized = normalizeAthleteBenefits(benefits);
  if (normalized.personal) return 'liberado na conta do atleta';
  if (normalized.inherited) return 'liberado também quando há coach vinculado';
  return 'sem bloqueios no app do atleta';
}

export function formatDay(day) {
  const days = {
    'segunda': 'Segunda',
    'terça': 'Terça',
    'terca': 'Terça',
    'quarta': 'Quarta',
    'quinta': 'Quinta',
    'sexta': 'Sexta',
    'sábado': 'Sábado',
    'sabado': 'Sábado',
    'domingo': 'Domingo',
  };
  return days[String(day || '').toLowerCase()] || day || 'Hoje';
}

export function formatDateShort(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export function formatTrendValue(value, scoreType) {
  if (scoreType === 'for_time') return `${formatNumber(value)}s`;
  return formatNumber(value);
}

export function renderSparkline(values = [], lowerIsBetter = false) {
  const points = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (points.length < 2) {
    return '<div class="trend-empty">Sem dados suficientes</div>';
  }

  const width = 220;
  const height = 64;
  const padding = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const coords = points.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
    const normalized = (value - min) / range;
    const y = height - padding - normalized * (height - padding * 2);
    return [x, y];
  });
  const polyline = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = coords[coords.length - 1];
  const stroke = lowerIsBetter ? '#7ee0a1' : '#ff9c71';

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${polyline}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" fill="${stroke}"></circle>
    </svg>
  `;
}

function renderBottomTools(state, { escapeHtml }) {
  const currentPage = state?.__ui?.currentPage || 'today';
  if (currentPage !== 'today') return '';
  const hasWorkout = !!(state?.workout?.blocks?.length || state?.workoutOfDay?.blocks?.length);
  const hasWeeks = (state?.weeks?.length ?? 0) > 0;

  if (!hasWorkout && !hasWeeks) return '';

  return `
    <div class="bottom-tools">
      <div class="bottom-toolsHead">
        <span class="section-kicker">Ações rápidas</span>
        <span class="bottom-toolsHint">${hasWorkout ? 'Mantenha o treino em movimento sem sair da tela principal.' : 'Comece pelo treino e organize o resto depois.'}</span>
      </div>
      ${hasWorkout ? `
        <button class="quick-action quick-action-primary" data-action="workout:copy" type="button">
          <span class="quick-actionIcon">COP</span>
          <span class="quick-actionLabel">Copiar treino</span>
          <span class="quick-actionMeta">Leve a sessão para mensagem, nota ou WhatsApp.</span>
        </button>
        <button class="quick-action quick-action-wide" data-action="modal:open" data-modal="import" type="button">
          <span class="quick-actionIcon">+</span>
          <span class="quick-actionLabel">Trocar treino</span>
          <span class="quick-actionMeta">Substitua a planilha atual sem perder a navegação.</span>
        </button>
      ` : `
        <button class="quick-action quick-action-primary quick-action-wide" data-action="modal:open" data-modal="import" type="button">
          <span class="quick-actionIcon">+</span>
          <span class="quick-actionLabel">Importar treino</span>
          <span class="quick-actionMeta">PDF, imagem, vídeo, texto ou planilha em um só fluxo.</span>
        </button>
      `}
    </div>
  `;
}
