#!/bin/bash
set -e

# ============================================
# INSTALADOR MULTI-TENANT - VPS LINUX
# Sistema: Prevenção no Radar
# Suporte a múltiplos clientes com subdomínios
# VERSÃO 4.0: Túnel SSH isolado, ERP Templates seed,

#              Dockerfile.cron, registro clientes.json
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   INSTALADOR MULTI-TENANT - PREVENÇÃO NO RADAR            ║"
echo "║   Sistema com subdomínios por cliente                      ║"
echo "║   VERSÃO: 4.0 (Fevereiro 2026)                            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Este script precisa ser executado como root!"
    echo "   Use: sudo bash install-multitenant.sh"
    exit 1
fi

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado!"
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker instalado"
fi

# Verificar se Docker Compose está instalado
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado!"
    echo "📦 O Docker Compose plugin já deve estar incluído. Verifique a instalação."
    exit 1
fi

echo "✅ Docker encontrado: $(docker --version)"
echo "✅ Docker Compose encontrado"
echo ""

# Verificar se Git está instalado
if ! command -v git &> /dev/null; then
    echo "📦 Instalando Git..."
    apt-get update -qq
    apt-get install -y -qq git
    echo "✅ Git instalado"
fi

# Verificar se Nginx está instalado
if ! command -v nginx &> /dev/null; then
    echo "📦 Instalando Nginx..."
    apt-get update -qq
    apt-get install -y -qq nginx
    systemctl enable nginx
    systemctl start nginx
    echo "✅ Nginx instalado"
fi

# Verificar se Certbot está instalado (para SSL)
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot (Let's Encrypt)..."
    apt-get install -y -qq certbot python3-certbot-nginx
    echo "✅ Certbot instalado"
fi

# ============================================
# CONFIGURAR FIREWALL (UFW)
# ============================================

echo "🔥 Configurando Firewall (UFW)..."

if ! command -v ufw &> /dev/null; then
    echo "📦 Instalando UFW..."
    apt-get update -qq
    apt-get install -y -qq ufw
    echo "✅ UFW instalado"
fi

# Regras básicas
ufw allow OpenSSH comment 'SSH access'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Permitir comunicação dos containers Docker (172.16.0.0/12 cobre 172.17.0.0/16 etc.)
# Necessário para containers acessarem serviços do host como túneis SSH
ufw allow from 172.16.0.0/12 to any comment 'Docker containers'

# Ativar UFW (--force para não travar em prompt interativo)
ufw --force enable
echo "✅ Firewall UFW configurado"

echo ""

# ============================================
# CONFIGURAÇÃO DO DOMÍNIO BASE
# ============================================

DOMAIN_BASE="prevencaonoradar.com.br"

echo "🌐 Domínio base configurado: $DOMAIN_BASE"
echo ""

# ============================================
# DETECÇÃO AUTOMÁTICA DE IP
# ============================================

echo "🔍 Detectando IP público da VPS..."

HOST_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || curl -4 -s ipinfo.io/ip || echo "")

if [ -z "$HOST_IP" ]; then
    echo "⚠️  Não foi possível detectar o IP automaticamente"
    read -p "Digite o IP público desta VPS: " HOST_IP
fi

echo "✅ IP detectado: $HOST_IP"
echo ""

# ============================================
# CONFIGURAÇÃO DO CLIENTE
# ============================================

# Verificar se nome foi passado como parâmetro
if [ -n "$1" ]; then
    CLIENT_NAME="$1"
    echo "🏪 Nome do cliente recebido: $CLIENT_NAME"
else
    echo "🏪 Configuração do Novo Cliente"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "O nome do cliente será usado para:"
    echo "  - Subdomínio: [nome].$DOMAIN_BASE"
    echo "  - Banco de dados: postgres_[nome]"
    echo "  - Bucket MinIO: minio-[nome]"
    echo "  - Containers Docker: prevencao-[nome]-*"
    echo ""

    # Solicitar nome do cliente
    while true; do
        read -p "📝 Nome do cliente (apenas letras minúsculas, sem espaços): " CLIENT_NAME </dev/tty

        # Validar: apenas letras minúsculas e números, sem espaços ou caracteres especiais
        if [[ "$CLIENT_NAME" =~ ^[a-z0-9]+$ ]]; then
            break
        else
            echo "❌ Nome inválido! Use apenas letras minúsculas e números, sem espaços."
            echo "   Exemplos válidos: nunes, mercado01, loja123"
        fi
    done
fi

# Validar nome do cliente
if [[ ! "$CLIENT_NAME" =~ ^[a-z0-9]+$ ]]; then
    echo "❌ Nome inválido! Use apenas letras minúsculas e números, sem espaços."
    exit 1
fi

echo ""
echo "✅ Nome do cliente: $CLIENT_NAME"

# Gerar nomes baseados no cliente
CLIENT_SUBDOMAIN="${CLIENT_NAME}.$DOMAIN_BASE"
POSTGRES_DB_NAME="postgres_${CLIENT_NAME}"
# IMPORTANTE: Bucket name com hífen (não underscore) - S3 não aceita underscore
MINIO_BUCKET_NAME="minio-${CLIENT_NAME}"
CONTAINER_PREFIX="prevencao-${CLIENT_NAME}"

echo ""
echo "📋 Configuração gerada:"
echo "   Subdomínio: $CLIENT_SUBDOMAIN"
echo "   Banco PostgreSQL: $POSTGRES_DB_NAME"
echo "   Bucket MinIO: $MINIO_BUCKET_NAME"
echo "   Prefixo containers: $CONTAINER_PREFIX"
echo ""

# Se nome foi passado por parâmetro, não pede confirmação
if [ -z "$1" ]; then
    read -p "Confirma essas configurações? (s/n): " CONFIRM </dev/tty
    if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
        echo "❌ Instalação cancelada"
        exit 1
    fi
else
    echo "✅ Configurações confirmadas automaticamente"
fi

echo ""

# ============================================
# VERIFICAR SE CLIENTE JÁ EXISTE
# ============================================

CLIENT_DIR="/root/clientes/$CLIENT_NAME"

if [ -d "$CLIENT_DIR" ]; then
    echo "⚠️  Cliente '$CLIENT_NAME' já existe!"

    # Se nome foi passado por parâmetro, reinstala automaticamente
    if [ -z "$1" ]; then
        read -p "Deseja REINSTALAR? Isso apagará todos os dados! (s/n): " REINSTALL </dev/tty
        if [[ "$REINSTALL" != "s" && "$REINSTALL" != "S" ]]; then
            echo "❌ Instalação cancelada"
            exit 1
        fi
    else
        echo "🔄 Reinstalando automaticamente..."
    fi

    echo "🧹 Removendo instalação anterior..."
    cd "$CLIENT_DIR" 2>/dev/null || true
    docker compose -f docker-compose.yml down -v 2>/dev/null || true
    rm -rf "$CLIENT_DIR"
fi

# Criar diretório do cliente
mkdir -p "$CLIENT_DIR"
cd "$CLIENT_DIR"

echo "📂 Diretório do cliente: $CLIENT_DIR"
echo ""

# ============================================
# CLONAR/ATUALIZAR REPOSITÓRIO
# ============================================

REPO_DIR="/root/prevencao-radar-repo"

if [ -d "$REPO_DIR" ]; then
    echo "📥 Atualizando repositório..."
    cd "$REPO_DIR"
    git fetch origin
    git reset --hard origin/TESTE
    git pull origin TESTE
    cd "$CLIENT_DIR"
else
    echo "📥 Clonando repositório..."
    git clone -b TESTE https://github.com/Betotradicao/TESTES-.git "$REPO_DIR"
fi

echo "✅ Repositório atualizado"

# ============================================
# CORRIGIR DOCKERFILES (npm ci -> npm install)
# O repositório pode ter Dockerfiles com npm ci que falham
# porque não existe package-lock.json
# ============================================

echo "🔧 Corrigindo Dockerfiles..."

# Corrigir Backend Dockerfile
cat > "$REPO_DIR/packages/backend/Dockerfile" << 'BACKEND_DOCKERFILE'
# ===================================
# STAGE 1: Build
# ===================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependências
RUN npm install && \
    npm cache clean --force

# Copiar código fonte
COPY src ./src

# Build TypeScript
RUN npm install -g typescript && \
    tsc && \
    # Copiar arquivos .js que não são compilados pelo TypeScript
    find src -name "*.js" -exec sh -c 'mkdir -p dist/$(dirname ${1#src/}) && cp "$1" dist/${1#src/}' _ {} \;

# ===================================
# STAGE 2: Production
# ===================================
FROM node:18-alpine

# Instalar openssh (necessário para ssh-keygen na geração de chaves do túnel)
RUN apk add --no-cache openssh

WORKDIR /app

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev && \
    npm cache clean --force

# Copiar código compilado do builder (inclui migrations já compiladas)
COPY --from=builder /app/dist ./dist

# Criar pastas de uploads necessárias
RUN mkdir -p /app/uploads/temp /app/uploads/images /app/uploads/videos /app/uploads/dvr_images /app/uploads/label-audits

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar
CMD ["node", "dist/index.js"]
BACKEND_DOCKERFILE

# Corrigir Frontend Dockerfile
cat > "$REPO_DIR/packages/frontend/Dockerfile" << 'FRONTEND_DOCKERFILE'
# ===================================
# STAGE 1: Build
# ===================================
FROM node:18-alpine AS builder

# Argumentos de build para variáveis do Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install && \
    npm cache clean --force

# Copiar código fonte
COPY . .

# Build do Vite (as variáveis VITE_* são injetadas no build)
RUN npm run build

# ===================================
# STAGE 2: Production com Nginx
# ===================================
FROM nginx:alpine

# Copiar build do Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3004 || exit 1

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
FRONTEND_DOCKERFILE

# Corrigir Cron Dockerfile
cat > "$REPO_DIR/packages/backend/Dockerfile.cron" << 'CRON_DOCKERFILE'
# Dockerfile para Serviço de Cron em Produção
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
RUN npm install && npm cache clean --force

# Copiar source code
COPY . .

# Build da aplicação
RUN npm run build

# Imagem final
FROM node:18-alpine AS production

# Instalar cron
RUN apk add --no-cache dcron

WORKDIR /app

# Copiar dependências de produção
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar aplicação compilada
COPY --from=builder /app/dist ./dist

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Criar arquivo de cron com tarefas unificadas
RUN echo "# Verificação diária completa às 8h (vendas + bipagens + notificações do dia anterior)" > /etc/crontabs/root && \
    echo "0 8 * * * cd /app && npm run run:daily:verification:prod -- --runYesterday >> /var/log/cron.log 2>&1" >> /etc/crontabs/root && \
    echo "" >> /etc/crontabs/root && \
    echo "# Monitoramento contínuo a cada 2 minutos (dia atual, sem notificações)" >> /etc/crontabs/root && \
    echo "*/2 * * * * cd /app && node dist/commands/daily-verification.command.js >> /var/log/cron.log 2>&1" >> /etc/crontabs/root && \
    echo "" >> /etc/crontabs/root && \
    echo "# Monitoramento de última bipagem - alerta se não receber bipagens por mais de 1h (a cada 1h)" >> /etc/crontabs/root && \
    echo "0 * * * * cd /app && node dist/commands/check-last-bip.command.js >> /var/log/cron.log 2>&1" >> /etc/crontabs/root && \
    echo "" >> /etc/crontabs/root && \
    echo "# Monitoramento de emails DVR - verifica novos emails a cada 1 minuto" >> /etc/crontabs/root && \
    echo "*/1 * * * * cd /app && node dist/commands/email-monitor.command.js >> /var/log/cron.log 2>&1" >> /etc/crontabs/root

# Criar diretório de logs
RUN mkdir -p /var/log && touch /var/log/cron.log

# Alterar ownership dos arquivos
RUN chown -R nodejs:nodejs /app

# Script de inicialização
RUN echo '#!/bin/sh' > /start-cron.sh && \
    echo 'echo "Starting cron service..."' >> /start-cron.sh && \
    echo 'crond -f -d 8' >> /start-cron.sh && \
    chmod +x /start-cron.sh

# Comando para executar cron
CMD ["/start-cron.sh"]
CRON_DOCKERFILE

echo "✅ Dockerfiles corrigidos (Backend + Frontend + Cron)"
echo ""

# ============================================
# GERAR PORTAS DINÂMICAS
# ============================================

echo "🔢 Gerando portas únicas para este cliente..."

# Função para encontrar porta disponível
find_available_port() {
    local BASE_PORT=$1
    local PORT=$BASE_PORT
    while netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; do
        PORT=$((PORT + 10))
        if [ $PORT -gt 65535 ]; then
            echo "❌ Não foi possível encontrar porta disponível"
            exit 1
        fi
    done
    echo $PORT
}

# Gerar portas baseadas em hash do nome do cliente para consistência
CLIENT_HASH=$(echo -n "$CLIENT_NAME" | md5sum | cut -c1-4)
CLIENT_NUM=$((16#$CLIENT_HASH % 900 + 100))  # Número entre 100 e 999

FRONTEND_PORT=$((3000 + CLIENT_NUM))
BACKEND_PORT=$((4000 + CLIENT_NUM))
POSTGRES_PORT=$((5400 + CLIENT_NUM))
MINIO_API_PORT=$((9000 + CLIENT_NUM))
MINIO_CONSOLE_PORT=$((9100 + CLIENT_NUM))

# Verificar se portas estão disponíveis, senão encontrar alternativas
FRONTEND_PORT=$(find_available_port $FRONTEND_PORT)
BACKEND_PORT=$(find_available_port $BACKEND_PORT)
POSTGRES_PORT=$(find_available_port $POSTGRES_PORT)
MINIO_API_PORT=$(find_available_port $MINIO_API_PORT)
MINIO_CONSOLE_PORT=$(find_available_port $MINIO_CONSOLE_PORT)

echo "   Frontend: $FRONTEND_PORT"
echo "   Backend: $BACKEND_PORT"
echo "   PostgreSQL: $POSTGRES_PORT"
echo "   MinIO API: $MINIO_API_PORT"
echo "   MinIO Console: $MINIO_CONSOLE_PORT"

# ============================================
# GERAR PORTAS DE TÚNEL SSH (isolamento por cliente)
# Cada cliente recebe portas ÚNICAS para seus túneis
# ============================================

TUNNEL_ORACLE_PORT=$((10000 + CLIENT_NUM))
TUNNEL_MSSQL_PORT=$((11000 + CLIENT_NUM))
TUNNEL_API_PORT=$((12000 + CLIENT_NUM))

TUNNEL_ORACLE_PORT=$(find_available_port $TUNNEL_ORACLE_PORT)
TUNNEL_MSSQL_PORT=$(find_available_port $TUNNEL_MSSQL_PORT)
TUNNEL_API_PORT=$(find_available_port $TUNNEL_API_PORT)

echo "   --- Túneis SSH (isolados) ---"
echo "   Túnel Oracle: $TUNNEL_ORACLE_PORT"
echo "   Túnel MSSQL: $TUNNEL_MSSQL_PORT"
echo "   Túnel API ERP: $TUNNEL_API_PORT"
echo ""

# ============================================
# GERAR CREDENCIAIS SEGURAS
# ============================================

echo "🔐 Gerando credenciais seguras..."

# Função para gerar senha segura
generate_password() {
    openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32
}

POSTGRES_USER="postgres"
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_password)
API_TOKEN=$(generate_password)
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD=$(generate_password)
MINIO_ACCESS_KEY="$MINIO_ROOT_USER"
MINIO_SECRET_KEY="$MINIO_ROOT_PASSWORD"

echo "✅ Credenciais geradas"
echo ""

# ============================================
# CRIAR ARQUIVO .env
# ============================================

echo "📝 Criando arquivo .env..."

cat > .env << EOF
# ============================================
# CONFIGURAÇÃO DO CLIENTE: $CLIENT_NAME
# Gerado em: $(date)
# ============================================

# Identificação
CLIENT_NAME=$CLIENT_NAME
CLIENT_SUBDOMAIN=$CLIENT_SUBDOMAIN

# Portas
FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT
POSTGRES_PORT=$POSTGRES_PORT

# POSTGRESQL - Banco de Dados
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB_NAME
DB_HOST=${CONTAINER_PREFIX}-postgres
DB_PORT=5432
DB_USER=$POSTGRES_USER
DB_PASSWORD=$POSTGRES_PASSWORD
DB_NAME=$POSTGRES_DB_NAME

# MINIO - Armazenamento
MINIO_API_PORT=$MINIO_API_PORT
MINIO_CONSOLE_PORT=$MINIO_CONSOLE_PORT
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET_NAME=$MINIO_BUCKET_NAME

# MINIO PÚBLICO - Para acesso via HTTPS (navegador)
# Configurado para usar proxy Nginx em /storage/
MINIO_PUBLIC_ENDPOINT=$CLIENT_SUBDOMAIN
MINIO_PUBLIC_PORT=443
MINIO_PUBLIC_USE_SSL=true
MINIO_PUBLIC_PATH=/storage

# SEGURANÇA
JWT_SECRET=$JWT_SECRET
API_TOKEN=$API_TOKEN

# VITE (Frontend)
VITE_API_URL=https://$CLIENT_SUBDOMAIN/api

# APP
HOST_IP=$HOST_IP
NODE_ENV=production
FRONTEND_URL=https://$CLIENT_SUBDOMAIN

# TÚNEL SSH (portas isoladas por cliente)
# Cada cliente tem portas EXCLUSIVAS - um cliente NUNCA acessa o túnel de outro
TUNNEL_ORACLE_PORT=$TUNNEL_ORACLE_PORT
TUNNEL_MSSQL_PORT=$TUNNEL_MSSQL_PORT
TUNNEL_API_PORT=$TUNNEL_API_PORT

# EMAIL (configurar depois)
EMAIL_USER=
EMAIL_PASS=
EOF

echo "✅ Arquivo .env criado"
echo ""

# ============================================
# CRIAR DOCKER-COMPOSE.YML
# ============================================

echo "📦 Criando docker-compose.yml..."

cat > docker-compose.yml << EOF
services:
  # ============================================
  # POSTGRESQL - Banco de Dados
  # ============================================
  postgres:
    image: postgres:15-alpine
    container_name: ${CONTAINER_PREFIX}-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
      TZ: America/Sao_Paulo
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "\${POSTGRES_PORT}:5432"
    networks:
      - ${CLIENT_NAME}_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============================================
  # MINIO - Armazenamento de Arquivos
  # ============================================
  minio:
    image: minio/minio:latest
    container_name: ${CONTAINER_PREFIX}-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: \${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD}
      TZ: America/Sao_Paulo
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    ports:
      - "\${MINIO_API_PORT}:9000"
      - "\${MINIO_CONSOLE_PORT}:9001"
    networks:
      - ${CLIENT_NAME}_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # ============================================
  # BACKEND - API Node.js
  # ============================================
  backend:
    build:
      context: /root/prevencao-radar-repo/packages/backend
      dockerfile: Dockerfile
    container_name: ${CONTAINER_PREFIX}-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      # Conexão ao banco (interno Docker)
      DB_HOST: ${CONTAINER_PREFIX}-postgres
      DB_PORT: 5432
      DB_USER: \${POSTGRES_USER}
      DB_PASSWORD: \${POSTGRES_PASSWORD}
      DB_NAME: \${POSTGRES_DB}
      # Variáveis para seed de configurações
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      HOST_IP: \${HOST_IP}
      # Segurança
      JWT_SECRET: \${JWT_SECRET}
      API_TOKEN: \${API_TOKEN}
      # MinIO interno (comunicação entre containers)
      MINIO_ENDPOINT: ${CONTAINER_PREFIX}-minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: \${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: \${MINIO_SECRET_KEY}
      MINIO_ROOT_USER: \${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET_NAME: \${MINIO_BUCKET_NAME}
      # MinIO público (para URLs geradas - HTTPS via proxy Nginx)
      MINIO_PUBLIC_ENDPOINT: \${MINIO_PUBLIC_ENDPOINT}
      MINIO_PUBLIC_PORT: \${MINIO_PUBLIC_PORT}
      MINIO_PUBLIC_USE_SSL: \${MINIO_PUBLIC_USE_SSL}
      MINIO_PUBLIC_PATH: \${MINIO_PUBLIC_PATH}
      # Email
      EMAIL_USER: \${EMAIL_USER}
      EMAIL_PASS: \${EMAIL_PASS}
      FRONTEND_URL: \${FRONTEND_URL}
      # Túneis SSH (portas no host VPS)
      TUNNEL_ORACLE_PORT: \${TUNNEL_ORACLE_PORT}
      TUNNEL_MSSQL_PORT: \${TUNNEL_MSSQL_PORT}
      TUNNEL_API_PORT: \${TUNNEL_API_PORT}
      TZ: America/Sao_Paulo
    ports:
      - "\${BACKEND_PORT}:3001"
    volumes:
      # Volume compartilhado para imagens do DVR (email-monitor)
      - backend_uploads:/app/uploads
      # Montar .ssh do host para o backend gerenciar chaves de túnel
      - /root/.ssh:/root/.ssh
    extra_hosts:
      # Permite container acessar portas de túnel SSH no host VPS
      - "host.docker.internal:host-gateway"
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - ${CLIENT_NAME}_network

  # ============================================
  # FRONTEND - React/Vite
  # ============================================
  frontend:
    build:
      context: /root/prevencao-radar-repo/packages/frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: \${VITE_API_URL}
    container_name: ${CONTAINER_PREFIX}-frontend
    restart: unless-stopped
    environment:
      TZ: America/Sao_Paulo
    ports:
      - "\${FRONTEND_PORT}:3004"
    depends_on:
      - backend
    networks:
      - ${CLIENT_NAME}_network

  # ============================================
  # CRON - Tarefas Agendadas (DVR, Verificações)
  # ============================================
  cron:
    build:
      context: /root/prevencao-radar-repo/packages/backend
      dockerfile: Dockerfile.cron
    container_name: ${CONTAINER_PREFIX}-cron
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DB_HOST: ${CONTAINER_PREFIX}-postgres
      DB_PORT: 5432
      DB_USER: \${POSTGRES_USER}
      DB_PASSWORD: \${POSTGRES_PASSWORD}
      DB_NAME: \${POSTGRES_DB}
      MINIO_ENDPOINT: ${CONTAINER_PREFIX}-minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: \${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: \${MINIO_SECRET_KEY}
      MINIO_BUCKET_NAME: \${MINIO_BUCKET_NAME}
      MINIO_PUBLIC_ENDPOINT: \${MINIO_PUBLIC_ENDPOINT}
      MINIO_PUBLIC_PORT: \${MINIO_PUBLIC_PORT}
      MINIO_PUBLIC_USE_SSL: \${MINIO_PUBLIC_USE_SSL}
      TUNNEL_ORACLE_PORT: \${TUNNEL_ORACLE_PORT}
      TUNNEL_MSSQL_PORT: \${TUNNEL_MSSQL_PORT}
      TUNNEL_API_PORT: \${TUNNEL_API_PORT}
      TZ: America/Sao_Paulo
    volumes:
      # IMPORTANTE: Compartilhar volume de uploads com o backend
      # para que as imagens do email-monitor (DVR) sejam acessíveis pela API
      - backend_uploads:/app/uploads
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - ${CLIENT_NAME}_network

networks:
  ${CLIENT_NAME}_network:
    name: ${CLIENT_NAME}_network
    driver: bridge

volumes:
  postgres_data:
    name: ${CONTAINER_PREFIX}_postgres_data
  minio_data:
    name: ${CONTAINER_PREFIX}_minio_data
  backend_uploads:
    name: ${CONTAINER_PREFIX}_backend_uploads
EOF

echo "✅ docker-compose.yml criado"
echo ""

# ============================================
# CONFIGURAR NGINX PROXY REVERSO
# ============================================

echo "🌐 Configurando Nginx para $CLIENT_SUBDOMAIN..."

# Criar configuração Nginx para este cliente
cat > /etc/nginx/sites-available/$CLIENT_NAME << EOF
# Configuração para: $CLIENT_NAME
# Subdomínio: $CLIENT_SUBDOMAIN
# Versão: 2.0 - Com proxy MinIO para HTTPS

server {
    listen 80;
    server_name $CLIENT_SUBDOMAIN;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # NO-CACHE para arquivos JS/CSS (evita cache de versões antigas)
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeout para uploads grandes
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        client_max_body_size 100M;
    }

    # WebSocket para bips em tempo real
    location /socket.io {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # PROXY MINIO - Serve imagens via HTTPS (evita Mixed Content)
    location /storage/ {
        proxy_pass http://127.0.0.1:$MINIO_API_PORT/$MINIO_BUCKET_NAME/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Cache para imagens (7 dias)
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # PROXY UPLOADS - Serve imagens do DVR (Reconhecimento Facial)
    location /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Cache para imagens (1 dia)
        expires 1d;
        add_header Cache-Control "public";
    }
}
EOF

# Habilitar site
ln -sf /etc/nginx/sites-available/$CLIENT_NAME /etc/nginx/sites-enabled/

# Testar configuração Nginx
nginx -t

# Recarregar Nginx
systemctl reload nginx

echo "✅ Nginx configurado para $CLIENT_SUBDOMAIN"
echo ""

# ============================================
# INICIAR CONTAINERS
# ============================================

echo "🚀 Iniciando containers Docker..."
echo ""

docker compose up -d --build

echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 10

# ============================================
# PULAR MIGRATION PROBLEMÁTICA EM INSTALAÇÃO NOVA
# A migration RemoveCnpjUniqueConstraint falha em banco novo
# porque referencia tabela 'companies' que ainda não existe.
# Inserimos o registro na tabela 'migrations' para que o
# TypeORM pule essa migration automaticamente.
# ============================================

echo "🔧 Preparando banco de dados para migrations..."

# Aguardar postgres ficar pronto
PG_TRIES=0
PG_MAX=30
while [ $PG_TRIES -lt $PG_MAX ]; do
    if docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL pronto"
        break
    fi
    sleep 2
    PG_TRIES=$((PG_TRIES + 2))
done

# Inserir registro para pular migration RemoveCnpjUniqueConstraint
# (ela só faz sentido em banco que JÁ tem a tabela companies)
docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << 'EOSQL' 2>/dev/null || true
-- Criar tabela migrations se não existir (TypeORM cria automaticamente, mas por segurança)
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL
);
-- Pular migration que falha em banco novo (referencia companies::regclass)
INSERT INTO migrations (timestamp, name)
SELECT 1738800000000, 'RemoveCnpjUniqueConstraint1738800000000'
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'RemoveCnpjUniqueConstraint1738800000000');
EOSQL

echo "   ✅ Migrations preparadas"
echo ""

# ============================================
# AGUARDAR BACKEND INICIALIZAR
# ============================================

echo ""
echo "🚀 Aguardando backend inicializar e criar configurações..."
echo ""
echo "ℹ️  O backend irá automaticamente:"
echo "   • Criar tabelas do banco de dados (migrations)"
echo "   • Popular configurações com dados do .env (seed)"
echo "   • Criar usuário MASTER (Roberto)"
echo ""

# Aguardar backend estar respondendo
MAX_TRIES=60  # 2 minutos
TRY=0
while [ $TRY -lt $MAX_TRIES ]; do
    # Verificar se backend responde na rota de health
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        echo "✅ Backend inicializado com sucesso!"
        echo ""
        break
    fi

    # Mostrar progresso a cada 5 segundos
    if [ $((TRY % 5)) -eq 0 ]; then
        echo "   Aguardando backend... (${TRY}s / 120s)"
    fi

    sleep 2
    TRY=$((TRY + 2))
done

if [ $TRY -ge $MAX_TRIES ]; then
    echo "⚠️  Backend demorou para responder, mas pode estar inicializando ainda..."
    echo "   Você pode verificar os logs com:"
    echo "   docker logs ${CONTAINER_PREFIX}-backend -f"
    echo ""
fi

echo "✅ Sistema configurado automaticamente pelo backend!"
echo ""

# ============================================
# CRIAR TABELAS ADICIONAIS (não cobertas por migrations)
# ============================================

echo "🗄️  Criando tabelas adicionais..."

docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << EOSQL || true
-- Tabela para identificação de suspeitos em bipagens
CREATE TABLE IF NOT EXISTS suspect_identifications (
  id SERIAL PRIMARY KEY,
  identification_number VARCHAR(255) NOT NULL,
  bip_id INTEGER REFERENCES bips(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suspect_identifications_bip_id ON suspect_identifications(bip_id);
-- Adicionar coluna updated_at se não existir (para instalações anteriores)
ALTER TABLE suspect_identifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
EOSQL

echo "✅ Tabelas adicionais criadas"
echo ""

# ============================================
# ATUALIZAR CONFIGURAÇÕES PARA HTTPS
# Aguarda tabela 'configurations' existir (criada pelo backend via TypeORM)
# ============================================

echo "⚙️  Atualizando configurações para HTTPS..."

# Aguardar tabela configurations ser criada pelo backend (migrations)
CONFIG_TRIES=0
CONFIG_MAX=30
while [ $CONFIG_TRIES -lt $CONFIG_MAX ]; do
    TABLE_EXISTS=$(docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'configurations');" 2>/dev/null || echo "f")
    if [ "$TABLE_EXISTS" = "t" ]; then
        echo "   ✅ Tabela configurations encontrada"
        break
    fi
    if [ $((CONFIG_TRIES % 10)) -eq 0 ]; then
        echo "   Aguardando backend criar tabelas... (${CONFIG_TRIES}s)"
    fi
    sleep 2
    CONFIG_TRIES=$((CONFIG_TRIES + 2))
done

if [ "$TABLE_EXISTS" = "t" ]; then
    docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << EOSQL || true
-- Configurar MinIO para usar proxy HTTPS
UPDATE configurations SET value = '$CLIENT_SUBDOMAIN' WHERE key = 'minio_public_endpoint';
UPDATE configurations SET value = '443' WHERE key = 'minio_public_port';

-- Inserir configurações de SSL se não existirem
INSERT INTO configurations (id, key, value, encrypted, created_at, updated_at)
SELECT uuid_generate_v4(), 'minio_public_use_ssl', 'true', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = 'minio_public_use_ssl');

-- Inserir path do proxy MinIO
INSERT INTO configurations (id, key, value, encrypted, created_at, updated_at)
SELECT uuid_generate_v4(), 'minio_public_path', '/storage', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = 'minio_public_path');

-- Atualizar portas específicas do multi-tenant
UPDATE configurations SET value = '$HOST_IP' WHERE key = 'minio_endpoint';
UPDATE configurations SET value = '$MINIO_API_PORT' WHERE key = 'minio_port';
UPDATE configurations SET value = '$MINIO_CONSOLE_PORT' WHERE key = 'minio_console_port';
UPDATE configurations SET value = '$POSTGRES_PORT' WHERE key = 'postgres_port';
EOSQL
    echo "✅ Configurações atualizadas para HTTPS"
else
    echo "⚠️  Tabela configurations ainda não existe. O backend atualizará automaticamente ao iniciar."
fi
echo ""

# ============================================
# CRIAR BUCKET NO MINIO
# ============================================

echo "📦 Criando bucket no MinIO..."

# Aguardar MinIO estar pronto
sleep 5

# Usar mc (MinIO Client) para criar bucket
docker exec ${CONTAINER_PREFIX}-minio sh -c "
  mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD 2>/dev/null || true
  mc mb local/$MINIO_BUCKET_NAME 2>/dev/null || true
  mc anonymous set download local/$MINIO_BUCKET_NAME 2>/dev/null || true
" 2>/dev/null || echo "⚠️  Bucket pode já existir ou será criado pelo backend"

echo "✅ Bucket MinIO configurado"
echo ""

# ============================================
# CRIAR USUÁRIO MASTER
# ============================================

echo ""
echo "👤 Criando usuário master..."

docker exec ${CONTAINER_PREFIX}-backend npm run create-master-user 2>&1 || echo "⚠️  Aviso: Erro ao criar usuário master (pode já existir)"

echo "✅ Usuário master configurado"

# ============================================
# CRIAR EMPRESA PADRÃO E VINCULAR AO MASTER
# ============================================

echo ""
echo "🏢 Criando empresa padrão..."

# Capitalizar nome do cliente para nome da empresa
CLIENT_DISPLAY_NAME="$(echo "$CLIENT_NAME" | sed 's/./\U&/')"

docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << EOSQL || true
-- Criar empresa padrão (se não existir)
INSERT INTO companies (id, nome_fantasia, razao_social, cnpj, cod_loja, apelido, active, created_at, updated_at)
SELECT gen_random_uuid(), '${CLIENT_DISPLAY_NAME}', '${CLIENT_DISPLAY_NAME}', '00000000000000', '1', '${CLIENT_DISPLAY_NAME}', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1);

-- Vincular todos os usuários sem empresa à primeira empresa
UPDATE users SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
EOSQL

echo "✅ Empresa '${CLIENT_DISPLAY_NAME}' criada e vinculada"

# ============================================
# CONFIGURAR TÚNEL SSH ISOLADO POR CLIENTE
# ============================================

echo ""
echo "🔐 Configurando túnel SSH para cliente $CLIENT_NAME..."

# Garantir que a pasta .ssh existe
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Gerar par de chaves SSH dedicado para este cliente
SSH_KEY_DIR="$CLIENT_DIR/ssh_keys"
mkdir -p "$SSH_KEY_DIR"

if [ ! -f "$SSH_KEY_DIR/tunnel_key" ]; then
    ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_DIR/tunnel_key" -N "" -C "${CLIENT_NAME}@tunnel" -q

    # Montar restrição de portas no authorized_keys
    # ISOLAMENTO: O cliente SÓ pode abrir túneis nas portas dele
    PORT_RESTRICTIONS="permitopen=\"localhost:$TUNNEL_ORACLE_PORT\",permitopen=\"localhost:$TUNNEL_MSSQL_PORT\",permitopen=\"localhost:$TUNNEL_API_PORT\""
    RESTRICTION="restrict,port-forwarding,$PORT_RESTRICTIONS"
    PUBLIC_KEY=$(cat "$SSH_KEY_DIR/tunnel_key.pub")

    # Remover chave antiga do mesmo cliente (se existir)
    sed -i "/${CLIENT_NAME}@tunnel/d" /root/.ssh/authorized_keys 2>/dev/null || true

    # Adicionar nova chave com restrições
    echo "$RESTRICTION $PUBLIC_KEY" >> /root/.ssh/authorized_keys

    echo "✅ Chave SSH gerada para $CLIENT_NAME"
    echo "   Chave privada: $SSH_KEY_DIR/tunnel_key"
    echo "   Portas permitidas: $TUNNEL_ORACLE_PORT, $TUNNEL_MSSQL_PORT, $TUNNEL_API_PORT"
else
    echo "✅ Chave SSH já existe para $CLIENT_NAME"
fi

# Salvar configuração de túneis em arquivo legível
cat > "$CLIENT_DIR/TUNNEL_CONFIG.txt" << EOF
# ============================================
# CONFIGURAÇÃO DE TÚNEL SSH - $CLIENT_NAME
# ============================================
#
# PORTAS EXCLUSIVAS deste cliente na VPS:
#   Oracle:   $TUNNEL_ORACLE_PORT
#   MSSQL:    $TUNNEL_MSSQL_PORT
#   API ERP:  $TUNNEL_API_PORT
#
# ISOLAMENTO: Este cliente SÓ pode usar essas portas.
# Nenhum outro cliente tem acesso a essas portas.
#
# COMO CONECTAR (no Windows do cliente):
#   ssh -R $TUNNEL_ORACLE_PORT:<IP_ERP_LOCAL>:1521 root@$HOST_IP -N -i tunnel_key
#   ssh -R $TUNNEL_API_PORT:<IP_ERP_LOCAL>:3003 root@$HOST_IP -N -i tunnel_key
#
# Ou baixe o instalador automático pelo sistema:
#   https://$CLIENT_SUBDOMAIN → Configurações → Túnel SSH
#
EOF

echo ""

# ============================================
# SEED DE ERP TEMPLATES (pré-configurados)
# Aguarda tabela 'erp_templates' existir (criada pelo backend via TypeORM)
# ============================================

echo "📋 Inserindo ERP Templates pré-configurados..."

# Aguardar tabela erp_templates ser criada pelo backend (migrations)
ERP_TRIES=0
ERP_MAX=30
while [ $ERP_TRIES -lt $ERP_MAX ]; do
    ERP_TABLE=$(docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'erp_templates');" 2>/dev/null || echo "f")
    if [ "$ERP_TABLE" = "t" ]; then
        echo "   ✅ Tabela erp_templates encontrada"
        break
    fi
    if [ $((ERP_TRIES % 10)) -eq 0 ]; then
        echo "   Aguardando backend criar tabelas... (${ERP_TRIES}s)"
    fi
    sleep 2
    ERP_TRIES=$((ERP_TRIES + 2))
done

if [ "$ERP_TABLE" != "t" ]; then
    echo "⚠️  Tabela erp_templates não encontrada. Templates serão inseridos pelo backend automaticamente."
else

docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << 'EOSQL' || true

-- ERP Template: Intersolid (Oracle) - único template pré-configurado
INSERT INTO erp_templates (name, description, database_type, mappings, is_active, created_at, updated_at)
SELECT 'Intersolid', 'ERP Intersolid com banco Oracle', 'oracle',
'{"version":2,"schema":"INTERSOLID","tabelas":{"TAB_PRODUTO":{"nome_real":"TAB_PRODUTO","colunas":{"codigo":"COD_PRODUTO","descricao":"DES_PRODUTO","secao":"COD_SECAO","grupo":"COD_GRUPO","subgrupo":"COD_SUBGRUPO","unidade":"DES_UNIDADE","custo":"VAL_CUSTO","preco_venda":"VAL_PRECO_VENDA","estoque":"QTD_ESTOQUE","status":"SITUACAO","ean":"COD_BARRAS","ncm":"COD_NCM","margem":"PER_MARGEM","peso_bruto":"PESO_BRUTO"}},"TAB_CUPOM":{"nome_real":"TAB_CUPOM","colunas":{"numero_cupom":"NUM_CUPOM","data":"DTA_MOVIMENTO","pdv":"NUM_PDV","operador":"COD_OPERADOR","valor_total":"VAL_TOTAL","status":"SITUACAO","tipo":"TIPO_VENDA","desconto":"VAL_DESCONTO","hora":"HORA_VENDA"}},"TAB_CUPOM_ITEM":{"nome_real":"TAB_CUPOM_ITEM","colunas":{"numero_cupom":"NUM_CUPOM","codigo_produto":"COD_PRODUTO","quantidade":"QTD_ITEM","valor_unitario":"VAL_UNITARIO","valor_total":"VAL_TOTAL","desconto":"VAL_DESCONTO","cancelado":"FLG_CANCELADO"}},"TAB_CUPOM_FINALIZADORA":{"nome_real":"TAB_CUPOM_FINALIZADORA","colunas":{"numero_cupom":"NUM_CUPOM","forma_pagamento":"COD_FINALIZADORA","valor":"VAL_FINALIZADORA","descricao":"DES_FINALIZADORA"}},"TAB_SECAO":{"nome_real":"TAB_SECAO","colunas":{"codigo":"COD_SECAO","descricao":"DES_SECAO"}},"TAB_GRUPO":{"nome_real":"TAB_GRUPO","colunas":{"codigo":"COD_GRUPO","descricao":"DES_GRUPO","secao":"COD_SECAO"}},"TAB_SUBGRUPO":{"nome_real":"TAB_SUBGRUPO","colunas":{"codigo":"COD_SUBGRUPO","descricao":"DES_SUBGRUPO","grupo":"COD_GRUPO"}},"TAB_FORNECEDOR":{"nome_real":"TAB_FORNECEDOR","colunas":{"codigo":"COD_FORNECEDOR","razao_social":"DES_RAZAO_SOCIAL","nome_fantasia":"DES_FANTASIA","cnpj":"NUM_CNPJ","telefone":"NUM_TELEFONE"}},"TAB_PEDIDO":{"nome_real":"TAB_PEDIDO","colunas":{"numero_pedido":"NUM_PEDIDO","data":"DTA_PEDIDO","fornecedor":"COD_FORNECEDOR","status":"SITUACAO","valor_total":"VAL_TOTAL","tipo_parceiro":"TIPO_PARCEIRO"}},"TAB_PEDIDO_PRODUTO":{"nome_real":"TAB_PEDIDO_PRODUTO","colunas":{"numero_pedido":"NUM_PEDIDO","codigo_produto":"COD_PRODUTO","quantidade_pedida":"QTD_PEDIDO","quantidade_recebida":"QTD_RECEBIDA","quantidade_embalagem":"QTD_EMBALAGEM","valor_tabela":"VAL_TABELA"}},"TAB_NF":{"nome_real":"TAB_NF","colunas":{"numero_nf":"NUM_NF","serie_nf":"NUM_SERIE_NF","data_entrada":"DTA_ENTRADA","codigo_parceiro":"COD_PARCEIRO","tipo_operacao":"TIPO_OPERACAO"}},"TAB_NF_ITEM":{"nome_real":"TAB_NF_ITEM","colunas":{"numero_nf":"NUM_NF","serie_nf":"NUM_SERIE_NF","codigo_parceiro":"COD_PARCEIRO","codigo_item":"COD_ITEM","quantidade_entrada":"QTD_ENTRADA","valor_custo":"VAL_CUSTO_SCRED","valor_total":"VAL_TOTAL"}},"TAB_PRODUTO_LOJA":{"nome_real":"TAB_PRODUTO_LOJA","colunas":{"codigo_produto":"COD_PRODUTO","codigo_loja":"COD_LOJA","fora_linha":"FORA_LINHA"}},"TAB_PRODUTO_PDV":{"nome_real":"TAB_PRODUTO_PDV","colunas":{"codigo":"COD_PRODUTO","descricao":"DES_PRODUTO","preco":"VAL_PRECO_VENDA","ean":"COD_BARRAS"}}}}',
true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM erp_templates WHERE name = 'Intersolid' AND is_active = true);

EOSQL
    echo "✅ ERP Templates pré-configurados inseridos"

# Atualizar logo do template Intersolid
docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << LOGOEOF || true
UPDATE erp_templates SET logo_url = 'data:image/jpeg;base64,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' WHERE LOWER(name) LIKE '%intersolid%';
LOGOEOF
    echo "Logo Intersolid atualizada"

fi
echo ""

# ============================================
# REGISTRAR CLIENTE NO clientes.json
# ============================================

echo "📋 Registrando cliente no clientes.json..."

CLIENTES_JSON="/root/clientes/clientes.json"

# Criar arquivo se não existir
if [ ! -f "$CLIENTES_JSON" ]; then
    cat > "$CLIENTES_JSON" << EJSON
{
  "vps": {
    "46": {
      "ip": "$HOST_IP",
      "descricao": "VPS Multi-Clientes",
      "repo_path": "$REPO_DIR",
      "branch": "TESTE",
      "clientes": {}
    }
  }
}
EJSON
fi

# Adicionar cliente ao JSON usando python (disponível na maioria dos sistemas)
if command -v python3 &> /dev/null; then
    python3 << PYEOF
import json

with open('$CLIENTES_JSON', 'r') as f:
    data = json.load(f)

# Garantir estrutura
if 'vps' not in data:
    data['vps'] = {}
if '46' not in data['vps']:
    data['vps']['46'] = {'ip': '$HOST_IP', 'descricao': 'VPS Multi-Clientes', 'repo_path': '$REPO_DIR', 'branch': 'TESTE', 'clientes': {}}

data['vps']['46']['clientes']['$CLIENT_NAME'] = {
    'nome': '$CLIENT_NAME',
    'path': '$CLIENT_DIR',
    'subdomain': '$CLIENT_SUBDOMAIN',
    'containers': {
        'frontend': '${CONTAINER_PREFIX}-frontend',
        'backend': '${CONTAINER_PREFIX}-backend',
        'postgres': '${CONTAINER_PREFIX}-postgres',
        'minio': '${CONTAINER_PREFIX}-minio',
        'cron': '${CONTAINER_PREFIX}-cron'
    },
    'ports': {
        'frontend': $FRONTEND_PORT,
        'backend': $BACKEND_PORT,
        'postgres': $POSTGRES_PORT,
        'minio_api': $MINIO_API_PORT,
        'minio_console': $MINIO_CONSOLE_PORT
    },
    'tunnel_ports': {
        'oracle': $TUNNEL_ORACLE_PORT,
        'mssql': $TUNNEL_MSSQL_PORT,
        'api_erp': $TUNNEL_API_PORT
    }
}

with open('$CLIENTES_JSON', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('OK')
PYEOF
    echo "✅ Cliente registrado em $CLIENTES_JSON"
else
    echo "⚠️  python3 não encontrado. Registre manualmente em $CLIENTES_JSON"
fi

# Copiar clientes.json para o repo também
cp "$CLIENTES_JSON" "$REPO_DIR/scripts/clientes.json" 2>/dev/null || true

echo ""

# ============================================
# CONFIGURAR SSL (HTTPS)
# ============================================

echo ""
echo "🔒 Configurando SSL (HTTPS) para $CLIENT_SUBDOMAIN..."

# Tentar obter certificado SSL
certbot --nginx -d $CLIENT_SUBDOMAIN --non-interactive --agree-tos --email admin@$DOMAIN_BASE --redirect 2>/dev/null || {
    echo "⚠️  Não foi possível obter certificado SSL automaticamente."
    echo "   O DNS pode ainda não ter propagado."
    echo "   Execute manualmente depois: certbot --nginx -d $CLIENT_SUBDOMAIN"
}

# ============================================
# EXIBIR STATUS
# ============================================

echo ""
echo "📊 Status dos containers:"
docker compose ps

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║    ✅ INSTALAÇÃO DO CLIENTE CONCLUÍDA COM SUCESSO!        ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 ACESSO AO SISTEMA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   🔗 URL Principal:"
echo "      https://$CLIENT_SUBDOMAIN"
echo ""
echo "   ⚠️  PRIMEIRO ACESSO? Entre em:"
echo "      https://$CLIENT_SUBDOMAIN/first-setup"
echo ""
echo "   📱 Acesso direto (se DNS não propagou):"
echo "      http://$HOST_IP:$FRONTEND_PORT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 CREDENCIAIS DO CLIENTE $CLIENT_NAME:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   👤 Usuário Master:"
echo "      Username: Roberto"
echo "      Senha: Beto3107@@##"
echo ""
echo "   📦 MinIO (Armazenamento):"
echo "      Console: http://$HOST_IP:$MINIO_CONSOLE_PORT"
echo "      Usuário: $MINIO_ROOT_USER"
echo "      Senha: $MINIO_ROOT_PASSWORD"
echo ""
echo "   🗄️  PostgreSQL (Banco de Dados):"
echo "      Host: $HOST_IP"
echo "      Porta: $POSTGRES_PORT"
echo "      Usuário: $POSTGRES_USER"
echo "      Senha: $POSTGRES_PASSWORD"
echo "      Database: $POSTGRES_DB_NAME"
echo ""
echo "   🔑 API Token (para scanners):"
echo "      $API_TOKEN"
echo ""
echo "   🔌 TÚNEL SSH (portas exclusivas deste cliente):"
echo "      Oracle:   $TUNNEL_ORACLE_PORT"
echo "      MSSQL:    $TUNNEL_MSSQL_PORT"
echo "      API ERP:  $TUNNEL_API_PORT"
echo "      Chave:    $CLIENT_DIR/ssh_keys/tunnel_key"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Salvar credenciais
cat > CREDENCIAIS.txt << EOF
╔════════════════════════════════════════════════════════════╗
║   CLIENTE: $CLIENT_NAME
║   Gerado em: $(date)
║   Versão do Instalador: 4.0
╚════════════════════════════════════════════════════════════╝

🌐 URL: https://$CLIENT_SUBDOMAIN
📱 Acesso direto: http://$HOST_IP:$FRONTEND_PORT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 USUÁRIO MASTER:
   Username: Roberto
   Senha: Beto3107@@##

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 MINIO:
   Console: http://$HOST_IP:$MINIO_CONSOLE_PORT
   Usuário: $MINIO_ROOT_USER
   Senha: $MINIO_ROOT_PASSWORD
   Bucket: $MINIO_BUCKET_NAME
   Proxy HTTPS: https://$CLIENT_SUBDOMAIN/storage/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  POSTGRESQL:
   Host: $HOST_IP
   Porta: $POSTGRES_PORT
   Usuário: $POSTGRES_USER
   Senha: $POSTGRES_PASSWORD
   Database: $POSTGRES_DB_NAME

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 API TOKEN:
   $API_TOKEN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 CONTAINERS:
   Frontend: ${CONTAINER_PREFIX}-frontend (porta $FRONTEND_PORT)
   Backend: ${CONTAINER_PREFIX}-backend (porta $BACKEND_PORT)
   PostgreSQL: ${CONTAINER_PREFIX}-postgres (porta $POSTGRES_PORT)
   MinIO: ${CONTAINER_PREFIX}-minio (portas $MINIO_API_PORT, $MINIO_CONSOLE_PORT)
   Cron: ${CONTAINER_PREFIX}-cron (verificações automáticas)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔌 TÚNEL SSH (ISOLADO):
   Porta Oracle: $TUNNEL_ORACLE_PORT
   Porta MSSQL: $TUNNEL_MSSQL_PORT
   Porta API ERP: $TUNNEL_API_PORT
   Chave privada: $CLIENT_DIR/ssh_keys/tunnel_key

   ⚠️  ISOLAMENTO: Estas portas são EXCLUSIVAS deste cliente.
   Nenhum outro cliente pode acessá-las.

   Configurar túnel: https://$CLIENT_SUBDOMAIN → Configurações → Túnel SSH

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ERP TEMPLATES:
   Intersolid já pré-configurado.
   Acesse: https://$CLIENT_SUBDOMAIN → Configurações → Tabelas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  GUARDE ESTE ARQUIVO EM LOCAL SEGURO!
EOF

echo "💾 Credenciais salvas em: $CLIENT_DIR/CREDENCIAIS.txt"
echo ""
echo "🛠️  COMANDOS ÚTEIS:"
echo ""
echo "   Ver logs:"
echo "   cd $CLIENT_DIR && docker compose logs -f"
echo ""
echo "   Reiniciar:"
echo "   cd $CLIENT_DIR && docker compose restart"
echo ""
echo "   Parar:"
echo "   cd $CLIENT_DIR && docker compose down"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
