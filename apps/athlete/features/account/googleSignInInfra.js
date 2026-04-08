export function createGoogleScriptLoader() {
  let googleScriptPromise = null;

  return async function loadGoogleScript() {
    if (!navigator.onLine) {
      throw new Error('Google Sign-In indisponível offline');
    }
    if (window.google?.accounts?.id) return window.google;
    if (googleScriptPromise) return googleScriptPromise;

    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-gsi="1"]');
      if (existing) {
        const checkReady = () => {
          if (window.google?.accounts?.id) resolve(window.google);
          else window.setTimeout(checkReady, 80);
        };
        checkReady();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleGsi = '1';
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Não foi possível carregar o Google Sign-In'));
      document.head.appendChild(script);
    });

    return googleScriptPromise;
  };
}

export function isNativeAppRuntime() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const protocol = String(window.location?.protocol || '').toLowerCase();
    return protocol === 'capacitor:' || protocol === 'file:' || (protocol === 'https:' && window.location?.hostname === 'localhost');
  } catch {
    return false;
  }
}
