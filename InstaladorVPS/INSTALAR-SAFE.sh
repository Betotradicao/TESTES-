#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🚀 INSTALAÇÃO SEGURA - PREVENÇÃO NO RADAR                    ║"
echo "║      (Não apaga nada existente na VPS)                         ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# VERIFICAR SE JÁ EXISTE INSTALAÇÃO
# ============================================

PROJECT_DIR="$HOME/prevencao-no-radar"

if [ -d "$PROJECT_DIR" ]; then
  echo "⚠️  Já existe uma instalação em $PROJECT_DIR"
  echo ""
  read -p "Deseja atualizar a instalação existente? (s/n): " ATUALIZAR </dev/tty

  if [ "$ATUALIZAR" = "s" ] || [ "$ATUALIZAR" = "S" ]; then
    echo "🔄 Atualizando instalação existente..."
    cd "$PROJECT_DIR"
    git pull
    cd InstaladorVPS
    docker compose -f docker-compose-producao.yml down
    docker compose -f docker-compose-producao.yml up -d --build
    echo "✅ Atualização concluída!"
    exit 0
  else
    echo "❌ Instalação cancelada."
    exit 0
  fi
fi

# ============================================
# VERIFICAR/INSTALAR DOCKER
# ============================================

echo "🔍 Verificando Docker..."

if ! command -v docker &> /dev/null; then
  echo "📦 Docker não encontrado. Instalando..."

  # Atualizar sistema
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  # Adicionar chave GPG do Docker
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Adicionar repositório
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  # Instalar Docker
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Iniciar Docker
  systemctl start docker
  systemctl enable docker

  echo "✅ Docker instalado com sucesso"
else
  echo "✅ Docker já instalado"
fi

echo ""

# ============================================
# CLONAR REPOSITÓRIO
# ============================================

echo "📥 Clonando repositório do GitHub..."
cd "$HOME"
git clone https://github.com/Betotradicao/TESTES-.git prevencao-no-radar

if [ $? -ne 0 ]; then
  echo "❌ Erro ao clonar repositório"
  exit 1
fi

echo "✅ Repositório clonado"
echo ""

# ============================================
# DETECTAR IP DA VPS AUTOMATICAMENTE
# ============================================

echo "📋 Configuração do Sistema"
echo ""

# Detectar IP público da VPS automaticamente
echo "🔍 Detectando IP público da VPS..."
VPS_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || curl -s ipinfo.io/ip)

if [ -z "$VPS_IP" ]; then
  echo "⚠️  Não foi possível detectar o IP automaticamente"
  read -p "Digite o IP público desta VPS: " VPS_IP </dev/tty
else
  echo "✅ IP detectado: $VPS_IP"
  read -p "Confirma este IP? (Enter para sim, ou digite outro IP): " IP_CUSTOM </dev/tty
  if [ ! -z "$IP_CUSTOM" ]; then
    VPS_IP="$IP_CUSTOM"
  fi
fi
echo ""

# IP Tailscale do cliente
echo "Digite o IP Tailscale do cliente (máquina onde roda o ERP):"
echo "Exemplo: 100.69.131.40"
echo "Deixe vazio se não usar Tailscale"
read -p "IP Tailscale do cliente: " TAILSCALE_CLIENT_IP </dev/tty
echo ""

# ============================================
# CRIAR .ENV
# ============================================

echo "⚙️  Configurando variáveis de ambiente..."

cd "$PROJECT_DIR/InstaladorVPS"

cat > .env << EOF
# URLs e Hosts
NODE_ENV=production
FRONTEND_URL=http://${TAILSCALE_CLIENT_IP:-$VPS_IP}:3004
BACKEND_URL=http://${TAILSCALE_CLIENT_IP:-$VPS_IP}:3003

# Banco de Dados
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres123
DB_NAME=prevencao_db

# MinIO (Armazenamento de Arquivos)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=employee-avatars
MINIO_USE_SSL=false

# MinIO - URLs públicas (acesso do navegador)
MINIO_PUBLIC_ENDPOINT=${TAILSCALE_CLIENT_IP:-$VPS_IP}
MINIO_PUBLIC_PORT=9000
MINIO_PUBLIC_USE_SSL=false

# Portas da aplicação
BACKEND_PORT=3003
FRONTEND_PORT=3004

# Email (será configurado no primeiro acesso)
EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=ylljjijqstxnwogk
WELCOME_MESSAGE=Bem-vindo ao Sistema Prevenção no Radar! Estamos felizes em tê-lo conosco. Sua conta foi criada com sucesso e você já pode começar a utilizar todas as funcionalidades do sistema.

# JWT
JWT_SECRET=$(openssl rand -base64 32)

# Configuração de log
LOG_LEVEL=info
EOF

echo "✅ Arquivo .env criado"
echo ""

# ============================================
# SUBIR CONTAINERS
# ============================================

echo "🐳 Subindo containers Docker..."
echo ""

docker compose -f docker-compose-producao.yml up -d --build

if [ $? -ne 0 ]; then
  echo "❌ Erro ao subir containers"
  exit 1
fi

echo ""
echo "⏳ Aguardando containers iniciarem (30 segundos)..."
sleep 30

# ============================================
# VERIFICAR STATUS
# ============================================

echo ""
echo "🔍 Verificando status dos containers..."
echo ""

docker compose -f docker-compose-producao.yml ps

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║            ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Acesse o sistema:"
echo ""
echo "   Frontend: http://${TAILSCALE_CLIENT_IP:-$VPS_IP}:3004"
echo "   Backend:  http://${TAILSCALE_CLIENT_IP:-$VPS_IP}:3003"
echo "   MinIO:    http://${TAILSCALE_CLIENT_IP:-$VPS_IP}:9000"
echo ""
echo "📝 Próximos passos:"
echo ""
echo "   1. Acesse o frontend e faça o primeiro cadastro"
echo "   2. Configure as integrações (ERP, produtos, etc)"
echo "   3. Teste o envio de emails e upload de arquivos"
echo ""
echo "📚 Para ver logs:"
echo "   cd $PROJECT_DIR/InstaladorVPS"
echo "   docker compose -f docker-compose-producao.yml logs -f"
echo ""
