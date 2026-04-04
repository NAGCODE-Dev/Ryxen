# CrossApp Backend

Backend Node + Postgres para:
- autenticação
- billing (Kiwify link no frontend + webhook/postback opcional + mock local de desenvolvimento)
- telemetria
- reset de senha por código
- painel admin básico
- gyms, memberships e feed de treinos
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

Se você quiser apontar para outro backend, ajuste o `config.js` ou as variáveis de build do frontend (`CROSSAPP_API_BASE_URL`).

## Teste rápido de assinatura (modo mock)

1. Fazer signup/signin.
2. `POST /billing/mock/activate` existe apenas para a conta de desenvolvimento (`nagcode.contact@gmail.com`).
3. Consultar `GET /billing/status`.

## Reset de senha

- `POST /auth/request-password-reset`
- `POST /auth/confirm-password-reset`

Se `RESEND_API_KEY` estiver configurado, o backend usa Resend como provedor principal. Se não estiver, tenta SMTP. Se nenhum estiver configurado, usa Ethereal para preview de email. O preview/código só é exposto para a conta de desenvolvimento e apenas quando `EXPOSE_RESET_CODE=true`.

Resend + SMTP com fallback e fila:

```env
RESEND_API_KEY=
RESEND_FROM=onboarding@resend.dev

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

SMTP_FALLBACK_HOST=
SMTP_FALLBACK_PORT=587
SMTP_FALLBACK_SECURE=false
SMTP_FALLBACK_USER=
SMTP_FALLBACK_PASS=
SMTP_FALLBACK_FROM=

MAILER_VERIFY_TIMEOUT_MS=8000
MAILER_SEND_TIMEOUT_MS=12000
SMTP_CONNECTION_TIMEOUT_MS=8000
SMTP_GREETING_TIMEOUT_MS=8000
SMTP_SOCKET_TIMEOUT_MS=12000
EMAIL_JOB_RETRY_DELAY_MS=15000
EMAIL_JOB_SWEEP_INTERVAL_MS=30000
RETENTION_SWEEP_INTERVAL_MS=21600000
RETENTION_TELEMETRY_DAYS=30
RETENTION_OPS_DAYS=90
RETENTION_EMAIL_JOBS_DAYS=30
RETENTION_PASSWORD_RESET_DAYS=2
RETENTION_EMAIL_VERIFICATION_DAYS=2
RETENTION_SYNC_SNAPSHOT_KEEP_PER_USER=5
RETENTION_ACCOUNT_DELETION_DAYS=90
```

Notas:

- Em produção inicial, use `RESEND_FROM=onboarding@resend.dev` até validar domínio próprio no Resend.
- `SENTRY_DSN` é opcional. Se não tiver um DSN real, deixe vazio; não use `...`.
- O worker de retenção remove dados operacionais antigos automaticamente e mantém apenas os snapshots mais recentes por usuário.

## Admin

- O primeiro usuário criado vira admin automaticamente.
- Emails listados em `ADMIN_EMAILS` também viram admin.
- Endpoint: `GET /admin/overview`
- Health operacional: `GET /admin/ops/health`
- Reprocessar claim de billing: `POST /admin/billing/claims/:claimId/reprocess`
- Reenviar job de email: `POST /admin/email/jobs/:jobId/retry`

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

## CrossAI

O backend agora inclui uma base inicial da CrossAI com:

- prompts versionados em `backend/src/ai/prompts/*.txt`
- composição de camadas por endpoint
- resposta estruturada em JSON via OpenAI Responses API
- rotas prontas para atleta e coach

Configuração mínima:

```env
OPENAI_API_KEY=
CROSSAI_MODEL=gpt-5.4
CROSSAI_REASONING_EFFORT=medium
```

Memória esportiva inicial da CrossAI:

```sql
\i backend/sql/2026-04-04-crossai-memory.sql
```

Tabelas incluídas:

- `athlete_context`
  - preferências persistentes do atleta por modalidade
  - equipamento, limitações e notas curtas de contexto
- `crossai_insights`
  - respostas estruturadas da CrossAI salvas por usuário, modo e treino
  - request payload + response data/meta para reuso futuro

Persistência atual:

- toda rota `/ai/*` tenta salvar a resposta em `crossai_insights`
- se as tabelas ainda não existirem, o backend continua respondendo sem quebrar a IA

Contexto atual:

- `POST /ai/analyze-result` já consulta `buildCrossAiContext()`
- o contexto inclui:
  - `athlete_context` do usuário/modalidade
  - últimos `benchmark_results`
  - últimos `athlete_pr_records` quando o esporte é `cross`
  - últimos insights de `analyze-result`

Rotas disponíveis:

- `GET /ai/meta`
- `POST /ai/explain-workout`
- `POST /ai/strategy`
- `POST /ai/adapt-workout`
- `POST /ai/analyze-result`
- `POST /ai/compare-history`
- `POST /ai/import-workout`
- `POST /ai/competition-plan`
- `POST /ai/recovery-check`
- `POST /ai/coach-review`
- `POST /ai/chat-coach`
- `POST /ai/research-answer`
- `POST /ai/verify-study`

Todas exigem autenticação Bearer.

Envelope de resposta:

```json
{
  "ok": true,
  "mode": "strategy",
  "version": "v1",
  "data": {},
  "meta": {
    "model": "gpt-5.4",
    "generatedAt": "2026-04-04T00:00:00.000Z"
  }
}
```

Payload sugerido:

```json
{
  "message": "Analisa este WOD",
  "workout": {
    "title": "For time",
    "description": "21-15-9 thrusters e pull-ups"
  },
  "athleteProfile": {
    "level": "intermediate",
    "limitations": [],
    "goal": "competir melhor"
  },
  "history": [],
  "result": null,
  "assets": []
}
```

Contracts V1 prioritários:

- `POST /ai/explain-workout`
  - `data.summary`
  - `data.goal`
  - `data.stimulus`
  - `data.demands[]`
  - `data.commonMistakes[]`
  - `data.notes[]`
- `POST /ai/strategy`
  - `data.summary`
  - `data.opening`
  - `data.pacing[]`
  - `data.breakPlan[]`
  - `data.transitions[]`
  - `data.riskFlags[]`
  - `data.finish`
- `POST /ai/adapt-workout`
  - `data.summary`
  - `data.originalStimulus`
  - `data.adaptedWorkout[]`
  - `data.whyItWorks[]`
  - `data.scenarios.noEquipment[]`
  - `data.scenarios.beginner[]`
  - `data.scenarios.fatigued[]`
  - `data.warnings[]`
- `POST /ai/analyze-result`
  - `data.summary`
  - `data.strengths[]`
  - `data.mainLimiter`
  - `data.pacingRead`
  - `data.movementBreakdown[]`
  - `data.nextFocus[]`
  - `data.coachNote`
- `POST /ai/import-workout`
  - `data.summary`
  - `data.structuredWorkout.warmup[]`
  - `data.structuredWorkout.strength[]`
  - `data.structuredWorkout.skill[]`
  - `data.structuredWorkout.wod[]`
  - `data.structuredWorkout.accessories[]`
  - `data.structuredWorkout.notes[]`
  - `data.uncertainParts[]`
  - `data.detectedGoal`

Contract de conversa guiada:

- `POST /ai/chat-coach`
  - `data.reply`
  - `data.quickActions[]`
  - `data.tone` = `coach`
  - `data.focus[]`
  - `data.followUpPrompt`

Payload sugerido para conversa:

```json
{
  "message": "Hoje tô com a lombar cansada, mas quero fazer o treino bem. Como você faria?",
  "workout": {
    "title": "Treino do dia",
    "blocks": [
      { "title": "WOD", "lines": ["21-15-9 deadlift e burpees"] }
    ]
  },
  "athlete": {
    "level": "intermediate",
    "limitations": ["lombar cansada"],
    "goal": "treinar bem sem acumular risco"
  },
  "conversation": [
    { "role": "user", "content": "Ontem fiz terra pesado." },
    { "role": "assistant", "content": "Hoje vale controlar posterior e evitar ego no início." }
  ]
}
```

Contracts de evidência:

- `POST /ai/research-answer`
  - usa `file_search` com `CROSSAI_SCIENCE_VECTOR_STORE_IDS`
  - `data.answer`
  - `data.bottomLine`
  - `data.evidenceLevel`
  - `data.citations[]`
  - `data.caveats[]`

- `POST /ai/verify-study`
  - exige `fileId` ou `fileUrl`
  - `data.answer`
  - `data.verdict`
  - `data.evidenceLevel`
  - `data.citations[]`
  - `data.caveats[]`

Configuração adicional para biblioteca científica:

```env
CROSSAI_SCIENCE_VECTOR_STORE_IDS=vs_123,vs_456
```

Payload sugerido para pesquisa:

```json
{
  "question": "Treinar força e cardio no mesmo bloco atrapalha hipertrofia?",
  "sources": ["science-library"]
}
```

Payload sugerido para verificação:

```json
{
  "question": "Esse artigo realmente sustenta que HIIT piora ganho de força?",
  "fileId": "file_123"
}
```

Observações:

- sem `OPENAI_API_KEY`, as rotas `/ai/*` retornam `503`
- sem `CROSSAI_SCIENCE_VECTOR_STORE_IDS`, `POST /ai/research-answer` retorna `503`
- os contracts por tela ficam em `backend/src/ai/contracts.js`
- a composição de camadas fica em `backend/src/ai/presets.js`

Deploy recomendado:

- frontend no Vercel
- backend no Render
- banco no Supabase
- alternativa depois: Railway

Arquivos:

- `../render.yaml`
- `../docs/deploy/VERCEL_RENDER_SUPABASE.md`
- `.env.render.example`
- detalhes em `docs/deploy/VERCEL_RAILWAY.md`

Seeds:

- biblioteca organizada em `backend/src/benchmarks/girls.js`
- `backend/src/benchmarks/hero.js`
- `backend/src/benchmarks/open.js`

## Billing atual

- checkout externo por link da Kiwify no frontend
- webhook/postback opcional para ativação automática:
  - `POST /billing/kiwify/webhook`
- backend mantém:
  - `GET /billing/status`
  - `GET /billing/entitlements`
  - `POST /billing/mock/activate` para desenvolvimento

### Webhook Kiwify

Configuração mínima no backend:

```env
KIWIFY_WEBHOOK_TOKEN=troque-isto
KIWIFY_ACCOUNT_ID=
KIWIFY_CLIENT_ID=
KIWIFY_CLIENT_SECRET=
KIWIFY_PRODUCT_ATHLETE_PLUS_ID=
KIWIFY_PRODUCT_STARTER_ID=
KIWIFY_PRODUCT_PRO_ID=
KIWIFY_PRODUCT_PERFORMANCE_ID=
```

URL recomendada no painel da Kiwify:

```txt
https://SEU_BACKEND/billing/kiwify/webhook?token=SEU_TOKEN
```

O backend também aceita o token via header/body, então você pode usar o modo que a Kiwify expuser no painel.

Com isso:
- pagamento aprovado gera uma claim por email
- se o usuário já existir, o plano é ativado na hora
- se o usuário ainda não existir, a claim fica pendente e é aplicada no próximo signup/signin
- se a API nativa da Kiwify estiver configurada, o backend tenta validar a venda pela API oficial antes de aplicar a claim
