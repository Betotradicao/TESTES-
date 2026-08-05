---
tags:
  - arquitetura
  - infra
  - vps
  - resiliencia
data: 2026-07-25
---

# 🐕 Radar Watchdog — reinicia container congelado (com disjuntor)

Vigia instalado na **VPS 46** em 25/07, depois do incidente em que o backend do Tradição
**congelou vivo por 10h** e o Docker viu e não agiu
([[../bugs-resolvidos/2026-07-25-backend-tradicao-congelou-queda-oracle]]).

## 🎯 Por que NÃO usamos `autoheal` pronto

> 🔴 **Roberto relatou incidente passado:** automação desse tipo "tentou recriar tudo
> sozinho, esquentou a VPS e gerou bloqueios".

O dado que confirma o medo: **13 frontends da VPS estão `unhealthy` agora**, todos
falso-positivo crônico (healthcheck sonda porta errada — ver [[../modulos/dvr-cameras]]).
Um autoheal com `MONITOR_ALL` ficaria **reiniciando 13 containers a cada ciclo, para
sempre**. Por isso: script próprio, **lista branca**, sem imagem de terceiro.

## 📂 Onde mora

| Caminho | O quê |
|---|---|
| `/opt/radar-watchdog/watchdog.sh` | o script |
| `/opt/radar-watchdog/watch.list` | **lista branca** (1 nome por linha, `#` = comentário) |
| `/opt/radar-watchdog/state/` | contadores por container (strikes / último / histórico) |
| `/opt/radar-watchdog/watchdog.log` | log de tudo (logrotate semanal, 4 semanas) |
| `/etc/systemd/system/radar-watchdog.{service,timer}` | agendamento a cada **2 min** |

Custo medido: **111 ms de CPU por execução**, `Nice=15` + `CPUSchedulingPolicy=idle` —
nunca disputa CPU com os containers.

## 🛡️ As 5 travas (é isso que impede o descontrole)

| Trava | Valor | Para quê |
|---|---|---|
| **Lista branca** | só `watch.list` | não enxerga o resto da VPS |
| **Confirmações** | 2 ciclos seguidos | ignora piscada de healthcheck |
| **Cooldown** | 15 min | não martela o mesmo container |
| **Disjuntor** | 3 restarts / 6h | **estourou, DESISTE** e pede olho humano |
| **1 por ciclo** | máx. 1 restart | nunca reinicia dois juntos |

**Só faz `docker restart`.** Nunca `up`, nunca `compose`, nunca `pull`, nunca recria.

## ✅ Por que é seguro ligar isso no backend

O `/api/health` ([[../../packages/backend/src/routes/health.routes.ts|health.routes.ts]])
devolve **HTTP 200 mesmo com o Oracle fora** — reporta `allConnected:false` no corpo, mas
o código continua 200, e o healthcheck do Docker só olha o código.

> 🔑 **Logo: queda de ERP NÃO marca `unhealthy`.** Só travamento/morte marca.
> Sem esse detalhe, o watchdog reiniciaria o backend em loop a cada oscilação do Oracle.
> **Antes de adicionar QUALQUER container na lista, confirmar que o healthcheck dele não
> depende de serviço externo.**

## 🧪 Como foi validado (repetir se mexer no script)

Testado com container descartável (`--health-cmd 'exit 1'`), **sem tocar em produção**:
1. 1ª rodada → `AGUARDA (1/2)`; 2ª → `RESTART` ✅ (`StartedAt` mudou)
2. Cooldown barrou a rodada seguinte ✅
3. Disjuntor com histórico forjado → `!! DISJUNTOR ABERTO` e **não reiniciou** ✅
4. 3 rodadas com a lista real → **`StartedAt` dos 13 frontends idêntico** ✅

## 📋 Operação

```bash
tail -f /opt/radar-watchdog/watchdog.log       # o que ele fez
systemctl list-timers radar-watchdog.timer     # próximo disparo
DRY_RUN=1 /opt/radar-watchdog/watchdog.sh      # simula sem agir
systemctl disable --now radar-watchdog.timer   # desliga tudo
```

**Adicionar container** = uma linha em `watch.list` (efeito no próximo ciclo, sem reload).
Se aparecer `!! DISJUNTOR ABERTO`, **não é pra insistir** — o container está quebrado de
verdade e reiniciar não resolve.

## 🚧 Lista branca atual (3 backends)

```
prevencao-tradicao-backend
prevencao-supervital-backend
prevencao-maxvale-backend
```

> 🔴 **`prevencao-nunes-backend` está FORA** — decisão do Roberto (03/08). Ele roda o código
> antigo (sem a correção anti-travamento) **e** sem vigia: se congelar, fica fora até alguém
> reparar na tela, como aconteceu com o SuperVital (3 dias).

Ampliada em **03/08/2026**, depois que o **SuperVital congelou e ficou 3 dias fora** sem
ninguém perceber — ele não estava na lista.
Ver [[../bugs-resolvidos/2026-07-25-backend-tradicao-congelou-queda-oracle]].

> 🔴 **`kontrata-*` (9 containers) continuam FORA.** São outro produto (porta 3010) e o
> health endpoint deles **não foi auditado** — não dá pra afirmar que devolve 200 com o ERP
> fora. Só entram depois de conferir isso; senão viram loop de restart.

⏭️ **Pendência que destrava os frontends:** o healthcheck deles sonda `localhost:3004`,
mas o nginx do container só escuta IPv4 e `localhost` resolve `::1`. Fix = `listen [::]:3004;`
no `default.conf`. Só depois disso frontend pode entrar na lista.

## 🔗 Relacionados
- [[../bugs-resolvidos/2026-07-25-backend-tradicao-congelou-queda-oracle|O incidente que motivou]]
- [[estrutura-vps|Estrutura da VPS 46]]
- [[deploy|Deploy Multi-Tenant]]
