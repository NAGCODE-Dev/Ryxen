import { getRuntimeConfig } from '../../src/config/runtime.js';
import { getCapacitorAppPlugin as resolveCapacitorAppPlugin } from '../../src/app/capacitorRuntime.js';
import { getAthletePlatformVariant } from './platformVariant.js';

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
  const platformVariant = getAthletePlatformVariant();

  document.title = appLabel;
  document.body.dataset.sport = sport;
  document.body.dataset.nativeApp = nativeApp ? 'true' : 'false';
  document.body.dataset.platformVariant = platformVariant;

  try {
    const current = window.__RYXEN_APP_CONTEXT__ || window.__CROSSAPP_APP_CONTEXT__ || {};
    const next = {
      ...current,
      appLabel,
      sport,
      platformVariant,
    };
    window.__RYXEN_APP_CONTEXT__ = next;
    window.__CROSSAPP_APP_CONTEXT__ = next;
  } catch {
    // no-op
  }
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getCapacitorAppPlugin() {
  return resolveCapacitorAppPlugin();
}
