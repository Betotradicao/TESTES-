# REGRAS DE SEGURANÇA

## Proteções Implementadas

### 1. CORS Restrito (`index.ts`)
- **Antes:** `origin: true` (qualquer site acessava a API)
- **Agora:** whitelist por regex
- **Permitidos:**
  - `*.prevencaonoradar.com.br` (produção)
  - `10.x.x.x`, `192.168.x.x`, `172.x.x.x` (rede local)
  - `localhost`, `127.0.0.1` (desenvolvimento)
  - `*.ngrok.io`, `*.ngrok-free.app` (ngrok)
  - `*.trycloudflare.com` (cloudflare)
- **Bloqueados:** qualquer outra origem (log de warning)
- **Commit:** `ac00515`

### 2. Rate Limiting

#### Login (`auth.routes.ts`)
- Max **10 tentativas** por IP a cada **15 minutos**
- Protege contra brute force de senha
- Mensagem: "Muitas tentativas de login. Tente novamente em 15 minutos."

#### Recuperação de Senha (`password-recovery.routes.ts`)
- Max **5 tentativas** por IP a cada **1 hora**
- Protege contra abuso do sistema de reset

#### Global (`index.ts`)
- Max **200 requests** por IP a cada **1 minuto**
- Health check (`/api/health`) é excluído do limite
- Protege contra DDoS simples e scraping

### 3. Helmet (`index.ts`)
- Headers HTTP de segurança automáticos:
  - `X-Content-Type-Options: nosniff` (previne MIME sniffing)
  - `X-Frame-Options: SAMEORIGIN` (previne clickjacking)
  - `X-XSS-Protection` (previne XSS refletido)
  - `Strict-Transport-Security` (força HTTPS)
  - `X-Download-Options: noopen` (previne download automático)
- **Desabilitados** (pra não quebrar o frontend):
  - `contentSecurityPolicy` (scripts inline do React)
  - `crossOriginEmbedderPolicy` (imagens externas/MinIO)

### 4. JWT
- Expiração: **24 horas** (operador loga de manhã, expira à noite)
- Secret: via `process.env.JWT_SECRET` (fallback `development-secret` só local)
- Middleware `authenticateToken` obrigatório em todas as rotas protegidas

### 5. Certificados e Chaves (`.gitignore`)
- `*.pfx`, `*.pem`, `*.key`, `*.p12`, `*.cert` ignorados pelo git
- Pasta `packages/backend/certificates/` ignorada
- Impossível subir pro GitHub acidentalmente

### 6. Banco de Dados
- PostgreSQL do sistema: dentro do container Docker (isolado)
- Banco do cliente (Oracle/PG ERP): acesso read-only (usuário `bi`)
- `.env` com credenciais nunca vai pro git

## Pacotes de Segurança

| Pacote | Versão | Função |
|--------|--------|--------|
| `helmet` | 8.1.0 | Headers HTTP de segurança |
| `express-rate-limit` | 8.3.2 | Limitação de requests por IP |
| `bcrypt` | (existente) | Hash de senhas |
| `jsonwebtoken` | (existente) | Autenticação JWT |
| `cors` | (existente) | Controle de origem |

## Checklist para Novos Clientes

Ao criar um novo cliente, verificar:

- [ ] `.env` com `JWT_SECRET` único (não usar `development-secret`)
- [ ] Certificados bancários na pasta `certificates/` (fora do git)
- [ ] Usuário do banco ERP com permissão SELECT only
- [ ] Túnel SSH configurado e persistente (autossh)
- [ ] HTTPS configurado no domínio (Cloudflare/Let's Encrypt)

## O que NÃO temos (melhorias futuras)

- [ ] Permissão por rota (controle granular por usuário)
- [ ] Permissão por loja (usuário só vê dados da loja dele)
- [ ] Proteção DDoS avançada (Cloudflare WAF)
- [ ] Auditoria de acessos (log de quem acessou o quê)
- [ ] 2FA (autenticação de dois fatores)

---

**Atualizado em:** 10/04/2026
