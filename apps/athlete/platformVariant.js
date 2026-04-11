export function getAthletePlatformVariant() {
  try {
    const explicit = document.body?.dataset?.platformVariant;
    if (explicit === 'native' || explicit === 'web') return explicit;
  } catch {
    // no-op
  }

  try {
    const context = window.__RYXEN_APP_CONTEXT__ || window.__CROSSAPP_APP_CONTEXT__ || {};
    if (context?.platformVariant === 'native') return 'native';
    if (context?.platformVariant === 'web') return 'web';
  } catch {
    // no-op
  }

  try {
    if (window.Capacitor?.isNativePlatform?.()) return 'native';
  } catch {
    // no-op
  }

  return 'web';
}

export function isAthleteNativeVariant(value) {
  return String(value || '').trim() === 'native';
}
