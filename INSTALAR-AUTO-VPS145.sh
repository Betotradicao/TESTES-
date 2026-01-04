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

# Salvar diretório atual
INSTALLER_DIR=$(pwd)

# Voltar para raiz do repositório
cd "$(dirname "$0")/.."

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

# Voltar para diretório do instalador
cd "$INSTALLER_DIR"
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
echo "🔐 AUTENTICAÇÃO TAILSCALE NECESSÁRIA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ -n "$TAILSCALE_AUTH_URL" ]; then
    echo "   Abra este link no navegador para autenticar:"
    echo ""
    echo "   $TAILSCALE_AUTH_URL"
    echo ""
    echo "   ⏳ Após autenticar, o sistema detectará automaticamente o IP"
    echo "   💾 O IP será salvo automaticamente no banco de dados"
    echo ""
    echo "   ℹ️  A instalação continuará automaticamente após você autenticar!"
else
    echo "   ⚠️  Link não foi gerado no log."
    echo "   Execute manualmente para gerar o link:"
    echo ""
    echo "   tailscale up --reset --accept-routes --shields-up=false"
    echo ""
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo ""

# ============================================
# IP TAILSCALE DO CLIENTE (WINDOWS/ERP)
# ============================================

# O IP do cliente será configurado depois pela interface web
# em Configurações → Tailscale
TAILSCALE_CLIENT_IP=""

echo "ℹ️  O IP Tailscale do cliente será configurado pela interface web"
echo ""

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
# CONFIGURAR BANCO DE DADOS
# ============================================

echo "💾 Configurando credenciais no banco de dados..."

# Aguardar PostgreSQL estar 100% pronto
echo "⏳ Aguardando PostgreSQL inicializar..."
sleep 10

# LIMPAR configurações antigas (garantir instalação limpa)
echo "🧹 Limpando configurações antigas..."
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
-- Limpar TODAS as configurações antigas
TRUNCATE TABLE configurations;
" 2>/dev/null

echo "✅ Banco limpo! Inserindo configurações novas..."

# Inserir credenciais do banco de dados
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
-- Credenciais do PostgreSQL
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES
  ('postgres_host', 'postgres', false, NOW(), NOW()),
  ('postgres_port', '5432', false, NOW(), NOW()),
  ('postgres_user', '$POSTGRES_USER', false, NOW(), NOW()),
  ('postgres_password', '$POSTGRES_PASSWORD', false, NOW(), NOW()),
  ('postgres_database', '$POSTGRES_DB', false, NOW(), NOW()),
  ('db_host', 'postgres', false, NOW(), NOW()),
  ('db_port', '5432', false, NOW(), NOW()),
  ('db_user', '$POSTGRES_USER', false, NOW(), NOW()),
  ('db_password', '$POSTGRES_PASSWORD', false, NOW(), NOW()),
  ('db_name', '$POSTGRES_DB', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
" 2>/dev/null

echo "✅ Credenciais do banco configuradas!"

# Inserir configurações do MinIO
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES
  ('minio_endpoint', 'minio', false, NOW(), NOW()),
  ('minio_port', '9000', false, NOW(), NOW()),
  ('minio_access_key', '$MINIO_ACCESS_KEY', false, NOW(), NOW()),
  ('minio_secret_key', '$MINIO_SECRET_KEY', false, NOW(), NOW()),
  ('minio_bucket_name', '$MINIO_BUCKET_NAME', false, NOW(), NOW()),
  ('minio_public_endpoint', '$HOST_IP', false, NOW(), NOW()),
  ('minio_public_port', '$MINIO_PUBLIC_PORT', false, NOW(), NOW()),
  ('minio_use_ssl', 'false', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
" 2>/dev/null

echo "✅ Configurações do MinIO salvas!"

# Inserir configurações de Email (Gmail)
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
VALUES
  ('email_user', 'betotradicao76@gmail.com', false, NOW(), NOW()),
  ('email_pass', 'ylljjijqstxnwogk', false, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
" 2>/dev/null

echo "✅ Configurações de Email (Gmail) salvas!"
echo ""

# ============================================
# CONFIGURAR IP TAILSCALE NO BANCO
# ============================================

if [ -n "$TAILSCALE_IP" ]; then
    echo "💾 Salvando IP Tailscale da VPS no banco de dados..."

    # Inserir IP Tailscale da VPS no banco
    docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
    INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
    VALUES ('tailscale_vps_ip', '$TAILSCALE_IP', false, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET value = '$TAILSCALE_IP', updated_at = NOW();
    " 2>/dev/null

    echo "✅ IP Tailscale da VPS configurado automaticamente: $TAILSCALE_IP"
    echo ""
else
    # IP não detectado ainda - iniciar sincronização automática em background
    echo "🔄 IP Tailscale ainda não detectado. Iniciando sincronização automática..."
    chmod +x sync-tailscale-ip.sh
    nohup ./sync-tailscale-ip.sh > /tmp/tailscale-sync.log 2>&1 &
    echo "✅ Monitor de sincronização iniciado em background"
    echo "ℹ️  O IP será salvo automaticamente quando o Tailscale conectar"
    echo ""
fi

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
    echo "   ✅ Status: Conectado automaticamente via Auth Key!"
    echo "   🌐 IP da VPS na rede Tailscale: $TAILSCALE_IP"
    echo "   💾 IP salvo automaticamente no banco de dados"
    echo ""
    echo "   💡 Configure o IP do cliente em: Configurações → Tailscale"
else
    echo "   ⚠️  Aviso: Tailscale não conectou automaticamente"
    echo ""
    if [ -n "$TAILSCALE_AUTH_URL" ]; then
        echo "   🔐 Auth Key pode ter expirado. Use autenticação manual:"
        echo "      $TAILSCALE_AUTH_URL"
        echo ""
        echo "   Após autenticar, execute para ver o IP:"
        echo "      tailscale ip -4"
        echo ""
        echo "   📋 Para gerar nova Auth Key, acesse:"
        echo "      https://login.tailscale.com/admin/settings/keys"
    else
        echo "   Execute: sudo tailscale up --authkey=SUA_CHAVE"
        echo ""
        echo "   📋 Para gerar Auth Key, acesse:"
        echo "      https://login.tailscale.com/admin/settings/keys"
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
