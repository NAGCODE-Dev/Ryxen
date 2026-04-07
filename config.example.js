window.__RYXEN_CONFIG__ = {
  apiBaseUrl: 'https://your-backend.up.railway.app',
  nativeApiBaseUrl: 'https://your-backend.up.railway.app',
  telemetryEnabled: true,
  auth: {
    googleClientId: 'your-google-client-id.apps.googleusercontent.com',
  },
  observability: {
    sentry: {
      dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      environment: 'production',
      release: 'ryxen@1.0.0',
    },
  },
  billing: {
    provider: 'kiwify_link',
    successUrl: 'https://your-frontend.vercel.app/coach/?billing=success',
    cancelUrl: 'https://your-frontend.vercel.app/coach/?billing=cancel',
    links: {
      athlete_plus: 'https://checkout.kiwify.com.br/example-athlete-plus',
      starter: 'https://checkout.kiwify.com.br/example-starter',
      pro: 'https://checkout.kiwify.com.br/example-pro',
      coach: 'https://checkout.kiwify.com.br/example-coach',
      performance: 'https://checkout.kiwify.com.br/example-performance',
    },
  },
};

window.__CROSSAPP_CONFIG__ = window.__CROSSAPP_CONFIG__ || window.__RYXEN_CONFIG__;
