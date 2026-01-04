# 🤖 APRENDIZADO CLAUDE - Guia Completo de Deploy e Alterações

## 📍 INFORMAÇÕES DA VPS

### Acesso SSH
```bash
# IP da VPS
46.202.150.64

# Usuário
root

# Comando de acesso
ssh root@46.202.150.64
```

### Localização do Projeto
```bash
# Diretório principal
/root/TESTES

# Entrar no diretório
cd /root/TESTES
```

---

## 🗂️ ESTRUTURA DE PASTAS NA VPS

```
/root/TESTES/
├── InstaladorVPS/
│   ├── docker-compose-producao.yml  ← Configuração dos containers
│   ├── Dockerfile.backend           ← Como buildar o backend
│   └── Dockerfile.frontend          ← Como buildar o frontend
│
├── packages/
│   ├── backend/
│   │   └── src/                     ← CÓDIGO DO BACKEND (alterações aqui)
│   │
│   └── frontend/
│       └── src/                     ← CÓDIGO DO FRONTEND (alterações aqui)
│
└── .git/                            ← Controle de versão Git
```

---

## 💾 BANCO DE DADOS

### Informações
- **Tipo**: PostgreSQL 15
- **Container**: `prevencao-postgres-prod`
- **Porta Externa**: `5434` (mapeada para 5432 interna)
- **Banco**: `prevencao_db`
- **Usuário**: Variável de ambiente (ver .env)

### Localização dos Dados
```bash
# Os dados ficam em um VOLUME Docker (persistente)
docker volume ls | grep postgres

# Acessar o banco via CLI
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml exec postgres psql -U postgres -d prevencao_db
```

### Como Fazer Alterações no Banco
**NÃO FAÇA ALTERAÇÕES DIRETAS NO BANCO!**

Use migrations TypeORM no código:
```bash
# 1. Criar nova migration (local)
cd packages/backend
npm run migration:create -- src/migrations/NomeDaMigration

# 2. Editar a migration criada
# 3. Commit e push
# 4. Deploy (migrations rodam automaticamente)
```

---

## 🚀 PROCESSO DE DEPLOY COMPLETO

### 1. Fazer Alterações Localmente (Windows)

```bash
# No seu PC Windows (C:\Users\Administrator\Desktop\TESTES)

# 1. Editar arquivos necessários
# Exemplo: packages/frontend/src/pages/AlgumaPage.jsx

# 2. Testar localmente
docker compose up

# 3. Comitar mudanças
git add .
git commit -m "descrição das alterações"

# 4. Enviar para GitHub
git push origin main
```

### 2. Atualizar VPS (Produção)

```bash
# Conectar na VPS
ssh root@46.202.150.64

# Ir para o diretório
cd /root/TESTES

# Puxar alterações do GitHub
git pull

# AGORA VEM A PARTE IMPORTANTE:
```

---

## 📦 DEPLOY POR COMPONENTE

### A. Alterou apenas o FRONTEND?

```bash
cd /root/TESTES

# 1. Puxar código novo
git pull

# 2. Rebuild do frontend (sem cache para pegar mudanças)
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache frontend

# 3. Recriar container do frontend
docker compose -f docker-compose-producao.yml up -d --force-recreate frontend

# 4. Verificar logs
docker compose -f docker-compose-producao.yml logs -f frontend
```

### B. Alterou apenas o BACKEND?

```bash
cd /root/TESTES

# 1. Puxar código novo
git pull

# 2. Rebuild do backend (sem cache)
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend

# 3. Recriar container do backend
docker compose -f docker-compose-producao.yml up -d --force-recreate backend

# 4. Verificar logs (IMPORTANTE: ver se migrations rodaram)
docker compose -f docker-compose-producao.yml logs -f backend
```

### C. Alterou FRONTEND + BACKEND?

```bash
cd /root/TESTES

# 1. Puxar código novo
git pull

# 2. Rebuild de tudo (sem cache)
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache

# 3. Recriar todos os containers
docker compose -f docker-compose-producao.yml up -d --force-recreate

# 4. Verificar logs de todos
docker compose -f docker-compose-producao.yml logs -f
```

---

## ⚙️ COMANDO ÚNICO AUTOMÁTICO

Se você configurou os atalhos do Claude, pode usar:

### Deploy Frontend
```bash
ssh root@46.202.150.64 "cd /root/TESTES && git pull && docker compose -f InstaladorVPS/docker-compose-producao.yml build frontend && docker compose -f InstaladorVPS/docker-compose-producao.yml up -d --force-recreate frontend"
```

### Deploy Backend
```bash
ssh root@46.202.150.64 "cd /root/TESTES && git pull && docker compose -f InstaladorVPS/docker-compose-producao.yml build backend && docker compose -f InstaladorVPS/docker-compose-producao.yml up -d --force-recreate backend"
```

---

## 🔍 VERIFICAÇÃO PÓS-DEPLOY

### 1. Verificar se containers estão rodando
```bash
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml ps
```

Deve mostrar:
```
NAME                        STATUS
prevencao-backend-prod      Up X minutes
prevencao-frontend-prod     Up X minutes
prevencao-postgres-prod     Up X hours
prevencao-minio-prod        Up X hours
prevencao-cron-prod         Up X hours
```

### 2. Verificar logs do backend (erros?)
```bash
docker compose -f docker-compose-producao.yml logs backend --tail 100
```

Procure por:
- ✅ "Servidor rodando na porta 3001"
- ✅ "Database connected"
- ❌ "Error:", "ECONNREFUSED", "Cannot find module"

### 3. Testar no navegador
```
http://46.202.150.64:3000  <- Frontend
http://46.202.150.64:3001  <- Backend API
```

---

## 🐛 TROUBLESHOOTING

### Container não inicia após deploy

```bash
# Ver logs do container com problema
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml logs backend

# Se tiver erro de build, limpar tudo e refazer
docker compose -f docker-compose-producao.yml down
docker system prune -f
docker compose -f docker-compose-producao.yml up -d --build
```

### Alterações não aparecem (cache)

```bash
# SEMPRE use --no-cache ao buildar
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d --force-recreate frontend

# Limpar cache do navegador (Ctrl+Shift+Del)
```

### Erro "Migration already exists"

```bash
# Migrations são aplicadas automaticamente no start do backend
# Se der erro, verificar:
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml logs backend | grep migration
```

---

## 📝 CHECKLIST DE DEPLOY

Quando eu (Claude) for fazer um deploy, seguirei esta ordem:

### ✅ PRÉ-DEPLOY
1. [ ] Alterações testadas localmente
2. [ ] Código commitado no Git
3. [ ] Código pushado para GitHub (main)

### ✅ DEPLOY
4. [ ] SSH na VPS: `ssh root@46.202.150.64`
5. [ ] Ir para diretório: `cd /root/TESTES`
6. [ ] Puxar código: `git pull`
7. [ ] Identificar o que mudou (frontend/backend/ambos)
8. [ ] Rebuild do componente necessário (--no-cache)
9. [ ] Recriar container (--force-recreate)

### ✅ PÓS-DEPLOY
10. [ ] Verificar containers: `docker compose ps`
11. [ ] Verificar logs: `docker compose logs -f`
12. [ ] Testar no navegador
13. [ ] Confirmar ao usuário que deploy foi bem-sucedido

---

## 🚨 IMPORTANTE: O QUE NÃO FAZER

❌ **NÃO** editar arquivos diretamente na VPS
- Sempre editar no Windows, commitar e fazer pull

❌ **NÃO** alterar banco de dados manualmente
- Usar migrations TypeORM

❌ **NÃO** usar `git commit` na VPS
- VPS só faz `git pull`

❌ **NÃO** esquecer do `--no-cache` no build
- Cache pode fazer mudanças não aparecerem

❌ **NÃO** esquecer do `--force-recreate`
- Container pode não atualizar sem isso

✅ **SEMPRE** verificar logs após deploy
- Garantir que não tem erros

✅ **SEMPRE** testar no navegador
- Confirmar que mudanças estão visíveis

---

## 🎯 FLUXO IDEAL DE TRABALHO

```
1. WINDOWS (Local)
   ├── Editar código
   ├── Testar (docker compose up)
   ├── Git add + commit + push
   └── ✅ Código no GitHub

2. VPS (Produção)
   ├── SSH na VPS
   ├── cd /root/TESTES
   ├── git pull
   ├── cd InstaladorVPS
   ├── docker compose build --no-cache [componente]
   ├── docker compose up -d --force-recreate [componente]
   ├── docker compose logs -f [componente]
   └── ✅ Deploy concluído

3. VERIFICAÇÃO
   ├── Abrir navegador
   ├── http://46.202.150.64:3000
   └── ✅ Mudanças visíveis
```

---

## 💡 DICAS RÁPIDAS

### Ver logs em tempo real
```bash
docker compose -f docker-compose-producao.yml logs -f backend
```

### Ver últimas 100 linhas de log
```bash
docker compose -f docker-compose-producao.yml logs backend --tail 100
```

### Reiniciar apenas um serviço (sem rebuild)
```bash
docker compose -f docker-compose-producao.yml restart backend
```

### Ver uso de recursos
```bash
docker stats
```

### Verificar espaço em disco
```bash
df -h
docker system df
```

---

## 📞 QUANDO PEDIR AJUDA

Se você me pedir para fazer deploy, me informe:

1. **O que foi alterado?**
   - Frontend, Backend ou ambos?
   - Quais arquivos foram modificados?

2. **Já foi commitado?**
   - Se sim, posso fazer pull e deploy
   - Se não, precisa commitar primeiro

3. **Urgência?**
   - Deploy imediato ou pode testar antes?

---

**Última atualização**: 2026-01-01
**Criado por**: Claude Sonnet 4.5
