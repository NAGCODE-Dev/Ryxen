# Plano Mestre do Rebuild Ryxen

## Resumo executivo

Este documento passa a ser a fonte canônica do rebuild.

North star:

```txt
coach cria conta -> entra no portal -> publica treino -> atleta entra no app -> vê treino -> registra resultado -> coach percebe retorno
```

Tudo que não aproxima esse loop de produção entra depois.

## Estado real do repo

- `apps/api` já possui base funcional de auth, billing e snapshots do atleta.
- `apps/coach-web` e `apps/athlete-mobile` eram placeholders e agora passam a carregar o primeiro fluxo vivo.
- `apps/marketing-web` já cumpre a função inicial de superfície pública.
- O legado continua sendo referência funcional e de schema.

## Ordem de implementação

### Fase 1. API como núcleo real

- completar auth do rebuild:
  - signup
  - signup confirm
  - signin
  - password reset request
  - password reset confirm
- manter billing status, entitlements e checkout
- adicionar `coach/onboarding`, `gyms`, publicação de `workouts`
- adicionar leitura do treino do dia e submissão de retorno do atleta

### Fase 2. Coach-first

- coach entra sem ajuda
- cria o primeiro gym
- publica o primeiro treino
- recebe confirmação clara do que acabou de acontecer

### Fase 3. Athlete app funcional

- atleta autentica
- restaura snapshots mínimos
- abre a tela Today
- recebe treino publicado
- registra um retorno simples

### Fase 4. Paridade essencial

- trusted device
- password reset support
- import flows principais
- running e strength reais
- benchmark history e feed expandido

### Fase 5. Só depois do produto vivo

- admin/ops completos
- Nyx tour completo
- automações mais sofisticadas de billing
- parity expandida das superfícies secundárias

## Contratos públicos principais

- `packages/contracts/src/auth.ts`
- `packages/contracts/src/athlete.ts`
- `packages/contracts/src/billing.ts`
- `packages/contracts/src/coach.ts`

Novos snapshots centrais:

- `coach onboarding snapshot`
- `gym summary`
- `workout summary`
- `athlete today workout`
- `athlete workout result`

Regra:

- contrato primeiro
- parse na borda da API
- UI consumindo snapshots prontos

## Critérios de desligamento do legado

Uma superfície só pode perder responsabilidade quando:

- o fluxo equivalente existe no rebuild
- contratos e comportamento crítico estão cobertos por teste
- o fluxo foi exercitado em ambiente real
- existe observabilidade mínima
- fallback e rollback estão claros

Sequência recomendada:

1. marketing pública
2. coach auth + billing
3. coach publish flow
4. athlete auth + today/feed
5. snapshots antigos de athlete/billing
6. admin/ops por último

## Testes obrigatórios

### Contratos e domínio

- schemas aceitam payload válido e rejeitam payload inválido
- access policy cobre ativo, grace e bloqueado
- gym access e benefit tier não regressam
- sync escolhe snapshot mais novo corretamente

### API

- signup, confirm, signin, refresh, signout, reset
- billing status e entitlements
- snapshots de imported plan, app state, PRs e measurements
- publish de workout
- leitura do treino do atleta
- submissão de retorno

### Superfícies

- coach entra e publica treino sem ajuda
- atleta entra e vê treino publicado
- atleta registra resultado
- coach consegue ver que houve retorno

## Defaults oficiais

- estratégia do rebuild: `coach-first`
- o valor imediato vem do loop coach -> athlete funcionando
- `coach-web` e `athlete-mobile` são prioridade acima de expansão arquitetural abstrata
- o plano único substitui todos os docs fragmentados anteriores
