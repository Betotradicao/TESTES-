---
tags:
  - bug-resolvido
  - bipagens
  - oracle
  - tradicao
data: 2026-08-20
cliente: Tradição
---

# 🌟🚨 Venda com desconto no caixa NUNCA casava — todo desconto virava falso alarme

## 🔴 Sintoma
Roberto viu `AC FRG PEITO DE FRANGO SEM OSSO` como **Pendente** sabendo que o item passou
no caixa. Passou mesmo — **com desconto**.

## 🎯 Causa-raiz
A bipagem grava o valor da **ETIQUETA** (peso × preço cheio). O casamento
(`bip-verification.service.ts`) exigia:

```js
const precoOk = Math.abs(valProduto - precoBip) <= tolerance;   // tolerance = R$ 0,03
```

Com desconto, `VAL_TOTAL_PRODUTO` vem **menor** → diferença muito maior que 3 centavos →
não casa → fica pendente pra sempre, **parecendo produto que saiu sem passar no caixa**.

> 🔑 **Não era um caso isolado: TODA venda com desconto virava falso alarme.**
> O alerta de prevenção apontava furto onde havia desconto legítimo.

**Prova (20/08/2026, PLU 4787, 5,650 kg):**
```
bipagem ......... R$ 112,94   (5,650 × R$ 19,99 da etiqueta)
venda ........... R$ 101,64   (cupom 647185, PDV 1, 14:56)
VAL_DESCONTO .... R$  11,30
101,64 + 11,30 = 112,94   -> bate no centavo
```

## ✅ Correção
Aceita o casamento pelo valor **líquido** OU pelo **bruto** (líquido + desconto):
```js
const precoOk =
  Math.abs(valProduto - precoBip) <= tolerance ||
  Math.abs((valProduto + desconto) - precoBip) <= tolerance;
```

> ⚠️ **`descontoAplicado` existia no tipo `SaleData` mas era sempre `undefined`** — o campo
> estava lá desde sempre, nunca preenchido. `sales.service.ts` passou a ler `VAL_DESCONTO`
> (chave de mapeamento `valor_desconto`, **já existia** no mapeamento v2).

## 🆕 Colunas Desconto e Margem (pedido do Roberto)
Migration `1785400600000` → `bips` ganha `venda_valor_cents`, `venda_desconto_cents`,
`venda_custo_cents`, `venda_margem_pct` (centavos = inteiro, sem erro de float).

- **Margem sobre o valor REALMENTE cobrado** — o desconto dado no caixa aparece comendo a
  margem. É o número honesto pra prevenção. Custo vem de `VAL_CUSTO_REP`, que o SELECT
  **já trazia**.
- **Coluna Desconto distingue 3 estados:** `🏷️ R$ 11,30` (+ % do bruto) · `sem desconto`
  (casou e não teve) · `-` (pendente, não há venda). "Não teve" ≠ "não sei".

## 🧪 Validação em produção
```
id 56416  status: pending -> verified
cupom 647185 | valor R$ 101,64 | desconto R$ 11,30 | custo R$ 69,50 | margem 31,63%
```
**Reprocessou sozinho** no primeiro ciclo do SellsSync (roda de minuto em minuto sobre
pendentes do dia com `notified_at IS NULL`). Não precisou de script manual.

> 📌 Bipagem **já notificada** (`notified_at` preenchido) **não** é reprocessada. Se
> precisar recuperar falso alarme antigo, tem que limpar `notified_at` antes.

> ⚠️ **Caminho PostgreSQL (Nunes/RP INFO):** o desconto fica 0 — as colunas do row são
> minúsculas e `VAL_DESCONTO` não existe lá. Não quebra, só não preenche.

## 🔗 Relacionados
- [[../modulos/bipagens|Bipagens]] · [[../arquitetura/mapeamento-tabelas|Mapeamento]]
