const AUXILIARY_PAGES = new Map([
  ['/pricing.html', 'Planos'],
  ['/privacy.html', 'Política de Privacidade'],
  ['/terms.html', 'Termos de Uso'],
  ['/support.html', 'Suporte'],
]);

const OVERLAY_ID = 'ryxen-aux-browser';
const LEGACY_OVERLAY_ID = 'crossapp-aux-browser';
let isMounted = false;

export function initAuxiliaryBrowserLayer() {
  if (isMounted || !isNativeAppRuntime()) return;
  isMounted = true;
  ensureOverlayShell();
  document.addEventListener('click', handleAuxiliaryLinkClick, true);
}

function handleAuxiliaryLinkClick(event) {
  const anchor = event.target.closest('a[href]');
  if (!anchor) return;

  const href = String(anchor.getAttribute('href') || '').trim();
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;

  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return;
  }

  if (url.origin !== window.location.origin) return;
  const title = AUXILIARY_PAGES.get(url.pathname);
  if (!title) return;

  event.preventDefault();
  openAuxiliaryOverlay(url, title);
}

function openAuxiliaryOverlay(url, title) {
  const shell = ensureOverlayShell();
  const titleEl = shell.querySelector('[data-aux-title]');
  const frameEl = shell.querySelector('[data-aux-frame]');
  if (!titleEl || !frameEl) return;

  const nextUrl = new URL(url.toString());
  nextUrl.searchParams.set('embedded', '1');

  titleEl.textContent = title;
  frameEl.setAttribute('src', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  shell.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeAuxiliaryOverlay() {
  const shell = document.getElementById(OVERLAY_ID) || document.getElementById(LEGACY_OVERLAY_ID);
  if (!shell) return;
  shell.hidden = true;
  const frameEl = shell.querySelector('[data-aux-frame]');
  if (frameEl) frameEl.setAttribute('src', 'about:blank');
  document.body.style.overflow = '';
}

function ensureOverlayShell() {
  let shell = document.getElementById(OVERLAY_ID) || document.getElementById(LEGACY_OVERLAY_ID);
  if (shell) return shell;

  shell = document.createElement('div');
  shell.id = OVERLAY_ID;
  shell.hidden = true;
  shell.innerHTML = `
    <div class="aux-browserBackdrop" data-aux-close></div>
    <div class="aux-browserPanel" role="dialog" aria-modal="true" aria-label="Navegador auxiliar">
      <div class="aux-browserHeader">
        <div class="aux-browserTitle" data-aux-title>Conteúdo</div>
        <button class="aux-browserClose" type="button" data-aux-close>Fechar</button>
      </div>
      <iframe class="aux-browserFrame" data-aux-frame title="Conteúdo auxiliar"></iframe>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 99999;
    }
    #${OVERLAY_ID}[hidden] {
      display: none;
    }
    #${OVERLAY_ID} .aux-browserBackdrop {
      position: absolute;
      inset: 0;
      background: rgba(3, 7, 18, 0.72);
      backdrop-filter: blur(6px);
    }
    #${OVERLAY_ID} .aux-browserPanel {
      position: absolute;
      inset: 16px 12px;
      display: grid;
      grid-template-rows: auto 1fr;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.12);
      background: #0b1118;
      box-shadow: 0 24px 80px rgba(0,0,0,0.45);
    }
    #${OVERLAY_ID} .aux-browserHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      background: rgba(15, 23, 42, 0.96);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    #${OVERLAY_ID} .aux-browserTitle {
      color: #f8fafc;
      font: 700 16px/1.2 system-ui, sans-serif;
    }
    #${OVERLAY_ID} .aux-browserClose {
      min-height: 40px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: #f8fafc;
      font: 600 14px/1 system-ui, sans-serif;
    }
    #${OVERLAY_ID} .aux-browserFrame {
      width: 100%;
      height: 100%;
      border: 0;
      background: #ffffff;
    }
  `;
  shell.appendChild(style);

  shell.addEventListener('click', (event) => {
    if (event.target.closest('[data-aux-close]')) {
      closeAuxiliaryOverlay();
    }
  });

  document.body.appendChild(shell);
  return shell;
}

function isNativeAppRuntime() {
  try {
    return !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}
