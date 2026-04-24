# Rebuild Migration Plan

## Phase 0

- [x] Congelar fronteiras do legado.
- [x] Parar de aumentar acoplamento entre `apps/` e `src/`.
- [x] Usar os testes atuais como baseline de comportamento.
- [x] Deixar a workspace `rebuild/` instalavel com `pnpm-lock.yaml`.
- [x] Garantir comandos base verdes: `typecheck`, `lint`, `test` e `build`.

## Phase 1

- [x] Implementar base de `packages/contracts`.
- [x] Implementar base de `packages/domain`.
- [x] Subir `apps/api` com auth, billing e athlete snapshots iniciais.
- [ ] Completar signup/signin/password reset/trusted device na API nova.
- [ ] Cobrir contratos e dominio com testes reais.

## Phase 2

- [ ] Subir `apps/coach-web` com:
  - [ ] auth
  - [ ] billing status
  - [ ] gyms
  - [ ] memberships
  - [ ] groups
  - [ ] workouts publish
  - [ ] benchmarks
  - [ ] leaderboards

## Phase 3

- [ ] Subir `apps/athlete-mobile` com:
  - [ ] auth
  - [ ] imported plan
  - [ ] local workout
  - [ ] sync snapshots
  - [ ] PRs
  - [ ] measurements
  - [ ] benchmark results
  - [ ] timers
  - [ ] coach feed

## Phase 4

- [ ] Portar running e strength.
- [ ] Portar trusted device.
- [ ] Portar password reset support.
- [ ] Portar Nyx tour.

## Phase 5

- [ ] Portar admin/ops.
- [ ] Migrar billing claims e workers.
- [ ] Migrar account deletion workflow.

## Phase 6

- [ ] E2E de equivalencia entre legado e rebuild.
- [ ] Rollout controlado por superficie.
- [ ] Desligar legado por blocos.

## Current verification

- [x] `pnpm -C rebuild typecheck`
- [x] `pnpm -C rebuild lint`
- [x] `pnpm -C rebuild test`
- [x] `pnpm -C rebuild build`

## Next step

- [ ] Trocar placeholders de `marketing-web`, `coach-web` e `athlete-mobile` por primeiras telas de produto navegaveis.
- [ ] Conectar `coach-web` a `/auth/me`, `/billing/status` e `/billing/entitlements`.
- [ ] Conectar `athlete-mobile` a snapshots locais/remotos minimos.

## Definition of done

- Todas as features em `FEATURE_PRESERVATION.md` existem na base nova.
- P95 de boot do atleta reduzido drasticamente.
- Coach web sem layout quebrado.
- API com contratos tipados e testes de integracao.
- Offline do atleta coberto por teste real.
