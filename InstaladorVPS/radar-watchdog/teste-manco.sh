#!/bin/bash
# Teste do sensor 'manco' com containers DESCARTAVEIS (wdtest-*), sem tocar em
# /opt/radar-watchdog nem em container de producao.
# Uso na VPS:  bash teste-manco.sh /tmp/watchdog.sh
set -u
WD="${1:-/tmp/watchdog.sh}"
T=/tmp/wdtest
P='Connection terminated due to connection timeout'
rm -rf "$T"; mkdir -p "$T/state"
limpa() { docker rm -f wdtest-a-backend wdtest-a-postgres wdtest-b-backend wdtest-b-postgres wdtest-c-backend wdtest-c-postgres >/dev/null 2>&1; }
limpa
roda() { BASE=$T LIST=$T/vazia.list MANCO_LIST=$T/manco.list bash "$WD"; }
mostra() { echo "--- $1"; cat "$T/watchdog.log" 2>/dev/null; : > "$T/watchdog.log"; }

PG_OK='--health-cmd=true --health-interval=2s'
PG_RUIM='--health-cmd=false --health-interval=2s --health-retries=1'
MANCO="while true; do echo '$P'; sleep 1; done"
SAO="while true; do echo 'Database connection alive'; sleep 1; done"

# a = manco com postgres bom | b = manco com postgres RUIM | c = saudavel
docker run -d --name wdtest-a-postgres $PG_OK   alpine sleep 3600 >/dev/null
docker run -d --name wdtest-a-backend           alpine sh -c "$MANCO" >/dev/null
docker run -d --name wdtest-b-postgres $PG_RUIM alpine sleep 3600 >/dev/null
docker run -d --name wdtest-b-backend           alpine sh -c "$MANCO" >/dev/null
docker run -d --name wdtest-c-postgres $PG_OK   alpine sleep 3600 >/dev/null
docker run -d --name wdtest-c-backend           alpine sh -c "$SAO" >/dev/null
touch "$T/vazia.list"
echo "### esperando 35s acumular log e healthcheck..."; sleep 35

echo "### CENARIO b+c (a fora da lista): espera SKIP do b, nada do c"
printf 'wdtest-b-backend\nwdtest-c-backend\n' > "$T/manco.list"
roda; roda; mostra "b+c"

echo "### CENARIO a: AGUARDA -> RESTART -> COOLDOWN"
printf '# comentario\nwdtest-a-backend\n' > "$T/manco.list"
A0=$(docker inspect -f '{{.State.StartedAt}}' wdtest-a-backend)
roda; roda; A1=$(docker inspect -f '{{.State.StartedAt}}' wdtest-a-backend)
sleep 35; roda; roda
mostra "a"
echo "StartedAt antes=$A0 depois=$A1"

echo "### CENARIO disjuntor: historico forjado com 3 restarts recentes"
rm -f "$T/state/wdtest-a-backend.last"; n=$(date +%s)
printf '%s\n%s\n%s\n' $((n-60)) $((n-120)) $((n-180)) > "$T/state/wdtest-a-backend.hist"
A2=$(docker inspect -f '{{.State.StartedAt}}' wdtest-a-backend)
roda; roda; A3=$(docker inspect -f '{{.State.StartedAt}}' wdtest-a-backend)
mostra "disjuntor"
echo "StartedAt antes=$A2 depois=$A3 (tem que ser IGUAL)"

echo "### CENARIO producao em DRY_RUN (listas reais, estado separado)"
mkdir -p $T/prod/state
echo prevencao-tradicao-backend > $T/prod/manco.list
BASE=$T/prod LIST=/opt/radar-watchdog/watch.list MANCO_LIST=$T/prod/manco.list DRY_RUN=1 bash "$WD"
BASE=$T/prod LIST=/opt/radar-watchdog/watch.list MANCO_LIST=$T/prod/manco.list DRY_RUN=1 bash "$WD"
echo "--- prod (vazio = nenhuma acao)"; cat $T/prod/watchdog.log 2>/dev/null

echo "### CUSTO de 1 ciclo com a lista real:"
/usr/bin/time -f '%e s real, %U+%S s CPU' env BASE=$T/prod LIST=/opt/radar-watchdog/watch.list MANCO_LIST=$T/prod/manco.list DRY_RUN=1 bash "$WD"

limpa
echo "### FIM (containers wdtest removidos)"
