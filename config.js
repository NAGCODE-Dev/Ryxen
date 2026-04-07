// Keep the legacy global name for backward compatibility with already deployed clients.
// Keep the currently deployed backend hostname until infrastructure is cut over to a Ryxen-branded domain.
window.__CROSSAPP_CONFIG__ = window.__CROSSAPP_CONFIG__ || {
  apiBaseUrl: '/api',
  nativeApiBaseUrl: 'https://crossapp-znmj.onrender.com',
  telemetryEnabled: true,
  auth: {
    googleClientId: '581596457498-9vrde3rt79ikqqm751v8bfhngemm2k23.apps.googleusercontent.com',
  },
  observability: {
    sentry: {
      dsn: '',
      environment: 'production',
      release: '',
    },
  },
  billing: {
    provider: 'kiwify_link',
    successUrl: '',
    cancelUrl: '',
    links: {
      athlete_plus: '',
      starter: '',
      pro: '',
      coach: '',
      performance: '',
    },
  },
};
