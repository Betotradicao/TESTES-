# Instrucoes para Claude Code

## REGRAS CRITICAS - SEMPRE SEGUIR

### Deploy na VPS (OBRIGATORIO)
```bash
# NUNCA usar docker-compose.yml ou docker compose up -d --build
# SEMPRE usar estes comandos:

# Deploy BACKEND:
ssh -i ~/.ssh/vps_prevencao root@IP_DA_VPS "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend"

# Deploy FRONTEND:
ssh -i ~/.ssh/vps_prevencao root@IP_DA_VPS "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend"

# Deploy AMBOS:
ssh -i ~/.ssh/vps_prevencao root@IP_DA_VPS "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend backend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend"
```

### VPS Conhecidas
- VPS Principal: `145.223.92.152`
- VPS Teste: `46.202.150.64`

### Flags Obrigatorias
- `--no-deps` = NAO reinicia PostgreSQL/MinIO (preserva dados)
- `--no-cache` = Pega codigo novo do Git
- `-f docker-compose-producao.yml` = Arquivo de producao (NAO usar docker-compose.yml)

### Acesso SSH
- Chave: `~/.ssh/vps_prevencao`
- Usuario: `root`

### Verificar Logs Apos Deploy
```bash
ssh -i ~/.ssh/vps_prevencao root@IP_DA_VPS "docker logs prevencao-backend-prod --tail 30"
```

### Verificar Status dos Containers
```bash
ssh -i ~/.ssh/vps_prevencao root@IP_DA_VPS "docker ps --filter name=prevencao"
```

## Fluxo de Atualizacao (Multiplas VPS)

### Sequencia Correta:
1. Desenvolver e testar localmente
2. Commit e push para GitHub (branch TESTE)
3. Deploy em cada VPS (uma por uma ou em paralelo)

### Exemplo para 2 VPS:
```bash
# 1. Commit local
git add -A && git commit -m "feat: descricao" && git push origin TESTE

# 2. Deploy VPS 145 (backend)
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend"

# 3. Deploy VPS 46 (backend)
ssh -i ~/.ssh/vps_prevencao root@46.202.150.64 "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend"
```

## Instalador Automatico (Nova VPS)

### Comando para instalar do zero:
```bash
curl -sSL https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install.sh | bash
```

### O instalador pergunta:
- Nome do Banco de Dados PostgreSQL (padrao: prevencao_db)
- Nome do Bucket MinIO (padrao: market-security)

### Migrations
O instalador registra TODAS as migrations automaticamente. Se adicionar nova migration:
1. Criar o arquivo em `packages/backend/src/migrations/`
2. Adicionar na lista do `InstaladorVPS/install.sh` (secao "Registrar migrations")

## Git
- Branch principal de trabalho: `TESTE`
- Sempre fazer commit antes de deploy
- Formato commit: `tipo: descricao` (feat, fix, docs, refactor)

## Estrutura do Projeto
- Frontend: `packages/frontend/` (React + Vite)
- Backend: `packages/backend/` (Node + TypeScript + TypeORM)
- VPS: `/root/prevencao-radar-install/`
- Docker producao: `InstaladorVPS/docker-compose-producao.yml`
- Instalador: `InstaladorVPS/install.sh`

## NUNCA FAZER
- `docker compose up -d --build` (recria banco = perde dados)
- `docker compose down` (remove containers)
- Mexer em PostgreSQL ou MinIO sem autorizacao
- Usar docker-compose.yml (arquivo de desenvolvimento)
- Esquecer de adicionar novas migrations no install.sh
