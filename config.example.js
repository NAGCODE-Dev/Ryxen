window.__CROSSAPP_CONFIG__ = {
  apiBaseUrl: 'https://your-backend.up.railway.app',
  telemetryEnabled: true,
  billing: {
    provider: 'stripe',
    successUrl: 'https://your-frontend.vercel.app/coach/?billing=success',
    cancelUrl: 'https://your-frontend.vercel.app/coach/?billing=cancel',
  },
};
