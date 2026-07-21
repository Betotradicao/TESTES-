# Sells Sync deadlock — cron de cruzamento parava e não voltava sozinho

**Data:** 2026-07-10 · **Cliente afetado:** [[../clientes/tradicao|Tradição]] (mas o bug é de arquitetura, atinge todos)

## 🐛 Sintoma
Depois que o servidor caía e voltava (problema técnico), as bipagens continuavam
chegando, mas o **cruzamento bipagem × venda parava** — as bipagens ficavam
eternamente "Pendente". Só voltava **reiniciando o backend**. "Para e não volta sozinho."

## 🔍 Causa-raiz (duas peças combinadas)
O cron **Sells Sync** ([index.ts](../../packages/backend/src/index.ts) ~linha 1515) roda
`SellsSyncService.syncToday()` a cada 1 min, com uma trava anti-concorrência:

```ts
if (this.isRunning) return;      // pula se já tem sync rodando
this.isRunning = true;
try { ...sync... } finally { this.isRunning = false; }  // só destrava no finally
```

1. **Pool Postgres sem `statement_timeout`/`query_timeout`.** `connectionTimeoutMillis`
   só cobre *pegar* a conexão do pool — não a duração da query. Quando o servidor
   voltava de uma queda, sobravam **conexões zumbis** (socket "vivo", banco não
   responde). Uma query nessas conexões **penduraava o `await` pra sempre**.
2. **Trava sem watchdog.** Com a query pendurada, o `finally` nunca rodava →
   `isRunning` ficava `true` eternamente → todo minuto o cron logava
   *"Já está em execução, pulando..."* e nunca mais cruzava. Deadlock silencioso.

> ⚠️ O Oracle **não** era o culpado: `OracleService.query` tem `callTimeout: 300000`
> (5 min) + retry, então ele erra e se recupera. O buraco era o **PG local**.

## ✅ Correção (commit `dfc7a04`)
Duas camadas independentes — mesmo que apareça um travamento novo, recupera sozinho:

- **Watchdog na trava** ([sells-sync.service.ts](../../packages/backend/src/services/sells-sync.service.ts)):
  a trava anota `runStartedAt`; se ficar presa **> 8 min** (`MAX_RUN_MS`), o próximo
  tick considera stale, loga e **reassume**. 8 min > callTimeout do Oracle (5 min),
  então nunca aborta um sync legítimo.
- **`statement_timeout` + `query_timeout` = 120s** nos dois pools PG
  ([database.ts](../../packages/backend/src/config/database.ts) — `extra` do TypeORM
  e o `pool` raw): query travada **morre em 2 min** e solta a conexão.

## 🔑 Lição reutilizável
**Guard `isRunning` estático + await sem timeout = deadlock permanente.**
Todo cron que usa flag anti-concorrência em memória PRECISA de:
1. Watchdog (reset por tempo máximo) — senão um único travamento mata o cron pra sempre.
2. Timeout em TODA I/O de dentro (query, HTTP) — `connectionTimeoutMillis` **não**
   protege a duração da query no `pg`; use `statement_timeout`/`query_timeout`.

## ⚠️ Cuidado com auto-recuperação (histórico do projeto)
Recuperação automática já esquentou a VPS antes (loop de CPU). Por isso o watchdog é
**lento de propósito**: cooldown de 8 min → no máximo ~1 retentativa a cada 8 min, e o
`statement_timeout` impede empilhar execuções zumbis. Nunca fazer retry imediato/guloso.

## 🏷️ Tags
#bug-resolvido #cron #deadlock #postgres #sells-sync #bipagens #timeout
