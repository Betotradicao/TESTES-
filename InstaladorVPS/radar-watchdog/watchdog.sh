#!/bin/bash
# ============================================================================
# radar-watchdog — reinicia SOMENTE containers de LISTA BRANCA que estiverem
# realmente quebrados. Dois sensores:
#
#   1) watch.list  -> container 'unhealthy' no Docker (congelou de vez)
#   2) manco.list  -> backend 'manco': healthcheck passa, mas o log enche de
#                     'Connection terminated due to connection timeout'
#                     (o processo para de abrir conexao NOVA — ver
#                     obsidian-vault/bugs-resolvidos/2026-08-22-backend-nao-abre-conexao-nova-watchdog-nao-ve.md)
#
# O que ele NUNCA faz (por desenho):
#   - nunca recria container (sem 'up', sem 'compose', sem 'pull')
#   - nunca toca em quem nao esta numa das listas
#   - nunca reinicia dois containers no mesmo ciclo
#   - nunca insiste: apos MAX_RESTARTS na janela, DESISTE e pede olho humano
#     (o disjuntor e o MESMO para os dois sensores)
# ============================================================================
set -uo pipefail

BASE="${BASE:-/opt/radar-watchdog}"
LIST="${LIST:-$BASE/watch.list}"
MANCO_LIST="${MANCO_LIST:-$BASE/manco.list}"
STATE="$BASE/state"
LOG="$BASE/watchdog.log"
DRY_RUN="${DRY_RUN:-0}"

# ---- limites de seguranca (o coracao da protecao) ----
MAX_RESTARTS=3           # no maximo 3 restarts por container...
WINDOW=21600             # ...dentro de 6 horas. Estourou, para de vez.
COOLDOWN=900             # 15 min de silencio depois de agir no mesmo container
CONFIRMACOES=2           # so age se o sensor acusar em 2 ciclos SEGUIDOS
MAX_ACOES_POR_CICLO=1    # no maximo 1 restart por rodada

# ---- sensor 'manco' ----
MANCO_PADRAO='Connection terminated due to connection timeout'
MANCO_JANELA=600         # olha os ultimos 10 min de log...
MANCO_LIMITE=30          # ...e acusa com 30+ falhas (saudavel = 0; manco = ~70)
MANCO_AGORA_JANELA=180   # e AINDA esta falhando: 5+ nos ultimos 3 min
MANCO_AGORA_LIMITE=5

mkdir -p "$STATE"
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

acoes=0

# Conta linhas do padrao no log desde max(agora - janela, boot do container).
# Usa epoch no --since: a VPS esta em UTC-3 e ISO sem 'Z' aponta pro futuro.
conta_falhas() {
  local nome="$1" janela="$2" agora boot desde
  agora="$(date +%s)"
  boot="$(date -d "$(docker inspect -f '{{.State.StartedAt}}' "$nome" 2>/dev/null </dev/null)" +%s 2>/dev/null || echo 0)"
  desde=$((agora - janela))
  [ "$boot" -gt "$desde" ] && desde="$boot"
  docker logs --since "$desde" "$nome" 2>&1 </dev/null | grep -c -- "$MANCO_PADRAO"
}

# Confirmacao + cooldown + disjuntor + restart. $1=nome $2=arquivo de strikes $3=motivo
tentar_restart() {
  local nome="$1" strikes_f="$2" motivo="$3" strikes agora ult_f ult hist_f recentes

  strikes="$(cat "$strikes_f" 2>/dev/null || echo 0)"
  strikes=$((strikes + 1))
  echo "$strikes" > "$strikes_f"
  if [ "$strikes" -lt "$CONFIRMACOES" ]; then
    log "AGUARDA $nome $motivo ($strikes/$CONFIRMACOES confirmacoes)"
    return
  fi

  agora="$(date +%s)"

  # --- cooldown ---
  ult_f="$STATE/$nome.last"
  ult="$(cat "$ult_f" 2>/dev/null || echo 0)"
  if [ $((agora - ult)) -lt "$COOLDOWN" ]; then
    log "COOLDOWN $nome (faltam $((COOLDOWN - (agora - ult)))s)"
    return
  fi

  # --- disjuntor: quantos restarts na janela? ---
  hist_f="$STATE/$nome.hist"
  touch "$hist_f"
  awk -v c=$((agora - WINDOW)) '$1 > c' "$hist_f" > "$hist_f.tmp" 2>/dev/null && mv "$hist_f.tmp" "$hist_f"
  recentes="$(wc -l < "$hist_f" | tr -d ' ')"
  if [ "$recentes" -ge "$MAX_RESTARTS" ]; then
    log "!! DISJUNTOR ABERTO: $nome ja reiniciou $recentes vezes em ${WINDOW}s. NAO vou insistir — precisa de olho humano."
    return
  fi

  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN: reiniciaria $nome ($motivo x$strikes, $recentes restarts na janela)"
    acoes=$((acoes + 1))
    return
  fi

  log "RESTART $nome ($motivo x$strikes, $recentes restarts previos na janela)"
  if docker restart "$nome" >/dev/null 2>&1 </dev/null; then
    echo "$agora" >> "$hist_f"
    echo "$agora" > "$ult_f"
    rm -f "$STATE/$nome.strikes" "$STATE/$nome.manco"
    log "OK $nome reiniciado"
  else
    log "FALHA ao reiniciar $nome"
  fi
  acoes=$((acoes + 1))
}

# Le uma lista branca: ignora vazio e '#', so devolve container 'running'.
ler_lista() {
  local arq="$1" nome estado
  [ -f "$arq" ] || return 0
  while IFS= read -r nome || [ -n "$nome" ]; do
    nome="$(echo "$nome" | tr -d '[:space:]')"
    [ -z "$nome" ] && continue
    case "$nome" in \#*) continue ;; esac
    estado="$(docker inspect -f '{{.State.Status}}' "$nome" 2>/dev/null </dev/null)" || {
      log "SKIP $nome (container nao existe)"; continue; }
    [ "$estado" != "running" ] && { log "SKIP $nome (status=$estado)"; continue; }
    echo "$nome"
  done < "$arq"
}

[ -f "$LIST" ] || log "ERRO: lista $LIST nao existe"

# ============ Sensor 1: unhealthy ============
for nome in $(ler_lista "$LIST"); do
  [ "$acoes" -ge "$MAX_ACOES_POR_CICLO" ] && break

  saude="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-healthcheck{{end}}' "$nome" 2>/dev/null </dev/null)"
  strikes_f="$STATE/$nome.strikes"

  if [ "$saude" != "unhealthy" ]; then
    [ -f "$strikes_f" ] && rm -f "$strikes_f"
    continue
  fi
  tentar_restart "$nome" "$strikes_f" "unhealthy"
done

# ============ Sensor 2: manco (nao abre conexao nova) ============
for nome in $(ler_lista "$MANCO_LIST"); do
  [ "$acoes" -ge "$MAX_ACOES_POR_CICLO" ] && break
  strikes_f="$STATE/$nome.manco"

  falhas="$(conta_falhas "$nome" "$MANCO_JANELA")"
  agora_f="$(conta_falhas "$nome" "$MANCO_AGORA_JANELA")"
  if [ "$falhas" -lt "$MANCO_LIMITE" ] || [ "$agora_f" -lt "$MANCO_AGORA_LIMITE" ]; then
    [ -f "$strikes_f" ] && rm -f "$strikes_f"
    continue
  fi

  # Se o PROPRIO Postgres do cliente esta mal, reiniciar o backend nao cura nada.
  pg="${nome%-backend}-postgres"
  pg_saude="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$pg" 2>/dev/null </dev/null || echo ausente)"
  if [ "$pg_saude" != "healthy" ]; then
    log "SKIP $nome manco ($falhas falhas/10min) mas $pg esta '$pg_saude' — problema e o banco, nao o backend"
    rm -f "$strikes_f"
    continue
  fi

  tentar_restart "$nome" "$strikes_f" "manco ($falhas falhas/10min, $agora_f/3min)"
done

exit 0
