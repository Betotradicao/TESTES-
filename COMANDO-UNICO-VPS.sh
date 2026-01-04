#!/bin/bash

# ============================================
# INSTALADOR ÚNICO - PREVENÇÃO NO RADAR
# Cole este arquivo INTEIRO na VPS e execute
# ============================================

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     INSTALADOR AUTOMÁTICO - PREVENÇÃO NO RADAR (VPS)      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo "✅ Docker instalado"
else
    echo "✅ Docker já instalado"
fi

# Detectar IP
echo "🔍 Detectando IP público..."
HOST_IP=$(curl -4 -s ifconfig.me 2>/dev/null || curl -4 -s icanhazip.com 2>/dev/null || echo "")
echo "✅ IP: $HOST_IP"

# Instalar Tailscale
if ! command -v tailscale &> /dev/null; then
    echo "📦 Instalando Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "✅ Tailscale instalado"
else
    echo "✅ Tailscale já instalado"
fi

# Forçar re-autenticação do Tailscale (limpar sessão antiga)
echo "🚀 Iniciando Tailscale..."
echo "🔄 Limpando autenticações antigas..."

# Fazer logout forçado (ignora erros se já estiver deslogado)
tailscale logout 2>/dev/null || true

# Limpar estado antigo do Tailscale
rm -f /tmp/tailscale-auth.log

# Iniciar Tailscale com --reset para forçar nova autenticação
tailscale up --reset --accept-routes --shields-up=false 2>&1 | tee /tmp/tailscale-auth.log &
TAILSCALE_PID=$!

# Aguardar link de autenticação ser gerado
sleep 5

# Extrair link de autenticação
TAILSCALE_AUTH_URL=$(grep -o 'https://login.tailscale.com/a/[a-z0-9]*' /tmp/tailscale-auth.log 2>/dev/null | head -n 1)

# Verificar se conseguiu obter o link
TAILSCALE_IP=""

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 AUTENTICAÇÃO TAILSCALE NECESSÁRIA (VPS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ -n "$TAILSCALE_AUTH_URL" ]; then
    echo "   Abra este link no navegador para autenticar:"
    echo ""
    echo "   $TAILSCALE_AUTH_URL"
    echo ""
    echo "   ⏳ Aguardando autenticação..."
    echo ""
else
    echo "   ⚠️  Link não foi gerado no log."
    echo "   Execute manualmente para gerar o link:"
    echo ""
    echo "   tailscale up --reset --accept-routes --shields-up=false"
    echo ""
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Aguardar autenticação (máximo 5 minutos)
TIMEOUT=300
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
    if [ -n "$TAILSCALE_IP" ]; then
        echo "✅ Tailscale autenticado com sucesso!"
        echo "✅ IP Tailscale VPS: $TAILSCALE_IP"
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -ne "   ⏳ Aguardando autenticação... ${ELAPSED}s\r"
done

if [ -z "$TAILSCALE_IP" ]; then
    echo ""
    echo "⚠️  Timeout: Tailscale não foi autenticado em 5 minutos"
    echo "⚠️  Continue mesmo assim (Tailscale pode ser configurado depois)"
    TAILSCALE_IP=""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖥️  IP TAILSCALE DO CLIENTE (WINDOWS/ERP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Agora você precisa instalar o Tailscale no computador"
echo "   onde está o ERP/Windows e pegar o IP Tailscale dele."
echo ""
echo "   Download: https://tailscale.com/download"
echo ""
echo "   Exemplo de IP Tailscale: 100.69.131.40"
echo ""
read -p "   Digite o IP Tailscale do cliente (ou deixe vazio): " TAILSCALE_CLIENT_IP < /dev/tty
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Gerar senhas
echo "🔐 Gerando senhas..."
MINIO_PASS=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
POSTGRES_PASS=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
JWT_SECRET=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)
API_TOKEN=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)

# Criar diretório
mkdir -p /root/prevencao-instalacao
cd /root/prevencao-instalacao

# Criar .env
cat > .env << EOF
HOST_IP=$HOST_IP
TAILSCALE_VPS_IP=$TAILSCALE_IP
TAILSCALE_CLIENT_IP=$TAILSCALE_CLIENT_IP

MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=$MINIO_PASS
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=$MINIO_PASS
MINIO_BUCKET_NAME=market-security
MINIO_PUBLIC_ENDPOINT=$HOST_IP
MINIO_PUBLIC_PORT=9010
MINIO_PUBLIC_USE_SSL=false

POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASS
POSTGRES_DB=prevencao_db

DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$POSTGRES_PASS
DB_NAME=prevencao_db

NODE_ENV=production
PORT=3001
JWT_SECRET=$JWT_SECRET
API_TOKEN=$API_TOKEN

EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=fqojjjhztvganfya
FRONTEND_URL=http://$HOST_IP:3000

VITE_API_URL=http://$HOST_IP:3001/api
EOF

echo "✅ Configurações criadas!"
echo ""

# Instalar Git
if ! command -v git &> /dev/null; then
    echo "📦 Instalando Git..."
    apt-get update -qq
    apt-get install -y git
    echo "✅ Git instalado"
else
    echo "✅ Git já instalado"
fi

# Clonar repositório
echo "📥 Baixando código do GitHub..."
if [ -d "/root/TESTES" ]; then
    echo "⚠️  Diretório TESTES já existe, atualizando..."
    cd /root/TESTES
    git pull
else
    cd /root
    git clone https://github.com/Betotradicao/TESTES-.git TESTES
    cd TESTES
fi

echo "✅ Código baixado"

# Copiar .env para InstaladorVPS
echo "📋 Configurando variáveis de ambiente..."
cp /root/prevencao-instalacao/.env /root/TESTES/InstaladorVPS/.env
cp /root/prevencao-instalacao/.env /root/TESTES/.env

# Subir containers
echo "🐳 Fazendo build dos containers (sem cache para pegar última versão)..."
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend frontend cron

echo "🚀 Subindo containers..."
docker compose -f docker-compose-producao.yml up -d

echo ""
echo "⏳ Aguardando banco de dados inicializar..."
echo "   (Isso pode levar até 60 segundos)"
echo ""

# Aguardar até 60 segundos para o banco estar pronto
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    # Tentar conectar no PostgreSQL
    if docker exec prevencao-postgres-prod pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL pronto!"
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -ne "   ⏳ Aguardando PostgreSQL... ${ELAPSED}s\r"
done

echo ""
echo ""

# ============================================
# AGUARDAR BACKEND RODAR MIGRATIONS
# ============================================
echo "⏳ Aguardando backend criar tabelas (migrations)..."
echo "   (Isso pode levar até 60 segundos)"
echo ""

# Aguardar até 60 segundos para as tabelas serem criadas
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    # Verificar se tabela 'configurations' existe
    TABLE_EXISTS=$(docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'configurations');" 2>/dev/null || echo "false")

    if [ "$TABLE_EXISTS" = "t" ]; then
        echo "✅ Tabelas criadas! Backend está pronto."
        break
    fi

    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo -ne "   ⏳ Aguardando migrations... ${ELAPSED}s (verificando tabelas...)\r"
done

if [ "$TABLE_EXISTS" != "t" ]; then
    echo ""
    echo "⚠️  AVISO: Tabelas não foram criadas em 60 segundos."
    echo "⚠️  Verifique os logs do backend:"
    echo "     docker logs prevencao-backend-prod --tail 50"
    echo ""
    echo "⚠️  Continuando mesmo assim..."
    echo ""
fi

echo ""

# ============================================
# POPULAR CONFIGURAÇÕES NO BANCO DE DADOS
# ============================================
echo "💾 Populando configurações no banco de dados..."

# Inserir configurações do PostgreSQL
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES
  ('postgres_host', '$HOST_IP', false, NOW(), NOW()),
  ('postgres_port', '5434', false, NOW(), NOW()),
  ('postgres_user', 'postgres', false, NOW(), NOW()),
  ('postgres_password', '$POSTGRES_PASS', false, NOW(), NOW()),
  ('postgres_database', 'prevencao_db', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
" 2>/dev/null

# Inserir configurações do MinIO
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES
  ('minio_endpoint', '$HOST_IP', false, NOW(), NOW()),
  ('minio_port', '9010', false, NOW(), NOW()),
  ('minio_access_key', 'admin', false, NOW(), NOW()),
  ('minio_secret_key', '$MINIO_PASS', false, NOW(), NOW()),
  ('minio_bucket_name', 'market-security', false, NOW(), NOW()),
  ('minio_public_endpoint', '$HOST_IP', false, NOW(), NOW()),
  ('minio_public_port', '9010', false, NOW(), NOW()),
  ('minio_use_ssl', 'false', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
" 2>/dev/null

# Inserir configurações de Email
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES
  ('email_user', 'betotradicao76@gmail.com', false, NOW(), NOW()),
  ('email_pass', 'fqojjjhztvganfya', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
" 2>/dev/null

# Inserir IPs Tailscale se existirem
if [ -n "$TAILSCALE_IP" ]; then
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES ('tailscale_vps_ip', '$TAILSCALE_IP', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = '$TAILSCALE_IP', updated_at = NOW();
" 2>/dev/null
fi

if [ -n "$TAILSCALE_CLIENT_IP" ]; then
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES ('tailscale_client_ip', '$TAILSCALE_CLIENT_IP', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = '$TAILSCALE_CLIENT_IP', updated_at = NOW();
" 2>/dev/null
fi

# Inserir configurações de APIs (Zanthus e Intersolid)
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES
  ('zanthus_api_url', 'http://10.6.1.101', false, NOW(), NOW()),
  ('intersolid_api_url', 'http://10.6.1.102', false, NOW(), NOW()),
  ('intersolid_port', '3003', false, NOW(), NOW()),
  ('intersolid_username', 'ROBERTO', false, NOW(), NOW()),
  ('intersolid_password', '312013@#', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
" 2>/dev/null

echo "✅ Configurações populadas no banco!"
echo ""

# ============================================
# AJUSTE CRÍTICO DO CRON
# Criar constraint UNIQUE necessária para ON CONFLICT
# ============================================
echo "🔧 Aplicando ajuste crítico do CRON..."
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS sells_unique_sale
ON sells (product_id, product_weight, num_cupom_fiscal);
" 2>/dev/null

echo "✅ Constraint UNIQUE criada na tabela sells!"
echo ""

# ============================================
# VERIFICAÇÃO FINAL - BACKEND RESPONDENDO
# ============================================
echo "🔍 Verificando se backend está respondendo na API..."
echo "   (Aguardando até 30 segundos)"
echo ""

TIMEOUT=30
ELAPSED=0
BACKEND_READY=false

while [ $ELAPSED -lt $TIMEOUT ]; do
    # Testar endpoint /api/setup/status
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/setup/status 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Backend respondendo! API está pronta."
        BACKEND_READY=true
        break
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -ne "   ⏳ Aguardando API... ${ELAPSED}s (HTTP ${HTTP_CODE})\r"
done

echo ""

if [ "$BACKEND_READY" = false ]; then
    echo "⚠️  AVISO: Backend não respondeu em 30 segundos."
    echo "⚠️  Verifique os logs:"
    echo "     docker logs prevencao-backend-prod --tail 50"
    echo ""
    echo "⚠️  Containers rodando:"
    docker ps --filter name=prevencao --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "⚠️  Você pode continuar, mas pode ser necessário aguardar mais alguns segundos."
    echo ""
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ INSTALAÇÃO CONCLUÍDA!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 ACESSE O FIRST SETUP AGORA:"
echo ""
echo "   👉 http://$HOST_IP:3000/first-setup"
echo ""
echo "   Nesta tela você irá criar o usuário ADMIN do cliente"
echo ""
echo "   OBS: O usuário MASTER (Roberto) já foi criado automaticamente"
echo ""
echo "📡 URLs dos serviços:"
echo "   First Setup: http://$HOST_IP:3000/first-setup"
echo "   Login: http://$HOST_IP:3000"
echo "   Backend API: http://$HOST_IP:3001"
echo ""
echo "📋 Credenciais do sistema:"
echo ""
echo "   👤 Usuário MASTER:"
echo "      Username: Roberto"
echo "      Senha: Beto3107@@##"
echo ""
echo "   🔧 Serviços:"
echo "      MinIO: admin / $MINIO_PASS"
echo "      PostgreSQL: postgres / $POSTGRES_PASS"
echo "      API Token: $API_TOKEN"
echo ""
echo "💾 IMPORTANTE: Salve essas credenciais em local seguro!"
echo ""
echo "📊 Verificar status dos containers:"
echo "   cd /root/TESTES/InstaladorVPS"
echo "   docker compose -f docker-compose-producao.yml ps"
echo ""
echo "📝 Ver logs:"
echo "   docker compose -f docker-compose-producao.yml logs -f"
echo ""
