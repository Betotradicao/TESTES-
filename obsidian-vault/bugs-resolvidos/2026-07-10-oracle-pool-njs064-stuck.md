# Oracle pool preso em "closing" (NJS-064) — Gestão Inteligente parava

**Data:** 2026-07-10 · [[../clientes/tradicao|Tradição]] (bug de arquitetura, atinge todos os clientes Oracle).

## 🐛 Sintoma
Tela (ex: Gestão Inteligente) mostra `NJS-064: connection pool is closing`. Depois de um blip
de conexão Oracle, TODA query passa a falhar com NJS-064, sem parar (37 erros/90s), até reiniciar o backend.

## 🔍 Causa-raiz (mesma família do deadlock do sells-sync: estado preso sem auto-recuperação)
`OracleService` em [oracle.service.ts](../../packages/backend/src/services/oracle.service.ts). Dois defeitos combinados:

1. **`getConnection()` só reinicializava `if (!this.pool)`** — mas um pool em estado "closing" **não é null**.
   Depois que a reconexão chamava `pool.close(0)` e o pool ficava preso em closing, `getConnection`
   chamava `this.pool.getConnection()` num pool morto → **NJS-064**.
2. **`NJS-064` não estava na lista `isConnectionError`** (tinha `not available`, `socket`, `timeout`, mas
   não `closing`). Então uma query que pegava NJS-064 **não** disparava o reconnect → ficava preso pra sempre.

Gatilho: `pool.close(0)` do reconnect deixava o pool em closing, e como `this.pool = null` só rodava
DEPOIS de `await pool.close()`, se o close pendurasse (conexao presa) o `this.pool` nunca zerava.

## ✅ Correção (4 ajustes)
1. Campo `initPromise` — guarda contra reinicializacao concorrente (N getConnection = 1 init).
2. `getConnection()` reinicializa se `this.pool.status !== oracledb.POOL_STATUS_OPEN` (não só se null).
3. `isConnectionError` reconhece `msg.includes('pool is clos')` (NJS-064/065).
4. Reconnect do `query()`: zera `this.pool = null` **ANTES** de fechar; fecha o pool antigo em
   **background com timeout de 5s** (`Promise.race([close(0), timeout])`) pra não travar a recuperação.

Imediato: `docker restart` limpa o pool preso (paliativo). A correção evita recorrência.

## 🔑 Lição
Pool/recurso com estado interno ("open/closing/closed") + guarda que só checa null = pode ficar preso
num estado intermediário pra sempre. Sempre: (a) checar o STATUS real, não só existência; (b) garantir
que o erro do estado-preso dispare a recuperação; (c) nunca `await` um teardown que pode pendurar sem timeout.
Ver irmãos: [[2026-07-10-sells-sync-deadlock]], [[2026-07-10-minio-endpoint-boot-hang]].

## 🏷️ Tags
#bug-resolvido #oracle #pool #njs-064 #self-recovery #gestao-inteligente
