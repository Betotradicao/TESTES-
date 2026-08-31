# Onde paramos — 30/08/2026

## No ar em produção (RADAR 360)

Radar Facial completo, deployado e conferido em `tradicaosjc.prevencaonoradar.com.br`:

- **Detecção Facial** — rosto + atributos de quem passa, importação automática a
  cada 2 min nas duas câmeras faciais, expurgo de 30 dias
- **Ocorrências Faciais** — banco de rostos do DVR espelhado, criar/excluir
  grupo, cadastrar pessoa a partir de uma detecção, vídeos do furto
- **Identificados em Loja** — comparação rosto cadastrado × cena da câmera
- **WhatsApp** — cena, rosto e vídeos do furto (vídeos: 1× por dia por pessoa)
- **Permissões** — operador faz tudo no Radar; Configuração é do admin

Detalhes técnicos em `d:/radar360/MAPEAMENTO-DVR-FACIAL.md`.

## ✅ Legenda no vídeo (POS) — no ar, escrevendo bipagem real

A bipagem do açougue aparece escrita **dentro da imagem** da câmera 15 e fica na
gravação. Conferido na câmera com bipagens reais (`AC BOV C1 PATINHO 0,704kg`).

### ⚠️ As duas coisas que derrubaram a legenda por uma tarde inteira

Ambas se disfarçavam de "a aparência quebrou", porque o sintoma só aparecia
quando a aparência era escrita.

**1. `SrcPort`.** O DVR grava nesse campo a **porta efêmera da última conexão**
(`54098`, `51300`...). Relendo o registro e devolvendo esse valor, a entrada
passa a apontar para uma porta que nunca mais se repete, e o texto é descartado
em silêncio. Vai **fixa em 38800**.

**2. IP de origem.** O backend roda em contêiner e se enxerga como
`172.16.5.3`; ao sair pela VPN o endereço é trocado (`MASQUERADE`) e o DVR vê
**`10.200.200.1`**. Perguntar "qual é o meu IP?" de dentro do contêiner devolve
o endereço de ANTES da troca. Campo `ip_origem_pos` no DVR, que ganha da
detecção. Achado com `ip route get 10.6.1.110` na VPS.

⚠️ Em ambos os casos o DVR **aceita a conexão e joga o texto fora**: sem erro,
sem log, câmera limpa. Nunca dá para concluir "está configurado" a partir da
releitura.

### ⚠️ Não dá para conferir aparência pela API

`POS.getAll` diz o que está **guardado**, nunca se o gravador consegue
**desenhar** aquilo. Um valor que ele guarda mas não sabe desenhar é idêntico,
do lado de cá, a um que funciona. Consequências:

- Fonte só **24 e 32** — os dois em uso nas entradas que desenham. O `48` era
  invenção; ele guarda e não desenha.
- `Rect` é o **quadro inteiro deslocado**, não a caixa do texto: largura sempre
  `0..4096`, `Bottom - Top` sempre 4096, e o `Top` é um empurrão para baixo (a
  loja usa 24 e 73).
- A aparência parte **copiada** de uma entrada que está desenhando de verdade.

### ✅ PONTO DE RETORNO — bipagem real conferida, 31/08 10:40

`10:40  AC FRG (PRD) FRANGO A PASSAR / R$ 4,00  0.334kg` apareceu na câmera 15,
vindo da produção. **Quando alguma mudança quebrar a legenda, volte para cá
ANTES de investigar.**

A configuração inteira, campo a campo, está em
`d:/radar360/MAPEAMENTO-DVR-POS.md`, seção "PONTO DE RETORNO". O essencial:

```
NetAtt          SrcIP = DstIP = 10.200.200.1   (como o DVR VÊ o servidor)
                SrcPort = DstPort = 38800
ip_pos          10.6.1.110       (o POS só responde no IP da LAN)
ip_origem_pos   10.200.200.1
FontSize 32   FrontColor [255,156,62,128]   DisplayTime 45   OverlayType ROLL
Rect            Left 0  Top 369  Right 4096  Bottom 4465
Custom.LineDelimiter   vazio
Texto           UTF-8, 
 por linha, conexão ABERTA e mantida
```

⚠️ `SrcPort` é reescrita pelo gravador com a porta da última conexão. É normal e
não quebra nada — não perder tempo aí.

### Pendente

- Testar mudança de **cor** pela tela agora que a `SrcPort` está fixa — era a
  suspeita errada, deve funcionar. Roberto pediu cor, posição e segundos.
- A entrada `PDV15` é a da câmera 15. Cada `PDVn` é presa ao seu canal; pedir
  legenda numa câmera de caixa é recusado (apagaria a legenda das vendas).

## ✅ Banco facial — a foto agora fica gravada no DVR

O `addPersonWithImage` do `/cgi-bin/` **parecia servir**: responde `uid=N`, a
pessoa entra na lista, o rosto é extraído e o reconhecimento funciona. Mas ele
**não guarda o arquivo da foto**, e a tela do gravador mostra o quadradinho
quebrado. Nada acusa.

O caminho certo, lido do JavaScript da tela do DVR: `POST /RPC3` multipart, com
`faceRecognitionServer.append` no campo `verify` e o JPEG no campo `file`.
Detalhes em `d:/radar360/MAPEAMENTO-DVR-FACIAL.md`.

⚠️ **`GroupID` vai como TEXTO** (`"3"`). Com número o DVR responde
`groupId exceed!`, que parece "grupo inexistente".
⚠️ **Sem o cookie de sessão o `/RPC3` derruba a conexão** — parece rede.
⚠️ **O contador de processados sobe DEPOIS.** A extração é em segundo plano, e
ler logo após o cadastro acusava "não processou" em foto que ficava boa.

⚠️ Sobrou lixo dos meus testes: `ZZ CONFERINDO FOTO` no grupo ASSALTOS e uma
pessoa `uid 31` no FURTOS. Apagar é ação do Roberto, na tela.

⚠️ **Não usar o banco facial do cliente como bancada de teste.** Foi assim que
o lixo apareceu, e uma sondagem de parâmetros chegou a gravar (`modifyPerson`
respondeu 200 sem eu pretender alterar nada).

### ⚠️ Excluir rosto — três armadilhas em sequência

**1. A foto era compartilhada com a detecção.** Cadastrar pelo Reconhecer
apontava o rosto para o MESMO arquivo da detecção; apagar a pessoa apagava a
cena de quem passou, de outra tela, sem ninguém pedir. Agora **copia**, e a
exclusão só apaga imagem que começa com `rostos-faciais/`.

**2. Rosto apagado pela tela do DVR ficava preso aqui.** A exclusão exigia que
o gravador confirmasse a saída — e ele nunca confirma a saída de quem já saiu.
Agora pergunta se a pessoa ainda está lá (`pessoasDoGrupo`) e, se não está,
limpa só o espelho.

**3. A confirmação pedia o NOME digitado, e os nomes são números** (`27`, `9`).
Digitar número não faz ninguém olhar para o que apaga — só cria a chance de
errar o dígito. Virou sim/não. Na exclusão de GRUPO o nome digitado continua:
lá o nome é de verdade e leva os rostos de dentro junto.

⚠️ **Ler a lista de pessoas do grupo é pelo RPC**, não pelo CGI, e a resposta
vem em `params.results.candidates[].Person` — procurar em `params.results`
devolve vazio e parece grupo sem ninguém.

## ✅ Produção — aba Nutricionais

Nutricional, receituário e validade por item, com filtros, ordenação e PDF.

- nutricional: `TAB_PRODUTO.COD_INFO_NUTRICIONAL`
- receituário: `TAB_PRODUTO_LOJA.COD_INFO_RECEITA` — fica na **loja**
- validade: `TAB_PRODUTO.DIAS_VALIDADE`

⚠️ **A validade tem duas colunas parecidas no Oracle.** A do produto tem 815
itens preenchidos e valor real nos que têm receita; a `TAB_PRODUTO_LOJA.QTD_DIA_VALIDADE`
tem 67 e está zerada justamente nesses. Escolher pelo nome deixaria a coluna em
branco e pareceria que o campo não existe no ERP. As três entraram no
**mapeamento**, não cravadas no código.

⚠️ **Não busca sozinha.** Com "todas as seções" a consulta varre os 12.781 itens
do cadastro; sem seção o servidor exige o tipo, que é o que reduz a varredura.

## ⚠️ iPhone — três camadas no mesmo vídeo

Cada uma escondia a seguinte, e todas valem para qualquer `<video>` novo:

1. Sem `playsInline`, o iOS abre em **tela cheia** e o segundo vídeo some.
2. Dois vídeos **com som** não tocam juntos: o segundo pausa o primeiro. Por
   isso as câmeras da bipagem tocam **mudas**.
3. Tabela rolando para o lado **esconde informação sem avisar** no celular —
   Bipagens e Palavra-Chave viram cartões empilhados abaixo de 768px.

## 🧠 IA nas câmeras — duas frentes, ambas começadas em 31/08

### Frente 1 — Balança: o que é o produto (a mais promissora)

⚠️ **O rótulo vem DE GRAÇA.** O açougueiro pesa e digita o código; a bipagem diz
qual produto é aquela imagem. Marcar imagem à mão custa ~4h por 300; aqui chega
pronto ~50 vezes por dia. **449 fotos no primeiro dia.**

Coleta em `BalancaService`, tarefa `fotos-balanca` a cada 10 min, **fora do
caminho da bipagem** (decisão do Roberto: o que funciona não pode ser tocado por
experimento).

⚠️ **As fotos vêm da GRAVAÇÃO, de 16s a 2s antes do evento.** A primeira versão
tirava instantâneo na hora da bipagem e pegava a **bancada vazia** — quando a
etiqueta imprime, a carne já foi ensacada. Rótulo errado é pior que não coletar.
Três quadros, não um: não se sabe quanto dura cada pesagem.

⚠️ **O produto vai para a balança DENTRO DO SAQUINHO** (observação do Roberto
olhando a câmera). Foto de catálogo ensina o que a câmera nunca vai encontrar —
plástico reflete, embaça e clareia. Por isso `embalagem` é eixo separado de
`apresentacao`.

⚠️ **São duas balanças no campo da câmera.** O visor mostra o peso, e ele bate
com o da bipagem — é assim que se sabe qual das duas usar, sem comparar com
bancada vazia.

Telas em `Radar IA (teste)`: **Fotos da Balança** (revisar, confirmar com corte
e embalagem → promove a referência) e **Cadastro de Imagens** (por produto).

### Frente 2 — Caixa: se passou ou não passou

SKU-110K, 11.743 fotos, 1,7 milhão de produtos, **categoria única**. Treinando
na máquina da loja (i3, sem GPU): ~2h por época, 12 épocas. Salva a cada época.

⚠️ **NÃO existem pesos prontos publicados** — conferido, nem a Ultralytics tem.
⚠️ **Produto estrangeiro não é problema**: categoria única aprende FORMA, não
marca. O risco real é o ÂNGULO (gôndola de frente × esteira de cima).

### ⚠️ O que o modelo genérico faz — medido, não suposto

COCO conhece 80 categorias e **nenhuma é produto de mercado**. Nas câmeras da
loja: acha `person` bem, chama a balança de `laptop`, o teclado de `cell phone`,
e chuta `traffic light` e `horse`. Baixar o corte de confiança não resolve —
traz mais chute. **E de cima ele erra até o que conhece**: numa cena de caixa
marcou 3 pessoas e deixou 2 de fora.

### O caminho certo, que saiu da conversa

**Não usar detecção.** A balança não sai do lugar: marcar a região (4 números em
PORCENTAGEM) e recortar transforma o problema difícil (achar numa cena cheia) no
fácil (classificar uma imagem pequena). Menos dados, menos erro, e o rótulo já
existe.

⚠️ **Bancada de teste em `D:\iaovivo` (porta 8000) é DESCARTÁVEL.** O produto
final é o alerta dentro do RADAR 360, ao lado da bipagem — não um segundo
sistema.

### ⚠️ Erro caro que quase aconteceu

O download de 11 GB caiu **dentro da pasta do repositório**, que não tinha
`datasets/` no `.gitignore`; e o processo não morreu quando mandei parar —
chegaram a rodar quatro ao mesmo tempo. Corrigido: `os.chdir` antes de baixar
(a configuração da biblioteca sozinha não bastou) e `datasets/` ignorado.

## 💬 Em discussão — IA de furto nas câmeras

Conversa iniciada, **nada decidido**. O que ficou levantado:

- O DVR só tem `FaceAnalysis`/`FaceAttribute` — **não** faz detecção de objeto,
  então não ajuda; precisaria de GPU própria na loja (~R$ 3–5 mil, uma vez).
- O ativo raro do Roberto é **rótulo automático**: bipagem com timestamp +
  legenda no vídeo dão dataset etiquetado de graça.
- Recomendação: começar sem IA — cruzar **bipagem × peso × cupom** (o caso
  "passou a caixa, registrou 1 lata" é peso, não visão). Isso dá valor em
  semanas e constrói o dataset para um YOLO depois.
- Próximo passo sugerido: **levantar quantas divergências peso × cupom existem
  hoje no banco** — é consulta, não projeto, e diz se há material.

## Outros pendentes

- **Alertas antigos estão com `cod_loja` nulo** (gravados antes do campo
  existir). Corrigir só depois de o Roberto confirmar que todos são da Loja 1 —
  não deduzir.
- **Senha do DVR (`beto3107@`) apareceu no chat** — vale trocar.
