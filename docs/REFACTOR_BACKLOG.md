# Ryxen Refactor Backlog

## Objetivo

Sair de uma base web única com fronteiras implícitas e chegar em uma plataforma com superfícies claras:

- athlete app
- coach portal
- hub público
- backend por casos de uso
- shared contracts reutilizáveis

## Status geral

- `done`
  - entrypoints públicos separados em `apps/`
  - `packages/shared-web/` criado para runtime/auth/api client
  - coach portal migrado para shared runtime/auth
  - runtime nativo endurecido para device real vs emulator
  - coach portal buildado localmente, sem `esm.sh`
  - service worker atualizado para app instalado
  - `validate:stack` criado
  - `running` e `strength` agora usam shell compartilhado de bootstrap/auth/feed
- `in_progress`
  - extração gradual de shared frontend além de auth/runtime
  - redução do acoplamento do app do atleta ao `src/` legado
  - separar backend por query services / write services
  - separar `apps/athlete` como shell próprio e deixar `src/main.js` como compat layer
- `pending`
  - mover atleta principal para árvore de componentes mais previsível
  - testar offline/PWA de forma explícita

## Fase 1. Fronteiras do frontend

- `done` Criar `apps/hub`, `apps/athlete`, `apps/running`, `apps/strength`
- `done` Criar `packages/shared-web/runtime.js`
- `done` Criar `packages/shared-web/auth.js`
- `done` Criar `packages/shared-web/api-client.js`
- `done` Direcionar `index.html` e `sports/*` para `apps/`
- `done` Atualizar build estático para copiar `apps/` e `packages/`
- `done` Atualizar service worker para cachear novas fronteiras

## Fase 2. Shared athlete surfaces

- `done` Criar `packages/shared-web/athlete-services.js`
- `done` Criar `packages/shared-web/modality-shell.js`
- `done` Migrar `sports/running/main.js` para o shell compartilhado
- `done` Migrar `sports/strength/main.js` para o shell compartilhado
- `pending` Extrair componentes utilitários comuns de `running` e `strength`
- `pending` Mover `running` e `strength` para `apps/athlete/sports/*`
- `pending` Criar shared layout do atleta para modalidades derivadas

## Fase 3. Athlete app principal

- `done` Separar `src/main.js` em shell do atleta vs bridge legado
- `in_progress` Tirar `src/ui/ui.js` do papel de orquestrador global
  - `done` mover persistência/sync do estado de UI e event log para `apps/athlete/services/uiController.js`
  - `done` mover fila de render, signatures e cache de HTML para `apps/athlete/services/renderController.js`
  - `done` mover montagem principal da UI para `apps/athlete/mountUi.js` e manter `src/ui/ui.js` como compat layer
  - `done` extrair helpers de snapshot/profile/event log de `apps/athlete/services/uiController.js` para `apps/athlete/services/uiControllerHelpers.js`
  - `done` extrair cache/identidade/signatures de `apps/athlete/services/renderController.js` para `apps/athlete/services/renderControllerHelpers.js`
- `in_progress` Tirar `src/ui/actions.js` do papel de roteador absoluto do atleta
- `in_progress` Tirar `src/ui/actions.js` do papel de roteador absoluto do atleta
  - `done` extrair fluxo de Google Sign-In para `apps/athlete/features/account/googleSignIn.js`
  - `done` extrair guard/check de importação para `apps/athlete/features/import/guards.js`
  - `done` extrair handler `exercise:help` para `apps/athlete/features/actions/router.js`
  - `done` mover setup/orquestração principal de ações para `apps/athlete/features/actions/setup.js` e manter `src/ui/actions.js` como compat layer
  - `done` extrair helpers de bridge/UI e bootstrap de checkout de `apps/athlete/features/actions/setup.js` para `apps/athlete/features/actions/setupHelpers.js`
  - `done` extrair roteamento de click delegado de `apps/athlete/features/actions/setup.js` para `apps/athlete/features/actions/setupHelpers.js`
  - `done` extrair registro de listeners de `apps/athlete/features/actions/setup.js` para `apps/athlete/features/actions/setupHelpers.js`
  - `done` extrair fluxos de reset de senha de `apps/athlete/features/account/authActions.js` para `apps/athlete/features/account/authResetActions.js`
  - `done` extrair switch/signup/login de `apps/athlete/features/account/authActions.js` para `apps/athlete/features/account/authFlowActions.js`
  - `done` extrair ações admin de `apps/athlete/features/account/pageActions.js` para `apps/athlete/features/account/adminActions.js`
  - `done` extrair navegação/refresh/signout de `apps/athlete/features/account/pageActions.js` para `apps/athlete/features/account/pageSessionActions.js`
  - `done` extrair pickers e compressão de imagem de `apps/athlete/services/importFiles.js` para módulos dedicados
- `in_progress` Tirar `src/ui/render.js` do papel de dono das modais/autenticação do atleta
- `in_progress` Tirar `src/ui/render.js` do papel de dono das modais/autenticação do atleta
  - `done` mover implementação para `apps/athlete/features/render/shell.js` e manter `src/ui/render.js` como compat layer
  - `done` fazer `apps/athlete/mountUi.js` consumir render direto de `apps/athlete/features/render/shell.js`
  - `done` fazer `apps/athlete/layoutShell.js` consumir `renderAppShell` direto de `apps/athlete/features/render/shell.js`
  - `done` fazer testes de apresentação consumirem `apps/athlete/features/render/shell.js` direto
- `in_progress` Tirar `src/ui/render.js` e `src/ui/actions.js` do papel de dono do WOD/importação do atleta
- `in_progress` Tirar `src/ui/render.js` e `src/ui/actions.js` do papel de dono do WOD/importação do atleta
  - `done` mover binding de eventos de importação para `apps/athlete/features/events/bindings.js` com wrapper legado
  - `done` fazer `apps/athlete/mountUi.js` consumir eventos direto de `apps/athlete/features/events/bindings.js`
  - `done` extrair handlers de importação e app bus de `apps/athlete/features/events/bindings.js` para módulos dedicados
  - `done` extrair fluxos de importação e PRs de `apps/athlete/actions/todayActions.js` para módulos dedicados
  - `done` extrair navegação do WOD e `handleAthleteTodayChange` de `apps/athlete/actions/todayActions.js` para `apps/athlete/actions/todayUiActions.js`
- `in_progress` Tirar `src/ui/render.js` do papel de dono das modais secundárias do atleta
- `in_progress` Tirar `src/ui/render.js` do papel de dono dos helpers visuais compartilhados do atleta
- `in_progress` Tirar `apps/athlete/bootstrap.js` do papel de dono do ambiente/observabilidade/diagnóstico
- `in_progress` Tirar `apps/athlete/bootstrap.js` do papel de dono do pipeline de inicialização do atleta
- `done` Extrair domínios centrais do núcleo legado do atleta:
  - `src/app/workoutDomain.js`
  - `src/app/accountSyncDomain.js`
  - `src/app/authDomain.js`
  - `src/app/importExportDomain.js`
  - `src/app/coachFeedDomain.js`
  - `src/app/localSessionDomain.js`
  - `src/app/athleteInteractionDomain.js`
- `in_progress` Revisar `src/app.js` para ficar como composição + init + bridge
  - `done` remover imports mortos e wrappers redundantes
  - `done` extrair `coach/billing access` para `src/app/coachPortalDomain.js`
  - `done` extrair `history/measurements/workouts overview` para `src/app/athleteOverviewDomain.js`
  - `done` consolidar `billing actions` em `apps/athlete/features/billing/actions.js` (mantendo compat re-export)
  - `done` extrair fachada de hidratação para `apps/athlete/services/athleteHydration.js`
  - `done` extrair wiring restante de medidas da UI para `apps/athlete/features/measurements/services.js`
- `in_progress` Cobrir domínios novos com testes unitários dedicados
  - `done` `athleteOverviewDomain`
  - `done` `checkoutFlow`
- `pending` Extrair domínio do atleta restante:
  - `done` wiring de medidas na UI (`apps/athlete/features/measurements/services.js`)
  - `done` orquestração final de account/history consolidada em `apps/athlete/features/account/*` (com compat re-export)
  - `done` consolidar estados vazios compartilhados entre UI e testes (`apps/athlete/uiState.js`)
- `pending` Converter render manual/string para componentes por fatias
  - `done` extrair shell visual (`chrome.js`) e roteamento de modais (`modals.js`) a partir de `apps/athlete/features/render/shell.js`
  - `done` extrair roteamento de páginas (`pages.js`) a partir de `apps/athlete/features/render/shell.js`
  - `done` extrair seções de benchmarks e PRs de `apps/athlete/features/history/page.js` para `apps/athlete/features/history/sections.js`
  - `done` extrair overview, session card e workout header de `apps/athlete/features/today/page.js` para `apps/athlete/features/today/sections.js`
  - `done` extrair folds de visitante/acesso/portal/atividade de `apps/athlete/features/account/page.js` para `apps/athlete/features/account/sections.js`
  - `done` extrair hero, summary e coach access do modal autenticado para `apps/athlete/modals/authAccountSections.js`
  - `done` extrair guest auth, reset de senha e painel admin de `apps/athlete/modals/authModalSections.js` para módulos dedicados
  - `done` extrair biblioteca/inferência de execução de `apps/athlete/renderers/workoutBlock.js` para `apps/athlete/renderers/workoutExerciseHelp.js`
- `pending` Definir camada offline-first explícita:
  - snapshot local
  - fila de sync
  - reidratação
  - fallback visual por estado de rede

## Fase 4. Coach portal

- `done` Coach consumindo shared auth/runtime
- `done` Instalar Tailwind CSS no repo
- `done` Configurar Tailwind no build do `coach-portal`
- `done` Criar base compartilhada de tema Tailwind para `hub`, `coach` e `athlete`
- `done` Criar pipeline dedicado de build Tailwind para o hub público
- `done` Criar pipeline dedicado de build Tailwind para o athlete app
- `in_progress` Migrar superfícies para Tailwind-first
  - `done` hub com CSS gerado dedicado e hero/CTA em utilities
  - `done` coach-portal compilando Tailwind como camada principal
  - `done` athlete shell carregando CSS gerado do Tailwind
  - `in_progress` converter classes semânticas restantes do athlete para `@apply`/components
- `pending` Extrair `coach api client` próprio
- `pending` Separar módulos do portal:
  - gyms
  - memberships
  - groups
  - workouts
  - benchmarks
  - leaderboards
  - billing
- `pending` Introduzir cache local mínimo para rascunho/estado operacional
- `pending` Cobrir coach com smoke/E2E além do login básico

## Fase 5. Backend por casos de uso

- `done` Criar query services dedicados:
  - `backend/src/queries/athleteDashboardQueries.js`
  - `backend/src/queries/coachDashboardQueries.js`
- `done` Criar query services dedicados:
  - `backend/src/queries/billingQueries.js`
  - `backend/src/queries/leaderboardQueries.js`
- `pending` Criar write services dedicados:
  - workouts publish
  - memberships
  - groups
  - athlete logs
  - subscriptions
- `in_progress` Reduzir acoplamento entre rotas e regras de acesso
- `pending` Consolidar contratos de resposta por superfície
- `in_progress` Reduzir recomputação no frontend com endpoints mais específicos
- `done` Expor `GET /leaderboards/benchmarks/:slug` consumido pelo coach portal
- `done` Expor `POST /benchmarks/:slug/results` para registro de resultado autenticado

## Fase 6. Mobile/PWA/APK

- `done` Runtime nativo explícito
- `done` Service worker melhorado para app instalado
- `pending` Estratégia separada para:
  - PWA no browser
  - Android emulator
  - Android real
  - iOS real
- `pending` Testes de cenários offline
- `pending` Medição de cold start e hydration em device
- `pending` rever fontes externas e dependências de rede remota restantes

## Fase 7. Observabilidade e testes

- `done` `validate:stack`
- `in_progress` Cobrir domínios novos do atleta com testes unitários dedicados
  - `done` `athleteInteractionDomain`
  - `done` `authDomain`
  - `done` `workoutDomain`
  - `done` `accountSyncDomain`
  - `done` `coachFeedDomain`
  - `done` `importExportDomain`
  - `done` ampliar casos de borda para sync offline, imports inválidos e fallback do feed do coach
  - `done` ampliar falhas remotas/conflitos de sync em `accountSyncDomain`, `importExportDomain` e `coachFeedDomain`
- `done` adicionar `smoke:coach-trial` ao pipeline de stack (`scripts/validate-stack.sh`)
- `pending` E2E de atleta autenticado
- `pending` E2E de coach autenticado
- `pending` testes de offline/PWA
- `pending` métricas de render por superfície
- `pending` métricas de request por módulo de produto

## Próximos melhores blocos de execução

1. Retomar a extração dos domínios restantes do atleta: medidas, histórico e conta/billing.
2. Validar os novos cenários de falha remota em pipeline (`validate:stack`) e em execução local de smoke.
3. Seguir extraindo fatias remanescentes para reduzir `src/ui/actions.js` e `src/ui/render.js` ao papel de compat layer.
