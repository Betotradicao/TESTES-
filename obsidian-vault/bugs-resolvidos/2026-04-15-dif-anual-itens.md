# Bug: Dif Anual em branco nos itens da Compra x Venda

**Data:** 2026-04-15
**Cliente afetado:** [[../clientes/supervital|SuperVital]] (também aplicado em [[../clientes/tradicao|Tradição]])
**Módulo:** [[../modulos/compra-venda|Compra x Venda]]

## 🐛 Sintoma
Ao expandir uma seção/grupo/subgrupo até chegar aos **itens**, as colunas "Dif Anual (%)" e "Dif Anual (R$)" apareciam **em branco** (valor 0 ou `-`).

## 🔍 Causa Raiz
A função `toggleSubGrupo` em `CompraVendaAnalise.jsx` fazia **uma só** chamada ao endpoint `/compra-venda/drill-down/itens` (período selecionado). Diferente de `toggleGrupo` e `toggleSecao` que faziam duas chamadas (período + ano) e mesclavam.

Sem os dados anuais, os itens ficavam com `DIF_ANUAL_PCT: 0` e `DIF_ANUAL_RS: 0`.

## ✅ Fix Aplicado

### Frontend (`packages/frontend/src/pages/CompraVendaAnalise.jsx`)
Em `toggleSubGrupo` (função que busca itens):
1. Criado `paramsAnual` com `dataInicio: 01/01/<ano>` e `dataFim: <ontem>`
2. `Promise.all` com a chamada normal + anual
3. Merge pelos campos `COD_PRODUTO_LOJA`, preenchendo `DIF_ANUAL_PCT` e `DIF_ANUAL_RS`

## 📝 Lições
- Padrões de drill-down devem ser **simétricos** em todos os níveis
- Sempre que existe coluna "anual" ao lado de "período", provavelmente tem 2 chamadas

## 🏷️ Tags
#bug-resolvido #compra-venda #dif-anual #2026-04
