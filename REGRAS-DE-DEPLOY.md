# ⚠️ REGRAS CRÍTICAS DE DEPLOY - LEIA ANTES DE QUALQUER DEPLOY!

## 🚨 REGRA #1: NUNCA RECRIAR CONTAINERS DE BANCO DE DADOS

**❌ NUNCA FAÇA:**
```bash
docker compose up -d --build  # RECRIA TODOS OS CONTAINERS = PERDE BANCO DE DADOS!
docker compose down && up -d  # REMOVE E RECRIA = PERDE BANCO DE DADOS!
```

**✅ SEMPRE FAÇA:**
```bash
# Para deploy de FRONTEND apenas:
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend

# Para deploy de BACKEND apenas:
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d --no-deps backend cron

# Flags importantes:
# --no-deps = NÃO reinicia containers dependentes (PostgreSQL, MinIO)
# --no-cache = Força rebuild sem usar cache (pega mudanças novas)
```

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
cd /root/TESTES
git pull
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend
```

#### ✅ Se mudou APENAS BACKEND:
```bash
ssh root@145.223.92.152
cd /root/TESTES
git pull
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d --no-deps backend cron
```

#### ✅ Se mudou FRONTEND + BACKEND:
```bash
ssh root@145.223.92.152
cd /root/TESTES
git pull
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache frontend backend
docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend cron
```

#### ⚠️ Se mudou BANCO DE DADOS (migrations):
```bash
ssh root@145.223.92.152
cd /root/TESTES
git pull
cd InstaladorVPS

# Apenas rebuild do backend (migrations rodam automaticamente no boot)
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d --no-deps backend cron

# Verificar logs para confirmar que migrations rodaram:
docker logs prevencao-backend-prod --tail 50
```

---

## 🛑 SE VOCÊ RECRIOU O BANCO DE DADOS POR ENGANO

**Sintomas:**
- Tela de "First Setup" apareceu novamente
- Erro: `password authentication failed for user "postgres"`
- Perdeu todas as configurações/dados

**Solução:**
1. **NÃO ENTRE EM PÂNICO!** Os volumes ainda podem ter os dados
2. Verificar se volume existe:
```bash
docker volume ls | grep postgres
```

3. Se volume foi deletado (perdeu tudo):
```bash
# Parar tudo
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml down

# Rodar instalador novamente (vai criar banco do zero)
cd /root/TESTES/InstaladorVPS
bash INSTALAR-AUTO.sh

# Avisar o usuário que PERDEU TODOS OS DADOS e vai ter que:
# - Refazer First Setup
# - Reconfigurar APIs (Zanthus, WhatsApp, etc)
# - Reativar produtos
```

---

## 📝 EXEMPLO REAL DE DEPLOY CORRETO

**Situação:** Corrigi bug na tela de Etiquetas (arquivo `EtiquetaVerificacao.jsx`)

**Passos:**
```bash
# 1. Fazer commit local
git add packages/frontend/src/pages/EtiquetaVerificacao.jsx
git commit -m "fix: Corrige tela branca ao acessar auditoria concluída"
git push

# 2. Deploy na VPS (APENAS FRONTEND!)
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend"

# 3. Verificar se funcionou
# Aguardar 30 segundos e acessar: http://145.223.92.152:3000
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

# Ver logs do cron
docker logs prevencao-cron-prod --tail 50

# Verificar se banco está respondendo
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c 'SELECT COUNT(*) FROM companies;'

# Verificar volumes (NÃO DEVEM SER DELETADOS!)
docker volume ls
```

---

## ❗ MEMORIZAR ISSO:

1. **--no-deps** = NÃO mexe em PostgreSQL/MinIO
2. **--no-cache** = Pega código novo do Git
3. **Sempre especificar QUAL container atualizar** (frontend, backend, ou ambos)
4. **NUNCA usar `down`** a menos que queira começar do zero

---

## 📞 SE TIVER DÚVIDA

**ANTES** de rodar qualquer comando de deploy:
1. Pare e pense: "Vou recriar o banco de dados com esse comando?"
2. Se a resposta for "SIM" ou "NÃO SEI", **NÃO RODE O COMANDO!**
3. Consulte este documento novamente
4. Use `--no-deps` para garantir

---

**Última atualização:** 07/01/2026
**Criado por:** Claude (depois de aprender da forma difícil 😅)
