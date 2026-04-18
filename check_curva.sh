#!/bin/bash
python3 <<'PY'
import json
m = json.load(open('/tmp/mvmap.json'))
total_missing = 0
for tab, info in m['tabelas'].items():
    cols = set(info.get('colunas', {}).keys())
    tcamp = set(info.get('tabelas_campo', {}).keys())
    missing = cols - tcamp
    if missing:
        total_missing += len(missing)
        print(f"{tab}: faltam {len(missing)} em tabelas_campo -> {sorted(missing)}")
print(f"\nTOTAL campos sem tabelas_campo: {total_missing}")
PY
