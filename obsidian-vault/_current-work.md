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

## ⏸️ Pendente — legenda no vídeo (POS)

Mapeado e **testado com bipagens reais** na câmera 15 (BALANÇA AÇOUGUE). Falta
só o encanamento.

**Esperando:** a informática da loja liberar no roteador a porta **38800/TCP**
para `10.6.1.110`, **restrita à origem `31.97.82.235`** (a VPS). O texto pronto
para eles foi passado ao Roberto no chat.

⚠️ A restrição de origem é obrigatória: o protocolo POS **não tem autenticação
nenhuma** — aberto para a internet, qualquer um escreve na câmera do cliente e
fica gravado.

**Quando liberarem:** testar da VPS e montar o envio automático — bipagem do
açougue aparecendo na câmera 15 em tempo real. Não há código de POS no sistema
ainda; hoje só sai com envio manual da máquina `10.6.1.171`.

Como funciona: `d:/radar360/MAPEAMENTO-DVR-POS.md`. As duas armadilhas que
custaram caro: `SrcIP` **e** `DstIP` apontando para quem manda, e a conexão TCP
**mantida aberta** (abrindo/fechando por linha o DVR descarta em silêncio).

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
