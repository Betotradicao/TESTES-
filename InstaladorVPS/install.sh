#!/bin/bash
set -e

# ============================================
# INSTALADOR AUTOMÁTICO - VPS LINUX
# Sistema: Prevenção no Radar
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     INSTALADOR AUTOMÁTICO - PREVENÇÃO NO RADAR (VPS)      ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  AVISO: Recomenda-se executar como root (sudo)"
    echo ""
fi

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado!"
    echo "📦 Instale o Docker primeiro: https://docs.docker.com/engine/install/"
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado!"
    echo "📦 Instale o Docker Compose primeiro"
    exit 1
fi

echo "✅ Docker encontrado: $(docker --version)"
echo "✅ Docker Compose encontrado"
echo ""

# ============================================
# ATUALIZAR CÓDIGO DO GITHUB
# ============================================

echo "🔄 Verificando atualizações do código..."

# Descobrir diretório do script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Voltar para raiz do repositório
cd "$SCRIPT_DIR/.."
REPO_ROOT=$(pwd)

# Verificar se é um repositório git
if [ -d ".git" ]; then
    echo "📥 Atualizando código do GitHub..."
    git fetch origin
    git reset --hard origin/main
    git pull origin main
    echo "✅ Código atualizado com sucesso"
else
    echo "⚠️  Não é um repositório git. Pulando atualização."
fi

# Ir para diretório do instalador
cd "$SCRIPT_DIR"
echo ""

# ============================================
# DETECÇÃO AUTOMÁTICA DE IP
# ============================================

echo "🔍 Detectando IP público da VPS..."

# Tentar múltiplos serviços para obter IP público IPv4
HOST_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || curl -4 -s ipinfo.io/ip || echo "")

if [ -z "$HOST_IP" ]; then
    echo "⚠️  Não foi possível detectar o IP automaticamente"
    read -p "Digite o IP público desta VPS: " HOST_IP
fi

echo "✅ IP detectado: $HOST_IP"
echo ""

# ============================================
# INSTALAÇÃO DO TAILSCALE
# ============================================

echo "🔗 Instalando Tailscale (VPN segura)..."

# Verificar se Tailscale já está instalado
if ! command -v tailscale &> /dev/null; then
    echo "📦 Instalando Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "✅ Tailscale instalado"
else
    echo "✅ Tailscale já instalado"
fi

# Fazer logout para limpar autenticação antiga (se houver)
echo "🔄 Limpando autenticação anterior do Tailscale..."
tailscale logout 2>/dev/null || true

# Iniciar Tailscale em modo não-interativo (não bloqueia o script)
echo "🚀 Iniciando Tailscale..."
tailscale up --accept-routes --shields-up=false > /tmp/tailscale-auth.log 2>&1 &
TAILSCALE_PID=$!

# Aguardar alguns segundos para o link de autenticação aparecer
sleep 5

# Mostrar o que está no log (para debug)
echo "📋 Verificando log do Tailscale..."
cat /tmp/tailscale-auth.log
echo ""

# Tentar extrair o link de autenticação
TAILSCALE_AUTH_URL=$(grep -o 'https://login.tailscale.com/a/[a-z0-9]*' /tmp/tailscale-auth.log | head -n 1)

# Se encontrou link, mostrar e esperar aprovação
if [ -n "$TAILSCALE_AUTH_URL" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  ATENÇÃO: Você precisa aprovar esta VPS no painel do Tailscale!"
    echo ""
    echo "🔗 Link de autenticação:"
    echo "   $TAILSCALE_AUTH_URL"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📝 Passos:"
    echo "   1. Abra o link acima no navegador"
    echo "   2. Faça login no Tailscale (se necessário)"
    echo "   3. Aprove a conexão desta VPS"
    echo ""
    read -p "Pressione ENTER após aprovar no painel do Tailscale... " </dev/tty
    echo ""
fi

# Obter IP do Tailscale após aprovação
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")

# Se não conseguiu IP, tentar aguardar mais um pouco
if [ -z "$TAILSCALE_IP" ]; then
    echo "⏳ Aguardando aprovação do Tailscale..."
    sleep 5
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
fi

if [ -n "$TAILSCALE_IP" ]; then
    echo "✅ Tailscale conectado! IP: $TAILSCALE_IP"
fi

echo ""

# ============================================
# IP TAILSCALE DO CLIENTE (WINDOWS/ERP)
# ============================================

# Verificar se foi passado via variável de ambiente (do INSTALAR-DIRETO.sh)
if [ -n "$TAILSCALE_CLIENT_IP_AUTO" ]; then
    TAILSCALE_CLIENT_IP="$TAILSCALE_CLIENT_IP_AUTO"
    echo "✅ IP Tailscale do cliente configurado: $TAILSCALE_CLIENT_IP"
    echo ""
else
    echo "🏪 Configuração do Cliente (Loja)"
    echo ""
    echo "Se o cliente possui Tailscale instalado na máquina onde roda o ERP,"
    echo "informe o IP Tailscale para conectar automaticamente."
    echo ""
    echo "Exemplo: 100.69.131.40"
    echo ""
    read -p "IP Tailscale da máquina do cliente (deixe vazio se não usar): " TAILSCALE_CLIENT_IP </dev/tty

    if [ -n "$TAILSCALE_CLIENT_IP" ]; then
        echo "✅ IP Tailscale do cliente configurado: $TAILSCALE_CLIENT_IP"
    else
        echo "⚠️  Sem IP Tailscale do cliente. Conexão com ERP será local/manual."
    fi

    echo ""
fi

# ============================================
# GERAÇÃO DE SENHAS ALEATÓRIAS
# ============================================

echo "🔐 Gerando senhas seguras aleatórias..."

# Função para gerar senha aleatória (APENAS letras e números - sem caracteres especiais)
generate_password() {
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32
}

# Gerar senhas
MINIO_ROOT_USER="admin"
MINIO_ROOT_PASSWORD=$(generate_password)
MINIO_ACCESS_KEY="$MINIO_ROOT_USER"
MINIO_SECRET_KEY="$MINIO_ROOT_PASSWORD"

POSTGRES_USER="postgres"
POSTGRES_PASSWORD=$(generate_password)

JWT_SECRET=$(generate_password)
API_TOKEN=$(generate_password)

echo "✅ Senhas geradas com sucesso"
echo ""

# ============================================
# CRIAR ARQUIVO .env
# ============================================

echo "📝 Criando arquivo de configuração (.env)..."

cat > .env << EOF
# ============================================
# CONFIGURAÇÕES DO SISTEMA
# Gerado automaticamente em: $(date)
# ============================================

# IP da VPS
HOST_IP=$HOST_IP

# ============================================
# TAILSCALE - Rede Privada Virtual
# ============================================
TAILSCALE_VPS_IP=$TAILSCALE_IP
TAILSCALE_CLIENT_IP=$TAILSCALE_CLIENT_IP

# ============================================
# MINIO - Armazenamento de Arquivos
# ============================================
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET_NAME=market-security
MINIO_PUBLIC_ENDPOINT=$HOST_IP
MINIO_PUBLIC_PORT=9010
MINIO_PUBLIC_USE_SSL=false

# ============================================
# POSTGRESQL - Banco de Dados
# ============================================
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=prevencao_db

# Conexão do Backend ao PostgreSQL (interno Docker)
DB_HOST=postgres
DB_PORT=5432
DB_USER=$POSTGRES_USER
DB_PASSWORD=$POSTGRES_PASSWORD
DB_NAME=prevencao_db

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
EMAIL_PASS=ylljjijqstxnwogk

# ============================================
# FRONTEND - Interface Web
# ============================================
VITE_API_URL=http://$HOST_IP:3001/api

EOF

echo "✅ Arquivo .env criado com sucesso"
echo ""

# ============================================
# PARAR E LIMPAR CONTAINERS ANTIGOS
# ============================================

echo "🧹 Limpando containers antigos (se existirem)..."

docker compose -f docker-compose-producao.yml down -v 2>/dev/null || true

echo "✅ Limpeza concluída"
echo ""

# ============================================
# INICIAR APLICAÇÃO
# ============================================

echo "🚀 Iniciando containers Docker..."
echo ""

docker compose -f docker-compose-producao.yml up -d --build

echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 10

# ============================================
# EXIBIR STATUS
# ============================================

echo ""
echo "📊 Status dos containers:"
docker compose -f docker-compose-producao.yml ps

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║            ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 ACESSO AO SISTEMA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   📱 Interface Web:"
echo "      http://$HOST_IP:3000"
echo ""
echo "   ⚠️  PRIMEIRO ACESSO? Entre em:"
echo "      http://$HOST_IP:3000/first-setup"
echo ""
echo "   🔌 Backend API:"
echo "      http://$HOST_IP:3001"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 TAILSCALE (Rede Privada Virtual):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ -n "$TAILSCALE_IP" ]; then
    echo "   ✅ Status: Conectado"
    echo "   🌐 IP da VPS na rede Tailscale: $TAILSCALE_IP"
    echo ""
    echo "   💡 Use este IP para acessar APIs locais dos clientes"
else
    echo "   ⚠️  Status: Aguardando autenticação"
    echo ""
    if [ -n "$TAILSCALE_AUTH_URL" ]; then
        echo "   🔐 Para conectar, abra este link no navegador:"
        echo "      $TAILSCALE_AUTH_URL"
        echo ""
        echo "   Após autenticar, execute para ver o IP:"
        echo "      tailscale ip -4"
    else
        echo "   Execute o comando abaixo para obter o link de autenticação:"
        echo "      sudo tailscale up"
    fi
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 CREDENCIAIS GERADAS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   📦 MinIO (Armazenamento):"
echo "      Console: http://$HOST_IP:9011"
echo "      Usuário: $MINIO_ROOT_USER"
echo "      Senha: $MINIO_ROOT_PASSWORD"
echo ""
echo "   🗄️  PostgreSQL (Banco de Dados):"
echo "      Host: $HOST_IP"
echo "      Porta: 5434"
echo "      Usuário: $POSTGRES_USER"
echo "      Senha: $POSTGRES_PASSWORD"
echo "      Database: prevencao_db"
echo ""
echo "   🔑 API Token (para scanners):"
echo "      $API_TOKEN"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANTE: Guarde essas credenciais em local seguro!"
echo "    Elas também estão salvas no arquivo .env"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 PRÓXIMOS PASSOS:"
echo ""
echo "   1. Acesse a configuração inicial: http://$HOST_IP:3000/first-setup"
echo "   2. Cadastre sua empresa e crie o primeiro usuário administrador"
echo "   3. As credenciais MinIO/PostgreSQL acima já estão pré-configuradas"
echo "   4. Após o cadastro, faça login e configure os scanners"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🛠️  COMANDOS ÚTEIS:"
echo ""
echo "   Ver logs do backend:"
echo "   docker compose -f docker-compose-producao.yml logs -f backend"
echo ""
echo "   Parar aplicação:"
echo "   docker compose -f docker-compose-producao.yml down"
echo ""
echo "   Reiniciar aplicação:"
echo "   docker compose -f docker-compose-producao.yml restart"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Salvar credenciais em arquivo separado
cat > CREDENCIAIS.txt << EOF
╔════════════════════════════════════════════════════════════╗
║           CREDENCIAIS - PREVENÇÃO NO RADAR                 ║
║           Gerado em: $(date)                    ║
╚════════════════════════════════════════════════════════════╝

🌐 IP PÚBLICO DA VPS: $HOST_IP
🔗 IP TAILSCALE: ${TAILSCALE_IP:-Pendente autenticação}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 FRONTEND (Interface Web):
   URL: http://$HOST_IP:3000

🔌 BACKEND (API):
   URL: http://$HOST_IP:3001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 TAILSCALE (Rede Privada Virtual):
   IP na rede: ${TAILSCALE_IP:-Execute 'tailscale ip -4' após autenticar}
   Link de autenticação: ${TAILSCALE_AUTH_URL:-Execute 'sudo tailscale up'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 MINIO (Armazenamento de Arquivos):
   Console: http://$HOST_IP:9011
   API Endpoint: $HOST_IP
   API Port: 9010
   Usuário: $MINIO_ROOT_USER
   Senha: $MINIO_ROOT_PASSWORD
   Bucket: market-security

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  POSTGRESQL (Banco de Dados):
   Host: $HOST_IP
   Porta Externa: 5434
   Usuário: $POSTGRES_USER
   Senha: $POSTGRES_PASSWORD
   Database: prevencao_db

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 API TOKEN (para scanners):
   $API_TOKEN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  GUARDE ESTE ARQUIVO EM LOCAL SEGURO!
EOF

echo "💾 Credenciais também salvas em: $(pwd)/CREDENCIAIS.txt"
echo ""
