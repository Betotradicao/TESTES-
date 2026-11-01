# Backend para de abrir conexões NOVAS — e o watchdog não enxerga

**Data:** 22/08/2026 · **Cliente:** [[../clientes/tradicao|Tradição]] · **Downtime:** ~11h sem ninguém perceber

## 🔴 Sintoma
Roberto: "pesquisa de itens em ruptura fica carregando e no final dá erro no celular".

Na real era muito maior: **2.428 falhas de cron** desde 13:00 UTC (10:00 BRT).
Nenhum relatório saiu o dia inteiro — quebras, cortes, abastecimento, vendas
mensais, atrasos, top quedas. O monitor de e-mail também morreu.

```
Error: Connection terminated due to connection timeout
  [cause]: Error: Connection terminated unexpectedly
```

## 🎯 Causa
O processo Node entra num estado onde **não consegue mais abrir conexão nova**
(Postgres E IMAP), mas as **conexões que já estavam no pool continuam servindo**.

Por isso a tela "meio funciona": carrega o que dá com as conexões quentes e
estoura quando precisa de mais uma — 30s depois (`connectionTimeoutMillis`).

## 🧪 O que DESCARTAR primeiro (tudo isso estava normal)
| Suspeito | Como medir | Estava |
|---|---|---|
| Postgres lotado | `select count(*) from pg_stat_activity` vs `max_connections` | 8 de 100 ✅ |
| Rede / Docker | abrir 15 conexões simultâneas de um processo **novo** no container | 15 OK em 212ms ✅ |
| DNS | `dns.lookup` num processo novo | 8ms ✅ |
| CPU travada | `docker stats` | 0,01% ✅ |
| Pool vazado | conexões do backend no PG | só **2**, com pool `max: 20` ⚠️ |

> 🔑 **A pegadinha:** processo NOVO dentro do MESMO container conecta numa boa.
> Só o processo antigo do backend é que não conecta. Se testar de fora e der
> tudo verde, não conclua que está tudo bem — o defeito é interno ao processo.

## ⚠️ O WATCHDOG NÃO PEGA ESSE CASO
O container ficou **`healthy` o tempo todo**, 11 horas. O healthcheck bate num
endpoint que é servido pelas conexões já abertas — ou seja, **passa mesmo com o
backend meio morto**. O [[../arquitetura/radar-watchdog|watchdog]] só reinicia
container congelado; esse aqui não estava congelado, estava *manco*.

**Conclusão:** `healthy` no `docker ps` **não** é prova de que o backend está
funcionando. Pra ter certeza, contar falha de cron:

```bash
docker logs prevencao-<cliente>-backend --since 1h 2>&1 | grep -c 'connection timeout'
```

Zero = saudável. Centenas = manco há horas.

## 🔧 Solução aplicada
`docker compose restart backend`. Em 2 min: 0 falhas de conexão, 0 erro IMAP,
crons de volta.

## 🕳️ O que ficou EM ABERTO
**Não achei por que o processo degrada.** Rodou 23h saudável (deploy 21/08
13:39) e quebrou às 13:00 UTC do dia 22. Hipótese não confirmada: threadpool do
libuv esgotado (4 threads) por operação pendurada — o IMAP falhando junto aponta
pra isso, porque conexão nova precisa de `dns.lookup`, que usa esse threadpool.

Se repetir: **antes de reiniciar**, pegar o estado das threads de dentro do
container (`ps -T`, `/proc/<pid-interno>/task/*/wchan`) — de fora só se enxerga
o `docker-init`, por causa do namespace de PID.

## 🔁 REINCIDIU em 07/09/2026 — ~18h, de novo sem ninguem ver

Mesma assinatura, mesmo cliente. Chegou como **"o login do Tradicao nao carrega a
senha"**: a tela ficava em *Entrando...* pra sempre.

| Evidencia | Valor |
|---|---|
| 1º `Connection terminated due to connection timeout` | **05:12 UTC** (02:12 BRT) |
| Restart | **00:07 UTC do dia 08** — ~**18h** mancando |
| `docker ps` | `Up 5 days (healthy)` o tempo todo |
| `/api/health` | **200 em 70ms**, antes e depois — nao serve de prova |
| `pg_isready` no container do Postgres | *accepting connections* — o banco estava bem |
| `nc 187.90.96.96 11251` (Oracle da loja) | **succeeded** — o ERP estava no ar |
| IMAP | `Timed out while connecting to server` — a marca registrada deste bug |

⚠️ **A pista que engana:** o log repetia
`[SellsSync] 🛑 2 syncs ainda em voo (teto 2). NAO vou iniciar outro — provavel
Oracle fora do ar.` Isso faz pensar em [[2026-07-25-backend-tradicao-congelou-queda-oracle|queda de Oracle]],
que e **outro** bug. Mas o Oracle respondia na porta: os syncs estavam presos
porque o processo **nao abre conexao nova**, nao porque a loja caiu. **A mensagem
do SellsSync e consequencia, nao causa.**

### 🎯 O sintoma novo que vale guardar: quem quebra primeiro e o LOGIN

O login e a primeira tela que **precisa de conexao nova** com o banco. Quem ja
estava logado continua navegando com as conexoes quentes, entao **ninguem reporta
nada** — so quem tenta entrar. A prova fica no log:

```
🔐 Tentativa de login: {      <- entra
                                <- e NUNCA sai um "Usuario admin encontrado"
```

> 🔑 **"Nao consigo entrar / a senha nao vai" + container `healthy` = suspeitar
> deste bug ANTES de olhar senha, usuario ou banco.**

### ❌ O que eu errei nesta rodada

A propria nota pedia: *se repetir, pegar `ps -T` e `/proc/<pid>/task/*/wchan` de
DENTRO do container antes de reiniciar.* **Reiniciei sem capturar** — a evidencia
que confirmaria a hipotese do threadpool do libuv foi perdida outra vez.
Na proxima: **coletar primeiro, reiniciar depois.**

### 🐕 O watchdog continua cego (3ª vez que isso custa caro)

`watch.list` ja inclui o `tradicao` desde 03/08 e mesmo assim ficou 18h. O sensor
e o `/api/health`, que responde 200 sem tocar no banco. **Enquanto a sonda nao
abrir conexao NOVA (ou contar falha de cron), este bug e invisivel pro watchdog
por construcao.** Pendente de decisao do Roberto.

## 🔬 15/09/2026 — 4ª vez, e desta vez COM a perícia (hipótese antiga cai)

Chegou como *"o Tradicao esta caido e nao entra na pagina"*. Começou **10:50 UTC**
(07:50 BRT), restart às **14:43 UTC** — ~**4h**, com **340 falhas na última hora**.
Uma tentativa de login da **AMANDA** (14:33:45) ficou pendurada sem completar.

⚠️ De fora, `/api/health` **e** `/api/setup/status` (que toca o banco) responderam
**200 em ~50ms**. Ou seja: **endpoint que consulta o banco NAO serve sozinho como
sonda** — ele passa nas conexões que já estavam quentes. O que quebra é só o que
precisa de conexão **nova**, e quem sente primeiro é o **login**.

### A captura que faltava (dentro do container, antes do restart)

Arquivo: `_forense-2026-09-15-tradicao.txt`

| Medida | Resultado | Leitura |
|---|---|---|
| `wchan` da thread principal | **`ep_poll`** | event loop **VIVA** — nao e o congelamento de [[2026-07-25-backend-tradicao-congelou-queda-oracle\|25/07]] |
| `wchan` das outras 10 threads | **todas `futex_wait_queue`** | **paradas esperando trabalho** |
| Descritores abertos | 27 de 524.288 | sem vazamento de fd/socket |
| Sockets em **SYN_SENT** | **ZERO** | o processo **nem tenta** abrir conexao |
| Processo NOVO no mesmo container | DNS 20ms, TCP 5432 em 6ms | rede, DNS e banco **intactos** |
| `UV_THREADPOOL_SIZE` | nao definido (padrao 4) | — |

### ❌ A hipotese do threadpool esgotado NAO se sustenta

A nota de 22/08 apostava em **threadpool do libuv saturado**. A perícia diz o
contrário: thread saturada estaria **ocupada** (dentro de uma syscall), e todas as
10 estao **paradas em futex**, que e como thread OCIOSA espera trabalho.
**Pool vazia, nao cheia.**

### 🔑 A pista nova: para ANTES do socket

**Nenhum socket em SYN_SENT** com 340 falhas por hora e conclusivo: se o processo
chamasse `connect()` e ele pendurasse, haveria SYN_SENT empilhado. Nao ha. Logo a
parada e **antes de virar pacote** — e tudo que falha (`postgres`, IMAP do Gmail)
se conecta **por nome**, resolvido por `dns.lookup`, que roda no threadpool.

> 🎯 Pool ociosa **e** trabalho que nunca comeca = **a fila de trabalho do libuv
> perdeu o aviso**, nao ficou cheia. Proximo passo quando repetir: inspecionar a
> fila do libuv no processo vivo (`node --inspect` ja no boot, ou `gdb` com
> `uv_default_loop()`), em vez de contar threads.

⚠️ **Contorno que cabe testar antes da causa-raiz:** subir `UV_THREADPOOL_SIZE`
(ex.: 16) no compose do backend. Se a fila trava por aviso perdido, mais threads
**adiam** o problema sem resolver — mas tambem e o teste mais barato para separar
"fila travada" de "pool pequena demais".

### 🐕 4ª ocorrencia com o watchdog assistindo

22/08 (~11h) → 07/09 (~18h) → 15/09 (~4h). O `tradicao` esta na `watch.list` desde
03/08 e **nunca disparou**, porque a sonda e o `/api/health`. **O unico sensor que
pegaria isto e contar falha de cron:**

```bash
docker logs prevencao-<cliente>-backend --since 1h 2>&1 | grep -c 'connection timeout'
# 0 = saudavel | centenas = manco ha horas (15/09: 340)
```

## 🔁 09/10/2026 — 5ª vez: perícia IDÊNTICA à de 15/09

Chegou como *"o cliente Tradição tá caído"*. Começou **08/10 18:45 UTC** (15:45 BRT),
detectado 09/10 15:23 UTC — **~21h** manco. **435 falhas/h**, 8.399 em 24h, IMAP
morto (130/h), logins de AMANDA/DIEGO pendurados. Container `Up 5 days (healthy)`
(boot 04/10 05:38 UTC → quebrou com ~4,5 dias de vida).

| Medida | 15/09 | 09/10 |
|---|---|---|
| thread principal | `ep_poll` | `ep_poll` (pid 7, + tid 9) |
| demais threads | 10× `futex_wait_queue` | 10× `futex_wait_queue` |
| fds | 27 | 26 |
| SYN_SENT | 0 | 0 |
| processo novo: DNS + TCP 5432 | ok | ok |
| `UV_THREADPOOL_SIZE` | vazio | vazio · node v20.20.2 |

Assinatura **reproduz exata** → a leitura "fila do libuv perdeu o aviso, antes do
socket" ganha força. Arquivo bruto na VPS: `/tmp/forense-2026-10-09-tradicao.txt`.

**Restart às 15:34 UTC → 0 `timeout` desde então.** (O modo automático do Claude
Code bloqueia `docker compose restart`; precisou do Roberto em modo manual.)

⚠️ Pra contar falha **só depois** do restart use `--since <timestamp-ISO>Z` — o
`--since 3m` pega rabo de antes e parece que não curou.

🚨 **O `Z` é obrigatório.** A VPS 46 está em **UTC-3**: `--since 2026-11-01T21:37:51`
sem `Z` vira horário local = 3h no FUTURO → `grep -c` devolve **0 falso** ("curou!").
O "0 timeout" de 09/10 foi medido assim e **não vale como prova** (o restart curou, mas
pelos logins/crons, não por essa conta).

## 🔁 01/11/2026 — 6ª vez, perícia idêntica pela 3ª vez

Começou **01/11 01:18 UTC** (31/10 22:18 BRT), visto 21:31 UTC — **~20h**. 437 falhas/h,
IMAP morto. Backend tinha subido **21/10 05:36 UTC** → durou **~11 dias** (antes: ~4,5).
Threads: `ep_poll` (7, 9) + 10× `futex_wait_queue`, 26 fds, 0 SYN_SENT, processo novo
conecta. Bruto: `/tmp/forense-2026-11-01-tradicao.txt` na VPS.
Restart 21:37:51 UTC (de novo só passou em modo manual) → em 5 min: 0 timeout, 0 IMAP,
`Database connection alive` a cada 20s.

Intervalos entre quedas: 22/08 → 07/09 → 15/09 → 08/10 → 01/11. **Não há padrão de
tempo de vida** (4,5 a 23 dias) → não é vazamento que enche devagar; é um evento.

⚠️ O container **não tem `pgrep`** — achar o pid do node varrendo
`/proc/[0-9]*/comm` (é o pid 7, não o 1, que é o `docker-init`).

## 🏷️ Tags
#bug #resolvido #tradicao #infra #watchdog #postgres
