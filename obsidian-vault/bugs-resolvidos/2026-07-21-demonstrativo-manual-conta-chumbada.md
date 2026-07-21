# Demonstrativo Manual mostrava só UMA conta (chumbada no código)

**Data:** 2026-07-21 · **Cliente:** Tradição · **Commit:** `4a95b17`

## 🐛 Sintoma
Roberto conciliou 25 movimentos na conta **Santander ADM COMERCIAL** (`000130072585`)
— todos classificados, 0 não classificados — mas **nada** disso aparecia no
Demonstrativo de Caixa (modo Direto Manual). Sensação de "não está subindo".

## 🎯 Causa-raiz
O front escolhia a conta **por número fixo no código**:
```js
const santander = accs.find(a => (a.conta || '').includes('130075973'))
```
Só a **SANTANDER LTDA** subia. ADM COMERCIAL e Tricard **nunca** entravam.

> 🔴 **O que fez isso passar despercebido:** a tela **não dizia de qual conta era o
> dado**. Um demonstrativo que mostra "Despesas R$ 1.049.645,96" sem dizer a origem
> parece completo. Número sem procedência não denuncia o que está faltando.

## ✅ Correção
- `getDadosManual` aceita **`bankIds` (CSV)** além de `bankId`; itera as contas e
  concatena o extrato. Cada linha carrega `BANK_ID`.
- Controller repassa `req.query.bankIds`.
- Tela ganhou **seletor de conta** (só no modo Manual) com **"Todas as contas"
  como padrão**.

## ⚠️ RISCO CONHECIDO — colisão de `mov_key` entre contas
`mov_key` = `data|valor|texto|tipoOperacao` (`movKeyOf`) — **não inclui a conta**.
Com várias contas consolidadas, dois movimentos idênticos em contas diferentes
(mesma data, valor, favorecido e tipo) **compartilham a classificação**: classificar
um classifica o outro.

Plausível na prática — ex.: `PIX RECEBIDO - 47692182000172` com mesmo valor no mesmo
dia nas duas contas.

**Não foi corrigido de propósito:** incluir a conta na chave **invalidaria todas as
amarrações já salvas** pelo Roberto (as chaves antigas não casariam mais). Exigiria
migration convertendo `conciliacao_movimento.mov_key`. Decidir antes de mexer.

## 🏷️ Tags
#bug #financeiro #conciliacao #demonstrativo #santander #tradicao
