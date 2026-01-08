# 📋 GUIA COMPLETO DE DEPLOY - PREVENÇÃO NO RADAR

## 🎯 OBJETIVO
Este documento define o passo a passo completo para fazer deploy em produção do sistema Prevenção no Radar.

---

## ✅ O QUE FAZER - PASSO A PASSO COMPLETO

### 1️⃣ ANTES DO DEPLOY - PREPARAÇÃO LOCAL

#### a) Verificar alterações locais
```bash
# Ver o que foi modificado
git status

# Ver diferenças
git diff
```

#### b) Build do Frontend (se houver mudanças no frontend)
```bash
cd packages/frontend
npm run build
```
**Resultado esperado:** Pasta `dist/` criada com arquivos otimizados

#### c) Build do Backend (se houver mudanças no backend)
- O build é feito automaticamente no Docker
- Não precisa buildar localmente

#### d) Commitar alterações
```bash
# Adicionar arquivos
git add .

# Criar commit com mensagem descritiva
git commit -m "$(cat <<'EOF'
feat: Descrição clara da mudança

- Detalhe 1
- Detalhe 2
- Detalhe 3

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# Push para GitHub
git push
```

---

### 2️⃣ DEPLOY EM PRODUÇÃO

#### a) Deploy APENAS do Frontend
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend"
```

**Quando usar:**
- Mudanças apenas em arquivos `.jsx`, `.tsx`, `.css`
- Alterações de layout, cores, textos
- Novos componentes visuais

#### b) Deploy APENAS do Backend
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend"
```

**Quando usar:**
- Mudanças em services, controllers, routes
- Novos endpoints de API
- Alterações em lógica de negócio
- **NÃO use se houver migrations!**

#### c) Deploy COMPLETO (Backend + Frontend)
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d"
```

**Quando usar:**
- Mudanças em ambos frontend e backend
- Nova funcionalidade completa
- Primeira vez fazendo deploy

---

### 3️⃣ MIGRATIONS DE BANCO DE DADOS

#### a) Quando você TEM migrations novas

**IMPORTANTE:** Migrations devem ser executadas ANTES de subir o backend!

```bash
# 1. Pull do código
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull"

# 2. Build do backend
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES/InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend"

# 3. RODAR MIGRATIONS (ANTES DE UP)
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES/InstaladorVPS && docker compose -f docker-compose-producao.yml run --rm backend npm run migration:run:prod"

# 4. Subir backend
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES/InstaladorVPS && docker compose -f docker-compose-producao.yml up -d backend"
```

#### b) Como verificar se precisa de migrations

```bash
# Ver arquivos de migration no seu código
ls packages/backend/src/migrations/

# Verificar migrations já rodadas no banco
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker exec -i prevencao-postgres-prod psql -U postgres -d prevencao_db -c 'SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 10;'"
```

---

### 4️⃣ APÓS O DEPLOY - VERIFICAÇÃO

#### a) Verificar se containers estão rodando
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker ps"
```

**Deve mostrar:**
- `prevencao-backend-prod` - Up
- `prevencao-frontend-prod` - Up
- `prevencao-postgres-prod` - Up
- `prevencao-minio-prod` - Up
- `prevencao-cron-prod` - Up

#### b) Verificar logs do backend
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker logs prevencao-backend-prod --tail 50"
```

**Procurar por:**
- ✅ "Server running on port 3001"
- ✅ "Database connected"
- ❌ Erros em vermelho

#### c) Verificar logs do frontend
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker logs prevencao-frontend-prod --tail 30"
```

#### d) Testar aplicação no navegador
1. Abrir: http://145.223.92.152:3000
2. Fazer login
3. Testar funcionalidade alterada
4. Verificar console do navegador (F12) - não deve ter erros

---

## ❌ O QUE NÃO FAZER - REGRAS IMPORTANTES

### 🚫 NUNCA FAZER ANTES DE VER O ERRO
1. **NUNCA rebuilde sem motivo**
   - Build leva tempo e usa recursos
   - Só faça rebuild quando houver mudanças de código

2. **NUNCA use `down` sem necessidade**
   - `docker compose down` derruba TODOS os serviços
   - Use apenas se realmente precisa reiniciar tudo
   - Para reiniciar um serviço: `docker compose restart <serviço>`

3. **NUNCA delete volumes sem backup**
   ```bash
   # ❌ NUNCA faça isso:
   docker compose down -v
   ```
   - O flag `-v` deleta TODOS os dados do banco!

4. **NUNCA rode migrations duas vezes**
   - Migrations são idempotentes mas podem causar erros
   - Sempre verifique antes se já foram rodadas

5. **NUNCA suba backend sem rodar migrations**
   - Se houver migrations pendentes, o backend pode quebrar
   - Sempre rode migrations ANTES de `up`

6. **NUNCA use `force-recreate` sem motivo**
   - Recria containers do zero
   - Use apenas quando houver problemas graves
   - Comando normal já atualiza containers

7. **NUNCA esqueça de dar `git pull` antes do build**
   - Docker vai buildar código antigo se não fizer pull
   - Sempre: `git pull` → `build` → `up`

8. **NUNCA faça deploy sem commit/push**
   - Seu código local não está no servidor
   - Sempre: commit local → push GitHub → pull no servidor

9. **NUNCA modifique arquivos diretamente no servidor**
   - Use sempre o fluxo: local → GitHub → servidor
   - Exceção: configurações de emergência (.env)

10. **NUNCA esqueça do `--no-cache` no build**
    - Cache pode usar código antigo
    - Sempre use: `--no-cache` para garantir build limpo

---

## 🔧 COMANDOS ÚTEIS

### Ver logs em tempo real
```bash
# Backend
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker logs -f prevencao-backend-prod"

# Frontend
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker logs -f prevencao-frontend-prod"
```

### Reiniciar um serviço específico
```bash
# Backend
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES/InstaladorVPS && docker compose -f docker-compose-producao.yml restart backend"

# Frontend
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES/InstaladorVPS && docker compose -f docker-compose-producao.yml restart frontend"
```

### Acessar banco de dados
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker exec -it prevencao-postgres-prod psql -U postgres -d prevencao_db"
```

### Ver espaço em disco
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "df -h"
```

### Limpar Docker (liberar espaço)
```bash
# Remove containers parados, redes não usadas, imagens pendentes
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker system prune -f"

# Remove tudo (CUIDADO!)
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker system prune -af"
```

---

## 🆘 TROUBLESHOOTING

### Backend não sobe
1. Ver logs: `docker logs prevencao-backend-prod --tail 100`
2. Verificar banco: `docker ps | grep postgres`
3. Testar conexão: `docker exec prevencao-backend-prod ping -c 2 postgres`

### Frontend não carrega
1. Ver logs: `docker logs prevencao-frontend-prod --tail 50`
2. Verificar arquivos: `docker exec prevencao-frontend-prod ls -la /usr/share/nginx/html/`
3. Testar nginx: `docker exec prevencao-frontend-prod nginx -t`

### Erro de migration
1. Ver migrations rodadas: `SELECT * FROM migrations;`
2. Verificar se migration existe: `ls packages/backend/src/migrations/`
3. Se precisar refazer: deletar linha da tabela migrations e rodar novamente

### Container reiniciando infinitamente
1. Ver por que está morrendo: `docker logs <container> --tail 200`
2. Verificar recursos: `docker stats`
3. Inspecionar: `docker inspect <container>`

---

## 📝 CHECKLIST DE DEPLOY

- [ ] Código commitado localmente
- [ ] Push feito para GitHub
- [ ] Build do frontend funcionou (se houver mudanças)
- [ ] Migrations identificadas (se houver)
- [ ] Deploy executado com comando correto
- [ ] Logs verificados (sem erros)
- [ ] Aplicação testada no navegador
- [ ] Funcionalidade nova testada
- [ ] Sem erros no console do navegador

---

## 🎓 RESUMO RÁPIDO

### Para mudanças simples de frontend:
```bash
# Local
npm run build (em packages/frontend)
git add . && git commit -m "..." && git push

# Servidor
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend"
```

### Para mudanças de backend SEM migrations:
```bash
# Local
git add . && git commit -m "..." && git push

# Servidor
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend"
```

### Para mudanças de backend COM migrations:
```bash
# Local
git add . && git commit -m "..." && git push

# Servidor
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/TESTES && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml run --rm backend npm run migration:run:prod && docker compose -f docker-compose-producao.yml up -d backend"
```

---

**Última atualização:** Janeiro 2026
