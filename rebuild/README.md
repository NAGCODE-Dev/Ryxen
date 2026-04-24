# Ryxen Rebuild

Workspace paralela para reescrever o produto com arquitetura moderna,
preservando comportamento do legado.

## Apps

- `apps/api`: backend Fastify + Postgres + jobs
- `apps/athlete-mobile`: app mobile do atleta em Expo
- `apps/coach-web`: portal do coach em Next.js
- `apps/marketing-web`: landing, pricing e paginas publicas

## Packages

- `packages/contracts`: schemas tipados compartilhados
- `packages/domain`: regras puras de negocio

## Principle

Nenhuma feature do legado sera removida na reescrita.
O rebuild existe para substituir a base atual sem simplificar regras.

## Status

- [x] Workspace instalada com `pnpm`.
- [x] Lockfile criado em `pnpm-lock.yaml`.
- [x] `pnpm typecheck` verde.
- [x] `pnpm lint` verde com checagem TypeScript.
- [x] `pnpm test` verde, aceitando packages ainda sem testes.
- [x] `pnpm build` verde para API, packages, Next apps e export Android do atleta.
- [ ] Superficies ainda precisam sair do estado placeholder.

## Next step

1. Transformar `apps/marketing-web`, `apps/coach-web` e `apps/athlete-mobile` em primeiras telas de produto.
2. Conectar `coach-web` aos endpoints ja migrados da API.
3. Adicionar testes reais para contracts/domain/API antes de expandir features.
