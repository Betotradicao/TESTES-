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
echo "🐳 Subindo containers Docker..."
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml up -d --build

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ INSTALAÇÃO CONCLUÍDA!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 ACESSE O SISTEMA AGORA:"
echo ""
echo "   👉 http://$HOST_IP:3000"
echo ""
echo "   Você será redirecionado para a tela de First Setup"
echo "   onde irá criar o usuário master (Beto)"
echo ""
echo "📡 URLs dos serviços:"
echo "   Frontend: http://$HOST_IP:3000"
echo "   Backend API: http://$HOST_IP:3001"
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
