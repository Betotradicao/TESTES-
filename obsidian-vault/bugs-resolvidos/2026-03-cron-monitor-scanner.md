# Feature: Cron Monitor — scanner service completo

**Data:** 2026-03 (commit `f163c36`)

## 🎯 O que foi entregue
Scanner Service completo que roda via cron no container `*-cron`:
- Cruzamento de bipagens
- Sincronização periódica com ERP
- Processamento de filas

## 📂 Arquivo
`packages/frontend/src/pages/CronMonitor.jsx`

## 🐛 Fixes relacionados
- `17aaba2` — Dockerfile.cron alinhar build com Dockerfile principal
- `52d8e44` — Dockerfile.cron com Oracle Instant Client
- `27bb3b6` — PATH e Oracle env vars no crontab Debian
- `8a11789` — Dockerfile.cron exporta env vars pro cron Debian
- `1f87b8d` — usar ONLOGON ao invés de ONSTART no schtasks
- `a84fea5` — auto-start Scanner Service (schtasks robusto)

## ⚠️ Lições
- Container `*-cron` precisa dos mesmos recursos que o backend (Oracle Instant Client, env vars)
- Crontab em Debian não herda env vars automaticamente — exportar explicitamente no Dockerfile
- `schtasks` com `ONLOGON` é mais confiável que `ONSTART` no Windows

## 🏷️ Tags
#feature #cron #scanner #dvr #2026-03
