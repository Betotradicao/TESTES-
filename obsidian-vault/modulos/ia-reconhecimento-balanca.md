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

## 02 e 03/09 — cinco treinos, e o numero so caiu

| treino | recortes | grupos | acerto |
|---|---|---|---|
| 31/08 `balanca-grupo` | 250 | 4 | 61,7% |
| `bons` / `bons2` | 1.085 | 5 | 55,2% |
| `bons3` | 1.877 | 5 | 50,3% |
| `bons4` | 1.229 | 5 | 48,2% |
| `bons5` | 1.229 | 5 | 48,8% |

⚠️ **Nao se comparam.** A regua mudou tres vezes no meio: 4 para 5 grupos,
rotulo sujo para limpo, validacao sorteada para validacao por data. O que da
para afirmar e so isto: com cinco vezes mais foto, nao subiu.

E a licao maior: **cinco treinos seguidos sem mexer no rotulo.** O erro estava
todo antes do treino, e nenhum ajuste de epoca, de tamanho ou de aumento de
imagem ia achar.

## 05/09/2026 — tres defeitos, todos no ROTULO, nenhum na IA

Antes de treinar de novo, medi por que nao subia. Os tres achados sao de
preparo de dado; o modelo nunca foi o problema.

### 1. A regra de grupo tinha duas copias, e elas divergiram

`backend/src/utils/grupo-produto.ts` classificava `EMBUTIDOS`.
`baixar-fotos.py`, que rotula o treino, **nao tinha essa linha**.

Resultado: **583 fotos** de linguica, salsicha, calabresa e bacon eram
descartadas antes do treino. A IA nunca viu um embutido — e a tela de Palpites,
que usa a regra completa, cobrava dela justamente esse grupo. Media no dia
05/09: **acertava 3 de 101**.

⚠️ Os dois arquivos ja traziam, em maiusculas, o aviso *"tem de ser IDENTICA"*.
Ninguem errou nada: as copias foram editadas em dias diferentes, por motivos
diferentes. **Escrever o aviso nao impediu.** Agora existe
`ferramentas/conferir-regra-grupo.js`, que sai com erro se divergirem — e que
foi testado quebrando de proposito, porque conferidor que so sabe dizer "ok"
nao vale nada.

Calabresa e bacon entram em `EMBUTIDOS` — decisao do Roberto em 05/09/2026.

⚠️ `[SEM CADASTRO] PLU 03773` e o mesmo produto que `00003773 AC BOV C2 ACEM`:
o PLU vem sem o preenchimento de zeros. Sem normalizar o codigo, 96 fotos boas
viravam lixo por formatacao.

### 2. A regra dos 20 segundos nunca foi escrita

Decidida em 31/08 (a foto pode ser da bipagem vizinha), **nunca chegou ao
codigo**. Os treinos de 02 e 03/09 rodaram todos com esse ruido dentro. Medido
agora sobre 3.315 fotos: **928 (28%)** tem bipagem vizinha a menos de 20s.

⚠️ Nao e o mesmo ruido do prato: o filtro de prato resolve duas pessoas em duas
balancas (confusao no ESPACO), a regra dos 20s resolve duas bipagens seguidas na
mesma balanca (confusao no TEMPO). Consertar um nao conserta o outro — e foi
por isso que o `bons4` (com o filtro de prato) nao subiu.

### 3. O filtro de prato vazio estava fora de calibre — o pior dos tres

O metodo era "distancia da mediana", isto e, diferenca de COR. Duas falhas:

**Media a borda junto.** O recorte pega o vao onde o operador passa o braco, e
movimento ali levanta a diferenca sem ter nada no prato. Olhando folha de
contato por faixa: pelo recorte inteiro **o prato ainda estava VAZIO ate
distancia 26**, e o corte era **13**. Cerca de **1.600 recortes de inox limpo
entraram no treino rotulados como carne** — exatamente o veneno que esta nota
manda evitar, na dose maxima.

**Corta produto PALIDO.** Passavam 38% das fotos de `PROTEINA AVE` contra 18%
das de `EMBUTIDOS`: salsicha e linguica branca sao da cor do inox. O grupo que
ja estava morto morria de novo, agora no filtro.

**Agora o prato cheio se acha pela TEXTURA**, nao pela cor: prato vazio e chapa
LISA; saco amassado, salsicha e carne tem dobra, borda e relevo. Nao tem
preferencia por cor, e dispensa a mediana. Corte em **3.0**, escolhido OLHANDO a
folha de contato.

⚠️ Conferido que o filtro nao e injusto: dos recortes de `EMBUTIDOS` que ele
rejeita, **24 de 24 conferidos eram prato realmente vazio**. O embutido aparece
menos no prato mesmo — industrializado, o operador manuseia mais rapido.

### O tamanho real do material

Depois de tudo limpo, das **3.315 fotos** sobram **~810 recortes**. Em **78%
delas o prato esta vazio no instante fotografado**. Nao e desperdicio do
filtro: e o que existe.

### ⚠️ A janela da coleta esta TARDE — e isso rende mais que treinar

A coleta guarda quadros de 16s a 2s antes da bipagem. Medido em 05/09/2026, por
posicao do quadro:

| quadro | quando | com produto no prato |
|---|---|---|
| `-0` | ~16s antes | **35%** |
| `-1` | ~10s antes | 28% |
| `-2` | ~4s antes | **5%** |

Cai sem parar conforme chega perto da bipagem. Quando a etiqueta e bipada a
carne ja foi ensacada ha muito — **a janela precisa ir mais para tras**. Mexer
em `INICIO_S` (`balanca.service.ts`) rende mais material que qualquer ajuste de
treino, e nada no treino compensa foto de prato vazio.

### A regua, agora travada

Validacao = as fotos do **dia 05/09 (ids 4227 a 5468)**, dia que nenhum modelo
treinou. Material novo entra so no treino, e a janela **nao se mexe** — sem isso
dois treinos nao se comparam, que foi o que aconteceu em 03/09.

Medido nessa regua, o modelo que esta em producao (`bons5`, de 03/09):

| | acerto |
|---|---|
| geral | **39,3%** (chute no maior grupo = 29,3%) |
| PROTEINA AVE | 109/152 — 72% |
| PROTEINA BOVINA | 83/174 — 48% |
| PROTEINA SUINA | 38/166 — 23% |
| EMBUTIDOS | **3/101 — 3%** |

⚠️ A confianca, que era a doenca de 31/08, **sarou**: os erros com mais de 70%
de certeza cairam de 83% para 9%. Ela parou de errar convicta. Trocou um defeito
grave (acusar com 100% e estar errada) por um defeito honesto (nao saber).

### O caminho novo, sem senha

`baixar-fotos.py` entrava pela API do RADAR com usuario e senha na linha de
comando, e nao dava o leitor nem a vizinha. Agora:

`exportar-fotos.sql` (postgres da VPS) -> `montar-indice.py` (o grupo) ->
`preparar-balanca.py` -> `treinar-balanca.py` -> `conferir-confianca.py`.

As imagens vem do MinIO por `mc`, com a credencial do proprio ambiente do
container — nao passa por linha de comando nem por log.

## Treino de 05/09/2026 — 62,7%, e o dilema

562 recortes de treino, 249 de validacao (o dia 05/09), 4 grupos. Parou sozinha
na epoca 46; a melhor foi a 26.

| | modelo de 03/09 | modelo de 05/09 |
|---|---|---|
| **acerto** | 50,6% | **62,7%** |
| PROTEINA AVE | — | 85% |
| PROTEINA SUINA | — | 74% |
| PROTEINA BOVINA | — | 28% |
| **EMBUTIDOS** | **3%** | **28%** |
| **separacao da confianca** | **68,2%** | 62,2% |

Chute no maior grupo = 38,6%. O embutido saiu do zero.

⚠️ **O acerto subiu e a confianca piorou.** Os erros com mais de 70% de certeza
foram de 18% para **71%**; a confianca media e 86,7% acertando contra 79,5%
errando. A doenca de 31/08 voltou — com menos imagem (562 contra 1.229), o
modelo decora e responde com certeza tambem quando erra.

### SEPARACAO — a medida que nao se engana com o nivel

"Erros acima de 70%" e "confianca media" mudam de valor quando o treino baixa
TODAS as confiancas de uma vez: o modelo parece mais humilde sem separar nada
melhor. **Separacao** pergunta o que interessa: *pegando um acerto e um erro ao
acaso, quantas vezes o acerto vem com mais confianca?* 50% = a confianca nao
vale nada; 100% = da para cortar por ela.

Testados tres sinais no modelo novo — todos empatam, entao nao ha ganho facil:

| sinal | separacao |
|---|---|
| probabilidade do primeiro | 62,2% |
| margem para o segundo | 61,9% |
| entropia da resposta | 62,7% |

Cortando nos 10% mais confiantes o acerto vai a 79,2%; nos 20%, 73,5%.

⚠️ **Conclusao: ainda NAO pode apontar pessoa.** Serve para ordenar o que o
Roberto olha primeiro, nao para acusar. Acusar com 79% de acerto queima a
ferramenta na primeira vez que erra com um funcionario junto.

### ⚠️ `label_smoothing` nao existe mais — e falha CALADO

Era o caminho obvio contra a conviccao cega. Nesta versao do ultralytics esta
descontinuado e e **ignorado em silencio**: o treino com 0.1 deu exatamente os
mesmos numeros do treino sem ele nas quatro primeiras epocas, e so o aviso no
log denunciou. Foi por comparar os numeros que se percebeu.

**Licao:** parametro novo que nao muda o resultado nao "funcionou pouco" — ele
provavelmente nao rodou. Conferir antes de concluir qualquer coisa.

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
