#!/bin/bash

# ============================================
# INSTALADOR AUTOMÁTICO VPS - VERSÃO ATUALIZADA
# Inclui todas as correções de perdas e timezone
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  INSTALADOR ATUALIZADO - PREVENÇÃO NO RADAR (VPS)        ║"
echo "║  Inclui: Correções de Perdas + Timezone + Instaladores   ║"
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

# Tailscale
if ! command -v tailscale &> /dev/null; then
    echo "📦 Instalando Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "✅ Tailscale instalado"
else
    echo "✅ Tailscale já instalado"
fi

# ============================================
# CONFIGURAR TAILSCALE
# ============================================
echo ""
echo "🚀 Iniciando Tailscale..."
echo "🔄 Limpando autenticações antigas..."

# Fazer logout forçado
tailscale logout 2>/dev/null || true

# Limpar log antigo
rm -f /tmp/tailscale-auth.log

# Iniciar Tailscale
tailscale up --reset --accept-routes --shields-up=false 2>&1 | tee /tmp/tailscale-auth.log &
TAILSCALE_PID=$!

# Aguardar link de autenticação
sleep 5

# Extrair link
TAILSCALE_AUTH_URL=$(grep -o 'https://login.tailscale.com/a/[a-z0-9]*' /tmp/tailscale-auth.log 2>/dev/null | head -n 1)

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
    echo "   Execute manualmente:"
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

# ============================================
# BAIXAR CÓDIGO MAIS RECENTE DO GITHUB
# ============================================
echo ""
echo "📥 Baixando código MAIS RECENTE do GitHub..."
echo "   Incluindo todas as correções de perdas e timezone!"
echo ""
cd /root
git clone https://github.com/Betotradicao/TESTES-.git TESTES
cd TESTES

COMMIT_HASH=$(git log -1 --format='%h')
COMMIT_MSG=$(git log -1 --format='%s')
echo "✅ Código baixado: $COMMIT_HASH - $COMMIT_MSG"
echo ""

# Mostrar últimos 5 commits baixados
echo "📝 Últimas atualizações incluídas:"
git log --oneline -5 | sed 's/^/   /'
echo ""

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
# Data: $(date)
# Versão: Atualizada com correções de perdas/timezone
# ==========================================

# Backend
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://$HOST_IP:3000
JWT_SECRET=$(openssl rand -hex 32)

# IP Público da VPS
HOST_IP=$HOST_IP

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$POSTGRES_PASSWORD
DB_NAME=prevencao_db
POSTGRES_USER=postgres
POSTGRES_DB=prevencao_db
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

# Frontend
VITE_API_URL=http://$HOST_IP:3001/api

# API Token (Scanners)
API_TOKEN=$API_TOKEN

# Tailscale
TAILSCALE_CLIENT_IP=$TAILSCALE_CLIENT_IP
TAILSCALE_VPS_IP=$TAILSCALE_IP
TAILSCALE_IP=$TAILSCALE_IP

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
echo "   Isso pode demorar alguns minutos..."
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
# VERIFICAR USUÁRIO MASTER
# ============================================
echo ""
echo "👤 Verificando usuário master Roberto..."
MASTER_EXISTS=$(docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -tAc "SELECT EXISTS (SELECT FROM users WHERE \"isMaster\" = true);" 2>/dev/null || echo "false")

if [ "$MASTER_EXISTS" = "t" ]; then
    echo "✅ Usuário master Roberto criado automaticamente!"
    echo "   Usuário: Roberto"
    echo "   Senha: Beto3107@@##"
else
    echo "⚠️  AVISO: Usuário master não foi criado"
    echo "   Verifique os logs: docker logs prevencao-backend-prod"
fi

# ============================================
# RESULTADO FINAL
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 ACESSAR O SISTEMA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   📱 Interface Web (First Setup):"
echo "      http://$HOST_IP:3000/first-setup"
echo ""
echo "   🔌 Backend API:"
echo "      http://$HOST_IP:3001"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "👤 USUÁRIO MASTER (Para acesso emergencial):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Usuário: Roberto"
echo "   Senha: Beto3107@@##"
echo ""
echo "   ⚠️  Use APENAS em caso de emergência!"
echo "   ⚠️  O primeiro acesso deve ser em /first-setup"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 PRÓXIMOS PASSOS:"
echo ""
echo "   1. Acesse: http://$HOST_IP:3000/first-setup"
echo "   2. Preencha os dados da sua empresa"
echo "   3. Crie seu usuário administrador"
echo "   4. Faça login e configure os scanners"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 CREDENCIAIS GERADAS:"
echo ""
echo "   PostgreSQL:"
echo "      Porta: 5434"
echo "      Usuário: postgres"
echo "      Senha: $POSTGRES_PASSWORD"
echo ""
echo "   MinIO:"
echo "      Console: http://$HOST_IP:9011"
echo "      Usuário: $MINIO_ACCESS_KEY"
echo "      Senha: $MINIO_SECRET_KEY"
echo ""
echo "   💾 Salvas em: /root/prevencao-instalacao/.env"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🛠️  COMANDOS ÚTEIS:"
echo ""
echo "   Ver logs do backend:"
echo "   docker logs -f prevencao-backend-prod"
echo ""
echo "   Ver status dos containers:"
echo "   cd /root/TESTES/InstaladorVPS"
echo "   docker compose -f docker-compose-producao.yml ps"
echo ""
echo "   Reiniciar sistema:"
echo "   docker compose -f docker-compose-producao.yml restart"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Salvar informações de instalação
cat > /root/prevencao-instalacao/INSTALACAO-INFO.txt << EOF
╔════════════════════════════════════════════════════════════╗
║        INSTALAÇÃO PREVENÇÃO NO RADAR - INFORMAÇÕES        ║
║        Data: $(date)                           ║
╚════════════════════════════════════════════════════════════╝

🌐 IP PÚBLICO VPS: $HOST_IP
🔗 IP TAILSCALE VPS: ${TAILSCALE_IP:-Não configurado}
🖥️  IP TAILSCALE CLIENTE: ${TAILSCALE_CLIENT_IP:-Não configurado}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 INTERFACE WEB:
   http://$HOST_IP:3000/first-setup

🔌 BACKEND API:
   http://$HOST_IP:3001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 USUÁRIO MASTER (Emergência):
   Usuário: Roberto
   Senha: Beto3107@@##

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  POSTGRESQL:
   Host: $HOST_IP
   Porta: 5434
   Usuário: postgres
   Senha: $POSTGRES_PASSWORD
   Database: prevencao_db

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 MINIO:
   Console: http://$HOST_IP:9011
   Endpoint: $HOST_IP:9010
   Usuário: $MINIO_ACCESS_KEY
   Senha: $MINIO_SECRET_KEY
   Bucket: market-security

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 API TOKEN (Scanners):
   $API_TOKEN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 VERSÃO INSTALADA:
   Commit: $COMMIT_HASH
   Mensagem: $COMMIT_MSG

   Últimas atualizações:
$(git log --oneline -5 | sed 's/^/   /')

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  GUARDE ESTE ARQUIVO EM LOCAL SEGURO!
EOF

echo "💾 Informações completas salvas em: /root/prevencao-instalacao/INSTALACAO-INFO.txt"
echo ""
