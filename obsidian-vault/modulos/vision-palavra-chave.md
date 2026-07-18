# Vision Palavra-Chave

Ferramenta de busca por palavra-chave em cupons fiscais e vendas, com foco em "achar agulha no palheiro" (cupom específico, transação suspeita, etc).

## 📂 Arquivos
- **Frontend:** `packages/frontend/src/pages/VisionPalavraChave.jsx`, `VisionPalavraChave2.jsx`
- **Backend:** controllers/services relacionados a busca de cupons

## 🎯 O que faz
- Busca livre por termo/código em cupons, vendas, NFs
- Suporta filtros de período, loja, tipo de venda
- Botões de atalho: **Cartão POS** e **iFood** (adicionados recentemente)

## 🔍 Recursos especiais
- Busca em Oracle (Intersolid) respeitando range de datas
- Exibe itens de **CANC. VENDA** em `getCupomByTime`
- Expõe itens cancelados e com desconto no rodapé do cupom

## ⚡ Pre-geracao de clipes DVR (botao Play verde)

Cron a cada 2h pre-gera os clipes dos 4 tipos visiveis na tela: **CANC. ITEM, CANC. CUPOM, CANC. VENDA, DESCONTO**. Quando o clipe esta pronto, o botao Play vira **verde** com check ✓ e o video toca instantaneo (sem chamar ffmpeg na hora). Retencao 2 dias, igual Bipagens.

- Tabela: `dvr_pos_event_clips` (idempotente via `event_key`)
- Cron geracao: `0 */2 * * *` em `index.ts`
- Cron limpeza: `5 3 * * *` (apaga MP4 + remove registro >2 dias)
- Detalhes: [[../bugs-resolvidos/2026-05-pre-clipes-vision-palavra-chave|Pre-clipes Vision Palavra-Chave]]

## 🔎 Busca Preço — o que é, e o que NÃO dá pra saber

Filtro adicionado em 16/07 (commit `75d6788`). O backend **já suportava desde antes**
(`['BUSCA','BUSCA PRECO','CONSULTA','CONSULTA PRECO']` → `keyword='busca_preco'`) — só
faltava o botão. Digitar "consulta" na caixa dá o mesmo resultado.

### Como o evento existe no Oracle
Linha em `TAB_PRODUTO_PDV` com **`NUM_CUPOM_FISCAL = 0`** (consulta não gera cupom).
Por isso, nesses eventos: **Cupom vazio, Valor R$ 0,00, Operador vazio** — não é bug.

### ⛔ O operador NÃO existe no dado (medido 14/07/2026)
| | Total | Com operador |
|---|---|---|
| Busca preço (`cupom = 0`) | 470 | **0** |
| Vendas (`cupom > 0`) | 5.241 | **5.241 (100%)** |

`COD_VENDEDOR` vem **`null`** em 100% das consultas. O PDV Intersolid simplesmente não
grava quem consultou. **Nenhum JOIN resolve** — o `operador: ''` do código é honesto.
**Único caminho: inferir** pelo operador da venda vizinha no mesmo PDV/minuto.

### 📊 O que realmente aparece nesse filtro (14/07, 470 eventos)
| Vezes | Produto |
|---|---|
| **379 (81%)** | PRD P BASE **PÃO FRANCÊS** CONGELADO |
| 38 | FRIOS QUEIJO MUSSARELA |
| 19 | FLV MILHO VERDE ESPIGA |
| 7 / 7 / 6 / 4 | APRESUNTADO · PARMESÃO · PRESUNTO · PEITO DE PERU |

Distribuição uniforme entre PDV 1-4 (145/102/117/106).

> 💡 **São todos produtos DE BALANÇA** (sem código de barras) — o operador é *obrigado* a
> consultar. A cadência de ~1/min de manhã é o corre do pão, não anomalia.
>
> ⚠️ **Consequência pra prevenção: 81% do filtro é ruído (pão francês).** O sinal útil são
> os **frios** (alvo clássico de furto). O evento que interessa é **"consultou e não
> vendeu"** — cruzar a consulta com a venda seguinte no mesmo PDV.

### A notinha já mostra a venda vizinha — por acidente
`getCupomByTime` (dvr-cftv.service.ts ~L1480) faz `if (cupomNumDirect)`. Como o cupom da
consulta é **0**, e **`0` é falsy em JS**, ele nunca entra na busca direta: cai no
**fallback por horário (±1 min, `AND cupom > 0`)** e traz a **venda mais próxima**.
Por isso a notinha mostra um cupom de horário diferente do evento clicado.

> ⚠️ Janela de **±1 min é curta**: se a venda sai 3 min depois da consulta, não casa.

### 🎨 Vermelho na notinha já existe
`VisionPalavraChave2.jsx` ~L516 já pinta de `#C62828` item **cancelado** ou **com desconto**:
```js
const highlight = isCanc || hasDesc;
```
Marcar item consultado em vermelho = **reusar esse mecanismo**, não criar visual novo.

## 🔎 Filtros por Operador e por Faixa de Valor (18/07/2026)

Além de palavra-chave/código, dá pra buscar **sem termo**, só por critério:
- **Operador(a):** dropdown carregado do ERP (`GET /dvr-cftv/pos/operadores?start=&end=`,
  `value = COD_OPERADOR`). ⚠️ Lista **só quem teve venda no período** (DISTINCT em
  `TAB_CUPOM_FINALIZADORA` JOIN `TAB_OPERADORES`), não o cadastro inteiro — senão vinham nomes
  fantasma tipo SUPERMERC / Z CUSTOM que nunca operam caixa. Refetch quando o período muda.
  Traz **todas as vendas do dia daquele operador** — 1 linha por cupom.
- **Faixa de valor:** campos "Valor de" / "Valor até". Ex.: 0,01 a 0,30 → todos os cupons
  cujo **total** caiu nessa faixa (caça o clássico "passou 1 bala").

### Como funciona no backend (`searchOracleAllPdvs`, dvr-cftv.service.ts)
Branch novo: **`if (!text && (operador || valor))`**. Agrupa `TAB_PRODUTO_PDV` por
`(cupom, pdv, data)`, `SUM(valor)` = total do cupom:
- **Operador** → `EXISTS` em `TAB_CUPOM_FINALIZADORA` casando `C_CF_OPERADOR = :codOp`
  (quem fechou o cupom; é lá que mora o operador, não em TAB_PRODUTO_PDV).
- **Faixa** → `HAVING SUM(valor) >= :vmin AND <= :vmax`.
- Nome do operador vem por subselect na finalizadora + `TAB_OPERADORES`.
- Retorna `{time, cupomNum, pdv, valor, tipo:'VENDA', operador}` → Play funciona igual.

⚠️ **Operador só resolve em cupom fiscal** (`cupom > 0`). Consulta de preço (cupom=0) não
tem operador no dado — ver seção "Busca Preço" acima. Por isso o filtro ignora cupom=0.

Controller (`searchOracle`) agora aceita `operador`, `valorMin`, `valorMax` e **relaxa** a
obrigatoriedade de text/barcode quando há critério. Frontend: dropdown do endpoint +
2 inputs number; filtro client-side antigo por operador (que lia nome dos resultados) foi
removido — agora é tudo server-side por código.

## 🏷️ Tags
#modulo #vision #busca
