# Açougue — Desmembramento (rendimento de carcaça)

Calcula custo/receita/lucro do desmembramento de carcaças a partir de um **template de
rendimento** (% de cada corte).

## 📂 Arquivos
- Frontend: `AcougueDesmembramento.jsx` (tela de cálculo) · `AcougueCadastroRendimento.jsx` (CRUD)
- Backend: `acougue.controller.ts` + `routes/acougue.routes.ts`

## ✅ 19/08/2026 — AGORA LÊ AO VIVO DO ERP (rendimento **e** preço)

`listarTemplates`, `getTemplate` e `calcularDesmembramento` consultam o Oracle a cada
chamada. **Não existe mais cópia local** — mexeu no Intersolid, refletiu na tela.

| O quê | De onde vem |
|---|---|
| % de rendimento | `TAB_PRODUTO_DECOMPOSICAO.QTD_DECOMP` |
| Nome da matriz e dos cortes | `TAB_PRODUTO.DES_PRODUTO` |
| **Preço de venda** | `TAB_PRODUTO_LOJA.VAL_VENDA` (por loja) |
| "vende / não vende" | preço ≤ R$ 0,01 ⇒ não gera receita (é como o osso/sebo está no ERP) |

> 🔑 **Filtro com DUAS travas** — nenhuma sozinha resolve: prefixo do nome
> (`acougue_prefixo_matriz`, default `AC MATRIZ`) **+** soma dos percentuais entre 99 e 101.
> Só o prefixo pegaria matriz mal cadastrada; só a soma pegaria COMBO de mercearia
> (`COMBO PDR BISC AMANTEIGADOS` e `COMBO FLV CEASA` também somam 100).
> Validado: 8 matrizes, zero combos.

> ⚠️ **Zeros à esquerda:** o front mandava `parseInt(templateId)` e virava `3902`, mas no
> Oracle é `'00003902'`. Comparação nas queries usa
> `LPAD(TRIM(col),20,'0') = LPAD(TRIM(:cod),20,'0')` — casa dos dois jeitos.

> 🗃️ Migration `1785400500000`: `acougue_desmembramentos.template_id` virou VARCHAR e
> **perdeu a FK** pra tabela local (o id agora é do ERP). Histórico preservado — o
> `template_nome` sempre foi gravado junto.

**Impacto medido (250kg × R$ 22,50, matriz BOI CASADO):**

| | Antes (dados de abril) | Depois (ERP real) |
|---|---|---|
| Receita | R$ 8.192,81 | **R$ 7.869,59** |
| Lucro | R$ 2.567,81 | **R$ 2.244,59** |
| Margem | 31,34% | **28,52%** |

> 💰 A tela vinha prometendo **R$ 323 a mais de lucro por carcaça** do que o real.

> 📌 A tela `AcougueCadastroRendimento.jsx` e as tabelas `acougue_rendimento_*` ficaram
> **órfãs** — não alimentam mais o Desmembramento. Decidir se removem ou viram cadastro
> de matriz que não existe no ERP.

## 🕰️ Como era antes (o bug que motivou a mudança)

**Os percentuais ficam no NOSSO Postgres**, nas tabelas `acougue_rendimento_templates` e
`acougue_rendimento_itens`. Do Oracle o módulo só usa `/buscar-produtos` (pesquisa de produto).

> 🔴 **Não existe sincronização com o ERP.** Os 8 templates do Tradição foram cadastrados em
> **04-06/04/2026** e nunca mais mudaram (`updated_at == created_at`). Roberto alterou os
> rendimentos no Intersolid em **19/08/2026** e a nossa tela continuou com os de abril —
> inclusive com **nome diferente** do que está no ERP.

**Impacto medido (matriz BOI CASADO, 19/08/2026):**

| Corte | ERP | Nosso (abril) | Erro |
|---|---|---|---|
| OSSO/SEBO BOVINO | 25,53% | 20,44% | −5,09 pts |
| ACEM | 14,26% | 17,47% | +3,21 pts |
| MUSCULO | 5,79% | 4,27% | +1,52 pts |

> 💰 Osso subestimado + carne nobre superestimada ⇒ **a tela mostra lucro maior do que o real**.

## 🗄️ Onde o rendimento mora no Oracle (descoberto 19/08/2026)

**`INTERSOLID.TAB_PRODUTO_DECOMPOSICAO`** — é a tela "Cadastro (De)Composição" do Intersolid.

| Coluna | Tela do ERP |
|---|---|
| `COD_PRODUTO` | PLU da **matriz** (ex.: `00003902` = AC MATRIZ CARNE BOI CASADO) |
| `NUM_SEQUENCIA` | Item |
| `COD_PRODUTO_DECOM` | PLU do **corte** |
| `QTD_DECOMP` | **Qtde %** (é o rendimento) |
| `DES_UNIDADE` | Un |
| `VAL_CUSTO_INICIAL` | Custo Inicial |
| `DTA_ALTERACAO` | quando foi mexido |

> ⚠️ **`TAB_DECOMPOSICAO` e `TAB_DECOMPOSICAO_ITEM` estão VAZIAS** (0 linhas) — são do
> *movimento* de decomposição, não do cadastro. Não confundir.

> ⚠️ **A tabela mistura carne com COMBO de mercearia** (COMBO PIZZA, COMBO BALA…). Filtrar
> só por "soma = 100%" **não basta** — alguns combos também somam 100. As matrizes de carne
> se chamam `AC MATRIZ CARNE %` e têm todos os itens em **KG**.

Matrizes de carne no Tradição (19/08/2026): `3902` BOI CASADO · `3919` DIANTEIRO ·
`3933` PA · `3957` SUINO (GORDO) · `3964` TRASEIRO · `14816` TRASEIRO (BOI CASADO CAPOTE) ·
`10084625` DIANTEIRO (BOI CASADO CAPOTE) · `10085967` SUINO (MAGRA).

## 🐖 17/09/2026 — Festival do Suíno: a conta real e DOIS furos no cadastro

Pedido: custo de cada corte a partir da última entrada de suíno.

### Onde mora o custo de ENTRADA (nao e o VAL_CUSTO_REP)

`TAB_NF` + `TAB_NF_ITEM`, ligadas por **`NUM_NF` + `NUM_SERIE_NF` + `COD_PARCEIRO`**
(as tres, nao so o numero). `VAL_CUSTO_SCRED` e o **custo unitario** (confere:
`QTD_ENTRADA × VAL_CUSTO_SCRED = VAL_TOTAL`).

Últimas entradas da matriz `10085967` no Tradição — **o suíno subiu 18% em 3 semanas**:

| Data | NF | kg | R$/kg |
|---|---|---|---|
| **14/09** | 1607765 | **992,75** | **9,00** |
| 11/09 | 1607119 | 553,05 | 8,80 |
| 02/09 | 1603926 | 1.023,70 | 7,90 |
| 25/08 | 1601272 | 928,50 | 7,60 |

> ⚠️ **Quem entra e a matriz `10085967` (AC MATRIZ CARNE SUINO).** A `3957`
> "SUINO (GORDO)" existe no cadastro de decomposicao mas **nao tem entrada** — usar
> a errada troca todos os percentuais.

### 🚨 Furo 1: o osso/sebo suíno tem PREÇO, e infla a tela

`00006927 AC MATRIZ DESOSSA OSSO/SEBO SUINO` esta com **`VAL_VENDA` = R$ 13,20** —
mas tem **curva X e venda media ZERO**: nao passa no caixa. A regra da tela e
*"preco ≤ R$ 0,01 nao gera receita"*, entao ela **conta 69 kg × R$ 13,20 = R$ 913
de receita que nunca existiu**, por carcaca. No boi a convencao esta certa; **no
suíno, nao**.

> 💰 Efeito medido na entrada de 14/09: margem **39,98% (tela) vs 37,37% (real)**
> — **2,6 pontos** de otimismo. Mesmo tipo de erro que motivou a mudanca de 19/08.
> **Correcao de verdade e no Intersolid**, zerando o preco desse PLU.

### 🚨 Furo 2: o maior corte (29,64%) nao vende — e intermediario

`00011235 AC SUINO PERNIL SEM OSSO` tambem tem **venda media zero**: ele vira os
produzidos **`AC SUINO (PRD) ...`** — PERNIL PICADO (15,99), PERNIL FILE (17,90),
PERNIL COM OSSO (13,99), FATIADO, TEMPERADO. **O `VAL_VENDA` 14,99 dele e um preco
de passagem, nao o de venda.** Para o resultado bater, avaliar o pernil pelo preco
do produzido que sai (usei PERNIL PICADO, o de maior giro).

> 🔑 **Regra geral:** corte com **`venda_media = 0` e curva X** e intermediario ou
> lixo de cadastro. Antes de dar numero, cruzar o corte com o giro — nunca confiar
> so no `VAL_VENDA`.

### O resultado da carcaca de 14/09 (992,75 kg × R$ 9,00 = R$ 8.934,75)

Receita a preco de hoje **R$ 14.266,91** → **margem 37,4%**. Orçamento de desconto
sem furar a margem alvo: **25% → R$ 2.353** · **20% → R$ 3.098**.

### 🎯 Preco UNICO para o festival: a media tem de ser ponderada pelo GIRO

Pedido: um preco so, com margem media de 15 a 20%. A conta:

> **preco = custo medio ponderado pelo giro ÷ (1 − margem alvo)**

Ponderar pelo giro, nunca media simples: o item que vende 13 kg/dia pesa 13 vezes
mais na margem real do que o que vende 1.

**Resposta no Tradicao (grupo PROTEINA SUINA, 17/09): R$ 9,99/kg → 16,9% de
margem media, 13 itens.** Faixa que atende o alvo: **R$ 9,77 (15%) a R$ 10,38 (20%)**.

⚠️ **A armadilha do preco unico:** os custos do grupo vao de **R$ 4,20 a R$ 20,50**.
Qualquer preco que de 15-20% na media deixa **9 itens abaixo do custo** (panceta,
costelinha, linguicas, rocambole). Nao existe preco unico que sirva pro grupo
inteiro — **o festival precisa ter uma lista de participantes**, e o corte natural
e `custo < preco`. Quem quiser todos dentro, o preco teria de subir para R$ 24
(o custo do mais caro + 15%), e ai nao e festival.

⚠️ **Um item SOBE de preco no festival:** o courinho, de R$ 7,99 para R$ 9,99.
Conferir sempre quem esta abaixo do preco fixo antes de imprimir cartaz — festival
que encarece produto queima a confianca do cliente.

### 📉 Cortes NEGATIVOS de proposito: funciona, mas o risco nao esta no preco

Ideia do Roberto (17/09): preco unico **R$ 13,00** com alguns cortes vendidos
**abaixo do custo** (costelinha), deixando a MEDIA no alvo. **Funciona: 20,2% de
margem media** com os 22 itens — os de custo baixo (bistecas R$ 8,40, pernil
R$ 7,79–9,66) pagam o prejuizo dos caros.

> ⚠️ **O risco nao e a margem media — e o MIX.** A media so fecha se o padrao de
> compra continuar parecido com o de hoje. Mas os cortes negativos sao justamente
> os de **maior desconto** (costelinha −48%, panceta −57%): e natural que vendam
> muito mais. **Ponto de ruptura medido: 1,55x.** Se o bloco negativo vender 55%
> acima do normal, a margem cai abaixo de 15%. Num festival, 55% a mais e pouco.

**Formula do ponto de ruptura** (vale para qualquer festival com item no vermelho):

```
V_max = (lucro_dos_positivos - alvo x preco x volume_positivos)
        / (perda_media_por_kg + alvo x preco)
```

### ❌ O limite por cliente NAO segura sozinho

Foi a primeira reacao do Roberto, e e boa — mas incompleta: o teto por cliente
barra quem levaria 20 kg, **nao a soma de 100 clientes levando 2 kg**. O teto que
importa e o **global do bloco negativo**: 45,8 kg/dia (hoje 29,5).

### ✅ A alavanca que realmente funciona: ESCOLHER quem fica negativo

| Item | perde por kg | giro | vale a pena? |
|---|---|---|---|
| ROCAMBOLE QUEIJO/BACON | **−R$ 7,50** | 1,6 kg/d | ❌ sangra muito, nao puxa ninguem |
| LINGUICA FINA MISTA | **−R$ 6,71** | 3,2 kg/d | ❌ idem |
| PANCETA / BARRIGA | −R$ 3,89 | 5,6 kg/d | ⚠️ avaliar |
| **COSTELINHA** | **−R$ 2,00** | 8,7 kg/d | ✅ **o melhor chamariz**: cai 48% na vitrine, perde pouco |

Tirando so o rocambole e a linguica mista (5 kg/dia somados), o **mesmo R$ 12,99
sobe de 20,2% para 23,7% e o ponto de ruptura vai de 1,55x para 2,34x** — o
festival passa a aguentar o dobro de corrida.

> 🔑 **Isca boa e a que perde POUCO por kg e ja tem giro**, nao a que tem o maior
> desconto percentual. Desconto grande em item de custo alto e so prejuizo caro.

📄 Entregue em `ofertas/Festival-do-Suino.xlsx` (abas: festival, fora, preco x
margem, a carcaca, como ler).

Scripts: `scripts/festival-suino.js` (desmembramento da entrada) e
`scripts/festival-suino-grupo.js` (grupo inteiro + preco fixo).

## 🔗 Relacionados
- [[../arquitetura/oracle-intersolid|Oracle Intersolid]] · [[../arquitetura/mapeamento-tabelas|Mapeamento]]

## 🏷️ Tags
#modulo #acougue #rendimento #oracle #intersolid
