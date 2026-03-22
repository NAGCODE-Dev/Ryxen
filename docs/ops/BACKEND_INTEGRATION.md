# Backend Integration Contract

## Auth
- `POST /auth/signup`
  - body: `{ email, password, name? }`
  - response: `{ token, user }`
- `POST /auth/signin`
  - body: `{ email, password }`
  - response: `{ token, user }`
- `POST /auth/refresh`
  - response: `{ token, user }`
- `POST /auth/signout`

## Billing
- `GET /billing/status`
  - response: `{ plan, status, renewAt, provider }`
- `POST /billing/checkout`
  - body: `{ planId, provider, successUrl, cancelUrl }`
  - response: `{ checkoutUrl }`
- `GET /billing/entitlements`
  - response: `{ entitlements: string[] }`

## Telemetry
- `POST /telemetry/ingest`
  - body: `{ items: [...] }`
  - response: `{ success: true }`

## Security Notes
- JWT com expiração curta + refresh token rotativo.
- Billing externo via Kiwify link não depende de webhook no backend atual.
- Idempotência nos endpoints de checkout.
