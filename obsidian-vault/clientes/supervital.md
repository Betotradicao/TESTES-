# SuperVital

**Cliente de supermercado multi-loja**, hospedado na VPS 46.

## 📊 Dados Básicos
- **VPS:** `46.202.150.64` (alias SSH: `vps2-hostinger`)
- **Diretório:** `/root/clientes/supervital`
- **Containers:** `prevencao-supervital-frontend`, `prevencao-supervital-backend`, `prevencao-supervital-postgres`, `prevencao-supervital-minio`, `prevencao-supervital-cron`
- **Portas:** Frontend 3377, Backend 4377, Postgres 5777, MinIO 9377/9477
- **URL:** `supervital.prevencaonoradar.com.br`

## 🔌 ERP
- Usa [[../arquitetura/oracle-intersolid|Oracle Intersolid]]
- Schema: `INTERSOLID`

## ⭐ Particularidades
- **Multi-loja** (diferente de [[tradicao|Tradição]] que é loja única)
- Quando busca dados, o filtro `codLoja` precisa sempre ser respeitado
- Interface tem seletor de loja no canto superior esquerdo

## 🐛 Bugs já resolvidos neste cliente
- [[../bugs-resolvidos/2026-04-15-tiposSaida-gestao|NF Transferência contaminando valor na Gestão Inteligente]]
- [[../bugs-resolvidos/2026-04-15-dif-anual-itens|Dif Anual em branco nos itens da Compra x Venda]]

## 🚀 Deploy

Ver procedimento padrão em [[../arquitetura/deploy|Deploy Multi-Tenant]].

Comando rápido (frontend + backend):
```bash
powershell -Command "& { ssh vps2-hostinger 'cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/supervital && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend && docker builder prune -f && docker image prune -f 2>&1' | Out-String }"
```

## 🏷️ Tags
#cliente #oracle #multi-loja #vps46
