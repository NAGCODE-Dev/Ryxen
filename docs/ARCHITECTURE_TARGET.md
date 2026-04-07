# Ryxen Architecture Target

## Superfícies do produto

- `apps/hub`
  - entrada pública para escolher fluxo de atleta ou coach
- `apps/athlete`
  - shell do app do atleta e experiência instalada/offline-first
- `coach-portal`
  - portal operacional do coach
- `backend`
  - API, auth, billing, dashboards e políticas de acesso

## Shared web

- `packages/shared-web`
  - runtime config
  - auth compartilhado
  - API client
  - ponto de extração dos contratos comuns entre atleta e coach

## Princípios de migração

1. Manter build/deploy compatíveis enquanto os entrypoints migram para `apps/`
2. Extrair primeiro contratos estáveis e usados por mais de uma superfície
3. Migrar render/UI por fatias, sem reescrever backend e frontend ao mesmo tempo
4. Separar leitura otimizada do backend por visão de produto:
   - athlete
   - coach
   - billing
   - rankings

## Estado atual desta fase

- entrypoints web públicos já passam por `apps/`
- coach portal já consome shared runtime/auth
- build estático e service worker conhecem a nova fronteira
- próximos passos naturais:
  - mover running/strength para `apps/athlete/*`
  - separar query services do backend por dashboard
  - reduzir dependência de módulos globais do app do atleta
