# Ticket médio errado por filtro COD_TIPO=1110 oculto

**Data:** 2026-06-01
**Cliente reportou:** MaxValle (Mercado Fratelli) — ticket médio do nosso sistema diferente do sistema dela
**Cliente dela:** 22.425 cupons em maio · Nosso: 16.085 cupons em maio

## 🐛 Sintoma
Cliente abre a aba "CUPOM ONLINE" no ERP dela, filtra dia 01/05 a 31/05, loja 1 → mostra **22.425 registros**.
Nosso dashboard de Gestão Inteligente mostra **16.085 cupons** no mesmo período/loja.
Como ticket médio = vendas / cupons, **ticket médio nosso ficava inflado** (vendas iguais, denominador menor).

## 🔍 Causa raiz
Linha 366 (antes do fix) em `packages/backend/src/services/gestao-inteligente.service.ts`:

```sql
SELECT COUNT(DISTINCT cf.NUM_CUPOM_FISCAL) as QTD_CUPONS
FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
WHERE cf.DTA_VENDA BETWEEN ... 
  AND cf.COD_TIPO = 1110   ← filtro escondido
```

`TAB_CUPOM_FINALIZADORA` tem **1 linha por meio de pagamento do cupom** (dinheiro, cartão, pix, vale...).
O filtro `COD_TIPO = 1110` (provavelmente "venda à vista / dinheiro") excluía cupons pagos 100% por outros métodos:
- Cartão puro (sem troco em dinheiro)
- PIX puro
- Vale-refeição puro
- Crediário puro

**No Tradição:** todos os 39.587 cupons de maio têm COD_TIPO=1110 → filtro não fazia diferença → bug ficou escondido por meses.
**No MaxValle:** 6.340 cupons pagos por outros métodos puros → filtro descartava todos eles.

## 🛠️ Fix aplicado
Commit `XXX` — removido o filtro `AND cf.COD_TIPO = 1110`.
Agora `COUNT(DISTINCT NUM_CUPOM_FISCAL)` pega todos os cupons únicos.

## 🧠 Lição
**Why:** filtros mágicos com magic numbers (1110) sem comentário no código são bombas-relógio. Funcionam num cliente, quebram em outro com a mesma estrutura de banco mas perfil de uso diferente.

**How to apply:** ao adicionar qualquer filtro `= N` em query Oracle (especialmente `COD_TIPO`, `COD_STATUS`, `TIPO_*`), documentar **o que aquele número significa** no schema do cliente E **verificar se outros clientes têm o mesmo valor**. Se não tiverem, abstrair pra mapping/configuração.

## 🔗 Links
- [[../arquitetura/mapeamento-tabelas|MappingService]]
- [[../clientes/maxvalle|MaxValle]]
- Histórico: filtro adicionado em commit `a66a833` (2026-02-04) sem justificativa documentada
