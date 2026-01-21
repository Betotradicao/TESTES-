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
| VPS 145 | `145.223.92.152` | TESTE | `/root/prevencao-radar-install` |
| VPS 31 | `31.97.82.235` | PRODUÇÃO | `/root/NOVO-PREVEN-O` |
| VPS 46 | `46.202.150.64` | MULTI-CLIENTES | `/root/clientes/[cliente]` |

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

**Última atualização:** 20/01/2026 - Adicionado documentação completa da VPS 46 (multi-tenant)
**Criado por:** Claude (aprendendo com cada erro 🎓)
