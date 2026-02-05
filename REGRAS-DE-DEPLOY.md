# ⚠️ REGRAS CRÍTICAS DE DEPLOY - LEIA ANTES DE QUALQUER DEPLOY!

## 🚨 REGRA #1: NUNCA RECRIAR CONTAINERS DE BANCO DE DADOS

**❌ NUNCA FAÇA:**
```bash
docker compose up -d --build  # RECRIA TODOS OS CONTAINERS = PERDE BANCO DE DADOS!
docker compose down && up -d  # REMOVE E RECRIA = PERDE BANCO DE DADOS!
docker compose build          # Rebuilda tudo, incluindo gera NOVAS SENHAS!
```

**✅ SEMPRE FAÇA:**
```bash
# Para deploy de FRONTEND apenas:
cd /root/prevencao-radar-install/InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend

# Para deploy de BACKEND apenas:
cd /root/prevencao-radar-install/InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d --no-deps backend

# Flags importantes:
# --no-deps = NÃO reinicia containers dependentes (PostgreSQL, MinIO)
# --no-cache = Força rebuild sem usar cache (pega mudanças novas)
```

---

## 🔐 REGRA #2: SENHAS DO BANCO SÃO GERADAS UMA VEZ E NUNCA MUDAM

**IMPORTANTE:** O `docker-compose-producao.yml` gera senhas aleatórias na PRIMEIRA vez que os containers são criados. Se você reconstruir as imagens, o docker-compose vai gerar NOVAS senhas, mas o banco postgres vai continuar com a senha ANTIGA!

**Resultado:** Backend não consegue conectar no banco (erro: `password authentication failed`)

**SOLUÇÃO:**
- Use sempre `--no-deps` para não recriar o container do postgres
- Se precisar reconstruir tudo do zero, use `docker compose down -v` (⚠️ PERDE TODOS OS DADOS!)

---

## 📋 CHECKLIST OBRIGATÓRIO ANTES DE FAZER DEPLOY

### 1. Identificar o que mudou:
- [ ] Mudou código do FRONTEND? (arquivos em `packages/frontend/src/`)
- [ ] Mudou código do BACKEND? (arquivos em `packages/backend/src/`)
- [ ] Mudou BANCO DE DADOS? (migrations, schema)

### 2. Escolher comando correto:

#### ✅ Se mudou APENAS FRONTEND:
```bash
ssh root@145.223.92.152
cd /root/prevencao-radar-install
git pull
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend
```

#### ✅ Se mudou APENAS BACKEND:
```bash
ssh root@145.223.92.152
cd /root/prevencao-radar-install
git pull
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d --no-deps backend
```

#### ✅ Se mudou FRONTEND + BACKEND:
```bash
ssh root@145.223.92.152
cd /root/prevencao-radar-install
git pull
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache frontend backend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend
```

#### ⚠️ Se mudou BANCO DE DADOS (migrations):
```bash
ssh root@145.223.92.152
cd /root/prevencao-radar-install
git pull
cd InstaladorVPS

# Apenas rebuild do backend (migrations rodam automaticamente no boot)
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d --no-deps backend

# Verificar logs para confirmar que migrations rodaram:
docker logs prevencao-backend-prod --tail 50
```

---

## 🛑 SE DEU ERRO: "password authentication failed for user postgres"

**Causa:** Você reconstruiu as imagens e o docker-compose gerou novas senhas diferentes das que o postgres está usando.

**Sintomas:**
- Backend não conecta no banco
- Logs mostram: `password authentication failed for user "postgres"`
- Site fica em loop de loading

**Solução RÁPIDA (sem perder dados):**

```bash
# 1. Descobrir qual senha o backend está usando:
docker exec prevencao-backend-prod env | grep DB_PASSWORD

# 2. Descobrir qual senha o postgres está usando:
docker exec prevencao-postgres-prod env | grep POSTGRES_PASSWORD

# 3. Se forem diferentes, atualizar a senha do postgres:
docker exec prevencao-postgres-prod psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'SENHA_DO_BACKEND_AQUI';"

# 4. Reiniciar o backend:
docker restart prevencao-backend-prod

# 5. Verificar se conectou:
docker logs prevencao-backend-prod --tail 30 | grep "Database connected"
```

---

## 🛑 SE VOCÊ RECRIOU O BANCO DE DADOS POR ENGANO

**Sintomas:**
- Tela de "First Setup" apareceu novamente
- Perdeu todas as configurações/dados
- Volume do postgres foi deletado

**NÃO TEM MAIS VOLTA!** Os dados foram perdidos.

**Solução:**
```bash
# Parar tudo e começar do zero
cd /root/prevencao-radar-install/InstaladorVPS
docker compose -f docker-compose-producao.yml down -v  # Remove volumes também

# Rodar instalador novamente (cria banco do zero)
bash INSTALAR-AUTO.sh

# Avisar o usuário que precisa:
# - Refazer First Setup
# - Reconfigurar APIs (Zanthus, WhatsApp, Evolution)
# - Reativar produtos
# - Refazer todas as configurações
```

---

## 📝 EXEMPLO REAL DE DEPLOY CORRETO

**Situação:** Implementei módulo de Produção com novas tabelas no banco

**Passos:**
```bash
# 1. Fazer commit local
git add -A
git commit -m "feat: Adiciona módulo de produção com dias por item"
git push

# 2. Deploy na VPS (APENAS BACKEND porque tem migration!)
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend"

# 3. Verificar se migrations rodaram e backend conectou
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker logs prevencao-backend-prod --tail 50 | grep -E 'Database connected|migration ran|Server is running'"

# 4. Verificar se tabelas foram criadas
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c \"SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%production%';\""

# 5. Testar o site
curl http://145.223.92.152:3001/api/health
```

---

## 🔍 COMANDOS ÚTEIS PARA VERIFICAR STATUS

```bash
# Ver containers rodando
docker ps

# Ver logs do backend
docker logs prevencao-backend-prod --tail 50 -f

# Ver logs do frontend
docker logs prevencao-frontend-prod --tail 50

# Verificar se banco está respondendo
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c 'SELECT COUNT(*) FROM users;'

# Verificar volumes (NÃO DEVEM SER DELETADOS!)
docker volume ls

# Verificar quantas tabelas existem no banco
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c '\dt' | wc -l

# Ver senha atual do postgres
docker exec prevencao-postgres-prod env | grep POSTGRES_PASSWORD

# Ver senha que o backend está usando
docker exec prevencao-backend-prod env | grep DB_PASSWORD
```

---

## 📁 DIFERENÇA ENTRE docker-compose.yml E docker-compose-producao.yml

### `docker-compose.yml` (Desenvolvimento Local)
- Senhas SIMPLES e fixas (postgres123, test-api-token)
- Sem SSL/TLS
- Sem volumes nomeados persistentes
- Portas diretas (3000, 3001, 5432)
- **NUNCA usar em produção!**

### `docker-compose-producao.yml` (VPS)
- Senhas FORTES geradas automaticamente na criação
- Configurações de segurança
- Volumes nomeados persistentes (dados não são perdidos)
- Container de cron para tarefas agendadas
- Healthchecks configurados
- **SEMPRE usar em produção!**

**IMPORTANTE:** Se você reconstruir com `docker-compose-producao.yml`, ele vai gerar NOVAS senhas. Por isso sempre use `--no-deps` para não recriar o postgres!

---

## ❗ MEMORIZAR ISSO:

1. **--no-deps** = NÃO mexe em PostgreSQL/MinIO (preserva senhas e dados)
2. **--no-cache** = Pega código novo do Git
3. **Sempre especificar QUAL container atualizar** (frontend, backend, ou ambos)
4. **NUNCA usar `down`** a menos que queira começar do zero
5. **docker-compose-producao.yml gera senhas NOVAS a cada build** - por isso use --no-deps!

---

## 📞 SE TIVER DÚVIDA

**ANTES** de rodar qualquer comando de deploy:
1. Pare e pense: "Vou recriar o banco de dados com esse comando?"
2. Pare e pense: "Vou gerar novas senhas diferentes?"
3. Se a resposta for "SIM" ou "NÃO SEI", **NÃO RODE O COMANDO!**
4. Consulte este documento novamente
5. Use `--no-deps` para garantir

---

## 🎓 LIÇÕES APRENDIDAS (09/01/2026)

### Problema que aconteceu:
1. Reconstruí imagens com `docker-compose-producao.yml`
2. Docker gerou NOVAS senhas aleatórias
3. Backend tentou usar senha NOVA
4. Postgres tinha senha ANTIGA
5. Backend não conseguiu conectar

### Solução aplicada:
1. Mantive postgres com senha antiga (preservou dados)
2. Descobri qual senha o backend estava usando
3. Alterei a senha do postgres para a senha do backend novo
4. Backend conectou e migrations rodaram
5. Nenhum dado foi perdido!

### Aprendizado:
- Senhas são geradas na CRIAÇÃO dos containers
- Se rebuildar, gera novas senhas
- Sempre usar `--no-deps` para não recriar postgres
- Se errar, dá pra corrigir alterando senha do postgres

---

## 🆘 SE DEU ERRO: Hash de senha corrompido/desatualizado

**Problema encontrado em 11/01/2026:**

**Sintomas:**
- Backend não conecta no banco mesmo com senhas corretas no .env
- Erro: `password authentication failed for user "postgres"`
- Senhas conferem mas autenticação falha
- `database.connected = false` na API health

**Causa:**
- Hash da senha no PostgreSQL ficou desatualizado/corrompido
- Ocorre após múltiplos rebuilds ou recriações de containers
- Mesmo com senha correta no .env, o hash interno não corresponde

**Solução RÁPIDA:**

```bash
# 1. Verificar se as senhas estão iguais:
docker exec prevencao-backend-prod env | grep DB_PASSWORD
docker exec prevencao-postgres-prod env | grep POSTGRES_PASSWORD

# 2. Se estiverem iguais mas ainda dá erro, resetar hash da senha:
SENHA=$(docker exec prevencao-postgres-prod env | grep POSTGRES_PASSWORD | cut -d'=' -f2)
docker exec prevencao-postgres-prod psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$SENHA';"

# 3. Reiniciar backend:
docker restart prevencao-backend-prod

# 4. Verificar se conectou:
curl http://localhost:3001/api/health | grep "connected"
# Deve retornar: "connected":true
```

**Importante:**
- Este comando NÃO altera a senha, apenas atualiza o hash interno do PostgreSQL
- É seguro executar mesmo em produção
- Não afeta dados ou conexões existentes

---

## 🧹 LIMPEZA DE RECURSOS OBSOLETOS

**Quando fazer:** Após múltiplos deploys e testes, containers/imagens/volumes não usados se acumulam.

**Como identificar:**

```bash
# Ver containers inativos
docker ps -a --filter 'status=created' --filter 'status=exited'

# Ver volumes não linkados
docker volume ls

# Ver tamanho de volumes
docker system df -v

# Ver imagens não usadas
docker images

# Ver build cache (pode acumular 30GB+!)
docker system df
```

**Recursos seguros para remover:**

1. **Containers com status "Created"** - nunca rodaram
2. **Imagens sem TAG "latest"** ou duplicadas
3. **Volumes com LINKS=0** (não linkados a nenhum container)
4. **Build cache antigo** (libera muito espaço!)

**NUNCA remova:**
- Volumes linkados (LINKS > 0)
- Containers com `-prod` no nome
- Volumes de produção

**Comandos de limpeza:**

```bash
# Remover apenas recursos não usados (SEGURO)
docker system prune -a

# Limpar build cache (libera MUITO espaço)
docker builder prune --all --force

# Remover volume específico (CUIDADO!)
docker volume rm nome-do-volume  # Só se LINKS=0
```

---

---

## 🖥️ VPS 46 - MÚLTIPLOS CLIENTES (ATENÇÃO ESPECIAL!)

### ⚠️ ESTRUTURA DIFERENTE DAS OUTRAS VPS

A VPS 46 (`46.202.150.64`) tem uma estrutura **multi-tenant** com vários clientes instalados. **NÃO** é igual às outras VPS!

### 📍 IPs e Identificação das VPS

| VPS | IP | Uso | Diretório Principal |
|-----|-----|-----|---------------------|
| VPS 46 | `46.202.150.64` | **PRODUÇÃO** (Multi-clientes) | `/root/clientes/[cliente]` |
| VPS 31 | `31.97.82.235` | Outras finalidades | `/root/NOVO-PREVEN-O` |

> ⚠️ **VPS 145 (145.223.92.152) foi descontinuada - não usar mais!**

### 🏢 Clientes na VPS 46

```
/root/clientes/
├── tradicao/          # Cliente Tradição SJC
│   ├── docker-compose.yml
│   ├── .env
│   └── CREDENCIAIS.txt
├── piratininga/       # Cliente Piratininga
└── central/           # Cliente Central
```

### 📦 Containers por Cliente na VPS 46

| Cliente | Frontend | Backend | Postgres | MinIO |
|---------|----------|---------|----------|-------|
| tradicao | `prevencao-tradicao-frontend` | `prevencao-tradicao-backend` | `prevencao-tradicao-postgres` | `prevencao-tradicao-minio` |
| piratininga | `prevencao-piratininga-frontend` | `prevencao-piratininga-backend` | `prevencao-piratininga-postgres` | `prevencao-piratininga-minio` |
| central | `prevencao-central-frontend` | `prevencao-central-backend` | `prevencao-central-postgres` | `prevencao-central-minio` |

⚠️ **ATENÇÃO:** Também existem containers `prevencao-frontend-prod` e `prevencao-backend-prod` na VPS 46, mas **NÃO são usados pelos clientes**! São de uma instalação antiga/teste.

### 📂 Estrutura de Código na VPS 46

```
/root/
├── prevencao-radar-repo/      # ← CÓDIGO FONTE (git clone do TESTES-)
│   ├── packages/
│   │   ├── frontend/          # Código do frontend
│   │   └── backend/           # Código do backend
│   └── ...
├── clientes/
│   └── tradicao/
│       ├── docker-compose.yml # ← Referencia o código de /root/prevencao-radar-repo
│       └── .env               # ← Configurações específicas do cliente
└── prevencao-radar-install/   # ⚠️ NÃO USAR - instalação antiga
```

### ✅ DEPLOY CORRETO NA VPS 46 (Cliente Tradição)

```bash
# 1. Conectar na VPS 46
ssh root@46.202.150.64

# 2. Atualizar código fonte
cd /root/prevencao-radar-repo
git pull origin TESTE

# 3. Ir para pasta do cliente
cd /root/clientes/tradicao

# 4. Build do frontend (se mudou frontend)
docker compose build --no-cache frontend
docker compose up -d --no-deps frontend

# 5. Build do backend (se mudou backend ou migrations)
docker compose build --no-cache backend
docker compose up -d --no-deps backend

# 6. Verificar logs
docker logs prevencao-tradicao-backend --tail 50
docker logs prevencao-tradicao-frontend --tail 20
```

### 🔄 Comando Único para Deploy Completo (Tradição)

```bash
# Frontend + Backend
ssh root@46.202.150.64 "cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/tradicao && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend"

# Apenas Frontend
ssh root@46.202.150.64 "cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/tradicao && docker compose build --no-cache frontend && docker compose up -d --no-deps frontend"

# Apenas Backend
ssh root@46.202.150.64 "cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/tradicao && docker compose build --no-cache backend && docker compose up -d --no-deps backend"
```

### 🔍 Verificar Status dos Clientes

```bash
# Ver todos os containers da VPS 46
ssh root@46.202.150.64 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# Ver logs do tradicao
ssh root@46.202.150.64 "docker logs prevencao-tradicao-backend --tail 30"
ssh root@46.202.150.64 "docker logs prevencao-tradicao-frontend --tail 10"

# Verificar banco do tradicao
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c '\\dt'"
```

### ❌ ERROS COMUNS NA VPS 46

1. **Atualizou container errado**: Verificar se está usando `prevencao-tradicao-*` e não `prevencao-*-prod`
2. **Git pull no diretório errado**: Deve ser em `/root/prevencao-radar-repo`, não em `/root/prevencao-radar-install`
3. **Docker compose no lugar errado**: Deve rodar em `/root/clientes/tradicao`, não em `/root/prevencao-radar-repo`

### 🎓 Lição Aprendida (20/01/2026)

**Problema:** Deploy não funcionava na VPS 46 - site continuava mostrando versão antiga.

**Causa:** Estava atualizando `/root/prevencao-radar-install` e o container `prevencao-frontend-prod`, que não tem relação com o site `tradicao.prevencaonoradar.com.br`.

**Solução:**
1. Identificar que VPS 46 tem múltiplos clientes
2. Descobrir que o código está em `/root/prevencao-radar-repo`
3. Descobrir que o docker-compose está em `/root/clientes/tradicao`
4. Usar os containers corretos: `prevencao-tradicao-frontend` e `prevencao-tradicao-backend`

---

## 🔗 CONEXÃO COM INTERSOLID - LOCAL vs VPS (ATENÇÃO!)

### ⚠️ PROBLEMA: Código local funciona mas VPS não conecta no ERP

**Contexto:**
- **Local (Windows)**: Conecta diretamente no IP da máquina Intersolid (ex: `10.6.1.102:3003`)
- **VPS (Docker)**: Conecta via túnel SSH reverso que expõe a porta no host

**O problema:**
- O container Docker na VPS está numa rede isolada
- `127.0.0.1` dentro do container aponta para o próprio container, NÃO para o host
- O túnel SSH escuta no host da VPS, não dentro do container

### ✅ SOLUÇÃO CORRETA: Usar configuração do banco de dados

**NUNCA faça isso no código:**
```typescript
// ❌ ERRADO - não funciona no container Docker
if (isProduction) {
  erpApiUrl = `http://127.0.0.1:3003/v1/produtos`;
}
```

**SEMPRE faça assim:**
```typescript
// ✅ CORRETO - usa configuração do banco que já tem o IP certo
if (process.env.ERP_PRODUCTS_API_URL) {
  // Desenvolvimento local: usa .env
  erpApiUrl = process.env.ERP_PRODUCTS_API_URL;
} else {
  // Produção (VPS): busca do banco de dados
  const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
  const port = await ConfigurationService.get('intersolid_port', null);
  const endpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
  const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
  erpApiUrl = baseUrl ? `${baseUrl}${endpoint}` : 'http://mock-erp-api.com';
}
```

### 📝 Configuração do banco na VPS (já configurado)

| Chave | Valor | Descrição |
|-------|-------|-----------|
| `intersolid_api_url` | `http://172.20.0.1` | Gateway Docker (acessa o host) |
| `intersolid_port` | `3003` | Porta do túnel SSH |
| `intersolid_products_endpoint` | `/v1/produtos` | Endpoint de produtos |

**Por que `172.20.0.1`?**
- É o gateway da rede Docker
- Permite o container acessar serviços rodando no host da VPS
- O túnel SSH reverso expõe a porta 3003 no host

### 🎓 Lição Aprendida (21/01/2026)

**Problema:** Tela de Auditoria de Produção dava erro 500 - `ECONNREFUSED 127.0.0.1:3003`

**Causa:** Código usava IP fixo `127.0.0.1:3003` que não funciona dentro do container Docker

**Solução:** Alterado para usar `ConfigurationService.get('intersolid_api_url')` igual às outras telas

**Arquivos que devem seguir esse padrão:**
- `products.controller.ts` ✅
- `production-audit.controller.ts` ✅ (corrigido)
- `bip-webhook.service.ts` ✅
- `sales.service.ts` ✅
- Qualquer novo arquivo que conecte no Intersolid

---

## 🔶 REGRA #3: HOST ORACLE NA VPS É DIFERENTE DO LOCAL!

### ⚠️ PROBLEMA COMUM APÓS DEPLOY

Após fazer deploy, o Oracle para de conectar na VPS com erro:
```
❌ ORA-12170: Cannot connect. TCP connect timeout for host 10.6.1.100 port 1521
```

### 📍 Causa

A configuração de conexão Oracle é salva na tabela `database_connections` do PostgreSQL.

| Ambiente | Host Correto | Por quê |
|----------|--------------|---------|
| **Local** (desenvolvimento) | `10.6.1.100` | Conecta direto na rede local |
| **VPS** (produção) | `172.20.0.1` | Conecta via túnel SSH pelo gateway Docker |

Quando você configura a conexão Intersolid **localmente**, o sistema salva `10.6.1.100`. Se essa configuração for replicada para a VPS, ela não funciona porque `10.6.1.100` não existe na rede Docker da VPS.

### ✅ Solução: Verificar e corrigir após deploy

```bash
# 1. Verificar host atual
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"SELECT name, host, port FROM database_connections WHERE type = 'oracle';\""

# 2. Se estiver 10.6.1.100, corrigir para 172.20.0.1
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"UPDATE database_connections SET host = '172.20.0.1' WHERE name = 'Intersolid';\""

# 3. Reiniciar backend para recarregar configuração
ssh root@46.202.150.64 "docker restart prevencao-tradicao-backend"

# 4. Verificar se conectou
ssh root@46.202.150.64 "docker logs prevencao-tradicao-backend --tail 20 | grep -i oracle"
```

**Logs esperados (sucesso):**
```
📦 Oracle config loaded from database_connections: Intersolid (172.20.0.1:1521/orcl.intersoul)
✅ Oracle connection pool initialized
```

### 📋 Checklist pós-deploy (quando envolve Oracle)

- [ ] Verificar se host Oracle está `172.20.0.1` (não `10.6.1.100`)
- [ ] Verificar se túnel SSH está ativo: `ss -tlnp | grep 1521`
- [ ] Verificar logs do backend: `docker logs ... | grep oracle`

### 🎓 Lição Aprendida (01/02/2026)

**Problema:** Após deploy, Oracle parou de conectar na VPS.

**Causa:** A tabela `database_connections` tinha `host = '10.6.1.100'` (IP da rede local) em vez de `host = '172.20.0.1'` (gateway Docker que acessa o túnel SSH).

**Solução:** Atualizar o host no banco PostgreSQL da VPS para `172.20.0.1` e reiniciar o backend.

**Prevenção futura:** Sempre verificar o host Oracle após deploy ou ao configurar conexão Intersolid.

### 🛡️ SOLUÇÃO PERMANENTE: Variáveis de Ambiente

O `OracleService` já suporta uma **ordem de prioridade** para configuração:

1. **Variáveis de ambiente** `ORACLE_CONNECT_STRING` (mais alta prioridade)
2. **Tabela `database_connections`** (PostgreSQL)
3. **Valores padrão hardcoded** (fallback)

**A solução para não conflitar nunca mais:**

| Ambiente | Configuração | Como aplicar |
|----------|--------------|--------------|
| **VPS (Docker)** | Variável de ambiente no docker-compose | `ORACLE_CONNECT_STRING=172.20.0.1:1521/orcl.intersoul` |
| **Local** | Usa tabela `database_connections` | Configurar host `10.6.1.100` na tela de Configurações |

**Como configurar na VPS (docker-compose.yml do cliente):**

```yaml
services:
  backend:
    environment:
      # Força o Oracle a usar o gateway Docker (túnel SSH)
      ORACLE_CONNECT_STRING: "172.20.0.1:1521/orcl.intersoul"
      ORACLE_USER: "POWERBI"
      ORACLE_PASSWORD: "OdRz6J4LY6Y6"
```

**Benefícios:**
- VPS **sempre** usa `172.20.0.1` via variável de ambiente
- Local **sempre** usa o que está configurado na tela (tabela do banco)
- **Nunca mais conflita!** Cada ambiente tem sua config isolada

---

---

## 🧹 REGRA #4: SEMPRE LIMPAR CACHE DO DOCKER APÓS DEPLOY!

### ⚠️ PROBLEMA: Disco enche após múltiplos deploys

O Docker acumula **cache de build** a cada execução de `docker compose build --no-cache`. Isso pode facilmente ocupar **30GB+ de espaço** após alguns deploys, causando:

- VPS travando ou ficando sem resposta
- Builds falhando por falta de espaço
- Erro "No space left on device"

### 📊 Exemplo Real (02/02/2026)

```
ANTES do deploy:  49GB/50GB usado (1GB livre)
DEPOIS do deploy: VPS travou - disco 100% cheio
APÓS limpeza:     34GB/96GB usado (62GB livre)
```

### ✅ PROCESSO CORRETO DE DEPLOY (COM LIMPEZA)

```bash
# 1. Atualizar código
cd /root/prevencao-radar-repo && git pull origin TESTE

# 2. Ir para o cliente
cd /root/clientes/tradicao

# 3. Build com --no-cache (necessário para pegar mudanças no código)
docker compose build --no-cache frontend backend

# 4. Subir containers (--no-deps preserva PostgreSQL/MinIO)
docker compose up -d --no-deps frontend backend

# 5. ⚠️ IMPORTANTE: Limpar cache do Docker após o build
docker builder prune -f
docker image prune -f
```

### 📋 Tabela de Referência Rápida

| Flag/Comando | O que faz |
|--------------|-----------|
| `--no-cache` | Força rebuild completo (pega alterações no código) |
| `--no-deps` | Não recria PostgreSQL/MinIO (preserva dados e senhas) |
| `docker builder prune -f` | Limpa cache de build (libera muito espaço) |
| `docker image prune -f` | Remove imagens antigas não usadas |

### 🔄 Script de Deploy Completo (Recomendado)

Crie o arquivo `/root/deploy-cliente.sh`:

```bash
#!/bin/bash
# Script de deploy seguro com limpeza de cache

CLIENTE=${1:-tradicao}

echo "🚀 Iniciando deploy para cliente: $CLIENTE"

# Atualizar código
cd /root/prevencao-radar-repo && git pull origin TESTE

# Build e deploy
cd /root/clientes/$CLIENTE
docker compose build --no-cache frontend backend
docker compose up -d --no-deps frontend backend

# Limpar cache (IMPORTANTE!)
echo "🧹 Limpando cache do Docker..."
docker builder prune -f
docker image prune -f

# Verificar
echo "✅ Deploy concluído! Verificando containers..."
docker compose ps

echo "📊 Espaço em disco:"
df -h /

echo "🎉 Pronto!"
```

**Uso:**
```bash
chmod +x /root/deploy-cliente.sh
./deploy-cliente.sh tradicao    # Deploy no cliente Tradição
./deploy-cliente.sh piratininga # Deploy no cliente Piratininga
```

### 🔍 Como verificar espaço do Docker

```bash
# Ver uso geral do Docker
docker system df

# Ver detalhado (imagens, containers, volumes, cache)
docker system df -v

# Ver espaço em disco da VPS
df -h
```

### 🎓 Lição Aprendida (02/02/2026)

**Problema:** VPS 46 travou durante deploy - disco encheu e SSH parou de responder.

**Causa:** O `docker compose build --no-cache` acumula cache a cada execução. Sem limpeza periódica, o disco encheu rapidamente (49GB → 100%).

**Solução:**
1. Usuário aumentou limite da VPS de 50GB para 100GB
2. Após deploy, executar `docker builder prune -f && docker image prune -f`
3. Isso liberou ~30GB de espaço

**Prevenção:**
- Sempre limpar cache após o deploy
- Verificar `df -h` antes de fazer deploy
- Se espaço < 10GB, limpar antes do deploy

---

## 🏪 REGRA #5: VERIFICAR MULTI-LOJA ANTES DO DEPLOY!

### ⚠️ PROBLEMA: Deploy funciona mas sistema não separa dados por loja

Quando o suporte multi-loja não está configurado corretamente, o sistema pode:
- Misturar dados entre lojas diferentes
- Não mostrar filtro de loja corretamente
- Perder bipagens/vendas por falta de associação com cod_loja

### 📋 CHECKLIST MULTI-LOJA (ANTES DO DEPLOY)

#### 1. Verificar colunas cod_loja no PostgreSQL

```bash
# Conectar no banco do cliente
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'cod_loja'
ORDER BY table_name;
\""
```

**Tabelas que DEVEM ter cod_loja:**
| Tabela | Obrigatório |
|--------|-------------|
| `bips` | ✅ Sim |
| `sells` | ✅ Sim |
| `sectors` | ✅ Sim |
| `hort_frut_boxes` | ✅ Sim |
| `products` | ⚠️ Opcional (filtro por loja) |

#### 2. Se faltar coluna cod_loja, adicionar:

```bash
# Adicionar cod_loja em bips (se não existir)
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
ALTER TABLE bips ADD COLUMN IF NOT EXISTS cod_loja INTEGER;
\""

# Adicionar cod_loja em sells (se não existir)
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
ALTER TABLE sells ADD COLUMN IF NOT EXISTS cod_loja INTEGER;
\""

# Adicionar cod_loja em sectors (se não existir)
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS cod_loja INTEGER;
\""

# Adicionar cod_loja em hort_frut_boxes (se não existir)
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
ALTER TABLE hort_frut_boxes ADD COLUMN IF NOT EXISTS cod_loja INTEGER;
\""
```

#### 3. Verificar configuração de lojas no sistema

```bash
# Ver lojas cadastradas (companies)
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
SELECT id, name, cod_loja, apelido FROM companies ORDER BY cod_loja;
\""
```

**Esperado:** Cada loja deve ter um `cod_loja` único e um `apelido` para identificação

#### 4. Verificar se dados antigos têm cod_loja

```bash
# Verificar bipagens sem cod_loja
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
SELECT COUNT(*) as sem_loja FROM bips WHERE cod_loja IS NULL;
\""

# Verificar vendas sem cod_loja
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
SELECT COUNT(*) as sem_loja FROM sells WHERE cod_loja IS NULL;
\""
```

**Se houver registros sem cod_loja**, atualizar com a loja padrão:

```bash
# Atualizar bipagens antigas para loja padrão (ex: cod_loja = 1)
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
UPDATE bips SET cod_loja = 1 WHERE cod_loja IS NULL;
\""

# Atualizar vendas antigas para loja padrão
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
UPDATE sells SET cod_loja = 1 WHERE cod_loja IS NULL;
\""
```

### ✅ PROCESSO COMPLETO DE DEPLOY COM VERIFICAÇÃO MULTI-LOJA

```bash
# 1. Conectar na VPS
ssh root@46.202.150.64

# 2. VERIFICAR MULTI-LOJA PRIMEIRO
docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c "
SELECT table_name FROM information_schema.columns
WHERE column_name = 'cod_loja' AND table_name IN ('bips', 'sells', 'sectors', 'hort_frut_boxes')
ORDER BY table_name;
"

# 3. Se OK, prosseguir com deploy
cd /root/prevencao-radar-repo && git pull origin TESTE

# 4. Build e deploy
cd /root/clientes/tradicao
docker compose build --no-cache frontend backend
docker compose up -d --no-deps frontend backend

# 5. Limpar cache
docker builder prune -f && docker image prune -f

# 6. Verificar logs
docker logs prevencao-tradicao-backend --tail 30
```

### 🎓 Lição Aprendida

**Problema:** Sistema deployado mas dados apareciam misturados entre lojas.

**Causa:** Tabelas não tinham coluna `cod_loja` ou dados antigos estavam sem associação de loja.

**Solução:** Sempre verificar estrutura multi-loja ANTES do deploy e corrigir se necessário.

**Prevenção:**
- Executar checklist multi-loja antes de cada deploy
- Verificar se migrations de multi-loja rodaram corretamente
- Confirmar que dados antigos foram migrados com cod_loja

---

## 🗂️ REGRA #6: VERIFICAR MAPEAMENTO DINÂMICO (NÃO HARDCODE!)

### ⚠️ PROBLEMA: Código hardcoded impede uso com outros ERPs

Se o código usa tabelas/schema hardcoded como `INTERSOLID.TAB_PRODUTO`, o sistema só funciona com esse ERP específico. Para suportar múltiplos ERPs, **TODO código deve usar o MappingService**.

### 📋 CHECKLIST ANTES DO DEPLOY (Código Dinâmico)

#### 1. Verificar se há referências hardcoded no código novo

```bash
# Buscar por INTERSOLID hardcoded no código
grep -r "INTERSOLID\." packages/backend/src --include="*.ts"

# Se encontrar algo, o código precisa ser migrado para MappingService!
```

**Resultado esperado:** `0 matches` (nenhum hardcode)

#### 2. Padrão CORRETO (usar MappingService)

```typescript
// ❌ ERRADO - Hardcoded (não faz deploy assim!)
const sql = `SELECT * FROM INTERSOLID.TAB_PRODUTO WHERE ...`;

// ✅ CORRETO - Dinâmico via MappingService
import { MappingService } from '../services/mapping.service';

const schema = await MappingService.getSchema();
const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;
const sql = `SELECT * FROM ${tabProduto} WHERE ...`;
```

#### 3. Se adicionar nova funcionalidade que usa tabelas Oracle:

**ANTES de fazer commit/deploy:**

1. Verificar se usa `MappingService.getSchema()` para o schema
2. Verificar se usa `MappingService.getRealTableName()` para as tabelas
3. O segundo parâmetro é o fallback (valor padrão se não houver mapeamento)

### 📊 Tabelas disponíveis no MappingService

| ID da Tabela | Descrição | Usado em |
|--------------|-----------|----------|
| `TAB_PRODUTO` | Produtos | Todos os módulos |
| `TAB_PRODUTO_LOJA` | Preços por loja | Bipagens, Produtos |
| `TAB_PRODUTO_PDV` | Vendas PDV | Frente de Caixa |
| `TAB_OPERADORES` | Operadores | Frente de Caixa, PDV |
| `TAB_FORNECEDOR` | Fornecedores | Compra/Venda, Pedidos |
| `TAB_PEDIDO` | Pedidos | Pedidos de Compra |
| `TAB_PEDIDO_PRODUTO` | Itens do Pedido | Ruptura Indústria |
| `TAB_NF` | Notas Fiscais | Compra/Venda |
| `TAB_NF_ITEM` | Itens da NF | Compra/Venda |

---

## 🔄 REGRA #7: ATUALIZAR TEMPLATE ERP AO ADICIONAR NOVAS TABELAS

### ⚠️ PROBLEMA: Nova funcionalidade não funciona porque template ERP não tem as tabelas

Quando você adiciona código que usa uma nova tabela Oracle (ex: `TAB_NF_ITEM`), o template do ERP no banco de dados também precisa ser atualizado, senão o MappingService não encontra o mapeamento.

### 📋 CHECKLIST AO ADICIONAR NOVA TABELA/COLUNA

#### 1. Verificar se a tabela já existe no template

```bash
# Conectar no banco e ver o template atual
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
SELECT name,
       jsonb_pretty(mappings::jsonb->'tabelas') as tabelas
FROM erp_templates
WHERE name ILIKE '%intersolid%' AND is_active = true;
\""
```

#### 2. Se a tabela NÃO existe no template, adicionar:

**Opção A: Via script (recomendado)**

```bash
# Usar o script update-template.js
cd /root/prevencao-radar-repo/packages/backend
node update-template.js producao
```

**Opção B: Manualmente no banco**

```bash
# Exemplo: Adicionar TAB_NF_ITEM ao template
ssh root@46.202.150.64 "docker exec prevencao-tradicao-postgres psql -U postgres -d postgres_tradicao -c \"
UPDATE erp_templates
SET mappings = jsonb_set(
  mappings::jsonb,
  '{tabelas,TAB_NF_ITEM}',
  '{\"nome_real\": \"TAB_NF_ITEM\", \"colunas\": {\"numero_nf\": \"NUM_NF\", \"serie_nf\": \"NUM_SERIE_NF\", \"codigo_item\": \"COD_ITEM\"}}'::jsonb
)::text
WHERE name ILIKE '%intersolid%';
\""
```

#### 3. Atualizar também o frontend (ConfiguracoesTabelas.jsx)

Se adicionou uma nova tabela, ela deve aparecer na tela de configuração:

**Arquivo:** `packages/frontend/src/pages/ConfiguracoesTabelas.jsx`

1. Adicionar a tabela no `TABLE_CATALOG`
2. Adicionar os campos da tabela
3. Atualizar o submódulo correspondente em `BUSINESS_MODULES`

### 📝 Exemplo Completo: Adicionando TAB_NOVA_TABELA

**Passo 1: Código backend (usar MappingService)**
```typescript
const schema = await MappingService.getSchema();
const tabNova = `${schema}.${await MappingService.getRealTableName('TAB_NOVA_TABELA', 'TAB_NOVA_TABELA')}`;
```

**Passo 2: Frontend (ConfiguracoesTabelas.jsx)**
```javascript
// Em TABLE_CATALOG, adicionar:
TAB_NOVA_TABELA: {
  name: 'Nova Tabela',
  description: 'Descrição da tabela',
  fields: [
    { id: 'campo1', name: 'Campo 1', defaultColumn: 'COL_CAMPO1' },
    { id: 'campo2', name: 'Campo 2', defaultColumn: 'COL_CAMPO2' },
  ]
},

// Em BUSINESS_MODULES, adicionar ao submódulo:
{ id: 'meu_submodulo', name: 'Meu Submódulo', tables: ['TAB_NOVA_TABELA'] },
```

**Passo 3: Template ERP (banco de dados)**
```bash
# Atualizar template Intersolid
node update-template.js producao
```

**Passo 4: Commit e deploy**
```bash
git add -A
git commit -m "feat: Adiciona suporte a TAB_NOVA_TABELA"
git push origin TESTE

# Deploy
ssh root@46.202.150.64 "cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/tradicao && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend && docker builder prune -f && docker image prune -f"
```

### ✅ PROCESSO COMPLETO DE DEPLOY (COM VERIFICAÇÃO DE MAPEAMENTO)

```bash
# 1. ANTES DO COMMIT: Verificar se não há hardcode
grep -r "INTERSOLID\." packages/backend/src --include="*.ts"
# Esperado: 0 matches (exceto comentários)

# 2. Fazer commit e push
git add -A
git commit -m "feat: Nova funcionalidade com MappingService"
git push origin TESTE

# 3. Conectar na VPS
ssh root@46.202.150.64

# 4. Atualizar template ERP (se adicionou novas tabelas)
cd /root/prevencao-radar-repo
git pull origin TESTE
cd packages/backend
node update-template.js producao

# 5. Deploy normal
cd /root/clientes/tradicao
docker compose build --no-cache frontend backend
docker compose up -d --no-deps frontend backend

# 6. Limpar cache
docker builder prune -f && docker image prune -f

# 7. Verificar logs
docker logs prevencao-tradicao-backend --tail 30
```

### 🎓 Lição Aprendida (05/02/2026)

**Problema:** Sistema foi deployado com código usando MappingService, mas template ERP não tinha a nova tabela configurada.

**Causa:** O código usava `MappingService.getRealTableName('TAB_NF_ITEM', 'TAB_NF_ITEM')`, mas o template Intersolid no banco não tinha `TAB_NF_ITEM` definido.

**Resultado:** O sistema usava o fallback (segundo parâmetro), que funcionava para Intersolid mas não seria configurável para outros ERPs.

**Solução:**
1. Migração de ~479 referências hardcoded para MappingService
2. Atualização do template Intersolid com todas as tabelas necessárias
3. Atualização do frontend para exibir as novas tabelas na configuração

**Prevenção futura:**
- Sempre verificar se há hardcode ANTES do commit
- Ao adicionar nova tabela, atualizar: código + frontend + template ERP
- Usar o script `update-template.js` para manter templates sincronizados

---

**Última atualização:** 05/02/2026 - Adicionado regras de mapeamento dinâmico e atualização de templates ERP
**Criado por:** Claude (aprendendo com cada erro 🎓)
