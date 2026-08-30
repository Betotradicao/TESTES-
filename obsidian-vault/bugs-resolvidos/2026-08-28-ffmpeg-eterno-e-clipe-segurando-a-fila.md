---
tags: [radar360, dvr, ffmpeg, clipes, falha-silenciosa]
data: 2026-08-28
---

# ffmpeg eterno travando a VPS + clipe impossível segurando a fila

RADAR 360, commits `9a6c1fb`, `6d21691`, `38fa542`, `f6dcdf2`.

Achado **ao conferir um deploy**, não por reclamação: três processos `ffmpeg`
vivos ao mesmo tempo no mesmo canal, 100% de CPU no container, nenhum produzindo
arquivo — e **nenhuma linha de erro no log**. O cron parecia apenas "não estar
gerando".

---

## 🔴 Causa 1 — leitura RTSP travada não termina NUNCA

Sem `-rw_timeout`, um socket RTSP que para de entregar fica aberto para sempre:
o ffmpeg não sai, e o evento `close` que resolveria a promessa nunca chega.

⚠️ **O alarme por `setTimeout` do serviço não salvava.** Ele só dispara em
`max(300s, duracao*3s)` = 7 min para um clipe de 140s — e o ciclo seguinte, de
5 em 5 minutos, já tinha começado outro processo. O relógio do cron era mais
rápido que o próprio socorro.

```
'-rw_timeout', '20000000',   // 20s de silêncio e o ffmpeg desiste sozinho
```

⚠️ **Vai ANTES do `-i`.** Depois dele a opção vale para a SAÍDA e não faz nada —
falha que não dá erro, só continua travando.

### Como conferir se está acontecendo

`ps` não existe na imagem. Pelo `/proc`:

```bash
ssh vps-prevencao "docker exec radar360-backend sh -c '
  for p in /proc/[0-9]*; do
    c=\$(tr \"\\0\" \" \" < \$p/cmdline 2>/dev/null)
    case \"\$c\" in *ffmpeg*) echo \"\$p: \$(echo \$c | cut -c1-160)\";; esac
  done'"

docker stats --no-stream radar360-backend
```

Mais de um ffmpeg vivo ao mesmo tempo já é sinal.

---

## 🔴 Causa 2 — clipe impossível era tentado para sempre e segurava a fila

Gravação já apagada, ou câmera fora do ar naquele horário, **nunca** vira
arquivo. Mas era tentada de novo a cada 5 minutos — e como uma falha interrompe
o ciclo inteiro (proteção legítima contra link da loja fora do ar), **os clipes
seguintes nunca saíam**.

Falha silenciosa da pior espécie: o botão ficava cinza e nada dizia por quê.

### A correção: distinguir os dois tipos de falha

| Falha | O que é | O cron faz |
|---|---|---|
| **Trecho impossível** | gravação apagada, câmera fora naquele horário | **PULA** — é problema daquele horário |
| **Falha de rede** | link da loja fora do ar | **PARA** — é problema de todos |

Tratar os dois igual era o que fazia um clipe impossível parar a fila toda.

A falha agora é **gravada com contador** (`clipes.tentativas`). Na terceira, o
registro vira `desistiu` e passa a sair na hora, sem falar com o DVR. O erro
carrega o prefixo `DESISTIU: ` para o cron reconhecer.

⚠️ `desistiu` **não é definitivo**: clicar no botão Vídeo tenta de novo.

---

## 📹 Bipagem tem DUAS câmeras, não uma

A linha que causava:

```ts
const achado = uso === 'bipagem' ? lista[0] : ...
// "Bipagem não tem PDV: é a câmera da balança, uma só."
```

A suposição estava errada. Na Tradição são duas: a da **balança**, que mostra o
que foi pesado, e a **facial**, que mostra QUEM pesou. Com uma só, a tela
respondia metade da pergunta.

A tela de mapeamento **sempre** deixou marcar várias — era só esse `[0]` jogando
o resto fora, sem nada avisando.

⚠️ **PDV e risco continuam com uma câmera por caixa**: ali a lista é indexada
pelo número do PDV, e "todas" significaria mostrar os outros caixas junto.

### ⚠️ A chave do clipe passou a levar o canal

`bip:1:42:c14`. Sem isso as duas câmeras disputariam o mesmo registro: a segunda
sobrescreveria a primeira e o "reaproveitado" devolveria **o vídeo da câmera
errada**.

### ⚠️ Uma câmera que falha não derruba as outras

O erro dela vai junto na lista. Melhor abrir com "balança ok / facial fora do
ar" do que recusar tudo porque um canal está mudo.

### ⚠️ Nenhuma toca sozinha

Um botão **"Iniciar todas as câmeras"** dá o play nas duas, zerando o tempo
antes. Com `autoPlay` só na primeira, uma rodava e a outra ficava carregando, em
pontos diferentes do tempo — e é comparar as duas **no mesmo instante** que
responde a pergunta.

---

## ⏱️ O corte de 3h fazia o contrário do útil

O pré-download só pegava pendências com **mais de 3 horas**, herdado do sistema
antigo. O efeito na tela: a bipagem de agora abria com "gerando o clipe… 2
minutos e meio", e só a de três horas atrás abria na hora. **Justamente ao
contrário do que se olha** — quem confere pendência confere a de agora.

Agora são **4 minutos**, e esse é o **piso real**, não um número escolhido: o
clipe cobre 120s DEPOIS do evento (`depois` no mapeamento das câmeras), então
antes disso a gravação que ele precisa nem existe no DVR. O resto é margem para
o gravador fechar o arquivo.

⚠️ Continua **só para pendentes**. Bipagem que já casou com a venda foi vendida
— pré-gerar vídeo dela dobraria a carga no link da loja para assistir o que
ninguém vai assistir.

---

## 🔗 Relacionado

- [[bugs-resolvidos/2026-08-25-trava-de-cron-sem-prazo-parou-10h]] — mesma
  família: proteção necessária que, sem prazo, vira a própria falha
- [[modulos/dvr-cameras]]
- [[_current-work]]
