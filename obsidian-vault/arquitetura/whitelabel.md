---
name: Whitelabel - Estado atual e plano de mudança
description: Como o branding/domínio funciona hoje e o que muda pra virar whitelabel completo. Inclui rollback caso falhe.
type: arquitetura
---

# Whitelabel — Estado Atual + Plano de Mudança

> **Por que esse doc:** o usuário (Mameva) quer revender o sistema com domínio próprio (`mameva.com.br`). Se a implementação falhar e o chat cair, este doc é o ponto de retomada.

---

## 🟢 ESTADO ATUAL (2026-05-08, antes da mudança)

### Como funciona o domínio
**Tudo é subdomínio fixo de `prevencaonoradar.com.br`:**

| Cliente | URL atual |
|---|---|
| Tradição | `https://tradicao.prevencaonoradar.com.br` |
| SuperVital | `https://supervital.prevencaonoradar.com.br` |
| Mameva | `https://mameva.prevencaonoradar.com.br` |
| Novacentral | `https://novacentral.prevencaonoradar.com.br` |
| (etc.) | `https://<cliente>.prevencaonoradar.com.br` |

---

## 📦 COMO O AUTO INSTALADOR FUNCIONA HOJE

**Arquivo:** [InstaladorVPS/install-multitenant.sh](../../InstaladorVPS/install-multitenant.sh) (versão 5.4, ~1700 linhas)

### Como é executado
```bash
# Modo interativo (perguntas no terminal):
ssh root@vps2-hostinger
cd /root/prevencao-radar-repo/InstaladorVPS
bash install-multitenant.sh

# Modo automatizado (passa nome cliente como arg, sem perguntar):
bash install-multitenant.sh nomecliente
```

### Fluxo do instalador (12 etapas em ordem)

#### 1. **Detectar IP da VPS** (linha 142)
```bash
HOST_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || ...)
# Fallback: pergunta ao usuário se falhar
```

#### 2. **Receber nome do cliente** (linha 157-186)
- Modo interativo: pergunta `📝 Nome do cliente (apenas letras minúsculas, sem espaços):`
- Modo CLI: usa `$1` (primeiro argumento)
- **Validação:** regex `^[a-z0-9]+$` (rejeita maiúsculas, espaços, símbolos)
- **Reinstalação:** se `/root/clientes/$CLIENT_NAME` já existe, pergunta antes de apagar (com `docker compose down -v` — destrói volumes)

#### 3. **Calcular nomes derivados** (linha 192-195)
```bash
CLIENT_SUBDOMAIN="${CLIENT_NAME}.prevencaonoradar.com.br"  # ⚠️ HARDCODE AQUI
POSTGRES_DB_NAME="postgres_${CLIENT_NAME}"
MINIO_BUCKET_NAME="minio-${CLIENT_NAME}"
CONTAINER_PREFIX="prevencao-${CLIENT_NAME}"
```

#### 4. **Atualizar repo compartilhado** (linha 250-264)
```bash
REPO_DIR="/root/prevencao-radar-repo"
# Se existe: git fetch + reset --hard origin/TESTE + pull
# Se não: git clone -b TESTE https://github.com/Betotradicao/TESTES-.git
```
**Atenção:** Reset `--hard` apaga mudanças locais no repo compartilhado.

#### 5. **Gerar portas únicas** (linha 271-325)
- Hash do nome do cliente (md5 → mod 900 + 100) → número 100-999
- Frontend: `3000 + N`
- Backend: `4000 + N`
- Postgres: `5400 + N`
- MinIO API: `9000 + N`
- MinIO Console: `9100 + N`
- Túneis SSH (Oracle/MSSQL/API): `10000+N` / `11000+N` / `12000+N`
- **Verifica conflito:** se a porta calculada já tá em uso, soma +10 e tenta de novo
- **Abre no firewall (UFW):** as 3 portas de túnel SSH ficam expostas externamente

#### 6. **Gerar credenciais aleatórias** (linha 333-345)
```bash
generate_password() { openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32; }
# POSTGRES_PASSWORD, JWT_SECRET, API_TOKEN, MINIO_ROOT_PASSWORD
```
Cada cliente tem credenciais 100% diferentes — isolamento total.

#### 7. **Criar `/root/clientes/$CLIENT_NAME/.env`** (linha 355-426)
Aproximadamente 50 variáveis. Principais:
```env
CLIENT_NAME=...
CLIENT_SUBDOMAIN=...                # ⚠️ usado em 6 lugares depois
FRONTEND_URL=https://$CLIENT_SUBDOMAIN
VITE_API_URL=https://$CLIENT_SUBDOMAIN/api
MINIO_PUBLIC_ENDPOINT=$CLIENT_SUBDOMAIN
DB_HOST=${CONTAINER_PREFIX}-postgres
JWT_SECRET=...
# (+ portas, credenciais MinIO, etc.)
```

#### 8. **Criar `/root/clientes/$CLIENT_NAME/docker-compose.yml`** (linha 428-607)
5 serviços:
- `postgres` (PostgreSQL 16 + pg_trgm)
- `minio` (armazenamento S3-compatível pra fotos/uploads)
- `backend` (Node.js + TypeORM + Express)
- `frontend` (nginx servindo o Vite build)
- `cron` (jobs agendados: notificações, etc.)

Volumes nomeados: `${CONTAINER_PREFIX}_postgres_data`, `_minio_data`, `_backend_uploads`. Network própria por cliente.

#### 9. **Configurar Nginx proxy reverso** (linha 616-708)
Cria `/etc/nginx/sites-available/$CLIENT_NAME` com:
- `server_name $CLIENT_SUBDOMAIN`
- `/` → frontend (porta calculada)
- `/api` → backend (timeout 300s, body limit 100M pra uploads)
- `/socket.io` → backend WebSocket (bips em tempo real)
- `/uploads/` → backend (imagens DVR/facial)
- `/storage/` → MinIO bucket (fotos públicas, cache 7 dias)

Symlink em `sites-enabled/` + `nginx -t` + `systemctl reload nginx`.

#### 10. **Gerar SSL com Certbot** (linha 715-737)
```bash
certbot --nginx -d $CLIENT_SUBDOMAIN --non-interactive --agree-tos --register-unsafely-without-email
```
- ⚠️ **Pré-requisito crítico:** DNS do subdomínio precisa apontar pra `$HOST_IP` ANTES de rodar
- Modo interativo: pergunta `O DNS já está configurado? (s/n)`
- Modo CLI: assume sim
- Se Certbot falhar, instalação continua e mostra comando manual pra rodar depois

#### 11. **Subir containers + bootstrap do banco** (linha 766-924)
```bash
docker compose up -d --build  # ⚠️ rebuilda todas as imagens
sleep 10
# Aguarda postgres responder (até 60s)
# Insere migration "fake" RemoveCnpjUniqueConstraint pra pular bug conhecido
# Aguarda backend responder em /api/health (até 120s)
# Cria tabelas adicionais que não estão em migrations:
#   - suspect_identifications, secoes_inativas
#   - colunas: sells.operator_*, bips.cod_loja, database_connections.mappings
# Atualiza tabela `configurations` com URLs HTTPS:
#   - minio_public_endpoint = $CLIENT_SUBDOMAIN
#   - minio_public_use_ssl = true
#   - minio_public_path = /storage
```

#### 12. **MinIO bucket + ERP Templates + clientes.json** (linha 926-1083)
- Cria bucket no MinIO (`mc mb` + `mc anonymous set download` pra ler público)
- Insere ERP Templates pré-configurados (Intersolid + RP Info, com queries SQL prontas)
- Atualiza `/root/clientes/clientes.json` com:
  ```json
  {
    "vps": {
      "46": {
        "ip": "46.202.150.64",
        "clientes": {
          "$CLIENT_NAME": {
            "subdomain": "$CLIENT_SUBDOMAIN",
            "containers": {...},
            "ports": {...},
            "tunnel_ports": {...}
          }
        }
      }
    }
  }
  ```
- Salva resumo em `/root/clientes/$CLIENT_NAME/INSTALACAO_INFO.txt` (com TODAS as senhas em texto plano — só legível por root)

### Resultado final do instalador
- 1 stack Docker Compose isolada por cliente em `/root/clientes/$CLIENT_NAME/`
- 5 containers rodando (`prevencao-$CLIENT_NAME-{frontend,backend,postgres,minio,cron}`)
- 1 banco PostgreSQL próprio (`postgres_$CLIENT_NAME`)
- 1 bucket MinIO próprio (`minio-$CLIENT_NAME`)
- HTTPS funcionando via `https://$CLIENT_SUBDOMAIN`
- Cliente registrado em `clientes.json` (usado pelo `manage-multitenant.sh`)
- Acesso inicial via `/first-setup` (tela onde admin cria primeiro usuário master)

### Onde o domínio entra na implementação
`$CLIENT_SUBDOMAIN` é a chave do whitelabel. Aparece em:
1. `.env` (`CLIENT_SUBDOMAIN`, `FRONTEND_URL`, `VITE_API_URL`, `MINIO_PUBLIC_ENDPOINT`)
2. Nginx (`server_name`)
3. Certbot (`-d $CLIENT_SUBDOMAIN`)
4. SQL `UPDATE configurations SET value = '$CLIENT_SUBDOMAIN' WHERE key = 'minio_public_endpoint'`
5. `clientes.json` (`"subdomain"`)
6. `INSTALACAO_INFO.txt` (resumo)

**Ou seja:** se trocar `$CLIENT_SUBDOMAIN` no início (linha 192), tudo o resto se ajusta automaticamente. **Por isso o quick win é tão simples — só preciso parametrizar uma variável.**

### Comando de operação dia a dia (NÃO é o instalador)
Pra atualizar código de cliente JÁ instalado, NÃO se roda o instalador — usa-se [[deploy]]:
```bash
ssh vps2-hostinger "cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/$CLIENTE && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend"
```
Instalador só roda **uma vez** por cliente. Reexecução = wipe completo (com confirmação).

### Como funciona o branding (logo + nome)
**JÁ é parametrizado no banco** — não precisa código novo pra isso.

| Campo | Tabela | Onde edita |
|---|---|---|
| `client_brand_name` | `configurations` | UI: **Configurações → Empresa** |
| `client_logo_url` | `configurations` | UI: **Configurações → Empresa** |

Componente que lê: [packages/frontend/src/components/Logo.jsx](../../packages/frontend/src/components/Logo.jsx)
- Cacheia em memória (`_cachedBrand`) pra render rápido
- Fallback: se vazio, mostra logo "Radar 360" + iniciais "R"

### O que ESTÁ hardcoded hoje (texto fixo "Prevenção no Radar" / "Radar 360")
Levantamento — 12 arquivos:

| Arquivo | O que aparece |
|---|---|
| `components/Sidebar.jsx:1661` | Fallback `'Radar 360'` quando user sem nome |
| `components/Logo.jsx:90` | Comentário "Default: logo Radar 360" |
| `components/colaboradores/PermissionsSelector.jsx:369` | Header "Prevenção no Radar" no seletor de permissões |
| `components/configuracoes/AITab.jsx:99` | Prompt do assistente IA: `Voce trabalha dentro do sistema "Radar 360"` |
| `components/configuracoes/EmpresaConfigTab.jsx:425,452,542,550` | Mensagens de UI ("Restaurar logo Radar 360") |
| `components/configuracoes/LgpdTab.jsx:11,27,322,398,400,402,405` | Textos LGPD + email `dpo@prevencaonoradar.com.br` |
| `components/configuracoes/ModulesTab.jsx:30` | Comentário |
| `components/configuracoes/ModulosTab.jsx:45` | Nome de seção: `'Prevenção no Radar'` |
| `components/configuracoes/UserSecuritySettings.jsx:36,74` | `smtpFromName: 'Radar 360'` |
| `constants/menuConstants.js:12` | Comentário |
| `pages/AlertaResolucao.jsx:251` | Footer: "Prevenção no Radar · Check List" |
| `pages/Bipagens.jsx:860` | Footer PDF: `Radar 360` |
| `pages/ConfiguracoesTabelas.jsx:772,2233,3268` | Nome de módulo + footer PDF |
| `pages/CurriculoPublico.jsx:1360,1413,1447,1485,1516` | Textos LGPD + DPO email + footer "Prevenção no Radar · Banco de Currículos" |

### O que JÁ funciona em multi-domínio
- **Nginx** suporta múltiplos `server_name` na mesma VPS. Já tem 7+ subdomínios funcionando.
- **Certbot** gera SSL por domínio independente. Sem limite prático.
- **Logo + Nome** dinâmicos por cliente (via `configurations`)
- **Email SMTP** dinâmico por cliente (via tela Email em Configurações)

---

## 🟡 PLANO DE MUDANÇA (whitelabel completo)

### Quick win (3-4h) — fase 1
1. **Instalador aceitar domínio customizado** ([install-multitenant.sh:134](../../InstaladorVPS/install-multitenant.sh))
   - Adicionar prompt: "Usar domínio personalizado? (s/n)"
   - Se sim, ler `CUSTOM_DOMAIN` (ex: `app.mameva.com.br`)
   - `CLIENT_SUBDOMAIN=${CUSTOM_DOMAIN:-"${CLIENT_NAME}.$DOMAIN_BASE"}`
   - **Resto do script já usa $CLIENT_SUBDOMAIN — não muda mais nada.**

2. **Trocar hardcodes "Radar 360" / "Prevenção no Radar" pra `client_brand_name`** nos 12 arquivos acima.
   - Padrão: ler de `configurations.client_brand_name` (ou contexto React)
   - Fallback: `"Radar 360"` (se config vazia)
   - LgpdTab + CurriculoPublico: deixar **2 níveis** — "Operador" continua sendo Radar 360 (você é DPO real), mas o cabeçalho da página/footer mostra a marca do cliente.

3. **EmpresaConfigTab.jsx** ganhar campos extras:
   - Cor primária (CSS var)
   - Favicon URL
   - Title da aba (`document.title`)
   - DPO email (pra Mameva colocar o dela em vez de `dpo@prevencaonoradar.com.br`)

### Fase 2 (1 dia) — whitelabel completo
- **SMTP por cliente** (já tem tela, mas reforçar fallback)
- **Sub-revendedor**: tela onde Mameva pode criar clientes dela mesma sem o admin Radar 360 ser envolvido
- **Faturamento separado** (fora do escopo técnico — comercial)

### O que NÃO precisa mudar
- Backend (já é por tenant via banco separado)
- Postgres / MinIO (já isolado por cliente)
- Nginx multi-domínio (já funciona)
- Auth/permissões (já é por tenant)

---

## 🔴 ROLLBACK — se algo der errado

### Se a mudança no instalador quebrar
**Sintoma:** novo cliente não consegue ser criado, ou subdomínio padrão deixa de funcionar.

**Reverter:**
```bash
# Na VPS
cd /root/prevencao-radar-repo
git log --oneline | head -5  # achar o commit ANTES da mudança do whitelabel
git checkout <hash-antigo> -- InstaladorVPS/install-multitenant.sh
```

Ou no local:
```bash
git revert <hash-do-commit-whitelabel>
git push origin TESTE
```

### Se a remoção dos hardcodes quebrar UI
**Sintoma:** página em branco, ou texto vazio onde deveria ter "Radar 360".

**Diagnóstico rápido:**
1. Console do browser (F12) mostra erro de undefined?
2. Componente `Logo.jsx` está retornando `null`?

**Reverter localmente:**
```bash
# Reverte só os arquivos de UI, mantém instalador
git checkout HEAD~1 -- packages/frontend/src/components/configuracoes/LgpdTab.jsx
# (repete pros outros arquivos)
```

**Quick fix sem reverter:** o componente `Logo.jsx` já tem fallback `'Radar 360'`. Garantir que TODOS os outros pontos também tenham fallback:
```jsx
{brandName || 'Radar 360'}
```

### Se DNS / SSL der problema no domínio customizado
**Sintoma:** `mameva.com.br` não resolve, ou certbot falha.

**Diagnóstico:**
```bash
# DNS aponta certo?
dig app.mameva.com.br +short
# Esperado: 46.202.150.64 (IP da VPS)

# Certbot tem cert?
ssh vps2-hostinger "certbot certificates" | grep mameva
```

**Workaround:** rodar instalador com subdomínio padrão primeiro (`mameva.prevencaonoradar.com.br`), e DEPOIS adicionar o domínio customizado como alias no Nginx + certbot:
```bash
ssh vps2-hostinger "certbot --nginx -d app.mameva.com.br --non-interactive --agree-tos"
```

---

## 📍 PONTOS CRÍTICOS QUE NÃO PODEM QUEBRAR

1. **Clientes existentes continuam acessando pelo subdomínio antigo.** A mudança do instalador é **aditiva** — não afeta `tradicao.prevencaonoradar.com.br` etc.
2. **`client_brand_name` vazio = fallback "Radar 360".** Não pode quebrar quem não configurou.
3. **`configurations` é por cliente** (banco separado por tenant) — não tem risco de Mameva sobrescrever branding da Tradição.
4. **DNS é responsabilidade da Mameva** — você só roda o instalador depois que ela apontou. Senão certbot falha e o cliente fica sem SSL.

---

## 🎯 CHECKLIST PRÉ-IMPLEMENTAÇÃO

Antes de começar a mudança, confirmar:

- [ ] Mameva entendeu que precisa apontar DNS antes
- [ ] Backup do `install-multitenant.sh` no git (já tá lá)
- [ ] Definido se DPO Radar 360 continua sendo `dpo@prevencaonoradar.com.br` mesmo pra revendedor (provavelmente sim)
- [ ] Cliente piloto pra testar (criar um `whitelabel-teste.local` com hosts file?)

## 🎯 CHECKLIST PÓS-IMPLEMENTAÇÃO

- [ ] Cliente novo com domínio customizado funciona
- [ ] Cliente antigo (subdomínio padrão) continua funcionando
- [ ] Logo customizado aparece no menu
- [ ] Nome customizado aparece no Sidebar
- [ ] LGPD page mostra marca do cliente
- [ ] Currículo público mostra marca do cliente
- [ ] PDFs gerados (Bipagens, ConfigTabelas) mostram marca
- [ ] Emails enviados usam `smtpFromName` customizado

---

## 🔗 Arquivos relacionados
- [[deploy]] — como subir mudanças nos clientes
- [[../padroes/regras-ssh-windows]] — wrapper PowerShell pra SSH
- [[../clientes/mameva]] — particularidades da Mameva (cliente piloto do whitelabel)
