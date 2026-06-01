# Cupons MaxValle 22.425 vs 16.085 — investigação completa

**Data:** 2026-06-01
**Cliente reportou:** MaxValle (Mercado Fratelli) — cupons diferentes entre o ERP dela e nosso

## 🔎 Sintoma reportado pela cliente
- ERP dela (aba "CUPOM ONLINE" do Intersolid): **22.425 registros encontrados** em maio/2026 loja 1
- Nosso sistema (Gestão Inteligente): **16.085 cupons** no mesmo período

## ❌ Hipótese inicial (descartada)
Achei que era o filtro `AND cf.COD_TIPO = 1110` na query `cuponsQuery` em `gestao-inteligente.service.ts`.
- No Tradição: todos os cupons têm COD_TIPO=1110, então remover ou manter não muda nada.
- No MaxValle: **também todos os cupons têm COD_TIPO=1110** (testado em 01/06/2026).

Removi o filtro mesmo assim (commit `116c99f`) — não causa regressão, é mais robusto pra clientes futuros que tenham outros COD_TIPOS, mas **NÃO era a causa do gap**.

## ✅ Verdadeira causa raiz
A aba "CUPOM ONLINE" do ERP Intersolid **conta REGISTROS de TAB_CUPOM_PDV** (ou TAB_CUPOM_FINALIZADORA), que tem **1 linha por meio de pagamento/sequência financeira**, não 1 linha por cupom.

Validação Oracle (MaxValle loja 1 / maio 2026):

| Tabela | COUNT(*) | COUNT(DISTINCT NUM_CUPOM_FISCAL) |
|---|---|---|
| TAB_CUPOM_PDV         | 22.884 | 16.086 |
| TAB_CUPOM_FINALIZADORA | 22.883 | 16.085 |

A cliente vê **22.425 registros** (próximo dos 22.884 — diff pequena pode ser cupons cancelados/devoluções).
Cada cupom pago em mais de um meio (ex: parte dinheiro + parte cartão) gera **N linhas** nessas tabelas.

## 📐 Matemática do ticket médio
- TM correto = `vendas / DISTINCT cupons` = R$ 607.259,48 / 16.085 = **R$ 37,75** ✓
- TM "como ela calcula" = R$ 607.259,48 / 22.425 = R$ 27,08 (erro: clientes que pagaram em 2 cartões contariam 2×)

**Nosso 16.085 está CORRETO** — é o número real de transações/clientes únicos no mês.

## 💬 Como explicar pra cliente
"O sistema do Intersolid conta cada linha da TAB_CUPOM_PDV. Como cada cupom pago em mais de um cartão/forma gera várias linhas, o total de 22.425 inclui essas duplicações. Quando você conta a coluna 'N.Cupom' como números únicos, dá 16.085 — que é o real número de vendas (e o ticket médio é calculado em cima desse 16.085)."

## 🛠️ Mudanças aplicadas
- `gestao-inteligente.service.ts`: filtro `COD_TIPO=1110` removido (defensivo, não corrige nada aqui mas previne bugs em outros clientes Intersolid futuros)
- Doc vault atualizada com a explicação correta

## 🧠 Lição
**Why:** assumi que o erro era no nosso lado (filtro mágico) antes de validar a fonte dos números do cliente. O erro estava na **interpretação dela**: "registros encontrados" ≠ "cupons únicos".

**How to apply:** quando cliente reportar diferença numérica, primeiro pedir UMA query exata de onde o número dela vem (preferível SQL ou screenshot mostrando coluna agrupadora). Só DEPOIS investigar o nosso. Aceitar "está errado" sem essa validação leva a fix-by-guess.

## 🔗 Links
- [[../clientes/maxvalle|MaxValle]]
- [[../arquitetura/mapeamento-tabelas|MappingService]]
