---
tags: [oferta, precificacao, oracle, tradicao, margem]
data: 2026-09-12
---

# 🔟 Oferta de valor fechado ("Quinta do 10") — como montar a lista

Mecânica: **N unidades por um valor redondo** (R$ 10,00 no Tradição), mantendo a
margem numa faixa. Vale para qualquer valor — troque o 10 pelo alvo.

## 🧮 A conta que dispensa testar preço por preço

> **margem = (VALOR − N × custo) ÷ VALOR**

Invertendo, o filtro vira uma faixa de **custo total do combo**:

| Alvo de margem | Custo total das N unidades (combo de R$ 10) |
|---|---|
| 15% a 20% | R$ 8,00 a R$ 8,50 |
| **12% a 22%** (a escolhida) | **R$ 7,80 a R$ 8,80** |

Ou seja: **não importa o N nem o preço unitário** — basta procurar produto cujo
`custo × N` caia na janela. Um único `BETWEEN` no Oracle resolve, e o N certo se
acha depois testando 1..12 em memória.

⚠️ **O "vão" entre os N.** Para muitos itens **nenhum N inteiro** cai na janela —
o combo pula de 14% para 22% de um N para o outro. Foi por isso que molho de
tomate ficou de fora da lista de 12/09. Não é falta de produto, é aritmética:
quanto mais caro o item, mais largo o salto. **Faixa estreita = lista curta.**
Medido no Tradição (12/09): 15–20% → 249 itens. **O Roberto abriu para 12–22% e a
lista saltou para 448** — e só aí entraram itens óbvios de oferta que a faixa
estreita tinha descartado: molho de tomate (7x R$ 1,43), papel higiênico
(1x R$ 10,00), detergente Ypê (4x R$ 2,50) e as cervejas de maior giro.
**A faixa estreita não descarta item ruim — descarta item que não cabe na
aritmética.**

## 🧱 De onde vem cada número (Oracle Intersolid, via MappingService)

| Dado | Chave lógica | Coluna real no Tradição |
|---|---|---|
| Custo | `preco_custo` (TAB_PRODUTO_LOJA) | `VAL_CUSTO_REP` (custo de **reposição**) |
| Preço atual | `preco_venda` | `VAL_VENDA` |
| **Curva ABC** | `curva` | `DES_RANK_PRODLOJA` |
| Giro | `venda_media` | `VAL_VENDA_MEDIA` |
| **Vendido por peso** | `pesavel` (TAB_PRODUTO) | `FLG_ENVIA_BALANCA` |

> 🔑 **A curva ABC não se calcula** — o ERP já mantém em `DES_RANK_PRODLOJA`.
> Refazer a conta daria número diferente do que as telas mostram.

⚠️ **Pegadinha de chave lógica:** em `TAB_SECAO` a descrição é
`descricao_secao`, **não** `descricao` (que existe em `TAB_PRODUTO`). Pedir a
chave errada devolve o literal `DESCRICAO` e o Oracle responde `ORA-00904`.

## ⚖️ A armadilha que estraga o cartaz: item de balança

Com `FLG_ENVIA_BALANCA = 'S'`, o "N" **não são unidades, são QUILOS**. "3x banana
por R$ 10" vira "3 kg por R$ 10" — no cartaz tem de sair **preço por quilo**
(R$ 3,33/kg). Foram 34 dos 250 candidatos: hortifruti, açougue e padaria a
granel. **Separar sempre**, senão o cartaz promete o que a balança não faz.

⚠️ Alguns itens de padaria têm "UN" no nome e mesmo assim vêm marcados como
balança (`DOCE SUSPIRO UN`). Conferir no cadastro antes de anunciar.

## 🥬 Hortifruti fica de fora — e os OVOS não são hortifruti

O Roberto pediu a lista **sem hortifruti**. Cortar a seção inteira leva junto o
que está apenas *arquivado* nela: **`OVOS GRANJA BRASIL`** (C/6 e C/12), que são
embalados e de giro alto. O corte certo é por **prefixo `FLV` + flag de balança**,
não pela seção. Seção no ERP é onde o produto foi cadastrado, **não é
necessariamente o que ele é**.

## 🚩 Sinal de custo desatualizado

Desconto implícito acima de ~40% quase sempre é **custo velho**, não oportunidade:
significa que o preço de hoje está muito acima do custo registrado. Conferir a
última compra antes de publicar — foi o caso da `PEDRA SAN LIPEX` (−67%).

## 📎 Onde ficou

Script da consulta: `scripts/oferta-combo-valor-fechado.js` (padrão de
[[../padroes/regras-ssh-windows|consulta avulsa no Oracle]]).
Saída em `ofertas/`: `Quinta-do-10.xlsx` (uma aba por curva + aba "Como ler") e
os CSVs por curva. Excel gerado com `openpyxl` — **não vinha instalado**, foi
preciso `pip install openpyxl`.

## 🔗 Relacionado

- [[analise-preco|Análise de Preço / Margem]] — a fórmula de margem sobre venda
  vem de `ancoragem.service.ts`
- [[../arquitetura/oracle-intersolid]] · [[../arquitetura/mapeamento-tabelas]]
- [[../clientes/tradicao]]
