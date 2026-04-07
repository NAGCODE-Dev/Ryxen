let nativeBackRegistered = false;

export function initNativeBackHandling() {
  if (nativeBackRegistered) return;
  const appPlugin = getCapacitorAppPlugin();
  if (!appPlugin?.addListener) return;

  nativeBackRegistered = true;
  appPlugin.addListener('backButton', ({ canGoBack } = {}) => {
    if (closeAuxiliaryOverlay()) return;
    if (closeModal()) return;
    if (navigateWebBack(canGoBack)) return;
    appPlugin.exitApp?.();
  });
}

function closeAuxiliaryOverlay() {
  const closeButton = document.querySelector('#ryxen-aux-browser:not([hidden]) [data-aux-close], #crossapp-aux-browser:not([hidden]) [data-aux-close]');
  if (!closeButton) return false;
  closeButton.click();
  return true;
}

function closeModal() {
  const closeButton = document.querySelector('.modal-overlay.isOpen .modal-close, .modal-overlay-auth.isOpen .modal-close, [data-action="modal:close"]');
  if (!closeButton) return false;
  closeButton.click();
  return true;
}

function navigateWebBack(canGoBack) {
  const path = window.location.pathname || '/';

  if (history.length > 1 && canGoBack) {
    history.back();
    return true;
  }

  if (isAuxiliaryPath(path)) {
    window.location.assign('/index.html');
    return true;
  }

  if (path !== '/index.html' && path !== '/') {
    window.location.assign('/index.html');
    return true;
  }

  return false;
}

function isAuxiliaryPath(path) {
  return ['/pricing.html', '/privacy.html', '/terms.html', '/support.html'].includes(path);
}

function getCapacitorAppPlugin() {
  try {
    return window.Capacitor?.Plugins?.App || null;
  } catch {
    return null;
  }
}
