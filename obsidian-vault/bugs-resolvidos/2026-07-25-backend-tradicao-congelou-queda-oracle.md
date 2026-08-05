---
tags:
  - bug-resolvido
  - backend
  - oracle
  - tradicao
  - resiliencia
data: 2026-07-25
cliente: Tradição
---

# 🌟🚨 Queda de 38min do Oracle CONGELOU o backend por 10h — e o Docker viu e não fez nada

## 🔴 Sintoma
Site do Tradição "caído": páginas em *loading* infinito, rodapé **SEM CONEXÃO ERP**.
`/api/health` → `HTTP=000` (timeout 15s). Container **`Up 35 hours`** — ou seja, **não caiu.**

## ⏱️ Timeline (tudo medido nos logs)

| Hora (UTC) | Evento |
|---|---|
| até 05:31 | tudo normal — `[SellsSync] Sync concluído em 0s`, Oracle e IMAP OK |
| **05:32** | **Oracle da loja cai.** SellsSync inicia e não volta |
| 05:33 | `NJS-040: connection request timeout (queueTimeout 60000)` |
| 05:34 | `ORA-12170: TCP connect timeout of 60s for host 187.90.96.96 port 11251` |
| 05:38 | 1º `Connection terminated due to connection timeout` — **pool do PG esgotado** |
| 05:46 / 05:55 / 06:03 | watchdog do SellsSync: *"preso há 480s — resetando trava e reassumindo"* (**3x**) |
| **06:10:00** | **congelamento total.** Último log: cron de pré-clipe + `[DVR] Generating clip` |
| 05:32→06:10 | **0 sucessos / 9 falhas** do Oracle |
| 06:10 → 16:07 | **10 horas fora**, até `docker restart` manual |

## 🎯 Causa-raiz

**O gatilho foi externo e passageiro: o Oracle da loja ficou ~38 min inacessível.**
O que transformou uma oscilação de link em 10h de indisponibilidade foi o **encadeamento**:

1. Cada tentativa de conexão Oracle **bloqueia 60s** (`ORA-12170` TCP timeout).
2. O **SellsSync roda a cada 1 minuto** → cada tick pendura mais uma conexão do pool do
   Postgres que nunca é devolvida.
3. Pool do Node (≈10) esgota → **todos os crons** passam a falhar com
   `Connection terminated due to connection timeout`.
4. 🔥 **O watchdog PIORA:** ao ver o sync preso há 8 min ele **reseta a trava e começa
   OUTRO sync — sem cancelar o anterior.** O antigo continua vivo segurando conexões.
   3 resets = 4 syncs zumbis competindo.
5. 06:10: o cron de pré-clipe pega as últimas conexões e o processo **trava de vez.**

### 🔬 A prova forense (vale reusar)

```bash
# 1) O processo está VIVO mas com a event loop MORTA?
cat /proc/<pid>/wchan        # -> futex_wait_queue  (normal seria ep_poll)
for t in /proc/<pid>/task/*; do echo "$(basename $t) $(cat $t/wchan)"; done
```
> 🔑 **Node com a thread principal em `futex_wait_queue` = event loop bloqueada.**
> Saudável, a principal fica em `ep_poll`. Esse único dado separa "lento" de "travado".

```sql
-- 2) Quando exatamente parou? As conexões denunciam o instante.
SELECT pid, state, now()-state_change AS parado_ha,
       left(regexp_replace(query,'\s+',' ','g'),90) FROM pg_stat_activity
 WHERE datname='postgres_tradicao' ORDER BY state_change;
```
As 9 conexões ficaram `idle` **no mesmo milissegundo** (todas há `09:57:47`) → carimba a
hora do congelamento sem depender de log. `max_connections=100` com só 10 em uso ⇒
**o esgotamento era do pool DO NODE, não do banco.**

```bash
# 3) Conexões empilhadas = ninguém aceita requisição
ss -tnp | grep <ip_container>   # centenas de FIN-WAIT-2 no docker-proxy + SYN-SENT
```

## 🚨 O achado mais caro: o Docker DETECTOU e não agiu

```
Healthcheck: GET localhost:3001/api/health, interval 30s, retries 3   ← funciona
RestartPolicy: unless-stopped                                          ← só reage a EXIT
```
O container foi marcado **`unhealthy` em ~90 segundos**. Mas `unless-stopped` só reinicia
processo que **morre** — este **congelou vivo**. Resultado: **o sistema sabia que estava
quebrado e ficou 10 horas assim.** Não existe `autoheal` na VPS (conferido).

> 💡 **O conserto mais barato de todos:** subir um container `autoheal` na VPS
> (reinicia qualquer container marcado `unhealthy`). Teria derrubado 10h de queda para ~2min,
> **para todos os 12 clientes**, sem tocar em uma linha do código do produto.
> ⚠️ Antes: o healthcheck do **frontend** é falso-positivo crônico
> (ver [[../modulos/dvr-cameras]]) — o autoheal ficaria reiniciando frontend à toa.
> **Corrigir o healthcheck do frontend é pré-requisito.**

## 🔧 Correções

| # | O quê | Estado |
|---|---|---|
| 1 | Vigia que reinicia container congelado | ✅ **NO AR** — [[../arquitetura/radar-watchdog]] |
| 2 | Zumbis do SellsSync não se multiplicam mais | ✅ código local, **não deployado** |
| 3 | Oracle pelo túnel SSH em vez do IP público | ⏳ **não feito** (decisão pendente) |
| 4 | Trava anti-empilhamento nos 2 crons de clipe | ✅ código local, **não deployado** |
| 5 | Healthcheck falso-positivo do frontend | ✅ código local, **não deployado** |

### ✅ #2 — como os zumbis foram esterilizados (`sells-sync.service.ts`)

O watchdog original tinha **duas falhas somadas**:
1. "Reassumir" **não abandona** o sync anterior — ele segue vivo segurando conexões.
2. 🔥 Quando o antigo enfim termina, o `finally` dele faz `isRunning = false` —
   **zerando a trava do sync NOVO**. Aí um terceiro entra. É a procriação.

Corrigido com **token de posse + teto de voo**:
```ts
const meuToken = ++this.runToken;      // cada execucao tem identidade
...
finally {
  this.emVoo--;
  if (this.runToken === meuToken) this.isRunning = false;   // so libero se for MINHA
}
```
```ts
if (this.emVoo >= this.MAX_EM_VOO) return;  // MAX_EM_VOO = 2 (atual + 1 abandonado)
```
> 🔑 **Concorrência fica travada em 2, por construção.** Antes crescia sem limite
> enquanto o Oracle estivesse fora. Quando o teto bate, loga
> `🛑 N syncs ainda em voo — NAO vou iniciar outro` em vez de piorar o quadro.

### ✅ #4 — `index.ts`: `preClipeRodando` e `preClipePdvRodando`
`cron.schedule` **não impede sobreposição**. Bipagens roda a cada 5min mas uma rodada leva
até 10 bipagens × N câmeras × 6,6min; PDV roda a cada 30min varrendo 48h. Ambos agora
pulam se a rodada anterior não acabou.

### ✅ #5 — `nginx.conf`: faltava `listen [::]:3004;`
**Provado dentro do container (25/07):** `127.0.0.1:3004` → **OK**;
`localhost:3004` → **Connection refused**. O healthcheck usa `localhost`, que no Alpine
resolve `::1` primeiro. Uma linha conserta os **13 frontends** no próximo deploy —
e é o que destrava colocá-los na lista branca do watchdog.

### ⏳ #3 — Oracle pelo túnel (NÃO feito, precisa decisão)
Hoje: `187.90.96.96:11251` (IP público + port-forward). Disponível e ocioso:
`-R 1521:10.6.1.100:1521`. Ambos responderam OK no teste pós-incidente.
**Não apliquei** porque muda como a produção fala com o ERP e há a contradição do CGNAT
abaixo — trocar às cegas pode derrubar o ERP inteiro.

### 🌐 Sobre o item 3 — o Oracle NÃO usa o túnel
O backend conecta em **`187.90.96.96:11251`** (IP público da loja + port-forward), embora
o `tunnels.json` já mantenha **`-R 1521:10.6.1.100:1521`** vivo e ocioso.
Os dois caminhos responderam OK no teste pós-incidente.

> ⚠️ **Isso contradiz a nota de CGNAT.** [[2026-07-15-dvr-tradicao-reinicia-ao-ler-gravacao]]
> e [[../modulos/dvr-cameras]] afirmam que porta direta no `187.90.96.96` é impossível por
> CGNAT da Vivo — mas o Oracle conecta direto nesse IP:11251 há meses. **Uma das duas
> conclusões está errada e vale reinvestigar** antes de usar isso como regra.

## ✅ O que foi feito hoje
`docker restart prevencao-tradicao-backend` → health **`HTTP=200` em 0,24s**, Oracle
reconectou (`✅ [ORACLE] Produto encontrado: AC SUINO...`), IMAP voltou a logar no Gmail.
**Nenhuma alteração de código ou config.**

## 🔁 03/08/2026 — REPETIU no SuperVital (e a lição que faltava)

Roberto reportou `CONEXÃO = OFF` no SuperVital. **Mesma assinatura, outro cliente:**

```
thread principal do node : futex_wait_queue     <- event loop morta
healthchecks empilhados  : 236 processos travados
conexoes penduradas      : 284 FIN-WAIT-2 + 10 SYN-SENT
ultimo log               : 31/07 03:00:14 UTC   <- 3 DIAS parado
```

> ⚠️ **`docker ps` dizia `Up 3 weeks`.** O container nunca caiu — quem congela é o processo
> Node dentro dele. **Uptime de container não é sinal de saúde.**

**Detalhe que engana:** o PID 1 do container é o `docker-init` (724 kB, 1 thread,
`do_sigtimedwait`). **Olhar o wchan do PID 1 dá falso negativo** — tem que pegar o PID do
`node dist/index.js` com `docker top`.

**Descartado:** Oracle no ar (`smvital.o3utm.com.br:1521` respondendo), sem erro nos logs,
sem queda de ERP. Congelou às 03:00 UTC = **meia-noite de Brasília** (container em
`America/Sao_Paulo`, então NÃO é o cron das 3h — esse dispara 06:00 UTC). **Gatilho exato
não identificado.**

### 🔑 A LIÇÃO: deploy num cliente só deixa os outros expostos

| Cliente | Imagem | Tem a correção? | Resultado |
|---|---|---|---|
| Tradição | 25/07 | ✅ | 5 dias healthy |
| **SuperVital** | 10/07 | ❌ | **congelou 31/07** |
| MaxValle | 01/06 | ❌ | exposto |
| Nunes | 10/07 | ❌ | exposto |

Como conferir se a correção está numa imagem, sem adivinhar:
```bash
docker exec <container> grep -c 'Rodada anterior ainda em andamento' /app/dist/index.js
# 0 = codigo antigo | >0 = tem a correcao
```

### ✅ Feito em 03/08
1. `docker restart prevencao-supervital-backend` → 200 em 0,25s, Oracle voltou (1396 vendas).
2. **Lista branca do watchdog ampliada** de 1 para **4 backends** (`tradicao`, `supervital`,
   `maxvale`, `nunes`). Se repetir, cai de **3 dias** para **~4 minutos**.
   `kontrata-*` ficaram de fora: outro produto, health endpoint não auditado.

3. ✅ **Correção `a4b13b9` DEPLOYADA no SuperVital** (build `--no-cache` + `up -d --no-deps`).
   Verificado dentro da imagem nova: trava anti-empilhamento = 2, teto anti-zumbi = 1
   (antes 0 e 0). Backend e **frontend `healthy`** (o fix do nginx pegou aqui também),
   Oracle reconectou (1415 vendas).

> 📌 **MaxValle e Nunes NÃO foram tocados — decisão do Roberto (03/08): "mexer só no Vital".**
> Seguem com o código antigo e **fora** da lista do watchdog. Se congelarem, ninguém avisa.

## 🔗 Relacionados
- [[2026-07-10-sells-sync-deadlock|Sells Sync deadlock (watchdog criado aqui)]]
- [[2026-07-10-oracle-pool-njs064-stuck|Oracle pool preso NJS-064]]
- [[2026-07-24-dvr-tradicao-mudou-de-ip-sozinho|DVR mudou de IP sozinho]]
