# 🚧 Trabalho em Andamento

## Sessão atual (2026-05-19)

### Tarefa
Implementado **pre-geracao de clipes DVR no Vision Palavra-Chave** (botao Play instantaneo pros 4 tipos: Canc. Item / Canc. Cupom / Canc. Venda / Desconto). Doc completa: [[bugs-resolvidos/2026-05-pre-clipes-vision-palavra-chave]]

### Estado
- ✅ Migration `1784810000000-CreateDvrPosEventClips.ts`
- ✅ Entity `DvrPosEventClip`
- ✅ Cron de pre-geracao (`0 */2 * * *`) em `index.ts`
- ✅ Cron de limpeza 2 dias (`5 3 * * *`)
- ✅ `enrichWithPreClips` no `dvr-cftv.controller.ts`
- ✅ `handlePlayVideo` + botao verde em `VisionPalavraChave2.jsx`
- ✅ Type-check backend OK
- ✅ Vault atualizado

### Próximo passo
**Testar localmente:**
1. Reiniciar backend pra rodar migration: `cd packages/backend && npm run dev`
2. Reiniciar frontend
3. Verificar que migration `1784810000000-CreateDvrPosEventClips` rodou sem erro
4. Aguardar primeiro ciclo do cron (rodara em 0/2/4/6... cheio) ou disparar manualmente pra testar
5. Validar visualmente: Play verde aparece, toca instantaneo

**Apos validacao → commit + push + deploy.**

### Decisoes pendentes
Nenhuma.

### Estado git
Branch `TESTE`, commit `7a06251` (docs vault) ja pushado. Implementacao atual ainda **nao commitada** — aguardar teste local.
