# Instrucoes para Claude Code

## REGRAS CRITICAS - SEMPRE SEGUIR

### Deploy na VPS (OBRIGATORIO)
```bash
# NUNCA usar docker-compose.yml ou docker compose up -d --build
# SEMPRE usar estes comandos:

# Deploy BACKEND:
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend"

# Deploy FRONTEND:
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend"

# Deploy AMBOS:
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend backend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend"
```

### Flags Obrigatorias
- `--no-deps` = NAO reinicia PostgreSQL/MinIO (preserva dados)
- `--no-cache` = Pega codigo novo do Git
- `-f docker-compose-producao.yml` = Arquivo de producao (NAO usar docker-compose.yml)

### Acesso SSH
- Chave: `~/.ssh/vps_prevencao`
- IP: `145.223.92.152`
- Usuario: `root`

### Verificar Logs Apos Deploy
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker logs prevencao-backend-prod --tail 30"
```

## Git
- Branch principal de trabalho: `TESTE`
- Sempre fazer commit antes de deploy
- Formato commit: `tipo: descricao` (feat, fix, docs, refactor)

## Estrutura do Projeto
- Frontend: `packages/frontend/` (React + Vite)
- Backend: `packages/backend/` (Node + TypeScript + TypeORM)
- VPS: `/root/prevencao-radar-install/`
- Docker producao: `InstaladorVPS/docker-compose-producao.yml`

## NUNCA FAZER
- `docker compose up -d --build` (recria banco = perde dados)
- `docker compose down` (remove containers)
- Mexer em PostgreSQL ou MinIO sem autorizacao
- Usar docker-compose.yml (arquivo de desenvolvimento)
