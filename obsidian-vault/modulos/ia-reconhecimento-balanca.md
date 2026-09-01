---
tags: [modulo, ia, balanca, acougue]
status: em-construcao
atualizado: 2026-08-31
---

# IA — Reconhecimento de produto na balança

Ensinar o sistema a olhar a foto da balança e dizer **o que está sendo pesado**,
para cruzar com o que o funcionário bipou. Divergência = o relatório que interessa.

Câmera `BALANCA ACOUGUE`, canal do DVR da Tradição SJC. 1920x1080.

## As duas frentes (não confundir)

1. **Identificar o produto** na balança — esta nota.
2. **Contar se os produtos passam** corretamente no caixa — outra coisa, outro modelo.

## ⚠️ O rótulo vem do cadastro, NÃO de regex na descrição

Primeiro eu montei os grupos por regra de texto (`ILIKE '%LINGUICA%'` etc). Funcionou
nos 219 registros existentes — e está **errado como projeto**.

O açougue já tem grupo no ERP, e é ele que manda:

`PROTEINA AVE` · `PROTEINA BOVINA` · `PROTEINA SUINA` · `EMBUTIDOS` ·
`SALGADOS E DEFUMADOS` · `ROTISSERIA`

`INSUMOS DE PRODUÇÃO` fica **fora** — não vai para balança (decisão do Roberto).

**Por quê:** regex apodrece. Produto novo com nome fora do padrão cai fora da regra e
ninguém percebe — o treino degrada em silêncio. O grupo do cadastro é mantido por eles
e produto novo já nasce classificado. Vem via `CatalogoService` (Oracle, pelo
MappingService); **não existe** coluna `grupo` na tabela `produtos` local.

## ⚠️ Prato vazio se detecta pela MEDIANA, sem IA

O problema: as 3 fotos por bipagem são tiradas de 16s a 2s antes do evento. Em muitas
o produto está na mão do operador, no ar, e o prato está vazio. Recorte vazio rotulado
como "bovino" **envenena o treino** — ensina que acém é uma chapa de inox.

A solução não precisa de IA: **o prato não sai do lugar e na maioria das vezes está
vazio, então a mediana de todos os recortes _é_ a foto do prato vazio.** Distância da
mediana = tem coisa em cima.

Medido em 31/08/2026 com 40 fotos ao acaso: 80 recortes, ~30 com produto.
Faixa de diferença 4.2 a 41.0; **corte em ~13** (abaixo disso já aparece mão e frasco
de spray). Rende ~0,75 recorte bom por foto.

Regiões dos pratos, em percentual do quadro (para não dependerem da resolução):

```
b1 = (0.333, 0.326, 0.529, 0.514)
b2 = (0.792, 0.394, 0.943, 0.546)
```

## ⚠️ Recortar o PRATO, não a bancada

Cheguei a propor uma faixa larga cobrindo a bancada inteira, porque num quadro que
examinei a carne estava na mão, no ar, e os dois pratos estavam vazios. **Estava errado.**
O recorte apertado no prato + descarte automático dos vazios dá imagem muito melhor
(224x224 de carne e prato, sem teto, sem notebook, sem operador) e resolve o caso da
mão sozinho — aquela foto simplesmente não entra.

Foi o Roberto que corrigiu, mandando um recorte apertado e perguntando "o ideal é a foto
vir assim?". Era.

## ⚠️ Ruído de rótulo é inevitável — e vira o produto

Se o funcionário bipa acém e era bacon, a foto do bacon entra na pasta de bovino. Não há
como saber na hora.

- **Ruído aleatório não quebra**: 3 erradas em 50 são vencidas pelas 47. É por isso que
  vale juntar 40-50 por grupo em vez de treinar com 10 (com 10, uma errada é 10%).
- **Erro sistemático quebra**: se o funcionário bipa errado *sempre*, a IA aprende o erro.
  Contra isso só conferência humana.
- **Depois de treinada, é ela que acha esses casos**: bipagem diz X, IA diz Y com
  confiança alta → é o relatório de divergência. O botão `Corrigir` da tela
  Fotos da Balança fecha o ciclo.

### ⚠️ A foto pode ser da bipagem VIZINHA (31/08/2026)

Parecia erro de operador: bipagem `AC BOV C2 (PRD) OSSOBUCO` com **salsicha
alaranjada** na foto. Registrei como erro de digitação. **Estava errado.**

Os horários explicam:

| bipagem | bipou | fotos |
|---|---|---|
| 1673 `OSSOBUCO` | 18:24:53 | 18:24:**37** e 18:24:**43** |
| 1674 `SALSICHA DE FRANGO` | 18:25:04 | 18:24:**48** e 18:24:**54** |

Onze segundos entre as duas, e a coleta pega de 16s a 2s **antes** do evento —
as janelas se encostam. Às 18:24:43 o funcionário já estava mexendo na salsicha
da bipagem seguinte. Não foi o operador que errou: foi a coleta pendurando a
foto na bipagem errada.

⚠️ **Não dá para saber por qual balança passou.** `bipagens.equipamento_id` é o
leitor de código de barras (valor 2 nas duas), não a balança. Dois funcionários
trabalham nas duas balanças ao mesmo tempo.

**Regra que sai disso:** foto cuja bipagem tem outra a menos de 20 segundos
**não entra no treino**. Medido em 31/08/2026 sobre 479 fotos:

| situação | fotos |
|---|---|
| sem bipagem vizinha em 60s | 164 |
| vizinha a mais de 40s | 127 |
| vizinha entre 20 e 40s | 90 |
| **vizinha a menos de 20s — descartar** | **98** |

Custa 20% do material e compra rótulo confiável. É automático, ninguém clica.

**Lição maior:** ver produto errado na foto **não prova** erro de operador. Antes
de acusar alguém, conferir se existe bipagem vizinha. Isto vale para o relatório
de divergência que a IA vai gerar — divergência em foto com vizinha próxima é
suspeita da ferramenta, não da pessoa.

⚠️ Em foto com rótulo errado o certo é **`Corrigir`**, não `Descartar`: corrigir
devolve a foto ao grupo certo e ela ainda treina. E `Corrigir` **escolhe do
cadastro** — texto livre gravava só a descrição, sem `cod_produto`, e sem código
não há grupo: a foto corrigida com esmero era justamente a que se perdia.

## Ordem do trabalho (por que nesta ordem)

1. **Grupo primeiro** — sai de graça, zero clique do Roberto, porque a bipagem dá o
   código e o código dá o grupo.
2. **Apresentação depois** (inteiro / fatiado / moído) — a bipagem **não** diz.
   Só o Roberto sabe, e aí sim custa clique dele.

Inverter seria pedir 439 marcações à mão antes de qualquer prova de que funciona.

O mesmo código pode ser as duas coisas: `00003773 AC BOV C2 ACEM` apareceu com
17 fotos `moído` e 2 `fatiado`. É a razão de existir o eixo apresentação em
[[cadastro-imagens-produto]].

## Primeiro treino — 31/08/2026 — 61,7%

`yolo11n-cls` (ImageNet) afinado em 250 recortes. 4 grupos; `ROTISSERIA` sem
nenhuma pesagem coletada (só vende fim de semana) e `SALGADOS E DEFUMADOS`
fora por ter 10 no treino e 0 na prova.

Parou sozinha na época 33 (melhor foi a 14). Chute no maior grupo = 33,3%.

| grupo | acerto |
|---|---|
| PROTEINA AVE | 67% |
| PROTEINA SUINA | 61% |
| PROTEINA BOVINA | 60% |
| EMBUTIDOS | 57% |

Nenhum grupo ficou para trás — a média não está escondendo um grupo morto.

### ⚠️ O problema não é o acerto, é a CONFIANÇA

**19 dos 23 erros foram cometidos com confiança acima de 70%**, vários com 100%
(era AVE, disse BOVINA, 100%). A confiança média fica em 82-91% enquanto o
acerto real é 61%.

**Consequência prática:** a confiança **não serve de filtro**. O plano era
"aponta só quando estiver certa" — e ela está sempre certa, inclusive quando
erra. Modelo assim **não pode apontar pessoa**: acusar com 100% de convicção e
estar errado queima a ferramenta de uma vez, e não tem alarme para "a IA ficou
convincente demais".

⚠️ Ao avaliar o próximo treino, olhar **confiança nos erros** antes de olhar
acerto. Um modelo com 70% de acerto e dúvida honesta vale mais que um com 80% e
convicção cega.

### Erro espalhado, não concentrado

Eu tinha combinado a leitura: erro concentrado (bovina × suína) seria falta de
foto; espalhado seria caminho errado. **Ficou no meio** — espalhado por todos os
pares, mas bem acima do chute. Não é motivo para trocar de rumo; é sintoma de
250 imagens. A partir da época 6 o erro de treino caía e o de validação subia:
decorou.

**Decisão:** não mudar nada. A coleta segue automática; retreinar quando o
material triplicar e comparar. Se subir para ~75% **e a confiança acompanhar o
acerto**, o caminho estava certo.

## Teto conhecido

Acém moído e `AC BOV C2 CARNE MOIDA BDJ` **são visualmente a mesma coisa**. Nenhum modelo
separa os dois pela foto — é limitação da física, não do modelo. Para o objetivo (pegar
quem pesa picanha digitando acém) "bovino moído" já resolve, porque picanha não parece moída.

## Onde ficam as coisas

| O quê | Onde |
|---|---|
| Coleta das fotos | `backend/src/services/dvr/balanca.service.ts` (cron) |
| Fotos + palpite | tabela `fotos_balanca` (`ia_palpite`, `ia_confianca`, `ia_modelo`) |
| Imagem em si | MinIO, `balanca/<loja>/<data>/<bipagem>-<n>.jpeg` |
| Fotos de referência | `ImagemProduto` — eixos `apresentacao` + `embalagem` |
| Treino / bancada | `D:\ia` (fora do repositório; `venv`, `treino/`, `aovivo/`) |

Relacionadas: [[bipagens]] · [[dvr-cameras]] · [[vision-antifurto]] · [[producao]]
