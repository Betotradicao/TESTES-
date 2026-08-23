# Grupo de similares na ruptura: tela existia, regra nunca foi implementada

**Data:** 22/08/2026 · **Cliente:** [[../clientes/tradicao|Tradição]] (afeta TODOS)

## 🔴 Sintoma
Roberto: *"coloquei o número 5 em todos os leites integrais, não salva o número
em cada item e consequentemente não está funcionando."*

## 🎯 Eram TRÊS defeitos, não um

### 1. Não salvava — `findOne` sem upsert
`updatePeculiaridades` só gravava se o produto **já tivesse linha** em `products`
(Postgres). A tela lista produtos do **ORACLE**. Os 9 leites não existiam lá:
**741 linhas** em `products` contra milhares no ERP.

O `findOne` voltava `null`, o `if (product)` pulava em silêncio, e a API
respondia **"0 produtos atualizados"** com status 200.

> ⚠️ **Padrão a caçar no resto do sistema:** toda tela que lista do Oracle e grava
> peculiaridade no Postgres tem esse risco. `products` é cache parcial, **não**
> espelho do ERP — nunca assumir que o produto está lá.

### 2. Limpar o grupo gravava ZERO
```ts
grupo_similar !== undefined && grupo_similar !== '' ? Number(grupo_similar) : null
```
O front manda `null` ao limpar. `null !== undefined` ✓, `null !== ''` ✓ →
`Number(null)` = **0**. Grupo fantasma: some da tela (o input trata 0 como vazio)
mas fica no banco. Achei **8 bacons** assim.

### 3. NINGUÉM lia o grupo
`grupo_similar` aparecia em **5 arquivos**: o modal, o controller, a entity e duas
migrations. **Zero** cálculo de ruptura consultava. A tela de configuração existia
desde 04/2026 e a regra nunca tinha sido escrita.

## 🔗 Como a regra funciona (`services/grupo-similar.service.ts`)
Mesmo número = substitutos. Se **qualquer um** do grupo tem estoque, nenhum item
do grupo entra na ruptura — o cliente acha o que precisa na gôndola.

> 🔑 **A sutileza que define o desenho:** não dá pra decidir olhando só os itens
> candidatos. O item COM estoque normalmente **não está** na lista de ruptura —
> justamente por ter estoque. Por isso o serviço consulta no Oracle o estoque do
> **grupo inteiro** (`TAB_PRODUTO_LOJA.estoque_atual`), não só dos candidatos.

Ligado nos **dois** endpoints que alimentam a tela:
- `/products/for-rupture` (dias sem venda)
- `/rupture-surveys/automatico` (estoque zerado)

No automático o filtro roda **antes** dos rankings e estatísticas — senão os
números contariam ruptura que a tela não mostra.

Se o serviço falhar, a pesquisa segue **sem filtrar**: refinamento não pode
derrubar a ruptura. Cache de 60s porque a tela chama os dois endpoints em
sequência; invalidado ao salvar peculiaridades.

## ✅ Validado em produção (22/08)
12 produtos configurados em 3 grupos (7 leites integrais, 3 farinhas, 2 leites
condensados). Mandando os 12 como ruptura → **12 removidos**, todos os grupos com
substituto em estoque.

## 🏷️ Tags
#bug #resolvido #rupturas #tradicao #oracle
