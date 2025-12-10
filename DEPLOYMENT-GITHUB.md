# 🚀 Deploy com GitHub + Docker Registry + Portainer

## 📋 Visão Geral

Esta é a abordagem mais profissional para deploy em produção:

```
Código → GitHub → Release → GitHub Actions → Docker Images → Portainer
```

## 🔧 Configuração Inicial

### 1. Configurar GitHub Repository

1. **Push do código** para GitHub
2. **Habilitar GitHub Packages** (Container Registry)
3. **Configurar secrets** se necessário

### 2. Criar Release

```bash
# Criar tag
git tag v1.0.0
git push origin v1.0.0

# Ou criar release via GitHub Web Interface
```

### 3. GitHub Actions (Automático)

O workflow `.github/workflows/release.yml` irá:

✅ **Build das 3 imagens Docker**:
- `ghcr.io/seu-usuario/repo/backend:v1.0.0`
- `ghcr.io/seu-usuario/repo/frontend:v1.0.0`
- `ghcr.io/seu-usuario/repo/cron:v1.0.0`

✅ **Push para GitHub Container Registry**
✅ **Gerar arquivo de deploy** anexado à release

## 🎯 Configuração no Portainer

### 1. Variáveis de Ambiente

No Portainer, configure estas variáveis na **Stack**:

```env
# Database (PostgreSQL da outra stack)
POSTGRES_PASSWORD=sua-senha-super-segura
POSTGRES_CONTAINER_NAME=postgres-container

# Backend
JWT_SECRET=chave-jwt-de-32-caracteres-minimo-super-segura
ERP_PRODUCTS_API_URL=https://api-erp.empresa.com/produtos
ERP_SALES_API_URL=https://api-erp.empresa.com/vendas

# Frontend
FRONTEND_API_URL=https://api.seudominio.com

# Domínios para Traefik
FRONTEND_DOMAIN=prevencao.seudominio.com
BACKEND_DOMAIN=api.seudominio.com
SWAGGER_DOMAIN=docs.seudominio.com
```

### 2. Deploy da Stack

1. **Portainer** → **Stacks** → **Add Stack**
2. **Nome**: `market-security`
3. **Método**: **Repository** ou **Upload**
4. **Compose File**: `docker-compose.portainer.yml`
5. **Environment Variables**: Cole as variáveis acima
6. **Deploy Stack**

### 3. Atualizações

Para uma nova versão:

1. **Fazer alterações** no código
2. **Criar nova release** no GitHub (ex: v1.1.0)
3. **Aguardar build** automático
4. **Atualizar stack** no Portainer com nova versão

## 🏷️ Estrutura das Imagens

### GitHub Container Registry

```
ghcr.io/seu-usuario/repo/
├── backend:latest
├── backend:v1.0.0
├── frontend:latest
├── frontend:v1.0.0
├── cron:latest
└── cron:v1.0.0
```

### Vantagens desta Abordagem

✅ **Versionamento**: Controle preciso de versões
✅ **Rollback**: Fácil voltar para versão anterior
✅ **CI/CD**: Build automático em releases
✅ **Segurança**: Imagens assinadas e verificadas
✅ **Performance**: Cache de layers do Docker
✅ **Rastreabilidade**: Histórico completo no GitHub

## 🔄 Fluxo de Atualizações

### Para Nova Funcionalidade:

```bash
# 1. Desenvolver localmente
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 2. Criar release
git tag v1.1.0
git push origin v1.1.0
# Ou via GitHub Web Interface

# 3. GitHub Actions builda automaticamente

# 4. Atualizar Portainer
# Editar stack → Mudar versão das imagens → Deploy
```

### Para Hotfix:

```bash
# 1. Criar branch hotfix
git checkout -b hotfix/v1.0.1
git commit -m "fix: correção crítica"
git push origin hotfix/v1.0.1

# 2. Merge e release
git checkout main
git merge hotfix/v1.0.1
git tag v1.0.1
git push origin v1.0.1

# 3. Deploy automático
```

## 🛠️ Comandos Úteis

### Verificar Imagens Disponíveis

```bash
# Listar todas as versões
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user/packages/container/REPO/versions

# Pull local para teste
docker pull ghcr.io/seu-usuario/repo/backend:v1.0.0
```

### Rollback no Portainer

```yaml
# Mudar versão das imagens no docker-compose
services:
  backend:
    image: ghcr.io/seu-usuario/repo/backend:v1.0.0  # Versão anterior
  frontend:
    image: ghcr.io/seu-usuario/repo/frontend:v1.0.0  # Versão anterior
  cron:
    image: ghcr.io/seu-usuario/repo/cron:v1.0.0      # Versão anterior
```

## 🔐 Configuração de Secrets (Opcional)

Se quiser usar secrets privados no GitHub Actions:

### Repository Secrets:
- `DOCKER_REGISTRY_TOKEN`: Token personalizado
- `PRODUCTION_ENV`: Variáveis de produção

### Usage no Workflow:
```yaml
env:
  CUSTOM_TOKEN: ${{ secrets.DOCKER_REGISTRY_TOKEN }}
```

## 📊 Monitoramento

### Logs das Imagens

```bash
# Backend
docker logs market-security-api

# Frontend
docker logs market-security-web

# Cron
docker logs market-security-cron
```

### Health Checks

```bash
# Verificar saúde dos serviços
curl https://api.seudominio.com/api/health
curl https://prevencao.seudominio.com/health
```

## 🎯 Resultado Final

Com esta configuração você terá:

✅ **Deploy automatizado** via GitHub Releases
✅ **Versionamento semântico** (v1.0.0, v1.1.0, etc)
✅ **Rollback simples** no Portainer
✅ **Imagens otimizadas** com cache
✅ **Segurança** com GitHub Registry
✅ **Zero downtime** com health checks
✅ **Traefik integration** completa

Esta é definitivamente a **melhor abordagem** para produção! 🚀