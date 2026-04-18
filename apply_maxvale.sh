#!/bin/bash
set -e
cat > /tmp/u.sql <<'EOF'
UPDATE database_connections
SET mappings = pg_read_file('/tmp/map.json'),
    schema = 'INTERSOLID',
    erp_type = 'intersolid',
    is_default = true,
    updated_at = NOW()
WHERE id = 1;
SELECT id, name, erp_type, schema, is_default, status, octet_length(mappings) AS maps_size FROM database_connections;
EOF

docker cp /tmp/trad_map.json prevencao-maxvale-postgres:/tmp/map.json
docker cp /tmp/u.sql prevencao-maxvale-postgres:/tmp/u.sql
docker exec prevencao-maxvale-postgres psql -U postgres -d postgres_maxvale -f /tmp/u.sql
