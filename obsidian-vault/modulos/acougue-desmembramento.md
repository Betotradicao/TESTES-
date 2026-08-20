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

## 🔗 Relacionados
- [[../arquitetura/oracle-intersolid|Oracle Intersolid]] · [[../arquitetura/mapeamento-tabelas|Mapeamento]]

## 🏷️ Tags
#modulo #acougue #rendimento #oracle #intersolid
