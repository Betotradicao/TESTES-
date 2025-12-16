#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          🎯 INSTALADOR OFICIAL - PREVENÇÃO NO RADAR            ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="$HOME/prevencao-no-radar"

# ============================================
# VERIFICAR INSTALAÇÃO EXISTENTE
# ============================================

if [ -d "$PROJECT_DIR" ]; then
  echo "⚠️  Detectada instalação existente em $PROJECT_DIR"
  echo ""
  echo "Escolha uma opção:"
  echo "  1) Atualizar código e reiniciar containers (mantém dados)"
  echo "  2) Reinstalar do ZERO (apaga tudo, inclusive banco de dados)"
  echo "  3) Cancelar"
  echo ""
  read -p "Opção (1/2/3): " OPCAO </dev/tty

  case $OPCAO in
    1)
      echo ""
      echo "🔄 Atualizando instalação..."
      cd "$PROJECT_DIR"
      git pull
      cd InstaladorVPS
      docker compose -f docker-compose-producao.yml down
      docker compose -f docker-compose-producao.yml up -d --build
      echo ""
      echo "✅ Atualização concluída!"
      echo ""
      echo "🌐 Acesse: http://$(cat .env 2>/dev/null | grep MINIO_PUBLIC_ENDPOINT | cut -d'=' -f2):3004"
      exit 0
      ;;
    2)
      echo ""
      echo "🧹 Removendo instalação anterior..."
      cd "$PROJECT_DIR/InstaladorVPS" 2>/dev/null
      docker compose -f docker-compose-producao.yml down -v 2>/dev/null || true
      cd "$HOME"
      rm -rf "$PROJECT_DIR"
      docker volume ls | grep prevencao | awk '{print $2}' | xargs -r docker volume rm 2>/dev/null || true
      echo "✅ Limpeza concluída"
      echo ""
      ;;
    *)
      echo "❌ Instalação cancelada"
      exit 0
      ;;
  esac
fi

# ============================================
# VERIFICAR/INSTALAR DOCKER
# ============================================

echo "🔍 Verificando Docker..."

if ! command -v docker &> /dev/null; then
  echo "📦 Instalando Docker..."

  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl start docker
  systemctl enable docker

  echo "✅ Docker instalado"
else
  echo "✅ Docker já instalado"
fi

echo ""

# ============================================
# CLONAR REPOSITÓRIO
# ============================================

echo "📥 Clonando repositório do GitHub..."
cd "$HOME"
git clone https://github.com/Betotradicao/NOVO-PREVEN-O.git prevencao-no-radar

if [ $? -ne 0 ]; then
  echo "❌ Erro ao clonar repositório"
  exit 1
fi

echo "✅ Repositório clonado"
echo ""

# ============================================
# DETECTAR IP DA VPS
# ============================================

echo "📋 Configuração do Sistema"
echo ""

echo "🔍 Detectando IP público da VPS..."
VPS_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || curl -4 -s ipinfo.io/ip)

if [ -z "$VPS_IP" ]; then
  echo "⚠️  Não foi possível detectar automaticamente"
  read -p "Digite o IP público desta VPS: " VPS_IP </dev/tty
else
  echo "✅ IP da VPS detectado: $VPS_IP"
fi

echo ""

# ============================================
# IP TAILSCALE DO CLIENTE (OPCIONAL)
# ============================================

echo "🔗 IP Tailscale (Opcional)"
echo ""
echo "Se o cliente tem Tailscale instalado na máquina do ERP,"
echo "você pode informar o IP Tailscale como acesso alternativo."
echo ""
echo "Exemplo: 100.69.131.40"
echo ""
read -p "IP Tailscale (deixe vazio se não usar): " TAILSCALE_IP </dev/tty

if [ -z "$TAILSCALE_IP" ]; then
  echo "→ Sem Tailscale configurado"
else
  echo "→ Tailscale configurado: $TAILSCALE_IP"
fi

echo ""

# ============================================
# CRIAR .ENV
# ============================================

echo "⚙️  Criando arquivo de configuração..."

cd "$PROJECT_DIR/InstaladorVPS"

cat > .env << EOF
# URLs e Hosts
NODE_ENV=production
FRONTEND_URL=http://${VPS_IP}:3004
BACKEND_URL=http://${VPS_IP}:3003

# Banco de Dados PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres123
DB_NAME=prevencao_db

# PostgreSQL (variáveis do container)
POSTGRES_DB=prevencao_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123

# MinIO - Conexão interna (backend -> MinIO)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=employee-avatars
MINIO_USE_SSL=false

# MinIO - URLs públicas (navegador -> MinIO)
MINIO_PUBLIC_ENDPOINT=${VPS_IP}
MINIO_PUBLIC_PORT=9000
MINIO_PUBLIC_USE_SSL=false

# MinIO - Credenciais do container
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123

# Portas da aplicação
BACKEND_PORT=3003
FRONTEND_PORT=3004
PORT=3003

# Email (configurável no primeiro acesso)
EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=ylljjijqstxnwogk
WELCOME_MESSAGE=Bem-vindo ao Sistema Prevenção no Radar! Estamos felizes em tê-lo conosco. Sua conta foi criada com sucesso e você já pode começar a utilizar todas as funcionalidades do sistema.

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# Configurações extras
LOG_LEVEL=info
HOST_IP=${VPS_IP}
VITE_API_URL=http://${VPS_IP}:3003
DB_USER=postgres
API_TOKEN=$(openssl rand -base64 32)
EOF

echo "✅ Configuração criada"
echo ""

# ============================================
# SUBIR CONTAINERS
# ============================================

echo "🐳 Iniciando containers Docker..."
echo "   (isso pode demorar alguns minutos...)"
echo ""

docker compose -f docker-compose-producao.yml up -d --build

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Erro ao iniciar containers"
  echo ""
  echo "Para diagnóstico, execute:"
  echo "  cd $PROJECT_DIR/InstaladorVPS"
  echo "  docker compose -f docker-compose-producao.yml logs"
  exit 1
fi

echo ""
echo "⏳ Aguardando containers inicializarem (30 segundos)..."
sleep 30

# ============================================
# VERIFICAR STATUS
# ============================================

echo ""
echo "🔍 Verificando status dos containers..."
echo ""

docker compose -f docker-compose-producao.yml ps

# Detectar portas do docker-compose
FRONTEND_PORT=$(docker compose -f docker-compose-producao.yml port frontend 80 2>/dev/null | cut -d: -f2)
BACKEND_PORT=$(docker compose -f docker-compose-producao.yml port backend 3001 2>/dev/null | cut -d: -f2)
MINIO_PORT=$(docker compose -f docker-compose-producao.yml port minio 9000 2>/dev/null | cut -d: -f2)

# Fallback para portas padrão se detecção falhar
FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${BACKEND_PORT:-3001}
MINIO_PORT=${MINIO_PORT:-9010}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║               ✅ INSTALAÇÃO CONCLUÍDA!                         ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 PRIMEIRO ACESSO - CONFIGURAÇÃO INICIAL:"
echo ""
echo "   👉 Abra o navegador e acesse:"
echo ""
echo "      http://${VPS_IP}:${FRONTEND_PORT}/first-setup"
echo ""
echo "   💡 Faça o cadastro inicial da empresa e usuário administrador"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🌐 URLs do Sistema:"
echo ""
echo "   📱 Frontend:  http://${VPS_IP}:${FRONTEND_PORT}"
echo "   🔧 Backend:   http://${VPS_IP}:${BACKEND_PORT}"
echo "   💾 MinIO:     http://${VPS_IP}:${MINIO_PORT}"
echo ""
if [ ! -z "$TAILSCALE_IP" ] && [ "$TAILSCALE_IP" != "$VPS_IP" ]; then
  echo "   🔗 Acesso alternativo via Tailscale:"
  echo "      http://${TAILSCALE_IP}:${FRONTEND_PORT}"
  echo ""
fi
echo "📝 Após o Primeiro Cadastro:"
echo ""
echo "   1. Faça login com as credenciais criadas"
echo "   2. Configure integrações (ERP, produtos)"
echo "   3. Teste recuperação de senha e upload de arquivos"
echo ""
echo "📚 Comandos Úteis:"
echo ""
echo "   Ver logs:       cd $PROJECT_DIR/InstaladorVPS && docker compose -f docker-compose-producao.yml logs -f"
echo "   Reiniciar:      cd $PROJECT_DIR/InstaladorVPS && docker compose -f docker-compose-producao.yml restart"
echo "   Parar tudo:     cd $PROJECT_DIR/InstaladorVPS && docker compose -f docker-compose-producao.yml down"
echo ""
