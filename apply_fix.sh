#!/bin/bash
set -e
echo "=== Antes ==="
docker exec prevencao-maxvale-backend grep -n "params: any = { dateStr" /app/dist/services/dvr-cftv.service.js | head -5

echo
echo "=== Patch: remover dateStr do params (a query agora usa apenas dateStrStart/End) ==="
docker exec prevencao-maxvale-backend sed -i 's/let params = { dateStr, dateStrStart, dateStrEnd };/let params = { dateStrStart, dateStrEnd };/' /app/dist/services/dvr-cftv.service.js

echo
echo "=== Depois ==="
docker exec prevencao-maxvale-backend grep -n "params = { dateStr" /app/dist/services/dvr-cftv.service.js | head -5

echo
echo "=== Restart ==="
docker restart prevencao-maxvale-backend
