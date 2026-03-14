window.__CROSSAPP_CONFIG__ = {
  apiBaseUrl: 'https://your-backend.up.railway.app',
  telemetryEnabled: true,
  auth: {
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  },
  billing: {
    provider: 'stripe',
    successUrl: 'https://your-frontend.vercel.app/coach/?billing=success',
    cancelUrl: 'https://your-frontend.vercel.app/coach/?billing=cancel',
  },
};
