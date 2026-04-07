import { renderAppShell } from '../../src/ui/render.js';

export function prepareAthleteLayoutRoot(root) {
  ensureAthleteStylesheet('./src/ui/styles.css');
  ensureAthleteBackground();
  root.innerHTML = renderAppShell();
  return getAthleteLayoutRefs(root);
}

export function ensureAthleteToast() {
  let element = document.getElementById('ui-toast');
  if (!element) {
    element = document.createElement('div');
    element.id = 'ui-toast';
    element.className = 'ui-toast';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    document.body.appendChild(element);
  }

  let timeout = null;
  const toast = (message) => {
    element.textContent = String(message ?? '');
    element.classList.add('ui-toastShow');
    clearTimeout(timeout);
    timeout = setTimeout(() => element.classList.remove('ui-toastShow'), 2200);
  };

  return { element, toast };
}

export function setLayoutText(element, value) {
  if (!element) return;
  const next = String(value ?? '');
  if (element.textContent === next) return;
  element.textContent = next;
}

export function setLayoutHtml(element, html) {
  if (!element) return;
  const next = String(html ?? '');
  if (element.innerHTML === next) return;
  element.innerHTML = next;
}

function getAthleteLayoutRefs(root) {
  const query = (selector) => root.querySelector(selector);
  return {
    headerAccount: query('#ui-headerAccount'),
    main: query('#ui-main'),
    bottomNav: query('#ui-bottomNav'),
    modals: query('#ui-modals'),
    prsCount: query('#ui-prsCount'),
  };
}

function ensureAthleteStylesheet(href) {
  const id = 'ui-styles';
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureAthleteBackground() {
  document.documentElement.classList.add('ui-bg');
  document.body.classList.add('ui-bg');
}
