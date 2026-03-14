window.__CROSSAPP_CONFIG__ = {
  apiBaseUrl: 'https://your-backend.up.railway.app',
  telemetryEnabled: true,
  auth: {
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  },
  billing: {
    provider: 'kiwify_link', // stripe | mercadopago | kiwify_link
    successUrl: 'https://your-frontend.vercel.app/coach/?billing=success',
    cancelUrl: 'https://your-frontend.vercel.app/coach/?billing=cancel',
    links: {
      starter: 'https://checkout.kiwify.com.br/example-starter',
      pro: 'https://checkout.kiwify.com.br/example-pro',
      coach: 'https://checkout.kiwify.com.br/example-coach',
      performance: 'https://checkout.kiwify.com.br/example-performance',
    },
  },
};
