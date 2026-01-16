#!/bin/bash
set -e

# Redirecionar stdin para o terminal se estiver sendo executado via pipe
if [ ! -t 0 ]; then
    exec < /dev/tty
fi

# ============================================
# INSTALADOR AUTOMÁTICO - VPS LINUX
# Sistema: Prevenção no Radar
# Versão: 2.0 (Sem Tailscale)
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     INSTALADOR AUTOMÁTICO - PREVENÇÃO NO RADAR (VPS)      ║"
echo "║                    Versão 2.0 - Sem Tailscale              ║"
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
# DETECTAR DIRETÓRIO CORRETO
# ============================================

echo "🔄 Verificando estrutura do projeto..."

# Salvar diretório do script ANTES de mudar de diretório
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Verificar se estamos dentro do repositório (InstaladorVPS deve estar dentro de um repo)
REPO_ROOT=""

# Tentar ir para raiz do repositório
if [ -d "$SCRIPT_DIR/../.git" ]; then
    # Estamos em um repositório (caminho normal: repo/InstaladorVPS)
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    echo "✅ Repositório git encontrado: $REPO_ROOT"

    # Atualizar código do GitHub
    cd "$REPO_ROOT"
    echo "📥 Atualizando código do GitHub..."
    git fetch origin
    git reset --hard origin/main
    git pull origin main
    echo "✅ Código atualizado com sucesso"

    # Voltar para InstaladorVPS
    cd "$SCRIPT_DIR"

    # Re-executar o script atualizado
    echo "🔄 Re-executando instalador atualizado..."
    exec bash "$SCRIPT_DIR/INSTALAR-AUTO.sh"
else
    # Script rodando fora do repositório - CLONAR AGORA
    echo "⚠️  Script não está dentro de um repositório git"
    echo "📥 Clonando repositório do GitHub..."

    cd /root

    # Remover instalação antiga se existir
    if [ -d "prevencao-radar-install" ]; then
        echo "🧹 Removendo instalação antiga..."
        rm -rf prevencao-radar-install
    fi

    # Clonar repositório
    git clone https://github.com/Betotradicao/TESTES-.git prevencao-radar-install

    if [ $? -ne 0 ]; then
        echo "❌ Erro ao clonar repositório!"
        exit 1
    fi

    echo "✅ Repositório clonado com sucesso"

    # Ir para o diretório do instalador
    cd prevencao-radar-install/InstaladorVPS
    SCRIPT_DIR="$(pwd)"
    REPO_ROOT="$(cd .. && pwd)"

    echo "✅ Redirecionado para: $SCRIPT_DIR"
fi

# Verificar se estamos no diretório correto (deve ter docker-compose-producao.yml)
if [ ! -f "docker-compose-producao.yml" ]; then
    echo ""
    echo "❌ ERRO: docker-compose-producao.yml não encontrado!"
    echo "📂 Diretório atual: $(pwd)"
    echo ""
    echo "💡 SOLUÇÃO: Execute o instalador da seguinte forma:"
    echo ""
    echo "   cd /root"
    echo "   git clone https://github.com/Betotradicao/TESTES-.git prevencao-radar-install"
    echo "   cd prevencao-radar-install/InstaladorVPS"
    echo "   sudo bash INSTALAR-AUTO.sh"
    echo ""
    exit 1
fi

# Verificar se packages/ existe (crítico)
if [ ! -d "../packages/backend" ] || [ ! -d "../packages/frontend" ]; then
    echo ""
    echo "❌ ERRO: Diretórios packages/backend ou packages/frontend não encontrados!"
    echo "📂 Diretório raiz: $REPO_ROOT"
    echo ""
    echo "💡 O repositório pode estar incompleto. Clone novamente:"
    echo ""
    echo "   cd /root"
    echo "   rm -rf prevencao-radar-install"
    echo "   git clone https://github.com/Betotradicao/TESTES-.git prevencao-radar-install"
    echo "   cd prevencao-radar-install/InstaladorVPS"
    echo "   sudo bash INSTALAR-AUTO.sh"
    echo ""
    exit 1
fi

echo "✅ Diretório de instalação: $SCRIPT_DIR"
echo "✅ Estrutura validada: packages/backend e packages/frontend encontrados"
echo ""

# ============================================
# DETECÇÃO AUTOMÁTICA DE IP DA VPS
# ============================================

echo "🔍 Detectando IP público da VPS..."

# Tentar múltiplos serviços para obter IP público IPv4
HOST_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || curl -4 -s ipinfo.io/ip || echo "")

if [ -z "$HOST_IP" ]; then
    echo "⚠️  Não foi possível detectar o IP automaticamente"
    read -p "Digite o IP público desta VPS: " HOST_IP
fi

echo "✅ IP da VPS detectado: $HOST_IP"
echo ""

# ============================================
# CONFIGURAÇÃO DOS NOMES (BANCO E BUCKET)
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  CONFIGURAÇÃO DO BANCO DE DADOS E ARMAZENAMENTO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Nome do banco de dados PostgreSQL
echo "📊 Nome do Banco de Dados PostgreSQL"
echo "   (Pressione ENTER para usar o padrão: prevencao_db)"
read -p "Nome do banco: " DB_NAME_INPUT < /dev/tty
DB_NAME_INPUT=$(echo "$DB_NAME_INPUT" | xargs)

if [ -n "$DB_NAME_INPUT" ]; then
    POSTGRES_DB_NAME="$DB_NAME_INPUT"
    echo "✅ Nome do banco: $POSTGRES_DB_NAME"
else
    POSTGRES_DB_NAME="prevencao_db"
    echo "✅ Usando padrão: $POSTGRES_DB_NAME"
fi

echo ""

# Nome do bucket MinIO
echo "📦 Nome do Bucket MinIO (Armazenamento de Imagens)"
echo "   (Pressione ENTER para usar o padrão: market-security)"
read -p "Nome do bucket: " BUCKET_NAME_INPUT < /dev/tty
BUCKET_NAME_INPUT=$(echo "$BUCKET_NAME_INPUT" | xargs)

if [ -n "$BUCKET_NAME_INPUT" ]; then
    MINIO_BUCKET="$BUCKET_NAME_INPUT"
    echo "✅ Nome do bucket: $MINIO_BUCKET"
else
    MINIO_BUCKET="market-security"
    echo "✅ Usando padrão: $MINIO_BUCKET"
fi

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
# Versão: 2.0 (Sem Tailscale)
# ============================================

# IP da VPS
HOST_IP=$HOST_IP

# ============================================
# MINIO - Armazenamento de Arquivos
# ============================================
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET_NAME=$MINIO_BUCKET
MINIO_PUBLIC_ENDPOINT=$HOST_IP
MINIO_PUBLIC_PORT=9010
MINIO_PUBLIC_USE_SSL=false

# ============================================
# POSTGRESQL - Banco de Dados
# ============================================
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB_NAME

# Conexão do Backend ao PostgreSQL (interno Docker)
DB_HOST=postgres
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
FRONTEND_URL=http://$HOST_IP:3000

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
# AGUARDAR BACKEND INICIALIZAR
# ============================================

echo "🚀 Aguardando backend inicializar e criar configurações..."
echo ""
echo "ℹ️  O backend irá automaticamente:"
echo "   • Criar tabelas do banco de dados (migrations)"
echo "   • Popular configurações com dados do .env (seed)"
echo "   • Criar usuário MASTER (Roberto)"
echo ""

# Aguardar backend estar respondendo
MAX_TRIES=60  # 2 minutos
TRY=0
while [ $TRY -lt $MAX_TRIES ]; do
    # Verificar se backend responde na rota de health
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Backend inicializado com sucesso!"
        echo ""
        break
    fi

    # Mostrar progresso a cada 5 segundos
    if [ $((TRY % 5)) -eq 0 ]; then
        echo "   Aguardando backend... (${TRY}s / 120s)"
    fi

    sleep 2
    TRY=$((TRY + 2))
done

if [ $TRY -ge $MAX_TRIES ]; then
    echo "⚠️  Backend demorou para responder, mas pode estar inicializando ainda..."
    echo "   Você pode verificar os logs com:"
    echo "   docker logs prevencao-backend-prod -f"
    echo ""
fi

echo "✅ Sistema configurado automaticamente pelo backend!"
echo ""

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
echo "🔐 CREDENCIAIS GERADAS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   📦 MinIO (Armazenamento):"
echo "      Console: http://$HOST_IP:9011"
echo "      Usuário: $MINIO_ROOT_USER"
echo "      Senha: $MINIO_ROOT_PASSWORD"
echo "      Bucket: $MINIO_BUCKET"
echo ""
echo "   🗄️  PostgreSQL (Banco de Dados):"
echo "      Host: $HOST_IP"
echo "      Porta: 5434"
echo "      Usuário: $POSTGRES_USER"
echo "      Senha: $POSTGRES_PASSWORD"
echo "      Database: $POSTGRES_DB_NAME"
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
║           Gerado em: $(date)
║           Versão: 2.0 (Sem Tailscale)                      ║
╚════════════════════════════════════════════════════════════╝

🌐 IP PÚBLICO DA VPS: $HOST_IP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 FRONTEND (Interface Web):
   URL: http://$HOST_IP:3000

🔌 BACKEND (API):
   URL: http://$HOST_IP:3001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 MINIO (Armazenamento de Arquivos):
   Console: http://$HOST_IP:9011
   API Endpoint: $HOST_IP
   API Port: 9010
   Usuário: $MINIO_ROOT_USER
   Senha: $MINIO_ROOT_PASSWORD
   Bucket: $MINIO_BUCKET

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  POSTGRESQL (Banco de Dados):
   Host: $HOST_IP
   Porta Externa: 5434
   Usuário: $POSTGRES_USER
   Senha: $POSTGRES_PASSWORD
   Database: $POSTGRES_DB_NAME

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 API TOKEN (para scanners):
   $API_TOKEN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  GUARDE ESTE ARQUIVO EM LOCAL SEGURO!
EOF

echo "💾 Credenciais também salvas em: $(pwd)/CREDENCIAIS.txt"
echo ""
