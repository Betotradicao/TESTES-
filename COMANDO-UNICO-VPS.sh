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
fi

echo "🚀 Iniciando Tailscale..."
tailscale up --accept-routes --shields-up=false 2>&1 | tee /tmp/tailscale.log &
sleep 3
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")

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
TAILSCALE_CLIENT_IP=

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
echo "🐳 Subindo containers Docker..."
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml up -d --build

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ INSTALAÇÃO CONCLUÍDA!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Acesse o sistema:"
echo "   Frontend: http://$HOST_IP:3000"
echo "   Backend API: http://$HOST_IP:3001"
echo ""
echo "👤 Primeiro acesso:"
echo "   Será criado o usuário master automaticamente"
echo ""
echo "📋 Credenciais dos serviços:"
echo "   MinIO: admin / $MINIO_PASS"
echo "   PostgreSQL: postgres / $POSTGRES_PASS"
echo "   API Token: $API_TOKEN"
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
