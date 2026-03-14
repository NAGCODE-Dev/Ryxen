# CrossApp Backend

Backend Node + Postgres para:
- autenticação
- billing (mock pronto para plugar Stripe/Mercado Pago)
- sync entre dispositivos
- telemetria
- reset de senha por código
- painel admin básico
- gyms, memberships e feed de treinos
- Stripe checkout e webhook
- benchmark library

## Rodar com Docker (recomendado)

No diretório raiz do projeto:

```bash
docker compose up -d
```

Frontend: `http://localhost:8000`  
API via nginx: `http://localhost:8000/api`  
Backend direto: `http://localhost:8787`  
Postgres: `localhost:5432`

## Rodar local sem Docker

```bash
cd backend
cp .env.example .env
npm install
npm run start
```

## Configuração no frontend

Com Docker, nenhuma configuração manual é necessária. O frontend usa `/api` por padrão e o nginx faz proxy para o backend.

Se você quiser apontar para outro backend, use no console do app:

```js
__APP__.setRuntimeConfig({
  apiBaseUrl: 'https://sua-api.example.com',
  billing: {
    provider: 'stripe'
  }
})
```

## Teste rápido de assinatura (modo mock)

1. Fazer signup/signin.
2. Chamar endpoint `POST /billing/mock/activate` com Bearer token.
3. Consultar `GET /billing/status`.

## Reset de senha

- `POST /auth/request-password-reset`
- `POST /auth/confirm-password-reset`

Se SMTP não estiver configurado, o backend usa Ethereal para preview de email e pode expor o código quando `EXPOSE_RESET_CODE=true`.

## Admin

- O primeiro usuário criado vira admin automaticamente.
- Emails listados em `ADMIN_EMAILS` também viram admin.
- Endpoint: `GET /admin/overview`

## Gyms / Coach / Athlete

Endpoints principais:

- `POST /gyms`
- `GET /gyms/me`
- `POST /gyms/:gymId/memberships`
- `GET /gyms/:gymId/memberships`
- `POST /gyms/:gymId/workouts`
- `GET /workouts/feed`
- `GET /access/context`
- `GET /benchmarks`
- `GET /competitions/calendar`
- `POST /gyms/:gymId/competitions`
- `POST /competitions/:competitionId/events`
- `POST /benchmarks/:slug/results`
- `GET /leaderboards/benchmarks/:slug`

Parâmetros úteis em `GET /benchmarks`:

- `q`
- `category`
- `source`
- `sort` com `year_desc`, `year_asc`, `name_asc`, `name_desc`, `category_asc`
- `page`
- `limit`

Regra de acesso:

- o coach/owner precisa ter assinatura ativa para publicar treinos
- atletas só recebem feed quando a assinatura do coach permite uso do app
- após vencimento, a assinatura entra em janela de grace antes do bloqueio total

Frontend dedicado:

- Coach Portal: `http://localhost:8000/coach/`

Seeds:

- biblioteca organizada em `backend/src/benchmarks/girls.js`
- `backend/src/benchmarks/hero.js`
- `backend/src/benchmarks/open.js`

## Stripe

Configuração por env:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_COACH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_STARTER`

Rotas:

- `POST /billing/checkout`
- `POST /billing/webhook`

Quando configurado, o checkout cria sessão real de assinatura e o webhook atualiza o status salvo no banco.
