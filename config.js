// Keep the currently deployed backend hostname until infrastructure is cut over to a Ryxen-branded domain.
window.__RYXEN_CONFIG__ = window.__RYXEN_CONFIG__ || {
  apiBaseUrl: '/api',
  nativeApiBaseUrl: 'https://crossapp-znmj.onrender.com',
  telemetryEnabled: true,
  auth: {
    googleClientId: '581596457498-9vrde3rt79ikqqm751v8bfhngemm2k23.apps.googleusercontent.com',
    appLinkBaseUrl: 'https://ryxen-app.vercel.app/auth/callback',
  },
  observability: {
    sentry: {
      dsn: '',
      environment: 'production',
      release: '',
    },
  },
  app: {
    rollout: {
      athleteReactShell: false,
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

window.__CROSSAPP_CONFIG__ = window.__CROSSAPP_CONFIG__ || window.__RYXEN_CONFIG__;
