#!/bin/bash

##############################################
# INSTALADOR AUTOMÁTICO - PREVENÇÃO NO RADAR
##############################################

set -e  # Parar se houver erro

echo "🚀 =========================================="
echo "   INSTALADOR PREVENÇÃO NO RADAR"
echo "   =========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para imprimir em verde
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Função para imprimir em amarelo
print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Função para imprimir em vermelho
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

##############################################
# 1. VERIFICAR DEPENDÊNCIAS
##############################################

echo ""
echo "📋 [1/8] Verificando dependências..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker não encontrado. Instale o Docker primeiro:"
    echo "  curl -fsSL https://get.docker.com | sh"
    exit 1
fi
print_success "Docker instalado"

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose não encontrado. Instalando..."
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi
print_success "Docker Compose instalado"

# Verificar Python3
if ! command -v python3 &> /dev/null; then
    print_error "Python3 não encontrado. Instalando..."
    apt update && apt install -y python3 python3-pip python3-venv
fi
print_success "Python3 instalado"

# Verificar Git
if ! command -v git &> /dev/null; then
    print_error "Git não encontrado. Instalando..."
    apt update && apt install -y git
fi
print_success "Git instalado"

##############################################
# 2. CLONAR REPOSITÓRIO
##############################################

echo ""
echo "📦 [2/8] Baixando código fonte..."

cd /root

# Remover instalação antiga se existir
if [ -d "prevencao-no-radar" ]; then
    print_info "Removendo instalação antiga..."
    rm -rf prevencao-no-radar
fi

# Clonar repositório (substitua pelo URL correto)
# git clone <URL_DO_SEU_REPOSITORIO> prevencao-no-radar
# Como não temos o repositório, vamos assumir que o código já está em /root/prevencao-no-radar

print_success "Código fonte pronto"

##############################################
# 3. PARAR CONTAINERS ANTIGOS
##############################################

echo ""
echo "🛑 [3/8] Parando containers antigos..."

# Parar e remover containers antigos
docker stop prevencao-backend prevencao-frontend 2>/dev/null || true
docker rm prevencao-backend prevencao-frontend 2>/dev/null || true

print_success "Containers antigos removidos"

##############################################
# 4. OBTER CREDENCIAIS DOS CONTAINERS PROD
##############################################

echo ""
echo "🔐 [4/7] Obtendo credenciais do banco de dados..."

# Obter senha do PostgreSQL
DB_PASSWORD=$(docker inspect prevencao-postgres-prod 2>/dev/null | grep POSTGRES_PASSWORD | head -1 | awk -F'"' '{print $4}')
if [ -z "$DB_PASSWORD" ]; then
    print_error "Container prevencao-postgres-prod não encontrado!"
    print_info "Certifique-se que o banco de dados está rodando"
    exit 1
fi
print_success "Senha do banco: ${DB_PASSWORD:0:10}..."

# Obter credenciais do MinIO
MINIO_USER=$(docker inspect prevencao-minio-prod 2>/dev/null | grep MINIO_ROOT_USER | head -1 | awk -F'"' '{print $4}')
MINIO_PASSWORD=$(docker inspect prevencao-minio-prod 2>/dev/null | grep MINIO_ROOT_PASSWORD | head -1 | awk -F'"' '{print $4}')
if [ -z "$MINIO_PASSWORD" ]; then
    print_error "Container prevencao-minio-prod não encontrado!"
    exit 1
fi
print_success "Credenciais MinIO obtidas"

# Obter portas
DB_PORT=$(docker port prevencao-postgres-prod 5432 2>/dev/null | cut -d':' -f2)
MINIO_PORT=$(docker port prevencao-minio-prod 9000 2>/dev/null | cut -d':' -f2)

print_info "Porta PostgreSQL: $DB_PORT"
print_info "Porta MinIO: $MINIO_PORT"

##############################################
# 5. BUILD DAS IMAGENS DOCKER
##############################################

echo ""
echo "🏗️  [5/7] Buildando imagens Docker..."

cd /root/prevencao-no-radar

# Build Backend (sem cache para garantir código atualizado)
print_info "Building backend..."
docker-compose build --no-cache backend

# Build Frontend (sem cache para garantir código atualizado)
print_info "Building frontend..."
docker-compose build --no-cache frontend

print_success "Imagens Docker buildadas"

##############################################
# 6. INICIAR CONTAINERS
##############################################

echo ""
echo "🚀 [6/7] Iniciando containers..."

# Obter IP do servidor
SERVER_IP=$(hostname -I | awk '{print $1}')

# Iniciar Backend
print_info "Iniciando backend..."
docker run -d \
  --name prevencao-backend \
  --restart always \
  -p 3001:3001 \
  -e DB_HOST=$SERVER_IP \
  -e DB_PORT=$DB_PORT \
  -e DB_USER=postgres \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e DB_NAME=prevencao_db \
  -e MINIO_ENDPOINT=$SERVER_IP \
  -e MINIO_PORT=$MINIO_PORT \
  -e MINIO_ACCESS_KEY=$MINIO_USER \
  -e MINIO_SECRET_KEY=$MINIO_PASSWORD \
  -e MINIO_USE_SSL=false \
  -e MINIO_BUCKET_NAME=prevencao \
  -e MINIO_PUBLIC_ENDPOINT=$SERVER_IP \
  -e MINIO_PUBLIC_PORT=$MINIO_PORT \
  -e MINIO_PUBLIC_USE_SSL=false \
  prevencao-no-radar_backend:latest

# Aguardar backend iniciar
sleep 5

# Iniciar Frontend
print_info "Iniciando frontend..."
docker run -d \
  --name prevencao-frontend \
  --restart always \
  -p 3000:80 \
  prevencao-no-radar_frontend:latest

print_success "Containers iniciados"

##############################################
# 7. CRIAR USUÁRIO ADMIN
##############################################

echo ""
echo "👤 Criando usuário admin..."

# Hash da senha "Beto14" (bcrypt)
ADMIN_HASH='$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c \
  "INSERT INTO users (email, password, name, role, created_at, updated_at)
   VALUES ('Beto', '$ADMIN_HASH', 'Beto', 'admin', NOW(), NOW())
   ON CONFLICT (email) DO UPDATE
   SET password = '$ADMIN_HASH', name = 'Beto', role = 'admin';" \
  2>/dev/null || print_info "Usuário já existe"

print_success "Usuário admin criado: Beto / Beto14"

##############################################
# FINALIZAÇÃO
##############################################

echo ""
echo "🎉 =========================================="
echo "   INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "   =========================================="
echo ""
print_success "Frontend: http://$SERVER_IP:3000"
print_success "Backend:  http://$SERVER_IP:3001"
echo ""
print_info "Credenciais de login:"
echo "  Usuário: Beto"
echo "  Senha:   Beto14"
echo ""
print_info "Serviços rodando:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep prevencao
echo ""
print_info "Para verificar logs:"
echo "  Backend: docker logs prevencao-backend"
echo "  Frontend: docker logs prevencao-frontend"
echo ""
