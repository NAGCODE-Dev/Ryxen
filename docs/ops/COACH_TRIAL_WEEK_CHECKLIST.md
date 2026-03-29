# Coach Trial Week Checklist

Checklist objetivo para liberar o app para 1 semana de teste com coach real.

## 1. Infraestrutura

- [ ] Frontend publicado
- [ ] Backend publicado
- [ ] Banco conectado
- [ ] `GET /health` respondendo `ok: true`
- [ ] `FRONTEND_ORIGIN` apontando para o frontend real
- [ ] `JWT_SECRET` forte configurado
- [ ] `EXPOSE_RESET_CODE=false`
- [ ] SMTP ou Resend configurado para signup e reset de senha

## 2. Conta do coach

- [ ] Conta do coach criada
- [ ] Coach consegue login
- [ ] Coach possui gym criado
- [ ] Coach consegue abrir `/coach/`

## 3. Assinatura

- [ ] Definido se a semana usa link Kiwify, mock local ou outro provider
- [ ] Coach tem acesso ativo para publicar treinos
- [ ] `billing/status` retorna plano/status esperados
- [ ] Botão `Assinar Coach` abre o checkout correto
- [ ] Fluxo manual de validação do pagamento está combinado

## 4. Seed inicial

- [ ] Rodado `npm run seed:coach-trial`
- [ ] Existem ao menos 3 atletas no gym
- [ ] Existe ao menos 1 grupo
- [ ] Existem treinos publicados

## 5. Smoke técnico

- [ ] Rodado `npm run smoke:coach-trial`
- [ ] Feed do atleta está carregando
- [ ] Dashboard do atleta está carregando
- [ ] Insights do coach estão carregando
- [ ] Benchmarks estão carregando

## 6. Fluxos do coach

- [ ] Publicar treino para todos
- [ ] Publicar treino para atletas específicos
- [ ] Publicar treino para grupo
- [ ] Criar grupo novo
- [ ] Adicionar membro novo

## 7. Fluxos do atleta

- [ ] Login ok
- [ ] Feed ok
- [ ] Histórico ok
- [ ] Conta ok
- [ ] Backup/export ok
- [ ] Sync automático ok

## 8. Prioridade do treino

- [ ] Atleta sem planilha local recebe treino do coach
- [ ] Atleta com planilha multi-dia mantém a planilha como prioridade
- [ ] Toggle entre `Planilha enviada` e `Treino do coach` aparece quando ambos existem
- [ ] Treino do coach expira e some conforme a regra

## 9. Mobile

- [ ] Testado em 1 Android pequeno
- [ ] Testado em 1 Android maior
- [ ] Página `Hoje` ok
- [ ] Página `Histórico` ok
- [ ] Página `Conta` ok
- [ ] Coach Portal legível no celular

## 10. Suporte

- [ ] Coach sabe o canal de reporte
- [ ] `nagcode.contact@gmail.com` visível onde necessário
- [ ] Runbook de suporte conhecido

## 11. Telemetria e logs

- [ ] Consentimento de telemetria aparece
- [ ] Erros do frontend chegam na fila de telemetria
- [ ] Backend registra requests 4xx/5xx com `requestId`

## 12. Critério para iniciar a semana

Só liberar o coach se:

- [ ] Itens 1 a 5 estiverem completos
- [ ] Nenhum fluxo principal falhar manualmente
- [ ] Coach entender como alternar entre treino local e treino do coach

## 13. Critério para encerrar a semana

Coletar:

- [ ] Bugs encontrados
- [ ] Horários de falha
- [ ] Prints/vídeos
- [ ] Dispositivo usado
- [ ] Fluxo que estava sendo executado
