# Deploy recomendado

Nota:
- as variáveis `CROSSAPP_*` abaixo continuam com prefixo legado para preservar compatibilidade com o pipeline atual de build.

Arquitetura recomendada para este projeto:

1. Frontend atleta + Coach Portal: `Vercel`
2. Backend Node/Express: `Railway`
3. Banco: `Postgres gerenciado` no Railway ou provedor equivalente

## Motivo

- o frontend é estático e encaixa bem no Vercel
- o backend precisa de processo Node persistente e conexão Postgres
- separar frontend e backend reduz acoplamento operacional

## Frontend no Vercel

Arquivos usados:

- `vercel.json`
- `config.js`
- `config.example.js`
- `scripts/build-static.mjs`

### Passos

1. Subir este repositório no GitHub
2. Importar o projeto no Vercel
3. Configurar o projeto como `Other`
4. Build command: `npm run build`
5. Output directory: `dist`

### Variáveis de ambiente do Vercel

Defina:

```env
CROSSAPP_API_BASE_URL=https://your-backend.up.railway.app
CROSSAPP_TELEMETRY_ENABLED=true
CROSSAPP_BILLING_PROVIDER=kiwify_link
CROSSAPP_BILLING_SUCCESS_URL=https://your-frontend.vercel.app/coach/?billing=success
CROSSAPP_BILLING_CANCEL_URL=https://your-frontend.vercel.app/coach/?billing=cancel
CROSSAPP_KIWIFY_CHECKOUT_STARTER_URL=
CROSSAPP_KIWIFY_CHECKOUT_PRO_URL=
CROSSAPP_KIWIFY_CHECKOUT_COACH_URL=
CROSSAPP_KIWIFY_CHECKOUT_PERFORMANCE_URL=
```

### Configuração do frontend

O build gera `dist/config.js` a partir das variáveis acima.

Se quiser rodar sem build, use `config.example.js` como referência:

```js
window.__CROSSAPP_CONFIG__ = {
  apiBaseUrl: 'https://your-backend.up.railway.app',
  telemetryEnabled: true,
  billing: {
    provider: 'kiwify_link',
    successUrl: 'https://your-frontend.vercel.app/coach/?billing=success',
    cancelUrl: 'https://your-frontend.vercel.app/coach/?billing=cancel',
  },
};
```

## Backend no Railway

Arquivo usado:

- `backend/Dockerfile`

### Passos

1. Criar novo projeto no Railway
2. Adicionar serviço `PostgreSQL`
3. Adicionar serviço a partir do diretório `backend/`
4. Usar `Dockerfile`
5. Definir as variáveis:

```env
PORT=8787
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=troque-isto
FRONTEND_ORIGIN=https://your-frontend.vercel.app
SUPPORT_EMAIL=nagcode.contact@gmail.com
ADMIN_EMAILS=nagcode.contact@gmail.com
EXPOSE_RESET_CODE=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=nagcode.contact@gmail.com
```

Use `EXPOSE_RESET_CODE=false` em qualquer ambiente publicado. O modo com código exposto deve ficar restrito ao desenvolvimento local.

### Healthcheck

Depois do deploy:

```bash
curl https://your-backend.up.railway.app/health
```

## Billing atual

Use links da Kiwify configurados nas envs do frontend. O backend não precisa de webhook de cobrança no estado atual.

## Pós-deploy

Checklist:

1. abrir `https://your-frontend.vercel.app`
2. abrir `https://your-frontend.vercel.app/coach/`
3. criar conta
4. criar gym
5. ativar plano local ou abrir checkout Kiwify
6. publicar treino
7. validar `GET /health`
8. validar login, benchmark, competição e rankings
