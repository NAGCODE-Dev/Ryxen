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

## Billing (Stripe / Mercado Pago)
- `GET /billing/status`
  - response: `{ plan, status, renewAt, provider }`
- `POST /billing/checkout`
  - body: `{ planId, provider, successUrl, cancelUrl }`
  - response: `{ checkoutUrl }`
- `GET /billing/entitlements`
  - response: `{ entitlements: string[] }`

## Sync
- `POST /sync/push`
  - body: `{ payload }`
  - response: `{ snapshotId, savedAt }`
- `GET /sync/pull`
  - response: `{ payload, snapshotId, savedAt }`
- `GET /sync/snapshots`
  - response: `{ snapshots: [{ id, savedAt }] }`

## Telemetry
- `POST /telemetry/ingest`
  - body: `{ items: [...] }`
  - response: `{ success: true }`

## Security Notes
- JWT com expiração curta + refresh token rotativo.
- Webhooks de cobrança obrigatórios para status real de assinatura.
- Idempotência nos endpoints de checkout e sync.
