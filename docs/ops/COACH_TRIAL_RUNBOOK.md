# Coach Trial Runbook

Nota:
- as envs do fluxo continuam com prefixo `CROSSAPP_` por compatibilidade com scripts já publicados, mesmo após o rebranding para Ryxen.

## Objetivo

Preparar e acompanhar uma semana de uso real por um coach sem improviso operacional.

## Preparação

1. Publicar frontend, backend e banco.
2. Rodar migrations.
3. Configurar o provider de cobrança.
   - Se usar `Kiwify`, preencher os links de checkout no frontend.
   - No início, a liberação do plano pode ser manual após confirmação do pagamento.
3. Popular ambiente com dados de teste:

```bash
export CROSSAPP_API_BASE_URL=https://seu-backend
export CROSSAPP_COACH_EMAIL=coach@dominio.com
export CROSSAPP_COACH_PASSWORD='SenhaForte123'
npm run seed:coach-trial
```

4. Validar ambiente:

```bash
export CROSSAPP_API_BASE_URL=https://seu-backend
export CROSSAPP_COACH_EMAIL=coach@dominio.com
export CROSSAPP_COACH_PASSWORD='SenhaForte123'
export CROSSAPP_ATHLETE_EMAIL=athlete1.test@ryxen.local
export CROSSAPP_ATHLETE_PASSWORD='Athlete123'
npm run smoke:coach-trial
```

## Roteiro do coach

O coach deve conseguir:

1. Entrar no app.
2. Abrir o Coach Portal.
3. Ver atletas e grupos.
4. Publicar treino para:
   - todos
   - específico
   - grupo
5. Ver competição/evento.

## Roteiro do atleta

O atleta deve conseguir:

1. Entrar no app.
2. Ver treino do dia.
3. Ver histórico e conta do atleta.
4. Abrir conta.
5. Testar sync e backup.

## Regra de treino

- Se existir planilha multi-dia enviada pelo atleta, ela é a prioridade.
- Se também existir treino do coach para o mesmo dia, aparece alternância manual.
- Se não existir planilha multi-dia, o treino do coach pode assumir automaticamente.

## O que monitorar durante a semana

- `/health`
- logs 4xx/5xx do backend
- falhas de login
- falhas de publicação de treino
- falhas de sync
- falhas de import PDF/OCR
- abertura correta do checkout do coach
- tempo entre pagamento confirmado e acesso liberado

## Quando pausar o teste

Pausar se ocorrer qualquer um:

- login quebrado
- treino não chega ao atleta
- sync apaga semanas/PRs
- publicação do coach falha de forma recorrente
- interface mobile inviabiliza uso
