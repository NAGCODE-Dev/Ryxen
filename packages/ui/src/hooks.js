import { useEffect, useState } from 'react';

export function detectNativeShell() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const protocol = String(window.location?.protocol || '').toLowerCase();
    return protocol === 'capacitor:' || protocol === 'file:' || (protocol === 'https:' && window.location?.hostname === 'localhost');
  } catch {
    return false;
  }
}

export function readPreferredMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  } catch {
    return false;
  }
}

export function useReducedMotion(explicitValue = null) {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof explicitValue === 'boolean' ? explicitValue : readPreferredMotion()
  ));

  useEffect(() => {
    if (typeof explicitValue === 'boolean') {
      setReducedMotion(explicitValue);
      return undefined;
    }

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) return undefined;

    const listener = () => setReducedMotion(mediaQuery.matches === true);
    listener();
    mediaQuery.addEventListener?.('change', listener);
    mediaQuery.addListener?.(listener);
    return () => {
      mediaQuery.removeEventListener?.('change', listener);
      mediaQuery.removeListener?.(listener);
    };
  }, [explicitValue]);

  return reducedMotion;
}

export function useNativeShell() {
  const [nativeShell, setNativeShell] = useState(() => detectNativeShell());

  useEffect(() => {
    setNativeShell(detectNativeShell());
  }, []);

  return nativeShell;
}
