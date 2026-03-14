# Release & Rollback Runbook

## Release
1. Validar checklist de qualidade:
   - testes críticos (upload PDF, cálculo, backup/restore)
   - smoke test UI principal
   - validação de política/termos no ambiente alvo
2. Criar tag de release (ex: `v1.4.0`).
3. Publicar build no ambiente de produção.
4. Monitorar:
   - taxa de erro JS
   - falhas de checkout
   - tempo de resposta API auth/sync

## Rollback
1. Definir critério de rollback:
   - checkout indisponível
   - perda de dados de sync
   - erro crítico de inicialização
2. Reverter para tag anterior estável.
3. Invalidação de cache:
   - atualizar versão do service worker
4. Reexecutar smoke tests e comunicar status.

## Comunicação de incidente
1. Abrir incidente (severidade e impacto).
2. Informar usuários afetados.
3. Publicar post-mortem com causa raiz e correção permanente.
