#!/bin/bash

# ============================================
# INSTALADOR AUTOMÁTICO VPS - VERSÃO LIMPA
# Remove tudo e instala do zero
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  INSTALADOR LIMPO - PREVENÇÃO NO RADAR (VPS)             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Detectar IP público
echo "🔍 Detectando IP público..."
HOST_IP=$(curl -s https://api.ipify.org)
echo "✅ IP: $HOST_IP"

# ============================================
# LIMPAR TUDO
# ============================================
echo ""
echo "🧹 LIMPANDO INSTALAÇÃO ANTERIOR..."

# Parar e remover containers
cd /root/TESTES/InstaladorVPS 2>/dev/null && docker compose -f docker-compose-producao.yml down -v 2>/dev/null
cd /root 2>/dev/null

# Remover código antigo
rm -rf /root/TESTES
rm -rf /root/prevencao-instalacao

# Remover imagens antigas
docker rmi instaladorvps-backend instaladorvps-frontend instaladorvps-cron 2>/dev/null || true

echo "✅ Limpeza completa"

# ============================================
# INSTALAR DEPENDÊNCIAS
# ============================================
echo ""
echo "📦 Verificando dependências..."

# Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker instalado"
else
    echo "✅ Docker já instalado"
fi

# Git
if ! command -v git &> /dev/null; then
    echo "📦 Instalando Git..."
    apt-get update && apt-get install -y git
    echo "✅ Git instalado"
else
    echo "✅ Git já instalado"
fi

# ============================================
# BAIXAR CÓDIGO MAIS RECENTE
# ============================================
echo ""
echo "📥 Baixando código MAIS RECENTE do GitHub..."
cd /root
git clone https://github.com/Betotradicao/TESTES-.git TESTES
cd TESTES

COMMIT_HASH=$(git log -1 --format='%h')
COMMIT_MSG=$(git log -1 --format='%s')
echo "✅ Código baixado: $COMMIT_HASH - $COMMIT_MSG"

# ============================================
# GERAR .ENV COM SENHAS ALEATÓRIAS
# ============================================
echo ""
echo "🔐 Gerando configurações seguras..."

mkdir -p /root/prevencao-instalacao

# Gerar senhas aleatórias
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
MINIO_ACCESS_KEY="admin"
MINIO_SECRET_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
API_TOKEN=$(openssl rand -hex 16)

# Criar .env
cat > /root/prevencao-instalacao/.env << EOF
# ==========================================
# CONFIGURAÇÃO VPS - GERADO AUTOMATICAMENTE
# ==========================================

# IP Público da VPS
HOST_IP=$HOST_IP

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$POSTGRES_PASSWORD
DB_NAME=prevencao_db
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# MinIO (Armazenamento)
MINIO_ROOT_USER=$MINIO_ACCESS_KEY
MINIO_ROOT_PASSWORD=$MINIO_SECRET_KEY
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET_NAME=market-security
MINIO_PUBLIC_ENDPOINT=$HOST_IP
MINIO_PUBLIC_PORT=9010
MINIO_PUBLIC_USE_SSL=false

# API Token (Scanners)
API_TOKEN=$API_TOKEN

# Tailscale (Configurar depois no painel)
TAILSCALE_CLIENT_IP=100.69.131.40
TAILSCALE_VPS_IP=
TAILSCALE_IP=

# Email (Configurar depois no painel)
EMAIL_USER=
EMAIL_PASS=
EOF

echo "✅ Configurações geradas"

# Copiar .env para InstaladorVPS
cp /root/prevencao-instalacao/.env /root/TESTES/InstaladorVPS/.env
cp /root/prevencao-instalacao/.env /root/TESTES/.env

# ============================================
# BUILD E SUBIR CONTAINERS
# ============================================
echo ""
echo "🐳 Fazendo build dos containers (sem cache)..."
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache --pull backend frontend cron

echo ""
echo "🚀 Subindo containers..."
docker compose -f docker-compose-producao.yml up -d

# ============================================
# AGUARDAR BANCO DE DADOS
# ============================================
echo ""
echo "⏳ Aguardando PostgreSQL inicializar..."
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if docker exec prevencao-postgres-prod pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL pronto!"
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -ne "   ⏳ Aguardando... ${ELAPSED}s\r"
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "⚠️  PostgreSQL demorou mais que esperado, mas pode estar funcionando"
fi

# ============================================
# AGUARDAR MIGRATIONS
# ============================================
echo ""
echo "⏳ Aguardando backend criar tabelas (migrations)..."
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    TABLE_EXISTS=$(docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'configurations');" 2>/dev/null || echo "false")

    if [ "$TABLE_EXISTS" = "t" ]; then
        echo "✅ Tabelas criadas! Backend está pronto."
        break
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -ne "   ⏳ Aguardando... ${ELAPSED}s\r"
done

if [ "$TABLE_EXISTS" != "t" ]; then
    echo "⚠️  AVISO: Tabelas não foram criadas em 60 segundos"
    echo "   Verifique os logs: docker logs prevencao-backend-prod"
fi

# ============================================
# RESULTADO FINAL
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Acesse o sistema em:"
echo "   http://$HOST_IP:3000/first-setup"
echo ""
echo "📝 Preencha os dados da empresa e crie o admin"
echo ""
echo "🔐 Credenciais foram salvas em: /root/prevencao-instalacao/.env"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
