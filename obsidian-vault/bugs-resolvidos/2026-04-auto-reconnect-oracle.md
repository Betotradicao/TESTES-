# Feature: Auto-reconnect Oracle quando conexão cai

**Data:** 2026-04 (commit `ecbb5d2`)
**Módulo:** Backend (todos clientes Oracle)

## 🐛 Problema
Conexão com Oracle caía (túnel SSH instável, restart no servidor Oracle, etc.) e backend ficava travado até restart manual do container.

## ✅ Fix
Backend agora detecta queda de conexão e **reconecta automaticamente**. Usuário não percebe queda (além de uma requisição lenta pontual).

## 📝 Lições
- Oracle Instant Client em Thick mode é sensível a túnel caindo
- Wrapper de query do OracleService precisa interceptar erros de conexão e retentar

## 🏷️ Tags
#feature #oracle #resiliencia #2026-04
