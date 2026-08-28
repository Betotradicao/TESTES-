---
tags: [modulo, dvr, whatsapp, evolution, radar360]
atualizado: 2026-08-26
---

# Monitor do DVR por e-mail (RADAR 360)

O gravador manda um e-mail a cada evento. O sistema lê a caixa por IMAP, filtra
pelo assunto, guarda a imagem anexa e dispara no WhatsApp.

`backend/src/services/dvr/monitor-email.service.ts` · tela `MonitorDvr.jsx`

---

## 🔴 A Evolution precisa do **ID** do grupo, nunca do nome

`120363XXXXXXXXX@g.us` — não `ALERTA TRADICAO`.

O campo era **texto livre**. Dava pra digitar o nome do grupo, salvar sem erro
nenhum, e o alerta simplesmente não chegava: a Evolution recusa, o serviço
registra a falha no log e segue. Tela verde, WhatsApp mudo.

**Corrigido em 26/08 com três travas:**
1. O campo virou **seletor** alimentado por `GET /api/whatsapp/grupos`
   (`group/fetchAllGroups` da Evolution) — grava o `id`, mostra o `subject`.
2. Aviso vermelho na tela se o valor gravado não terminar em `@g.us`.
3. Falha de envio marca o alerta como `situacao = 'falha_envio'` e grita no log
   dizendo que provavelmente é o grupo. **Silêncio era o problema.**

> ⚠️ A busca de grupos demora ~20s com 35 grupos. Por isso é um botão explícito
> ("Buscar grupos") e não carrega sozinho ao abrir a tela.
>
> O seletor **preserva o valor já gravado** mesmo fora da lista — senão abrir a
> tela trocaria a configuração de quem tem grupo antigo.

---

## 📸 Alerta vai por `sendMedia`, com a foto

Alerta de câmera sem a imagem obriga quem recebe a ir até o gravador pra saber o
que houve — na prática, ninguém vai.

- **Com anexo:** `POST /message/sendMedia/{instancia}`, imagem em base64,
  texto como `caption`. Prazo de 45s (o upload é o gargalo).
- **Sem anexo:** cai pra `sendText` com `_sem imagem anexa_`.

O RADAR 360 já salvava a imagem desde o começo — só não enviava. Corrigido 26/08.

---

## ✂️ O corpo do e-mail é resumido, não repassado

O DVR manda e-mail longo com cabeçalho, rodapé e campos inúteis. Despejar isso no
WhatsApp faz a pessoa **parar de ler os alertas** — e alerta que ninguém lê é
alerta que não existe.

Quatro campos sobrevivem (os mesmos que o sistema do Tradição decantou em produção):

```
🚨 *ALERTA DVR* 🚨

🧠 Evento de alarme: Reconhecimento Facial
🕐 Horário do inicio do alarme(D/M/A H:M:S): 24/08/2026  14:58:40

📂 Banco de imagens: teste
🧑 Nome: 9
```

⚠️ **Acento opcional nas duas grafias:** o DVR escreve *"Horário do inicio"* —
acentuado num campo e não no outro. A regex é `/hor[aá]rio do in[ií]cio do
alarme/i`. Exigir a forma certa perde a linha silenciosamente.

Se nenhum campo casar, manda o texto cru cortado em 500 caracteres — alerta feio
é melhor que alerta nenhum.

---

## 🖼️ Galeria "Identificados em Loja"

A mesma fonte alimenta a galeria: alerta do tipo `facial` vira cartão com foto,
nome, banco de imagens e similaridade. É o fluxo do Prevenção no Radar.

### Campos extraídos na GRAVAÇÃO, não na exibição

`alertas_dvr.nome`, `.banco_imagens`, `.similaridade` saem do corpo do e-mail no
momento de gravar. Se ficassem só no `corpo`, a galeria refaria parse de texto a
cada abertura — e corrigir o parser depois não arrumaria o que já está gravado.

### ⚠️ A imagem do rosto EXIGE token

Diferente da foto de produto, aqui a imagem é o rosto de uma pessoa. Nome de
arquivo difícil de adivinhar basta para mercadoria, não para isto.

Por isso a galeria **não usa `<img src>`**: busca com o token e monta um `blob:`
(`FotoDoAlerta`), revogando o objeto ao desmontar — senão navegar acumula
centenas de blobs na memória.

### Período abre no MÊS, não no dia

Reconhecimento facial é evento esparso: abrir em "hoje" mostra tela vazia quase
sempre, e tela vazia faz parecer que o monitor parou.

⚠️ As datas são montadas com campos **locais**, nunca `toISOString()` — o ISO
converte para UTC e, no Brasil, a partir das 21h já devolve o dia seguinte.

---

## 📦 Imagens ficam no MinIO, não em disco

Mesma decisão das fotos de produto: bucket privado, servido pelo backend.
Prefixo `dvr/`. Com imagem em dois lugares, backup e limpeza passam a ter duas
regras — e a esquecida perde arquivo em silêncio.

⚠️ MinIO fora do ar **não derruba** o processamento do e-mail: o alerta é
gravado sem foto e o aviso no WhatsApp sai assim mesmo.

### 🔴 NUNCA copiar objeto do MinIO pelo sistema de arquivos

O objeto no volume não é o arquivo. Ele vira uma **pasta**:

```
minio-tradicao/dvr_1787594375619.jpg/
  ├── <uuid>/part.1     ← NÃO é o JPEG cru
  └── xl.meta
```

`part.1` tem checksum intercalado (proteção contra bit rot). Copiar de lá
produz um arquivo com o **tamanho certo e o conteúdo errado**: o navegador
mostra ícone quebrado e nada no log denuncia — o backend serve os bytes
normalmente, com `Content-Type: image/jpeg`.

**Sempre pela API S3** (`GetObjectCommand`). E conferir a assinatura antes de
gravar: JPEG começa em `FF D8 FF`. Imagem quebrada na galeria é pior que cartão
sem imagem.

### O que se aprendeu olhando o Tradição (26/08)

Lá as imagens estão em **três lugares que não conversam**: o banco aponta para
`https://tradicao.../storage/`, existem 10 arquivos em `/app/uploads/dvr_images`
e 164 no bucket do MinIO. De 109 caminhos no banco, só **5** batem com o que há
em `uploads`. Se a rota `/storage` mudar, a galeria inteira apaga.

No RADAR 360 é um lugar só, de propósito.

---

## Ver também
- [[modulos/leitor-codigo-barras]]
- [[bugs-resolvidos/2026-08-26-archiver-8-esm-quebra-instalador]]
