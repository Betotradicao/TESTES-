#!/bin/bash
set -e
echo "=== Tradicao DB conn id=14 mapping export ==="
docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c "\copy (SELECT mappings FROM database_connections WHERE id=14) TO '/tmp/trad_map.json'"
docker cp prevencao-tradicao-postgres:/tmp/trad_map.json /tmp/trad_map.json
wc -c /tmp/trad_map.json
echo "=== First 4000 chars ==="
head -c 4000 /tmp/trad_map.json
