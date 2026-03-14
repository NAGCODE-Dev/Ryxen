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
- Billing Stripe com webhook e bloqueio automático do coach
- Grace period de assinatura com estados de acesso para coach/atleta
- Biblioteca de benchmarks com seed expandido, filtros e feed enriquecido
- Resultados de benchmark com leaderboard por slug/gym
- Calendário de competições com eventos vinculados a benchmark
- Telemetria com consentimento
- Base pronta para billing via Stripe/Mercado Pago
- Página pública de planos em `pricing.html`

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

## Testes

```bash
npm test
```

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

- Em ambiente local, o backend pode expor o código na resposta se `EXPOSE_RESET_CODE=true`.
- Se SMTP não estiver configurado, o backend usa conta de teste Ethereal e retorna `previewUrl` quando possível.

## Configuração importante

Backend `.env`:

```env
PORT=8787
DATABASE_URL=postgres://crossapp:crossapp@localhost:5432/crossapp
JWT_SECRET=change-me
FRONTEND_ORIGIN=http://localhost:8000
SUPPORT_EMAIL=nagcode.contact@gmail.com
ADMIN_EMAILS=nagcode.contact@gmail.com
EXPOSE_RESET_CODE=true
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=nagcode.contact@gmail.com
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_COACH=
STRIPE_PRICE_PRO=
STRIPE_PRICE_STARTER=
```

## Coach Portal

Na UI da conta, o Coach Portal já expõe:

- status da assinatura
- criação de gym
- gestão de membros
- publicação de treino
- benchmark library
- feed do app

Tudo via `window.__APP__` e APIs do backend.

Portal separado em framework:

- URL: `/coach/`
- frontend: [coach/index.html](/home/nagc/Downloads/CrossApp/coach/index.html)
- runtime: [coach/main.js](/home/nagc/Downloads/CrossApp/coach/main.js)

## Documentação complementar

- Backend/API: `docs/ops/BACKEND_INTEGRATION.md`
- Release/Rollback: `docs/ops/RELEASE_ROLLBACK_RUNBOOK.md`
- Suporte: `docs/ops/SUPPORT_PLAYBOOK.md`
