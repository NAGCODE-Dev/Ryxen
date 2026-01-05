import { renderAppShell, renderAll } from './render.js';
import { setupActions } from './actions.js';
import { bindAppEvents } from './events.js';

/**
 * UI plugável.
 * - Não inicializa app
 * - Não conhece core/store
 * - Consome apenas window.__APP__ (getState, on, actions)
 */
export async function mountUI({ root }) {
  if (!root) throw new Error('mountUI: root é obrigatório');

  ensureStylesheet('./src/ui/styles.css');
  ensureBg();

  root.innerHTML = renderAppShell();

  const subtitleEl = root.querySelector('#ui-subtitle');
  const weekBadgeEl = root.querySelector('#ui-weekBadge');
  const dayBadgeEl = root.querySelector('#ui-dayBadge');
  const warnBadgeEl = root.querySelector('#ui-warnBadge');
  const weekChipsEl = root.querySelector('#ui-weekChips');
  const mainEl = root.querySelector('#ui-main');
  const stateEl = root.querySelector('#ui-state');
  const eventsEl = root.querySelector('#ui-events');

  const prsTableEl = root.querySelector('#ui-prsTable');
  const prsCountEl = root.querySelector('#ui-prsCount');
  const prsSearchEl = root.querySelector('#ui-prsSearch');

  const { toast } = ensureToast();
  const pushEventLine = createEventLog(eventsEl);

  // Restaura estado do sidebar
  const { createStorage } = await import('../adapters/storage/storageFactory.js');
  const uiPrefsStorage = createStorage('ui-prefs', 100);
  const sidebarCollapsed = await uiPrefsStorage.get('sidebar-collapsed');

  if (sidebarCollapsed) {
    const sidebar = root.querySelector('#ui-sidebar');
    if (sidebar) {
      sidebar.classList.add('ui-sidebarCollapsed');
      const icon = sidebar.querySelector('.ui-toggleIcon');
      if (icon) icon.textContent = '▶';
    }
  }

  const rerender = () => {
    const state = safeGetState();
    const view = renderAll(state);

    console.log('[UI DEBUG] Atualizando DOM com:', {
      weekChipsHtml: view.weekChipsHtml?.substring(0, 100),
      weekChipsElExists: !!weekChipsEl
    });

    // CORREÇÃO: Adiciona null checks
    if (subtitleEl) subtitleEl.textContent = view.subtitle;
    if (weekBadgeEl) weekBadgeEl.textContent = view.weekBadge;
    if (dayBadgeEl) dayBadgeEl.textContent = view.dayBadge;

    if (warnBadgeEl) warnBadgeEl.style.display = view.warnBadgeVisible ? '' : 'none';

    console.log('[UI DEBUG] Antes de atualizar weekChips, HTML atual:', weekChipsEl?.innerHTML?.substring(0, 100));
    if (weekChipsEl) weekChipsEl.innerHTML = view.weekChipsHtml;
    console.log('[UI DEBUG] Depois de atualizar weekChips, HTML novo:', weekChipsEl?.innerHTML?.substring(0, 100));

    if (mainEl) mainEl.innerHTML = view.mainHtml;
    if (stateEl) stateEl.innerHTML = view.stateHtml;

    if (prsTableEl) prsTableEl.innerHTML = view.prsModalHtml;

    if (prsCountEl) {
      const count = Object.keys(state?.prs || {}).length;
      prsCountEl.textContent = `${count} PRs`;
    }

    if (prsSearchEl) {
      filterPrRows(root, prsSearchEl.value);
    }
  };

  const destroyEvents = bindAppEvents({
    pushEventLine,
    rerender,
    toast,
  });

  setupActions({ root, toast, rerender });

  pushEventLine('UI montada');
  rerender();

  return {
    rerender,
    destroy() {
      try {
        destroyEvents?.();
      } catch (e) {
        console.warn('destroyEvents falhou', e);
      }
    },
  };

  function safeGetState() {
    try {
      return window.__APP__?.getState ? window.__APP__.getState() : {};
    } catch {
      return {};
    }
  }

  function ensureStylesheet(href) {
    const id = 'ui-styles';
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureBg() {
    // UI pode aplicar fundo sem tocar no index.html
    document.documentElement.classList.add('ui-bg');
    document.body.classList.add('ui-bg');
  }

  function ensureToast() {
    let el = document.getElementById('ui-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ui-toast';
      el.className = 'ui-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }

    let timeout = null;

    const toast = (message) => {
      el.textContent = String(message ?? '');
      el.classList.add('ui-toastShow');
      clearTimeout(timeout);
      timeout = setTimeout(() => el.classList.remove('ui-toastShow'), 2200);
    };

    return { el, toast };
  }

  function createEventLog(containerEl) {
    const lines = [];

    const push = (msg) => {
      const time = new Date().toLocaleTimeString('pt-BR');
      lines.unshift(`${time}: ${msg}`);
      if (lines.length > 10) lines.pop();

      if (containerEl) {
        containerEl.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
      }
    };

    return push;
  }

  function filterPrRows(root, query) {
    const q = String(query || '').trim().toUpperCase();
    const rows = Array.from(root.querySelectorAll('tr[data-pr-row]'));

    let visible = 0;
    rows.forEach((row) => {
      const key = (row.getAttribute('data-pr-row') || '').toUpperCase();
      const show = !q || key.includes(q);
      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });

    const countEl = root.querySelector('#ui-prsCount');
    if (countEl) countEl.textContent = `${visible} PRs`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }
}
