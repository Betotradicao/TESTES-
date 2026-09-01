# Onde paramos

## Feito hoje (31/08/2026)
- **Primeiro treino da IA da balança: 61,7%** (chute = 33%). O defeito não é o
  acerto, é a **confiança**: 19 dos 23 erros com >70% de certeza. Detalhes e
  decisões em [[modulos/ia-reconhecimento-balanca]].
- `Corrigir` da tela Fotos da Balança agora **escolhe do cadastro** (novo
  componente `EscolherProduto`), gravando `cod_produto`. Antes era texto livre e
  a foto corrigida se perdia para o treino.
- Pastilha de produto passou a contar **dentro da situação aberta**, e a tela
  solta o produto quando ele esgota.
- Apagados os 542 quadros inteiros do disco local (apareciam funcionários).
  Ficaram só os 310 recortes de prato. Original continua no MinIO.

## Rodando agora — RECUPERAÇÃO DAS FOTOS ANTIGAS
Ideia do Roberto: as bipagens existem desde 27/08, a coleta só começou em 30/08,
e o gravador tem imagem até 20/08. Logo, **1.424 bipagens sem foto são
recuperáveis**.

⚠️ O cron nunca acharia: `balanca.service.ts` usa `order DESC, take: 200`, e com
~500 bipagens/dia as 200 mais recentes são todas de hoje. O atraso é invisível
para ele.

Rodando em `/root/backfill-balanca.sh` na VPS (manual, em lotes de 40, para
sozinho ao acabar ou após 2 lotes vazios). Log em `/root/backfill-balanca.log`.
Ritmo medido: **15,6s por bipagem**, ~6h no total.

Confirmado que as fotos antigas servem: a câmera não saiu do lugar entre 27 e
31/08 — os retângulos dos pratos caem certo em todos os dias.

## Próximo passo (meu, quando o backfill acabar)
1. Retreinar com tudo (~1.200-1.500 recortes, contra 250)
2. Comparar **lado a lado** com os 61,7%, olhando **confiança nos erros** primeiro
3. Descartar os recortes de fotos com **os dois pratos cheios** (4% das fotos —
   medido; um dos dois está errado e não dá para saber qual)

## Fila depois disso
- **Tela de desenhar regiões** sobre um quadro da câmera. Serve para o prato da
  balança (hoje chumbado no código, quebra em cliente novo) e para o mapa de
  bandejas do balcão. Única coisa que não depende do treino.
- Máquina de treino central + fila + botão "usar este modelo" — só se o próximo
  número justificar. Treinar na VPS do cliente está **fora**: 2 núcleos.
- Ideia do balcão (mão entra na bandeja X): mais fácil e mais confiável que
  reconhecer corte. ⚠️ Precisa de câmera **de frente** — a do teto não vê os 3
  andares, o de cima tapa os de baixo. Hoje só existem 2 câmeras no açougue
  (`Canal 15 BALANCA`, `Canal 16 FACIAL`).

## Pendências antigas
- Trocar a senha do DVR (`beto3107@` foi exposta em chat)
- Apagar o lixo dos meus testes no banco facial (`ZZ CONFERINDO FOTO` em
  ASSALTOS, `uid 31` em FURTOS)
- Habilitar gravação nos caixas; reinstalar o leitor na segunda máquina
- C: com ~6 GB livres — treino roda em D:

## Estado do código
`radar360` em `f9bc92f`, produção com `index-CYMNdWDf.js`, containers saudáveis.
