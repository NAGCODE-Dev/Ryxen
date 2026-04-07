import { getRuntimeConfig } from '../../src/config/runtime.js';

export function isNativePlatform() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const protocol = String(window.location?.protocol || '').toLowerCase();
    return protocol === 'capacitor:' || protocol === 'file:' || (protocol === 'https:' && window.location?.hostname === 'localhost');
  } catch {
    return false;
  }
}

export function applyAppContext() {
  const config = getRuntimeConfig();
  const appLabel = config?.app?.appLabel || 'Ryxen';
  const sport = config?.app?.sport || 'cross';
  const nativeApp = isNativePlatform();

  document.title = appLabel;
  document.body.dataset.sport = sport;
  document.body.dataset.nativeApp = nativeApp ? 'true' : 'false';
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getCapacitorAppPlugin() {
  try {
    return window.Capacitor?.Plugins?.App || null;
  } catch {
    return null;
  }
}
