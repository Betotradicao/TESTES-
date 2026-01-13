# 🚨 REGRAS CRÍTICAS QUE O CLAUDE DEVE SEMPRE SEGUIR

## ⚠️ REGRA #1: SSH - SEMPRE usar a chave correta

**SEMPRE use este formato exato:**
```bash
ssh -i ~/.ssh/vps_prevencao root@IP_DA_VPS "comando"
```

**NUNCA use:**
- `ssh root@IP` (sem a chave)
- `ssh -o StrictHostKeyChecking=no` (a menos que seja a primeira vez)

**IPs das VPS:**
- VPS 145 (TESTE): `145.223.92.152` - Diretório: `/root/prevencao-radar-install`
- VPS 31 (PRODUÇÃO): `31.97.82.235` - Diretório: `/root/NOVO-PREVEN-O`

---

## ⚠️ REGRA #2: DEPLOY - NUNCA recriar containers de banco de dados

**COMANDO CORRETO para deploy:**

### Frontend + Backend:
```bash
cd /root/TESTES/InstaladorVPS  # ou /root/NOVO-PREVEN-O/InstaladorVPS
git pull origin TESTE           # ou origin main
docker compose -f docker-compose-producao.yml build --no-cache frontend backend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend
```

### APENAS Backend (com migrations):
```bash
cd /root/TESTES/InstaladorVPS
git pull origin TESTE
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d --no-deps backend
```

### APENAS Frontend:
```bash
cd /root/TESTES/InstaladorVPS
git pull origin TESTE
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend
```

**FLAGS OBRIGATÓRIAS:**
- `--no-cache`: Força rebuild sem cache (pega código novo)
- `--no-deps`: NÃO reinicia containers dependentes (postgres, minio)

**❌ NUNCA FAÇA:**
```bash
docker compose up -d --build              # RECRIA TUDO = PERDE DADOS
docker compose down && docker compose up  # REMOVE E RECRIA = PERDE DADOS
docker compose build                      # GERA NOVAS SENHAS ALEATÓRIAS
```

---

## ⚠️ REGRA #3: Erro "password authentication failed"

Se aparecer `password authentication failed for user "postgres"`:

**SOLUÇÃO RÁPIDA:**
```bash
# 1. Ver senha que o backend está usando:
docker exec prevencao-backend-prod env | grep DB_PASSWORD

# 2. Alterar senha do postgres para a mesma do backend:
docker exec -e PGPASSWORD=postgres prevencao-postgres-prod psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'SENHA_DO_BACKEND_AQUI';"

# 3. Reiniciar backend:
docker restart prevencao-backend-prod

# 4. Verificar conexão:
docker logs prevencao-backend-prod --tail 20 | grep "Database connected"
```

---

## ⚠️ REGRA #4: Sempre verificar ANTES de fazer deploy

**CHECKLIST OBRIGATÓRIO:**
1. [ ] Identifiquei o que mudou? (frontend, backend, ou ambos?)
2. [ ] Estou usando `--no-deps`?
3. [ ] Estou usando `--no-cache`?
4. [ ] Especifiquei QUAL container atualizar (frontend, backend, ou ambos)?
5. [ ] NÃO estou usando `docker compose down`?
6. [ ] Não vou recriar o postgres?

**Se responder NÃO em qualquer item, PARE e revise!**

---

## ⚠️ REGRA #5: Comandos úteis de verificação

```bash
# Ver containers rodando
docker ps --filter name=prevencao

# Ver logs do backend
docker logs prevencao-backend-prod --tail 50

# Ver logs do frontend
docker logs prevencao-frontend-prod --tail 50

# Verificar se banco conectou
docker logs prevencao-backend-prod | grep "Database connected"

# Verificar quantas tabelas tem no banco
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c '\dt' | wc -l

# Verificar migrations rodaram
docker logs prevencao-backend-prod | grep "migration ran"
```

---

## ⚠️ REGRA #6: Estrutura de diretórios

**VPS 145 (TESTE):**
```
/root/TESTES/
├── InstaladorVPS/
│   ├── docker-compose-producao.yml  ← USAR ESTE
│   └── .env
├── packages/
│   ├── backend/
│   └── frontend/
└── docker-compose.yml               ← NÃO USAR EM PRODUÇÃO
```

**VPS 31 (PRODUÇÃO):**
```
/root/NOVO-PREVEN-O/
├── InstaladorVPS/
│   ├── docker-compose-producao.yml  ← USAR ESTE
│   └── .env
├── packages/
│   ├── backend/
│   └── frontend/
└── docker-compose.yml               ← NÃO USAR EM PRODUÇÃO
```

---

## ⚠️ REGRA #7: SEMPRE fazer git pull ANTES do docker build

**ORDEM CORRETA:**
```bash
cd /root/TESTES
git pull origin TESTE          # 1. PRIMEIRO: Puxar código novo
cd InstaladorVPS              # 2. Entrar no diretório correto
docker compose -f ...build    # 3. DEPOIS: Buildar imagens
docker compose -f ...up       # 4. FINALMENTE: Subir containers
```

**❌ ERRADO:**
```bash
cd InstaladorVPS
docker compose build  # Vai buildar código ANTIGO!
git pull             # Tarde demais
```

---

## ⚠️ REGRA #8: Nomes dos containers

**Produção:**
- Backend: `prevencao-backend-prod`
- Frontend: `prevencao-frontend-prod`
- Postgres: `prevencao-postgres-prod`
- MinIO: `prevencao-minio-prod`
- Cron: `prevencao-cron-prod`

**Desenvolvimento (local):**
- Backend: `prevencao-backend`
- Frontend: `prevencao-frontend`
- Postgres: `prevencao-postgres`
- MinIO: `prevencao-minio`

---

## ⚠️ REGRA #9: Branches corretos

- **VPS 145 (TESTE)**: Branch `TESTE`
- **VPS 31 (PRODUÇÃO)**: Branch `main`

**SEMPRE fazer pull do branch correto:**
```bash
# VPS 145
git pull origin TESTE

# VPS 31
git pull origin main
```

---

## ⚠️ REGRA #10: Se der MUITO errado e precisar começar do zero

**ÚLTIMO RECURSO (perde TODOS os dados):**
```bash
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml down -v  # Remove volumes também
bash INSTALAR-AUTO.sh  # Reinstala tudo do zero

# Avisar usuário que precisa:
# - Refazer First Setup
# - Reconfigurar APIs (Zanthus, WhatsApp, Evolution)
# - Reativar produtos
# - Refazer todas as configurações
```

---

## 📌 RESUMO SUPER RÁPIDO

**Para deploy normal:**
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull origin TESTE && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend backend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend"
```

**Se der erro de senha do postgres:**
```bash
# Pegar senha do backend
SENHA=$(ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker exec prevencao-backend-prod env | grep DB_PASSWORD | cut -d'=' -f2")

# Alterar senha do postgres
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker exec -e PGPASSWORD=postgres prevencao-postgres-prod psql -U postgres -c \"ALTER USER postgres WITH PASSWORD '$SENHA';\""

# Reiniciar backend
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker restart prevencao-backend-prod"
```

---

**Criado em:** 10/01/2026
**Objetivo:** Evitar que Claude cometa os mesmos erros repetidamente
**Status:** REGRAS ATIVAS E OBRIGATÓRIAS
