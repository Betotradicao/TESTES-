#!/bin/bash
set -e

# Envolver em função main() para garantir que o script inteiro
# seja lido antes de executar (necessário para curl | bash)
main() {

# ============================================
# INSTALADOR MULTI-TENANT - VPS LINUX
# Sistema: Prevenção no Radar
# Suporte a múltiplos clientes com subdomínios OU dominio personalizado (whitelabel)
# VERSÃO 5.5: Atualizado Mai/2026
#   NOVO (v5.5):
#   - Suporte a WHITELABEL: cliente pode usar dominio proprio
#     (ex: app.mameva.com.br) em vez de <cliente>.prevencaonoradar.com.br
#   - Como usar:
#     bash install.sh <cliente> [dominio]
#     # ou: CUSTOM_DOMAIN=app.mameva.com.br bash install.sh mameva
#     # ou: interativo (pergunta)
#   - DNS do dominio precisa apontar pra esta VPS ANTES de rodar.
#   v5.4:
#   - Marketing > Chatbot WhatsApp (construtor visual estilo n8n)
#     Editor drag-and-drop com React Flow, blocos: Mensagem, Pergunta,
#     IA (OpenAI), Atendente, Encerrar. Engine grafo (conexoes com
#     condicoes). Fluxo exemplo pronto: Ofertas/Horario/Curriculos/
#     Endereco/Atendente. Tabelas: mkt_chatbot_fluxos/blocos/conexoes/
#     contatos/sessoes/mensagens (migration auto)
#   v5.3:
#   - Modulo RH completo (Cadastro, Documentacao, ASO, DP, Lancamentos
#     Folha, Indicadores, Pesquisa Clima, Recrutador IA, Banco Curriculos)
#   - Setor (FK rh_colaboradores -> sectors), CLT/Aprendiz, EPIs/EPCs
#   - Auto-Reconectar de tuneis: botao na tela Configuracoes de Tabelas
#     baixa .bat que instala gerenciador 24/7 nas maquinas cliente
#   - Tunnel-manager-setup.ps1 servido pelo backend (nao GitHub)
#   - Reconhecimento Facial: endpoint /facial-logs (filtro SQL otimizado)
#   - Migrations tolerantes a clientes legacy (dp_pastas int->uuid,
#     no-op se rh_apontamento_campos nao existir)
#   - Apontamentos aceitam HH:MM (ex: 1:20 -> 1.333)
#   v5.2:
#   - Check List no Radar (auditorias + alertas WhatsApp + PDF automatico)
#   - Reconhecimento Facial via Vision 360
#   - Garimpador multi-loja (Oracle + PostgreSQL)
#   - Dashboards com heatmap + evolucao multi-loja + top NC
#   - Meta de conformidade por loja + grupo WhatsApp por template
#   - Resolucao publica de alertas via /alerta/:token
#   BASE (v5.1):
#   - Sem Tailscale (usa túnel SSH direto)
#   - Dockerfiles lidos do repo (não sobrescreve)
#   - pgvector/pgvector:pg15 (suporte a vectors)
#   - Volume de certificates para PIX/boletos
#   - Docker compose v2 (docker compose)
#   - Multi-loja: cod_loja em bips e sells
#   - Extensao pg_trgm para busca fuzzy
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   INSTALADOR MULTI-TENANT - PREVENÇÃO NO RADAR            ║"
echo "║   Sistema com subdomínios por cliente                      ║"
echo "║   VERSÃO: 5.4 (Maio 2026)                                  ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Este script precisa ser executado como root!"
    echo "   Use: sudo bash install-multitenant.sh"
    exit 1
fi

# ============================================
# INSTALAR DEPENDÊNCIAS
# ============================================

echo "📦 Verificando dependências..."

if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker instalado"
else
    echo "✅ Docker encontrado: $(docker --version)"
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado!"
    echo "📦 O Docker Compose plugin já deve estar incluído. Verifique a instalação."
    exit 1
fi
echo "✅ Docker Compose encontrado"

if ! command -v git &> /dev/null; then
    echo "📦 Instalando Git..."
    apt-get update -qq
    apt-get install -y -qq git
    echo "✅ Git instalado"
fi

if ! command -v nginx &> /dev/null; then
    echo "📦 Instalando Nginx..."
    apt-get update -qq
    apt-get install -y -qq nginx
    systemctl enable nginx
    systemctl start nginx
    echo "✅ Nginx instalado"
fi

if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot (Let's Encrypt)..."
    apt-get install -y -qq certbot python3-certbot-nginx
    echo "✅ Certbot instalado"
fi

echo ""

# ============================================
# CONFIGURAR FIREWALL (UFW)
# ============================================

echo "🔥 Configurando Firewall (UFW)..."

if ! command -v ufw &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq ufw
fi

ufw allow OpenSSH comment 'SSH access' 2>/dev/null || true
ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
ufw allow from 172.16.0.0/12 to any comment 'Docker containers' 2>/dev/null || true
ufw --force enable 2>/dev/null || true
echo "✅ Firewall UFW configurado"
echo ""

# ============================================
# CONFIGURAÇÃO DO DOMÍNIO BASE
# ============================================

DOMAIN_BASE="prevencaonoradar.com.br"
echo "🌐 Domínio base: $DOMAIN_BASE"
echo ""

# ============================================
# DETECÇÃO AUTOMÁTICA DE IP
# ============================================

echo "🔍 Detectando IP público da VPS..."
HOST_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || curl -4 -s ipinfo.io/ip || echo "")

if [ -z "$HOST_IP" ]; then
    echo "⚠️  Não foi possível detectar o IP automaticamente"
    read -p "Digite o IP público desta VPS: " HOST_IP </dev/tty
fi

echo "✅ IP detectado: $HOST_IP"
echo ""

# ============================================
# CONFIGURAÇÃO DO CLIENTE
# ============================================

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

    while true; do
        read -p "📝 Nome do cliente (apenas letras minúsculas, sem espaços): " CLIENT_NAME </dev/tty
        if [[ "$CLIENT_NAME" =~ ^[a-z0-9]+$ ]]; then
            break
        else
            echo "❌ Nome inválido! Use apenas letras minúsculas e números."
            echo "   Exemplos: nunes, mercado01, loja123"
        fi
    done
fi

# Validar nome
if [[ ! "$CLIENT_NAME" =~ ^[a-z0-9]+$ ]]; then
    echo "❌ Nome inválido! Use apenas letras minúsculas e números."
    exit 1
fi

echo ""
echo "✅ Nome do cliente: $CLIENT_NAME"

# ============================================
# CONFIGURAÇÃO DO DOMÍNIO (PADRÃO ou PERSONALIZADO/WHITELABEL)
# ============================================
#
# Por padrão: <cliente>.prevencaonoradar.com.br
# Whitelabel: dominio personalizado (ex: app.mameva.com.br)
#
# Pode ser passado via:
#   - 2o argumento CLI: bash install.sh <cliente> <dominio>
#   - Variavel de ambiente: CUSTOM_DOMAIN=app.mameva.com.br bash install.sh ...
#   - Modo interativo: pergunta se quer dominio personalizado
#
# DNS desse dominio precisa apontar pra esta VPS ($HOST_IP) ANTES de rodar,
# senao Certbot falha na hora de gerar o SSL.

CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-$2}"
DEFAULT_SUBDOMAIN="${CLIENT_NAME}.$DOMAIN_BASE"

if [ -z "$CUSTOM_DOMAIN" ]; then
    if [ -z "$1" ]; then
        # Modo interativo
        echo ""
        echo "🌐 Configuração do Domínio"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Padrão: $DEFAULT_SUBDOMAIN"
        echo "Whitelabel: usar dominio proprio (ex: app.mameva.com.br)"
        echo ""
        read -p "Usar dominio personalizado (whitelabel)? (s/n) [n]: " USA_CUSTOM </dev/tty
        if [[ "$USA_CUSTOM" == "s" || "$USA_CUSTOM" == "S" ]]; then
            while true; do
                read -p "Digite o dominio completo (ex: app.mameva.com.br): " CUSTOM_DOMAIN </dev/tty
                # Validacao basica: precisa ter ao menos um ponto e so caracteres validos
                if [[ "$CUSTOM_DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$ ]]; then
                    break
                else
                    echo "❌ Dominio invalido. Use letras minusculas, numeros, hifens e pontos."
                fi
            done
        fi
    fi
fi

if [ -n "$CUSTOM_DOMAIN" ]; then
    CLIENT_SUBDOMAIN="$CUSTOM_DOMAIN"
    echo "🌐 Dominio personalizado (whitelabel): $CLIENT_SUBDOMAIN"
    echo "⚠️  O DNS deste dominio deve apontar pra esta VPS ($HOST_IP) antes de rodar o instalador."
else
    CLIENT_SUBDOMAIN="$DEFAULT_SUBDOMAIN"
    echo "🌐 Subdominio padrao: $CLIENT_SUBDOMAIN"
fi

# Gerar demais nomes baseados no cliente (NAO usa o dominio — sempre pelo nome curto)
POSTGRES_DB_NAME="postgres_${CLIENT_NAME}"
MINIO_BUCKET_NAME="minio-${CLIENT_NAME}"
CONTAINER_PREFIX="prevencao-${CLIENT_NAME}"

echo ""
echo "📋 Configuração gerada:"
echo "   Subdomínio: $CLIENT_SUBDOMAIN"
echo "   Banco PostgreSQL: $POSTGRES_DB_NAME"
echo "   Bucket MinIO: $MINIO_BUCKET_NAME"
echo "   Prefixo containers: $CONTAINER_PREFIX"
echo ""

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
echo ""

# ============================================
# GERAR PORTAS DINÂMICAS
# ============================================

echo "🔢 Gerando portas únicas para este cliente..."

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

CLIENT_HASH=$(echo -n "$CLIENT_NAME" | md5sum | cut -c1-4)
CLIENT_NUM=$((16#$CLIENT_HASH % 900 + 100))

FRONTEND_PORT=$((3000 + CLIENT_NUM))
BACKEND_PORT=$((4000 + CLIENT_NUM))
POSTGRES_PORT=$((5400 + CLIENT_NUM))
MINIO_API_PORT=$((9000 + CLIENT_NUM))
MINIO_CONSOLE_PORT=$((9100 + CLIENT_NUM))

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

# Portas de túnel SSH (isolamento por cliente)
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

# Abrir portas de túnel no UFW
ufw allow $TUNNEL_ORACLE_PORT/tcp comment "Tunnel Oracle $CLIENT_NAME" 2>/dev/null || true
ufw allow $TUNNEL_MSSQL_PORT/tcp comment "Tunnel MSSQL $CLIENT_NAME" 2>/dev/null || true
ufw allow $TUNNEL_API_PORT/tcp comment "Tunnel API $CLIENT_NAME" 2>/dev/null || true

# ============================================
# GERAR CREDENCIAIS SEGURAS
# ============================================

echo "🔐 Gerando credenciais seguras..."

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
# Versão do Instalador: 5.2
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
  # POSTGRESQL - Banco de Dados (pgvector para suporte a vectors)
  # ============================================
  postgres:
    image: pgvector/pgvector:pg15
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
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      DB_HOST: ${CONTAINER_PREFIX}-postgres
      DB_PORT: 5432
      DB_USER: \${POSTGRES_USER}
      DB_PASSWORD: \${POSTGRES_PASSWORD}
      DB_NAME: \${POSTGRES_DB}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      HOST_IP: \${HOST_IP}
      JWT_SECRET: \${JWT_SECRET}
      API_TOKEN: \${API_TOKEN}
      MINIO_ENDPOINT: ${CONTAINER_PREFIX}-minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: \${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: \${MINIO_SECRET_KEY}
      MINIO_ROOT_USER: \${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: \${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET_NAME: \${MINIO_BUCKET_NAME}
      MINIO_PUBLIC_ENDPOINT: \${MINIO_PUBLIC_ENDPOINT}
      MINIO_PUBLIC_PORT: \${MINIO_PUBLIC_PORT}
      MINIO_PUBLIC_USE_SSL: \${MINIO_PUBLIC_USE_SSL}
      MINIO_PUBLIC_PATH: \${MINIO_PUBLIC_PATH}
      EMAIL_USER: \${EMAIL_USER}
      EMAIL_PASS: \${EMAIL_PASS}
      FRONTEND_URL: \${FRONTEND_URL}
      TUNNEL_ORACLE_PORT: \${TUNNEL_ORACLE_PORT}
      TUNNEL_MSSQL_PORT: \${TUNNEL_MSSQL_PORT}
      TUNNEL_API_PORT: \${TUNNEL_API_PORT}
      TZ: America/Sao_Paulo
    ports:
      - "\${BACKEND_PORT}:3001"
    volumes:
      - backend_uploads:/app/uploads
      - ${CLIENT_DIR}/ssh_keys:/root/.ssh
      - /root/.ssh:/root/host_ssh
      - /root/prevencao-radar-repo/packages/backend/certificates:/app/certificates
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
      - backend_uploads:/app/uploads
      - ${CLIENT_DIR}/ssh_keys:/root/.ssh
      - /root/.ssh:/root/host_ssh
      - /root/prevencao-radar-repo/packages/backend/certificates:/app/certificates
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

cat > /etc/nginx/sites-available/$CLIENT_NAME << EOF
# Configuração para: $CLIENT_NAME
# Subdomínio: $CLIENT_SUBDOMAIN
# Versão: 3.0 - Instalador v5.0

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

        # NO-CACHE para evitar cache de versões antigas
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

    # PROXY UPLOADS - Serve imagens do DVR (Reconhecimento Facial)
    location /uploads/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        expires 1d;
        add_header Cache-Control "public";
    }

    # PROXY MINIO - Serve imagens via HTTPS (evita Mixed Content)
    location /storage/ {
        proxy_pass http://127.0.0.1:$MINIO_API_PORT/$MINIO_BUCKET_NAME/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/$CLIENT_NAME /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "✅ Nginx configurado para $CLIENT_SUBDOMAIN"
echo ""

# ============================================
# CONFIGURAR SSL COM CERTBOT
# ============================================

echo "🔒 Configurando SSL (Let's Encrypt)..."
echo ""
echo "⚠️  IMPORTANTE: O DNS de $CLIENT_SUBDOMAIN deve apontar para $HOST_IP"
echo "   Caso contrário, o Certbot irá falhar."
echo ""

if [ -z "$1" ]; then
    read -p "O DNS já está configurado? (s/n): " DNS_OK </dev/tty
else
    DNS_OK="s"
fi

if [[ "$DNS_OK" == "s" || "$DNS_OK" == "S" ]]; then
    certbot --nginx -d $CLIENT_SUBDOMAIN --non-interactive --agree-tos --register-unsafely-without-email 2>&1 || {
        echo "⚠️  Certbot falhou. Você pode configurar SSL depois com:"
        echo "   certbot --nginx -d $CLIENT_SUBDOMAIN"
    }
    systemctl enable certbot.timer 2>/dev/null || true
    echo "✅ SSL configurado"
else
    echo "⚠️  SSL não configurado. Configure depois com:"
    echo "   certbot --nginx -d $CLIENT_SUBDOMAIN"
fi
echo ""

# ============================================
# CONFIGURAR SSH ISOLADO POR CLIENTE
# ============================================

echo "🔐 Configurando túnel SSH para cliente $CLIENT_NAME..."

mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

SSH_KEY_DIR="$CLIENT_DIR/ssh_keys"
mkdir -p "$SSH_KEY_DIR"
chmod 700 "$SSH_KEY_DIR"

# Criar authorized_keys vazio para o container
touch "$SSH_KEY_DIR/authorized_keys"
chmod 600 "$SSH_KEY_DIR/authorized_keys"

echo "✅ SSH isolado configurado"
echo ""

# ============================================
# INICIAR CONTAINERS
# ============================================

echo "🚀 Iniciando containers Docker..."
echo ""

cd "$CLIENT_DIR"
docker compose up -d --build

echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 10

# ============================================
# PULAR MIGRATION PROBLEMÁTICA EM INSTALAÇÃO NOVA
# ============================================

echo "🔧 Preparando banco de dados..."

PG_TRIES=0
PG_MAX=60
while [ $PG_TRIES -lt $PG_MAX ]; do
    if docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME -c "SELECT 1" > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL pronto"
        break
    fi
    sleep 2
    PG_TRIES=$((PG_TRIES + 2))
done

docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << 'EOSQL' 2>/dev/null || true
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL
);
INSERT INTO migrations (timestamp, name)
SELECT 1738800000000, 'RemoveCnpjUniqueConstraint1738800000000'
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'RemoveCnpjUniqueConstraint1738800000000');
EOSQL

echo "   ✅ Migrations preparadas"
echo ""

# ============================================
# AGUARDAR BACKEND INICIALIZAR
# ============================================

echo "🚀 Aguardando backend inicializar..."
echo ""
echo "ℹ️  O backend irá automaticamente:"
echo "   • Criar tabelas do banco de dados (migrations)"
echo "   • Popular configurações com dados do .env (seed)"
echo "   • Criar usuário MASTER"
echo ""

MAX_TRIES=120
TRY=0
while [ $TRY -lt $MAX_TRIES ]; do
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        echo "✅ Backend inicializado com sucesso!"
        echo ""
        break
    fi
    if [ $((TRY % 10)) -eq 0 ]; then
        echo "   Aguardando backend... (${TRY}s / 120s)"
    fi
    sleep 2
    TRY=$((TRY + 2))
done

if [ $TRY -ge $MAX_TRIES ]; then
    echo "⚠️  Backend demorou para responder, mas pode estar inicializando..."
    echo "   Verifique: docker logs ${CONTAINER_PREFIX}-backend -f"
    echo ""
fi

# ============================================
# CRIAR TABELAS ADICIONAIS
# ============================================

echo "🗄️  Criando tabelas adicionais..."

docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << 'EOSQL' 2>/dev/null || true

-- Extensoes adicionais
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabela suspect_identifications
CREATE TABLE IF NOT EXISTS suspect_identifications (
  id SERIAL PRIMARY KEY,
  identification_number VARCHAR(255) NOT NULL,
  bip_id INTEGER REFERENCES bips(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suspect_identifications_bip_id ON suspect_identifications(bip_id);
ALTER TABLE suspect_identifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Coluna mappings em database_connections
ALTER TABLE database_connections ADD COLUMN IF NOT EXISTS mappings text;

-- Colunas multi-loja e operador em sells
ALTER TABLE sells ADD COLUMN IF NOT EXISTS operator_code INTEGER;
ALTER TABLE sells ADD COLUMN IF NOT EXISTS operator_name VARCHAR(100);
ALTER TABLE sells ADD COLUMN IF NOT EXISTS cod_loja INTEGER;

-- Coluna multi-loja em bips
ALTER TABLE bips ADD COLUMN IF NOT EXISTS cod_loja INTEGER;

-- Tabela secoes_inativas (Venda Dia a Dia)
CREATE TABLE IF NOT EXISTS secoes_inativas (
  id SERIAL PRIMARY KEY,
  cod_secao INTEGER NOT NULL,
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

EOSQL

echo "✅ Tabelas adicionais criadas"
echo ""

# ============================================
# ATUALIZAR CONFIGURAÇÕES PARA HTTPS
# ============================================

echo "⚙️  Atualizando configurações para HTTPS..."

CONFIG_TRIES=0
CONFIG_MAX=30
while [ $CONFIG_TRIES -lt $CONFIG_MAX ]; do
    TABLE_EXISTS=$(docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'configurations');" 2>/dev/null || echo "f")
    if [ "$TABLE_EXISTS" = "t" ]; then
        echo "   ✅ Tabela configurations encontrada"
        break
    fi
    sleep 2
    CONFIG_TRIES=$((CONFIG_TRIES + 2))
done

if [ "$TABLE_EXISTS" = "t" ]; then
    docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << EOSQL 2>/dev/null || true
UPDATE configurations SET value = '$CLIENT_SUBDOMAIN' WHERE key = 'minio_public_endpoint';
UPDATE configurations SET value = '443' WHERE key = 'minio_public_port';
INSERT INTO configurations (id, key, value, encrypted, created_at, updated_at)
SELECT uuid_generate_v4(), 'minio_public_use_ssl', 'true', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = 'minio_public_use_ssl');
INSERT INTO configurations (id, key, value, encrypted, created_at, updated_at)
SELECT uuid_generate_v4(), 'minio_public_path', '/storage', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = 'minio_public_path');
UPDATE configurations SET value = '$HOST_IP' WHERE key = 'minio_endpoint';
UPDATE configurations SET value = '$MINIO_API_PORT' WHERE key = 'minio_port';
UPDATE configurations SET value = '$MINIO_CONSOLE_PORT' WHERE key = 'minio_console_port';
UPDATE configurations SET value = '$POSTGRES_PORT' WHERE key = 'postgres_port';
EOSQL
    echo "✅ Configurações atualizadas para HTTPS"
else
    echo "⚠️  Tabela configurations não encontrada. Backend atualizará ao iniciar."
fi
echo ""

# ============================================
# CRIAR BUCKET NO MINIO
# ============================================

echo "📦 Criando bucket no MinIO..."

sleep 5

docker exec ${CONTAINER_PREFIX}-minio sh -c "
  mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD 2>/dev/null || true
  mc mb local/$MINIO_BUCKET_NAME 2>/dev/null || true
  mc anonymous set download local/$MINIO_BUCKET_NAME 2>/dev/null || true
" 2>/dev/null || echo "⚠️  Bucket será criado pelo backend automaticamente"

echo "✅ Bucket MinIO configurado"
echo ""

# ============================================
# SEED DE ERP TEMPLATES
# ============================================

echo "📋 Inserindo ERP Templates pré-configurados..."

ERP_TRIES=0
ERP_MAX=30
while [ $ERP_TRIES -lt $ERP_MAX ]; do
    ERP_TABLE=$(docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'erp_templates');" 2>/dev/null || echo "f")
    if [ "$ERP_TABLE" = "t" ]; then
        echo "   ✅ Tabela erp_templates encontrada"
        break
    fi
    sleep 2
    ERP_TRIES=$((ERP_TRIES + 2))
done

if [ "$ERP_TABLE" = "t" ]; then

docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << 'EOSQL' 2>/dev/null || true

-- ERP Template: Intersolid (Oracle)
INSERT INTO erp_templates (name, description, database_type, mappings, is_active, created_at, updated_at)
SELECT 'Intersolid', 'ERP Intersolid com banco Oracle', 'oracle',
'{
  "version": 2,
  "tabelas": {
    "TAB_PRODUTO": {"nome_real": "TAB_PRODUTO", "colunas": {"codigo_produto": "COD_PRODUTO", "descricao": "DES_PRODUTO", "codigo_secao": "COD_SECAO", "descricao_secao": "DES_SECAO", "codigo_grupo": "COD_GRUPO", "descricao_grupo": "DES_GRUPO", "codigo_subgrupo": "COD_SUB_GRUPO", "descricao_subgrupo": "DES_SUB_GRUPO", "ean": "COD_BARRA", "preco_venda": "VAL_VENDA", "preco_custo": "VAL_CUSTO", "margem": "VAL_MARGEM", "status": "FLG_INATIVO", "codigo_fornecedor": "COD_FORNECEDOR"}},
    "TAB_PRODUTO_PDV": {"nome_real": "TAB_PRODUTO_PDV", "colunas": {"codigo_produto": "COD_PRODUTO", "data_movimento": "DAT_MOVIMENTO", "quantidade": "QTD_PRODUTO", "valor_total": "VAL_TOTAL", "codigo_operador": "COD_OPERADOR", "numero_cupom": "NUM_CUPOM", "codigo_loja": "COD_LOJA", "hora": "HOR_MOVIMENTO", "desconto": "VAL_DESCONTO", "cancelado": "FLG_CANCELADO", "oferta": "FLG_OFERTA"}},
    "TAB_OPERADORES": {"nome_real": "TAB_OPERADORES", "colunas": {"codigo_operador": "COD_OPERADOR", "nome_operador": "NOM_OPERADOR"}},
    "TAB_PRODUTO_LOJA": {"nome_real": "TAB_PRODUTO_LOJA", "colunas": {"codigo_produto": "COD_PRODUTO", "codigo_loja": "COD_LOJA", "estoque_atual": "QTD_ESTOQUE_ATUAL", "estoque_minimo": "QTD_ESTOQUE_MINIMO", "estoque_maximo": "QTD_ESTOQUE_MAXIMO", "cod_forn_ult_compra": "COD_FORN_ULT_COMPRA"}},
    "TAB_FORNECEDOR": {"nome_real": "TAB_FORNECEDOR", "colunas": {"codigo_fornecedor": "COD_FORNECEDOR", "razao_social": "DES_FORNECEDOR", "nome_fantasia": "DES_FANTASIA", "cnpj": "NUM_CGC", "telefone": "NUM_FONE"}},
    "TAB_FORNECEDOR_NOTA": {"nome_real": "TAB_FORNECEDOR_NOTA", "colunas": {"numero_nf": "NUM_NF_FORN", "serie": "NUM_SERIE_NF", "data_entrada": "DTA_ENTRADA", "codigo_fornecedor": "COD_FORNECEDOR", "valor_total": "VAL_TOTAL_NF", "chave_acesso": "NUM_CHAVE_ACESSO", "flag_cancelado": "FLG_CANCELADO", "codigo_loja": "COD_LOJA"}},
    "TAB_RUPTURA": {"nome_real": "TAB_RUPTURA", "colunas": {}},
    "TAB_ETIQUETA": {"nome_real": "TAB_ETIQUETA", "colunas": {}},
    "TAB_QUEBRA": {"nome_real": "TAB_QUEBRA", "colunas": {}},
    "TAB_ESTOQUE": {"nome_real": "TAB_ESTOQUE", "colunas": {}},
    "TAB_PEDIDO": {"nome_real": "TAB_PEDIDO", "colunas": {"codigo_fornecedor": "COD_PARCEIRO"}}
  },
  "modulos": {
    "prevencao": {
      "nome": "Prevenção no Radar",
      "submodulos": {
        "bipagens": {"nome": "Bipagens", "tabelas": ["TAB_PRODUTO", "TAB_PRODUTO_PDV", "TAB_OPERADORES"]},
        "pdv": {"nome": "PDV", "tabelas": ["TAB_PRODUTO_PDV", "TAB_OPERADORES"]},
        "facial": {"nome": "Facial", "tabelas": ["TAB_OPERADORES"]},
        "rupturas": {"nome": "Rupturas", "tabelas": ["TAB_PRODUTO", "TAB_RUPTURA"]},
        "etiquetas": {"nome": "Etiquetas", "tabelas": ["TAB_PRODUTO", "TAB_ETIQUETA"]},
        "quebras": {"nome": "Quebras", "tabelas": ["TAB_PRODUTO", "TAB_QUEBRA"]}
      }
    },
    "gestao": {
      "nome": "Gestão no Radar",
      "submodulos": {
        "gestao_inteligente": {"nome": "Gestão Inteligente", "tabelas": ["TAB_PRODUTO", "TAB_PRODUTO_PDV"]},
        "estoque_margem": {"nome": "Estoque e Margem", "tabelas": ["TAB_PRODUTO", "TAB_ESTOQUE"]},
        "compra_venda": {"nome": "Compra e Venda", "tabelas": ["TAB_PRODUTO", "TAB_FORNECEDOR", "TAB_FORNECEDOR_NOTA"]},
        "pedidos": {"nome": "Pedidos", "tabelas": ["TAB_PRODUTO", "TAB_FORNECEDOR", "TAB_PEDIDO"]},
        "ruptura_industria": {"nome": "Ruptura Indústria", "tabelas": ["TAB_PRODUTO", "TAB_FORNECEDOR", "TAB_RUPTURA"]}
      }
    }
  }
}',
true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM erp_templates WHERE name = 'Intersolid');

EOSQL

echo "✅ ERP Templates inseridos"

else
    echo "⚠️  Tabela erp_templates não encontrada. Templates serão criados pelo backend."
fi
echo ""

# ============================================
# REGISTRAR CLIENTE NO clientes.json
# ============================================

echo "📋 Registrando cliente no clientes.json..."

CLIENTES_JSON="/root/clientes/clientes.json"

if [ ! -f "$CLIENTES_JSON" ]; then
    echo '{"vps": {}}' > "$CLIENTES_JSON"
fi

# Usar python3 para manipular JSON
python3 << PYEOF
import json, os

filepath = "$CLIENTES_JSON"
try:
    with open(filepath) as f:
        data = json.load(f)
except:
    data = {"vps": {}}

vps_key = "46"
if vps_key not in data.get("vps", {}):
    data["vps"][vps_key] = {
        "ip": "$HOST_IP",
        "descricao": "VPS Multi-Clientes",
        "repo_path": "/root/prevencao-radar-repo",
        "branch": "TESTE",
        "clientes": {}
    }

data["vps"][vps_key]["clientes"]["$CLIENT_NAME"] = {
    "nome": "$CLIENT_NAME",
    "path": "$CLIENT_DIR",
    "subdomain": "$CLIENT_SUBDOMAIN",
    "whitelabel": $([ -n "$CUSTOM_DOMAIN" ] && echo "true" || echo "false"),
    "containers": {
        "frontend": "${CONTAINER_PREFIX}-frontend",
        "backend": "${CONTAINER_PREFIX}-backend",
        "postgres": "${CONTAINER_PREFIX}-postgres",
        "minio": "${CONTAINER_PREFIX}-minio",
        "cron": "${CONTAINER_PREFIX}-cron"
    },
    "ports": {
        "frontend": $FRONTEND_PORT,
        "backend": $BACKEND_PORT,
        "postgres": $POSTGRES_PORT,
        "minio_api": $MINIO_API_PORT,
        "minio_console": $MINIO_CONSOLE_PORT
    },
    "tunnel_ports": {
        "oracle": $TUNNEL_ORACLE_PORT,
        "mssql": $TUNNEL_MSSQL_PORT,
        "api_erp": $TUNNEL_API_PORT
    }
}

with open(filepath, "w") as f:
    json.dump(data, f, indent=2)

print("OK")
PYEOF

echo "✅ Cliente registrado"
echo ""

# ============================================
# SALVAR INFORMAÇÕES DA INSTALAÇÃO
# ============================================

cat > "$CLIENT_DIR/INSTALACAO_INFO.txt" << EOF
# ============================================
# INFORMAÇÕES DA INSTALAÇÃO
# Cliente: $CLIENT_NAME
# Data: $(date)
# Instalador: v5.2
# ============================================

URLs:
- Primeiro acesso: https://$CLIENT_SUBDOMAIN/first-setup
- Frontend: https://$CLIENT_SUBDOMAIN
- API: https://$CLIENT_SUBDOMAIN/api

Banco de Dados:
- Host: ${CONTAINER_PREFIX}-postgres
- Usuário: $POSTGRES_USER
- Senha: $POSTGRES_PASSWORD
- Database: $POSTGRES_DB_NAME
- Porta externa: $POSTGRES_PORT

MinIO:
- API: $MINIO_API_PORT
- Console: $MINIO_CONSOLE_PORT
- Usuário: $MINIO_ROOT_USER
- Senha: $MINIO_ROOT_PASSWORD
- Bucket: $MINIO_BUCKET_NAME

Segurança:
- JWT Secret: $JWT_SECRET
- API Token: $API_TOKEN

Portas:
- Frontend: $FRONTEND_PORT
- Backend: $BACKEND_PORT
- PostgreSQL: $POSTGRES_PORT

Túneis SSH:
- Oracle: $TUNNEL_ORACLE_PORT
- MSSQL: $TUNNEL_MSSQL_PORT
- API ERP: $TUNNEL_API_PORT

Diretório: $CLIENT_DIR
EOF

# ============================================
# INSTALAÇÃO COMPLETA!
# ============================================

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📋 INFORMAÇÕES DO SISTEMA INSTALADO"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 URL de Acesso:"
echo "   https://$CLIENT_SUBDOMAIN"
echo ""
echo "🔐 Credenciais do Banco:"
echo "   Usuário:  $POSTGRES_USER"
echo "   Senha:    $POSTGRES_PASSWORD"
echo "   Database: $POSTGRES_DB_NAME"
echo ""
echo "📦 MinIO Console:"
echo "   http://$HOST_IP:$MINIO_CONSOLE_PORT"
echo "   Usuário: $MINIO_ROOT_USER"
echo "   Senha:   $MINIO_ROOT_PASSWORD"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📝 PRÓXIMOS PASSOS"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Primeiro acesso: https://$CLIENT_SUBDOMAIN/first-setup"
echo "2. Acessos seguintes: https://$CLIENT_SUBDOMAIN"
echo "3. Configurar túnel SSH para banco (Oracle/Postgres) na tela"
echo "   Configurações de Tabelas → Instalador de Túnel"
echo "4. Configurar DVR (se necessário) - Configurações de Rede → DVR/CFTV"
echo "5. ⭐ Auto-Reconectar (Manter ON): Após instalar túneis, na tela"
echo "   Configurações de Tabelas → Instalador de Túnel, clique no botão"
echo "   verde 🛡️ Auto-Reconectar e rode o .bat na máquina cliente"
echo "   UMA vez. Manager fica monitorando 24/7 e religa sozinho."
echo "6. Configurar Evolution API WhatsApp em Config. REDE → APIs"
echo "7. Cadastrar grupos WhatsApp em Config. REDE → Grupos WhatsApp"
echo "8. Criar templates de auditoria em Check List → Cadastros → Templates"
echo "9. Configurar RH: Cargos, Setores, Empresa, Benefícios em RH → Configurações"
echo ""
echo "📄 Credenciais salvas em: $CLIENT_DIR/INSTALACAO_INFO.txt"
echo ""
echo "═══════════════════════════════════════════════════════════"

# Mostrar status dos containers
echo ""
echo "📊 Status dos containers:"
docker compose ps

echo ""
echo "✅ Sistema pronto para uso! 🚀"
echo ""

} # Fim da função main()

# Chamar main para executar (necessário para curl | bash)
main "$@"
