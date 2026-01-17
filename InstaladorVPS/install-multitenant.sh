#!/bin/bash
set -e

# ============================================
# INSTALADOR MULTI-TENANT - VPS LINUX
# Sistema: Prevenção no Radar
# Suporte a múltiplos clientes com subdomínios
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   INSTALADOR MULTI-TENANT - PREVENÇÃO NO RADAR            ║"
echo "║   Sistema com subdomínios por cliente                      ║"
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
    echo "  - Bucket MinIO: minio_[nome]"
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
MINIO_BUCKET_NAME="minio_${CLIENT_NAME}"
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
# ATUALIZAR/CLONAR CÓDIGO DO GITHUB
# ============================================

echo "🔄 Baixando código do GitHub..."

BRANCH="TESTE"
REPO_DIR="/root/prevencao-radar-repo"

if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR"
    git fetch origin
    git checkout $BRANCH 2>/dev/null || git checkout -b $BRANCH origin/$BRANCH
    git reset --hard origin/$BRANCH
    git pull origin $BRANCH
else
    git clone -b $BRANCH https://github.com/Betotradicao/TESTES-.git "$REPO_DIR"
fi

echo "✅ Código atualizado"
echo ""

# Voltar para diretório do cliente
cd "$CLIENT_DIR"

# ============================================
# ENCONTRAR PORTAS DISPONÍVEIS
# ============================================

echo "🔍 Procurando portas disponíveis..."

# Função para verificar se porta está em uso
is_port_in_use() {
    ss -tuln | grep -q ":$1 " && return 0 || return 1
}

# Encontrar porta disponível a partir de uma base
find_available_port() {
    local base_port=$1
    local port=$base_port
    while is_port_in_use $port; do
        port=$((port + 1))
    done
    echo $port
}

# Portas para este cliente
FRONTEND_PORT=$(find_available_port 3000)
BACKEND_PORT=$(find_available_port 4000)
POSTGRES_PORT=$(find_available_port 5500)
MINIO_API_PORT=$(find_available_port 9100)
MINIO_CONSOLE_PORT=$(find_available_port 9200)

echo "✅ Portas alocadas para $CLIENT_NAME:"
echo "   Frontend: $FRONTEND_PORT"
echo "   Backend: $BACKEND_PORT"
echo "   PostgreSQL: $POSTGRES_PORT"
echo "   MinIO API: $MINIO_API_PORT"
echo "   MinIO Console: $MINIO_CONSOLE_PORT"
echo ""

# ============================================
# GERAÇÃO DE SENHAS ALEATÓRIAS
# ============================================

echo "🔐 Gerando senhas seguras..."

generate_password() {
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32
}

MINIO_ROOT_USER="admin"
MINIO_ROOT_PASSWORD=$(generate_password)
POSTGRES_USER="postgres"
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_password)
API_TOKEN=$(generate_password)

echo "✅ Senhas geradas"
echo ""

# ============================================
# CRIAR ARQUIVO .env
# ============================================

echo "📝 Criando arquivo de configuração..."

cat > .env << EOF
# ============================================
# CLIENTE: $CLIENT_NAME
# Gerado em: $(date)
# ============================================

# Identificação do Cliente
CLIENT_NAME=$CLIENT_NAME
CLIENT_SUBDOMAIN=$CLIENT_SUBDOMAIN

# IP da VPS
HOST_IP=$HOST_IP

# ============================================
# PORTAS (específicas deste cliente)
# ============================================
FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT
POSTGRES_PORT=$POSTGRES_PORT
MINIO_API_PORT=$MINIO_API_PORT
MINIO_CONSOLE_PORT=$MINIO_CONSOLE_PORT

# ============================================
# MINIO - Armazenamento de Arquivos
# ============================================
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ACCESS_KEY=$MINIO_ROOT_USER
MINIO_SECRET_KEY=$MINIO_ROOT_PASSWORD
MINIO_BUCKET_NAME=$MINIO_BUCKET_NAME
MINIO_PUBLIC_ENDPOINT=$HOST_IP
MINIO_PUBLIC_PORT=$MINIO_API_PORT
MINIO_PUBLIC_USE_SSL=false

# ============================================
# POSTGRESQL - Banco de Dados
# ============================================
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB_NAME

# Conexão do Backend ao PostgreSQL (interno Docker)
DB_HOST=${CONTAINER_PREFIX}-postgres
DB_PORT=5432
DB_USER=$POSTGRES_USER
DB_PASSWORD=$POSTGRES_PASSWORD
DB_NAME=$POSTGRES_DB_NAME

# ============================================
# BACKEND - API
# ============================================
NODE_ENV=production
PORT=3001
JWT_SECRET=$JWT_SECRET
API_TOKEN=$API_TOKEN

# ============================================
# EMAIL - Recuperação de Senha
# ============================================
EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=fqojjjhztvganfya

# ============================================
# FRONTEND - Interface Web
# ============================================
VITE_API_URL=https://$CLIENT_SUBDOMAIN/api
FRONTEND_URL=https://$CLIENT_SUBDOMAIN

EOF

echo "✅ Arquivo .env criado"
echo ""

# ============================================
# CRIAR DOCKER-COMPOSE.YML
# ============================================

echo "📝 Criando docker-compose.yml..."

cat > docker-compose.yml << EOF
version: '3.8'

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
      DB_HOST: ${CONTAINER_PREFIX}-postgres
      DB_PORT: 5432
      DB_USER: \${POSTGRES_USER}
      DB_PASSWORD: \${POSTGRES_PASSWORD}
      DB_NAME: \${POSTGRES_DB}
      JWT_SECRET: \${JWT_SECRET}
      API_TOKEN: \${API_TOKEN}
      MINIO_ENDPOINT: ${CONTAINER_PREFIX}-minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: \${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: \${MINIO_SECRET_KEY}
      MINIO_BUCKET_NAME: \${MINIO_BUCKET_NAME}
      MINIO_PUBLIC_ENDPOINT: \${HOST_IP}
      MINIO_PUBLIC_PORT: \${MINIO_API_PORT}
      MINIO_PUBLIC_USE_SSL: "false"
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
      - "\${FRONTEND_PORT}:80"
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

server {
    listen 80;
    server_name $CLIENT_SUBDOMAIN;

    # Redirecionar para HTTPS (após certificado)
    # return 301 https://\$server_name\$request_uri;

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
# INICIALIZAR BANCO DE DADOS
# ============================================

echo ""
echo "📊 Inicializando banco de dados..."

# Criar script para inicializar o banco
cat > /tmp/init-database-$CLIENT_NAME.js << 'ENDOFSCRIPT'
const { AppDataSource } = require('./dist/config/database');

const options = { ...AppDataSource.options, synchronize: true, migrations: [] };
const { DataSource } = require('typeorm');
const dataSource = new DataSource(options);

dataSource.initialize()
  .then(async () => {
    console.log('✅ Tabelas criadas com sucesso');
    await dataSource.destroy();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro ao criar tabelas:', err.message);
    process.exit(1);
  });
ENDOFSCRIPT

# Executar criação de tabelas
docker cp /tmp/init-database-$CLIENT_NAME.js ${CONTAINER_PREFIX}-backend:/app/init-database.js 2>/dev/null
docker exec ${CONTAINER_PREFIX}-backend node /app/init-database.js 2>/dev/null || echo "⚠️  Tabelas já existem ou erro ao criar"

# Limpar arquivo temporário
rm -f /tmp/init-database-$CLIENT_NAME.js

# Registrar migrations
echo "📝 Registrando migrations..."
docker exec -i ${CONTAINER_PREFIX}-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB_NAME << EOSQL || true
INSERT INTO migrations (timestamp, name) VALUES
  (1758045672125, 'CreateUsersTable1758045672125'),
  (1758062371000, 'CreateBipsTable1758062371000'),
  (1758080000000, 'CreateProductsTable1758080000000'),
  (1758080001000, 'CreateProductActivationHistoryTable1758080001000'),
  (1758090000000, 'CreateSellsTable1758090000000'),
  (1758161394993, 'AddNumCupomFiscalToSells1758161394993'),
  (1758229581610, 'AddCancelledStatusToBips1758229581610'),
  (1758394113356, 'AddUniqueIndexToSells1758394113356'),
  (1758749391000, 'AddCancelledStatusToSells1758749391000'),
  (1758756405482, 'AddDiscountCentsToSells1758756405482'),
  (1758923139254, 'AlterSellDateToTimestamp1758923139254'),
  (1759074839394, 'AddNotifiedAtToBips1759074839394'),
  (1759078749185, 'ChangeNotifiedToNotVerified1759078749185'),
  (1759200000000, 'CreateSectorsTable1759200000000'),
  (1759493626143, 'CreateEquipmentsTable1759493626143'),
  (1759496345428, 'AddEquipmentIdToBips1759496345428'),
  (1759496400000, 'AddPointOfSaleCodeToSells1759496400000'),
  (1759500000000, 'CreateEmployeesTable1759500000000'),
  (1759600000000, 'CreateEquipmentSessionsTable1759600000000'),
  (1759700000000, 'AddEmployeeIdToBips1759700000000'),
  (1765080280169, 'CreateConfigurationsTable1765080280169'),
  (1765200000000, 'CreateCompaniesAndUpdateUsers1765200000000'),
  (1765300000000, 'AddPortNumberToEquipments1765300000000'),
  (1765400000000, 'AddMotivoCancelamentoToBips1765400000000'),
  (1765400000001, 'AddVideoUrlToBips1765400000000'),
  (1765500000000, 'AddEmployeeResponsavelToBips1765500000000'),
  (1765500000001, 'AddImageUrlToBips1765500000000'),
  (1765563000000, 'AddCompanyFields1765563000000'),
  (1765570000000, 'AddMissingFieldsToUsers1765570000000'),
  (1765580000000, 'AddAddressFieldsToCompanies1765580000000'),
  (1765600000000, 'CreateEmailMonitorLogsTable1765600000000'),
  (1765700000000, 'AddImagePathToEmailMonitorLogs1765700000000'),
  (1765800000000, 'AddValidacaoIAToBips1765800000000'),
  (1765900000000, 'AddIACharacteristicsToProducts1765900000000'),
  (1735600000000, 'CreateRuptureTables1735600000000'),
  (1735700000000, 'FixRuptureItemsDecimalColumns1735700000000'),
  (1735710000000, 'RenameParciallToRupturaEstoque1735710000000'),
  (1735720000000, 'AddPedidoToRuptureSurveyItems1735720000000'),
  (1766000000000, 'CreateLossesTable1766000000000'),
  (1767200000000, 'CreateLossReasonConfigsTable1767200000000'),
  (1767300000000, 'AddPeriodToLosses1767300000000'),
  (1767400000000, 'AssociateUsersToCompany1767400000000'),
  (1767733000000, 'CreateLabelAuditTables1767733000000'),
  (1767800000000, 'CreatePDVMappingTables1767800000000'),
  (1767900000000, 'AddPesoMedioKgToProducts1767900000000'),
  (1768000000000, 'CreateProductionAuditTables1768000000000'),
  (1768001000000, 'AddCostPriceMarginToProductionAuditItems1768001000000'),
  (1768002000000, 'AddWhatsappGroupToProductionAudits1768002000000'),
  (1768100000000, 'AddProductionDaysToProducts1768100000000'),
  (1736786400000, 'AddEmployeeIdToProductionAudits1736786400000'),
  (1736900000000, 'CreateHortFrutTables1736900000000'),
  (1768062600000, 'AddEmployeePermissions1768062600000')
ON CONFLICT DO NOTHING;
EOSQL

echo "✅ Banco de dados inicializado"

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
