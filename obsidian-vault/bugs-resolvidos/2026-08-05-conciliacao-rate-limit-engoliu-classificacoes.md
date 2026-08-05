---
tags:
  - bug-resolvido
  - conciliacao
  - frontend
  - react
  - tradicao
data: 2026-08-05
cliente: Tradição
---

# 🌟🚨 O rate limit engolia classificações em silêncio (+ tela branca por hook fora de ordem)

Dois bugs distintos na Conciliação **Direto Manual**, achados no mesmo dia.

## 1️⃣ "Classifiquei 100%, ficou tudo verde — mas o Demonstrativo diz 288 não classificados"

### 🔴 Sintoma
Roberto classificou centenas de `PIX RECEBIDO` na Conciliação, tudo ficou **verde**.
O Demonstrativo mostrava **288 lançamentos NÃO CLASSIFICADOS**. Sensação de bug de tela.

### 🎯 Causa-raiz — o backend recusava, e ninguém contava pro usuário
O front mandava **1 POST por linha**, todos de uma vez:
```js
await Promise.all(textos.map(txt => api.post('/conciliacao/amarracoes', {...})));
```
Com ~470 linhas selecionadas = ~470 requisições simultâneas. E o `index.ts` tem:
```js
rateLimit({ windowMs: 60_000, max: 200 })   // 200 req/min por IP, só /api/health escapa
```
**O excedente levava HTTP 429.** Como a tela pinta de verde **antes** de confirmar
(atualização otimista) e o `catch` só mostrava um toast genérico sem desfazer nada,
o usuário via "salvo" e o banco não tinha nada.

> 🔑 **Otimista + erro silencioso = a tela MENTE.** Se pinta antes de confirmar, tem que
> desfazer no erro e dizer quantos salvaram de fato.

### 🔬 A prova (números medidos)
```
POSTs /amarracoes que CHEGARAM ao backend .... 232   (179 num único minuto, 11:41)
amarrações realmente gravadas ................ 218
linhas que sobraram sem classificação ........ 288
```
E os PIX da tela do Demonstrativo **não tinham amarração nenhuma** no banco — ou seja,
o Demonstrativo estava certo o tempo todo.

```sql
-- confere se um lançamento específico foi mesmo gravado
SELECT '['||texto_exato||']', plano_conta_id FROM conciliacao_amarracoes
 WHERE texto_exato LIKE '%<parte do texto>%';
-- quantas foram criadas por dia (mostra se o lote entrou inteiro)
SELECT date(created_at), count(*) FROM conciliacao_amarracoes GROUP BY 1 ORDER BY 1 DESC;
```
```bash
# quantas requisições sobreviveram ao rate limit, por minuto
docker logs prevencao-<cliente>-backend --timestamps --since 24h \
  | grep 'Path: /amarracoes Method: POST' | cut -c1-16 | uniq -c
```

### ✅ Correção — endpoint de LOTE (1 requisição pra N itens)
Throttle **não resolve**: o teto é 200/min independente da concorrência, então 470 itens
levariam minutos. A saída é mandar tudo junto.

| Novo | O quê |
|---|---|
| `POST /conciliacao/amarracoes/lote` | `{ itens: [{texto_exato, plano_conta_id}] }` |
| `POST /conciliacao/movimento/unica/lote` | `{ itens: [{mov_key, plano_conta_id}] }` |

Service: dedup por chave (o mesmo texto 2x no lote quebraria o UNIQUE), `In()` pra buscar
os existentes de uma vez, `repo.save(bloco)` em blocos de 500 (INSERT gigante estoura o
limite de parâmetros do Postgres) e, se o bloco falhar, **retenta um a um** pra salvar o que
der e reportar só o que falhou. Devolve `{ salvas, erros[], enviadas }`.

Front: uma chamada só, toast com o número real (`"N classificações salvas"`) e, no erro,
**desfaz o verde otimista**.

> ⚠️ **`handleTransferManual` continua com `Promise.all`** — transferência em lote é raro,
> mas se alguém selecionar centenas o mesmo problema volta.

## 2️⃣ Tela branca ao clicar nos cards de filtro

### 🎯 Causa: hook depois de `return` condicional
```jsx
function ManualConciliacao({ rows, loading }) {
  if (loading) return <RadarLoading />;            // ← return ANTES
  if (!rows?.length) return <div>…</div>;
  const [sortCol, setSortCol] = useState(null);    // ← hooks DEPOIS  ❌
```
Quando `loading` vira true (nova busca, ou refetch após classificar), o componente retorna
antes e o React recebe **menos hooks** que no render anterior →
`Rendered fewer hooks than expected` → **tela branca**.

**Corrigido:** todos os `useState`/`useMemo` movidos pra antes dos returns; os `useMemo`
passaram a aguentar `rows` null (`const base = rows || []`).

> 🔎 **Como varrer o resto do projeto:** procurar componentes com `if (loading) return`
> seguido de `useState`. O `DemonstrativoManual` já estava certo (tem até o comentário da
> regra) — o `ManualConciliacao` era o único faltando.

## ⏭️ Depois do deploy
As **288 linhas continuam sem classificação** — precisam ser reclassificadas. Com o lote,
agora vai numa tacada só.

## 🔗 Relacionados
- [[../modulos/financeiro|Financeiro]]
- [[2026-07-21-demonstrativo-manual-conta-chumbada|Demonstrativo Manual mostrava só UMA conta]]
