# Feature: Segurança — CORS restrito, Helmet, Rate Limiting

**Data:** 2026-03 (commits `ac00515`, `25a9b88`)
**Impacto:** Backend (todos os clientes)

## 🎯 O que mudou

### CORS (`ac00515`)
- **Antes:** `origin: true` (qualquer site acessava)
- **Agora:** whitelist por regex
- Permitidos: `*.prevencaonoradar.com.br`, IPs locais (10.x, 192.168.x, 172.x), localhost, ngrok, cloudflare
- Bloqueados: qualquer outra origem (log de warning)

### Rate Limiting
- **Login:** 10 tentativas / 15min por IP (brute force protection)
- **Recuperação de senha:** 5 tentativas / 1h por IP
- **Global:** 200 requests / 1min por IP (DDoS simples / scraping)
- Health check excluído

### Helmet (`25a9b88`)
- Headers HTTP de segurança automáticos
- Desabilitados pra não quebrar o frontend: `contentSecurityPolicy`, `crossOriginEmbedderPolicy`

### Gitignore de certificados (`ac00515`)
- `*.pfx`, `*.pem`, `*.key`, `*.p12`, `*.cert` ignorados
- Pasta `packages/backend/certificates/` ignorada

## 📦 Pacotes adicionados
- `helmet` 8.1.0
- `express-rate-limit` 8.3.2

## ⚠️ Checklist pra novos clientes
- `.env` com `JWT_SECRET` único (NÃO usar `development-secret`)
- Certificados bancários na pasta `certificates/` (fora do git)
- Usuário do banco ERP com SELECT only
- HTTPS configurado no domínio

## 🏷️ Tags
#feature #seguranca #cors #helmet #rate-limit #2026-03
