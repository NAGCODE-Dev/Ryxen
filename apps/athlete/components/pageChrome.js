export function renderPageHero({ eyebrow, title, subtitle, actions = '', footer = '' }, { escapeHtml }) {
  return `
    <section class="page-hero">
      <div class="page-heroBody">
        ${eyebrow ? `<div class="page-heroEyebrow">${escapeHtml(eyebrow)}</div>` : ''}
        <h1 class="page-heroTitle">${escapeHtml(title || '')}</h1>
        ${subtitle ? `<p class="page-heroSubtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-heroActions">${actions}</div>` : ''}
      ${footer ? `<div class="page-heroFooter">${footer}</div>` : ''}
    </section>
  `;
}

export function renderPageFold({ title, subtitle = '', content = '', open = true, className = '', guideTarget = '' }, { escapeHtml }) {
  const foldClassName = ['page-fold', 'page-section', className].filter(Boolean).join(' ');
  return `
    <details class="${foldClassName}" ${guideTarget ? `data-guide-target="${escapeHtml(guideTarget)}"` : ''} ${open ? 'open' : ''}>
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
  `;
}

export function renderTrendSkeletons(count = 3) {
  return Array.from({ length: count }, () => `
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
  `).join('');
}

export function renderBottomTools(state, { escapeHtml }) {
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
        <button class="quick-action quick-action-wide" data-action="modal:open" data-modal="import" data-guide-target="today-import" type="button">
          <span class="quick-actionIcon">+</span>
          <span class="quick-actionLabel">Trocar treino</span>
          <span class="quick-actionMeta">Substitua a planilha atual sem perder a navegação.</span>
        </button>
      ` : `
        <button class="quick-action quick-action-primary quick-action-wide" data-action="modal:open" data-modal="import" data-guide-target="today-import" type="button">
          <span class="quick-actionIcon">+</span>
          <span class="quick-actionLabel">Importar treino</span>
          <span class="quick-actionMeta">PDF, imagem, vídeo, texto ou planilha em um só fluxo.</span>
        </button>
      `}
    </div>
  `;
}
