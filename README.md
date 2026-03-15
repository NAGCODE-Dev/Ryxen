# CrossApp

PWA para importar programação de treino, calcular cargas, manter PRs, operar offline e sincronizar conta entre dispositivos.

## Stack

- Frontend: HTML, CSS, JavaScript modular
- PWA: `manifest.json` + `sw.js`
- Parsing: PDF.js + OCR para imagem/vídeo
- Persistência local: `localStorage` e `IndexedDB`
- Backend: Node.js + Express + Postgres

## Funcionalidades

- Importação de `PDF`, `txt`, `csv`, `json`, imagem e vídeo
- Cálculo automático de cargas a partir de PRs
- Backup e restauração completos
- Login, cadastro e sync remoto
- Estrutura multi-tenant para `gym / coach / athlete`
- Publicação de treinos do coach para atletas do gym
- Reset de senha com código temporário
- Painel admin básico para usuários/assinaturas
- Billing via link externo da Kiwify e ativação local de desenvolvimento
- Grace period de assinatura com estados de acesso para coach/atleta
- Biblioteca de benchmarks com seed expandido, filtros e feed enriquecido
- Resultados de benchmark com leaderboard por slug/gym
- Calendário de competições com eventos vinculados a benchmark
- Ranking por evento e ranking agregado por competição
- Telemetria com consentimento
- Base pronta para billing via Kiwify link
- Página pública de planos em `pricing.html`
- `config.js` para apontar o frontend para backend externo em produção

## Estrutura real do projeto

```text
.
├── backend/
│   └── src/
├── docs/
├── src/
│   ├── adapters/
│   ├── config/
│   ├── core/
│   ├── data/
│   ├── libs/
│   └── ui/
├── __tests__/
├── docker-compose.yml
├── nginx.conf
├── sw.js
└── index.html
```

## Rodar local

### Com Docker

```bash
docker compose up -d
```

- App: `http://localhost:8000`
- API via nginx: `http://localhost:8000/api`
- Backend direto: `http://localhost:8787`
- Postgres: `localhost:5432`

### Sem Docker

Frontend:

```bash
python -m http.server 8000
```

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run start
```

## Deploy recomendado

- frontend atleta + coach portal: `Vercel`
- backend: `Render`
- banco: `Supabase Postgres`
- alternativa depois: `Railway`

Arquivos relevantes:

- `vercel.json`
- `.env.vercel.example`
- `config.js`
- `config.example.js`
- `scripts/build-static.mjs`
- `backend/Dockerfile`
- `render.yaml`
- `backend/railway.json`
- `docs/deploy/VERCEL_RENDER_SUPABASE.md`
- `docs/deploy/VERCEL_RAILWAY.md`

## Testes

```bash
npm test
```

## Semana de teste do coach

Seed inicial de ambiente:

```bash
npm run seed:coach-trial
```

Smoke test automático:

```bash
npm run smoke:coach-trial
```

Documentos operacionais:

- `docs/ops/COACH_TRIAL_WEEK_CHECKLIST.md`
- `docs/ops/COACH_TRIAL_RUNBOOK.md`

## Conta admin local

- O primeiro usuário criado vira admin.
- O email `nagcode.contact@gmail.com` também recebe perfil admin por padrão.

## Multi-tenant

APIs já preparadas para:

- criar `gym`
- adicionar `coach` ou `athlete` ao gym
- publicar treino para o gym
- consultar feed de treinos do atleta
- consultar contexto de acesso baseado na assinatura do coach

## Benchmarks

- Seed inicial organizada por categoria em `backend/src/benchmarks/`
- Cobertura atual: `Girls`, `Hero` e `Open`
- Busca com paginação e ordenação via `GET /benchmarks?q=&category=&source=&sort=&page=&limit=`
- Coach Portal já consome filtros por categoria, fonte e ordenação

## Reset de senha

- Em ambiente local, o backend só expõe o código na resposta para a conta de desenvolvimento e apenas se `EXPOSE_RESET_CODE=true`.
- Se SMTP não estiver configurado, o backend usa conta de teste Ethereal e retorna `previewUrl` quando possível.

## Configuração importante

Backend `.env`:

```env
PORT=8787
DATABASE_URL=postgres://crossapp:crossapp@localhost:5432/crossapp
JWT_SECRET=troque-por-uma-chave-forte
FRONTEND_ORIGIN=http://localhost:8000
SUPPORT_EMAIL=nagcode.contact@gmail.com
ADMIN_EMAILS=nagcode.contact@gmail.com
EXPOSE_RESET_CODE=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=nagcode.contact@gmail.com
BACKEND_PUBLIC_URL=http://localhost:8787
KIWIFY_WEBHOOK_TOKEN=
KIWIFY_ACCOUNT_ID=
KIWIFY_CLIENT_ID=
KIWIFY_CLIENT_SECRET=
KIWIFY_PRODUCT_ATHLETE_PLUS_ID=
KIWIFY_PRODUCT_STARTER_ID=
KIWIFY_PRODUCT_PRO_ID=
KIWIFY_PRODUCT_PERFORMANCE_ID=
```

Frontend/Vercel:

```env
CROSSAPP_API_BASE_URL=http://localhost:8787
CROSSAPP_BILLING_PROVIDER=kiwify_link
CROSSAPP_BILLING_SUCCESS_URL=http://localhost:8000/coach/?billing=success
CROSSAPP_BILLING_CANCEL_URL=http://localhost:8000/coach/?billing=cancel
CROSSAPP_KIWIFY_CHECKOUT_ATHLETE_PLUS_URL=
CROSSAPP_KIWIFY_CHECKOUT_STARTER_URL=
CROSSAPP_KIWIFY_CHECKOUT_PRO_URL=
CROSSAPP_KIWIFY_CHECKOUT_COACH_URL=
CROSSAPP_KIWIFY_CHECKOUT_PERFORMANCE_URL=
```

## Coach Portal

O Coach Portal é um frontend separado em `/coach/`. O app do atleta continua livre; o módulo do coach cobre operação do box e assinatura.

No portal do coach já existem:

- status da assinatura
- criação de gym
- gestão de membros
- publicação de treino
- benchmark library
- feed do app

Tudo via `window.__APP__` e APIs do backend.

Rankings disponíveis:

- `GET /leaderboards/benchmarks/:slug`
- `GET /leaderboards/events/:eventId`
- `GET /leaderboards/competitions/:competitionId`

Portal separado em framework:

- URL: `/coach/`
- frontend: [coach/index.html](/home/nagc/Downloads/CrossApp/coach/index.html)
- runtime: [coach/main.js](/home/nagc/Downloads/CrossApp/coach/main.js)

## Documentação complementar

- Backend/API: `docs/ops/BACKEND_INTEGRATION.md`
- Release/Rollback: `docs/ops/RELEASE_ROLLBACK_RUNBOOK.md`
- Suporte: `docs/ops/SUPPORT_PLAYBOOK.md`
- Deploy recomendado: `docs/deploy/VERCEL_RAILWAY.md`
- Deploy sem custo inicial: `docs/deploy/VERCEL_RENDER_SUPABASE.md`
