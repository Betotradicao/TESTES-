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

## Ordem do trabalho (por que nesta ordem)

1. **Grupo primeiro** — sai de graça, zero clique do Roberto, porque a bipagem dá o
   código e o código dá o grupo.
2. **Apresentação depois** (inteiro / fatiado / moído) — a bipagem **não** diz.
   Só o Roberto sabe, e aí sim custa clique dele.

Inverter seria pedir 439 marcações à mão antes de qualquer prova de que funciona.

O mesmo código pode ser as duas coisas: `00003773 AC BOV C2 ACEM` apareceu com
17 fotos `moído` e 2 `fatiado`. É a razão de existir o eixo apresentação em
[[cadastro-imagens-produto]].

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
