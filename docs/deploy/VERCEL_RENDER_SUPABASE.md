# Deploy recomendado sem custo inicial

Nota:
- as variáveis `CROSSAPP_*` abaixo continuam com prefixo legado para preservar compatibilidade com o pipeline atual de build.

Arquitetura recomendada para validar o produto sem custo imediato:

1. Frontend atleta + Coach Portal: `Vercel`
2. Backend Node/Express: `Render`
3. Banco: `Supabase Postgres`

## Motivo

- Vercel encaixa bem no frontend estático
- Render permite subir o backend com plano inicial gratuito
- Supabase entrega Postgres gerenciado com onboarding simples

## Frontend no Vercel

### Configuração

- Framework preset: `Other`
- Build command: `npm run build`
- Output directory: `dist`

### Variáveis do Vercel

```env
CROSSAPP_API_BASE_URL=https://your-backend.onrender.com
CROSSAPP_TELEMETRY_ENABLED=true
CROSSAPP_BILLING_PROVIDER=kiwify_link
CROSSAPP_BILLING_SUCCESS_URL=https://your-frontend.vercel.app/coach/?billing=success
CROSSAPP_BILLING_CANCEL_URL=https://your-frontend.vercel.app/coach/?billing=cancel
CROSSAPP_KIWIFY_CHECKOUT_STARTER_URL=
CROSSAPP_KIWIFY_CHECKOUT_PRO_URL=
CROSSAPP_KIWIFY_CHECKOUT_COACH_URL=
CROSSAPP_KIWIFY_CHECKOUT_PERFORMANCE_URL=
```

Arquivo de referência no repositório:

- `.env.vercel.example`

## Banco no Supabase

1. Criar projeto no Supabase
2. Abrir `Project Settings -> Database`
3. Copiar a `Connection string`
4. Usar essa URL em `DATABASE_URL`

Formato esperado:

```env
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

## Backend no Render

Arquivos usados:

- `backend/Dockerfile`
- `render.yaml`
- `backend/.env.render.example`

### Opção 1: Blueprint

1. Subir o repositório no GitHub
2. No Render, escolher `New +`
3. `Blueprint`
4. Selecionar o repositório
5. O Render lê `render.yaml`

### Opção 2: Web Service manual

1. `New +`
2. `Web Service`
3. Conectar GitHub
4. Selecionar o repositório
5. Configurar:
   - Root Directory: `backend`
   - Runtime: `Docker`

### Variáveis do Render

```env
PORT=8787
DATABASE_URL=<connection string do Supabase>
JWT_SECRET=troque-isto
FRONTEND_ORIGIN=https://your-frontend.vercel.app
SUPPORT_EMAIL=nagcode.contact@gmail.com
ADMIN_EMAILS=nagcode.contact@gmail.com
DEV_EMAILS=nagcode.contact@gmail.com
EXPOSE_RESET_CODE=false
BACKEND_PUBLIC_URL=https://your-backend.onrender.com
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=nagcode.contact@gmail.com
KIWIFY_WEBHOOK_TOKEN=troque-isto
KIWIFY_PRODUCT_STARTER_ID=
KIWIFY_PRODUCT_PRO_ID=
KIWIFY_PRODUCT_PERFORMANCE_ID=
```

Mantenha `EXPOSE_RESET_CODE=false` em Render, staging e produção. Expor o código na resposta é aceitável apenas em desenvolvimento local controlado.

### Teste

Depois do deploy:

```bash
curl https://your-backend.onrender.com/health
```

## Ligar frontend e backend

Depois que o Render subir:

1. copiar a URL pública do backend
2. configurar `CROSSAPP_API_BASE_URL` no Vercel
3. redeploy do frontend

## Billing atual

O projeto usa `kiwify_link` no frontend para abrir checkout externo por plano.

Para liberar o plano automaticamente após o pagamento:

1. configure `KIWIFY_WEBHOOK_TOKEN` no Render
2. opcionalmente preencha os `KIWIFY_PRODUCT_*_ID`
3. crie o webhook na Kiwify apontando para:

```txt
https://your-backend.onrender.com/billing/kiwify/webhook?token=SEU_TOKEN
```

Se os IDs dos produtos não forem informados, o backend tenta mapear o plano pelo nome do produto (`Starter`, `Pro`, `Performance`).

## Limitação do plano gratuito

- o backend pode “dormir”
- primeira resposta pode ser lenta após inatividade
- serve para validação inicial, não para operação em escala
