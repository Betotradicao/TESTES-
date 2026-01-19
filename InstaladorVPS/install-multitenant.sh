#!/bin/bash
set -e

# ============================================
# INSTALADOR MULTI-TENANT - VPS LINUX
# Sistema: Prevenção no Radar
# Suporte a múltiplos clientes com subdomínios
# VERSÃO CORRIGIDA: MinIO HTTPS, tabela suspect_identifications
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   INSTALADOR MULTI-TENANT - PREVENÇÃO NO RADAR            ║"
echo "║   Sistema com subdomínios por cliente                      ║"
echo "║   VERSÃO: 2.0 (Janeiro 2026)                              ║"
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
    git reset --hard origin/main
    git pull origin main
    cd "$CLIENT_DIR"
else
    echo "📥 Clonando repositório..."
    git clone https://github.com/roneyfraga/roberto-prevencao-no-radar.git "$REPO_DIR"
fi

echo "✅ Repositório atualizado"
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
      TZ: America/Sao_Paulo
    ports:
      - "\${BACKEND_PORT}:3001"
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

networks:
  ${CLIENT_NAME}_network:
    name: ${CLIENT_NAME}_network
    driver: bridge

volumes:
  postgres_data:
    name: ${CONTAINER_PREFIX}_postgres_data
  minio_data:
    name: ${CONTAINER_PREFIX}_minio_data
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
sleep 15

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
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suspect_identifications_bip_id ON suspect_identifications(bip_id);
EOSQL

echo "✅ Tabelas adicionais criadas"
echo ""

# ============================================
# ATUALIZAR CONFIGURAÇÕES PARA HTTPS
# ============================================

echo "⚙️  Atualizando configurações para HTTPS..."

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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Salvar credenciais
cat > CREDENCIAIS.txt << EOF
╔════════════════════════════════════════════════════════════╗
║   CLIENTE: $CLIENT_NAME
║   Gerado em: $(date)
║   Versão do Instalador: 2.0
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
