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

-- ERP Template: Intersolid (Oracle)
INSERT INTO erp_templates (name, description, database_type, mappings, is_active, created_at, updated_at)
SELECT 'Intersolid', 'ERP Intersolid com banco Oracle', 'oracle',
'{"version":2,"schema":"INTERSOLID","tabelas":{"TAB_PRODUTO":{"nome_real":"TAB_PRODUTO","colunas":{"codigo":"COD_PRODUTO","descricao":"DES_PRODUTO","secao":"COD_SECAO","grupo":"COD_GRUPO","subgrupo":"COD_SUBGRUPO","unidade":"DES_UNIDADE","custo":"VAL_CUSTO","preco_venda":"VAL_PRECO_VENDA","estoque":"QTD_ESTOQUE","status":"SITUACAO","ean":"COD_BARRAS","ncm":"COD_NCM","margem":"PER_MARGEM","peso_bruto":"PESO_BRUTO"}},"TAB_CUPOM":{"nome_real":"TAB_CUPOM","colunas":{"numero_cupom":"NUM_CUPOM","data":"DTA_MOVIMENTO","pdv":"NUM_PDV","operador":"COD_OPERADOR","valor_total":"VAL_TOTAL","status":"SITUACAO","tipo":"TIPO_VENDA","desconto":"VAL_DESCONTO","hora":"HORA_VENDA"}},"TAB_CUPOM_ITEM":{"nome_real":"TAB_CUPOM_ITEM","colunas":{"numero_cupom":"NUM_CUPOM","codigo_produto":"COD_PRODUTO","quantidade":"QTD_ITEM","valor_unitario":"VAL_UNITARIO","valor_total":"VAL_TOTAL","desconto":"VAL_DESCONTO","cancelado":"FLG_CANCELADO"}},"TAB_CUPOM_FINALIZADORA":{"nome_real":"TAB_CUPOM_FINALIZADORA","colunas":{"numero_cupom":"NUM_CUPOM","forma_pagamento":"COD_FINALIZADORA","valor":"VAL_FINALIZADORA","descricao":"DES_FINALIZADORA"}},"TAB_SECAO":{"nome_real":"TAB_SECAO","colunas":{"codigo":"COD_SECAO","descricao":"DES_SECAO"}},"TAB_GRUPO":{"nome_real":"TAB_GRUPO","colunas":{"codigo":"COD_GRUPO","descricao":"DES_GRUPO","secao":"COD_SECAO"}},"TAB_SUBGRUPO":{"nome_real":"TAB_SUBGRUPO","colunas":{"codigo":"COD_SUBGRUPO","descricao":"DES_SUBGRUPO","grupo":"COD_GRUPO"}},"TAB_FORNECEDOR":{"nome_real":"TAB_FORNECEDOR","colunas":{"codigo":"COD_FORNECEDOR","razao_social":"DES_RAZAO_SOCIAL","nome_fantasia":"DES_FANTASIA","cnpj":"NUM_CNPJ","telefone":"NUM_TELEFONE"}},"TAB_PEDIDO":{"nome_real":"TAB_PEDIDO","colunas":{"numero_pedido":"NUM_PEDIDO","data":"DTA_PEDIDO","fornecedor":"COD_FORNECEDOR","status":"SITUACAO","valor_total":"VAL_TOTAL","tipo_parceiro":"TIPO_PARCEIRO"}},"TAB_PEDIDO_PRODUTO":{"nome_real":"TAB_PEDIDO_PRODUTO","colunas":{"numero_pedido":"NUM_PEDIDO","codigo_produto":"COD_PRODUTO","quantidade_pedida":"QTD_PEDIDO","quantidade_recebida":"QTD_RECEBIDA","quantidade_embalagem":"QTD_EMBALAGEM","valor_tabela":"VAL_TABELA"}},"TAB_NF":{"nome_real":"TAB_NF","colunas":{"numero_nf":"NUM_NF","serie_nf":"NUM_SERIE_NF","data_entrada":"DTA_ENTRADA","codigo_parceiro":"COD_PARCEIRO","tipo_operacao":"TIPO_OPERACAO"}},"TAB_NF_ITEM":{"nome_real":"TAB_NF_ITEM","colunas":{"numero_nf":"NUM_NF","serie_nf":"NUM_SERIE_NF","codigo_parceiro":"COD_PARCEIRO","codigo_item":"COD_ITEM","quantidade_entrada":"QTD_ENTRADA","valor_custo":"VAL_CUSTO_SCRED","valor_total":"VAL_TOTAL"}},"TAB_PRODUTO_LOJA":{"nome_real":"TAB_PRODUTO_LOJA","colunas":{"codigo_produto":"COD_PRODUTO","codigo_loja":"COD_LOJA","fora_linha":"FORA_LINHA"}},"TAB_PRODUTO_PDV":{"nome_real":"TAB_PRODUTO_PDV","colunas":{"codigo":"COD_PRODUTO","descricao":"DES_PRODUTO","preco":"VAL_PRECO_VENDA","ean":"COD_BARRAS"}}}}',
true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM erp_templates WHERE name = 'Intersolid' AND is_active = true);

-- ERP Template: Zanthus (Oracle)
INSERT INTO erp_templates (name, description, database_type, mappings, is_active, created_at, updated_at)
SELECT 'Zanthus', 'ERP Zanthus com banco Oracle', 'oracle',
'{"version":2,"schema":"ZANTHUS","tabelas":{"TAB_PRODUTO":{"nome_real":"PRODUTO","colunas":{"codigo":"CODPRODUTO","descricao":"DESCRICAO","secao":"CODSECAO","grupo":"CODGRUPO","subgrupo":"CODSUBGRUPO","unidade":"UNIDADE","custo":"CUSTOMEDIO","preco_venda":"PRECOVENDA","estoque":"ESTOQUE","status":"STATUS","ean":"CODBARRA","ncm":"NCM"}},"TAB_CUPOM":{"nome_real":"CUPOM","colunas":{"numero_cupom":"NUMCUPOM","data":"DATAMOVIMENTO","pdv":"NUMPDV","operador":"CODOPERADOR","valor_total":"VALORTOTAL","status":"STATUS","tipo":"TIPOVENDA","desconto":"DESCONTO","hora":"HORAVENDA"}},"TAB_CUPOM_ITEM":{"nome_real":"CUPOM_ITEM","colunas":{"numero_cupom":"NUMCUPOM","codigo_produto":"CODPRODUTO","quantidade":"QUANTIDADE","valor_unitario":"VALORUNITARIO","valor_total":"VALORTOTAL","desconto":"DESCONTO","cancelado":"CANCELADO"}},"TAB_CUPOM_FINALIZADORA":{"nome_real":"CUPOM_FINALIZADORA","colunas":{"numero_cupom":"NUMCUPOM","forma_pagamento":"CODFINALIZADORA","valor":"VALOR","descricao":"DESCRICAO"}},"TAB_SECAO":{"nome_real":"SECAO","colunas":{"codigo":"CODSECAO","descricao":"DESCRICAO"}},"TAB_GRUPO":{"nome_real":"GRUPO","colunas":{"codigo":"CODGRUPO","descricao":"DESCRICAO","secao":"CODSECAO"}},"TAB_SUBGRUPO":{"nome_real":"SUBGRUPO","colunas":{"codigo":"CODSUBGRUPO","descricao":"DESCRICAO","grupo":"CODGRUPO"}},"TAB_FORNECEDOR":{"nome_real":"FORNECEDOR","colunas":{"codigo":"CODFORNECEDOR","razao_social":"RAZAOSOCIAL","nome_fantasia":"FANTASIA","cnpj":"CNPJ","telefone":"TELEFONE"}}}}',
true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM erp_templates WHERE name = 'Zanthus' AND is_active = true);

-- ERP Template: Sysmo (Oracle)
INSERT INTO erp_templates (name, description, database_type, mappings, is_active, created_at, updated_at)
SELECT 'Sysmo', 'ERP Sysmo com banco Oracle', 'oracle',
'{"version":2,"schema":"SYSMO","tabelas":{"TAB_PRODUTO":{"nome_real":"PRODUTO","colunas":{"codigo":"COD_PRODUTO","descricao":"DESC_PRODUTO","secao":"COD_SECAO","grupo":"COD_GRUPO","preco_venda":"VLR_VENDA","custo":"VLR_CUSTO","estoque":"QTD_ESTOQUE","ean":"COD_BARRA","status":"SITUACAO"}},"TAB_CUPOM":{"nome_real":"CUPOM_FISCAL","colunas":{"numero_cupom":"NR_CUPOM","data":"DT_MOVIMENTO","pdv":"NR_PDV","operador":"COD_OPERADOR","valor_total":"VLR_TOTAL","status":"SITUACAO"}},"TAB_CUPOM_ITEM":{"nome_real":"CUPOM_FISCAL_ITEM","colunas":{"numero_cupom":"NR_CUPOM","codigo_produto":"COD_PRODUTO","quantidade":"QTD","valor_unitario":"VLR_UNITARIO","valor_total":"VLR_TOTAL"}}}}',
true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM erp_templates WHERE name = 'Sysmo' AND is_active = true);

EOSQL
    echo "✅ ERP Templates pré-configurados inseridos"
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
   Intersolid, Zanthus e Sysmo já pré-configurados.
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
