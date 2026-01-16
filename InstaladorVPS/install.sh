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

# Verificar se Git está instalado
if ! command -v git &> /dev/null; then
    echo "📦 Instalando Git..."
    apt-get update -qq
    apt-get install -y -qq git
    echo "✅ Git instalado"
fi
echo ""

# ============================================
# ATUALIZAR CÓDIGO DO GITHUB
# ============================================

echo "🔄 Verificando atualizações do código..."

# Branch a ser usada
BRANCH="TESTE"

# Verificar se já está em um repositório
if [ -d ".git" ]; then
    echo "📥 Atualizando código do GitHub (branch $BRANCH)..."
    git fetch origin
    git checkout $BRANCH 2>/dev/null || git checkout -b $BRANCH origin/$BRANCH
    git reset --hard origin/$BRANCH
    git pull origin $BRANCH
    REPO_ROOT=$(pwd)
    echo "✅ Código atualizado com sucesso"
else
    # Não está em repositório, precisa clonar
    echo "📦 Clonando repositório do GitHub (branch $BRANCH)..."

    # Criar diretório temporário
    INSTALL_DIR="/root/prevencao-radar-install"

    # Remover se já existir
    rm -rf "$INSTALL_DIR"

    # Clonar repositório na branch correta
    git clone -b $BRANCH https://github.com/Betotradicao/TESTES-.git "$INSTALL_DIR"

    # Ir para o diretório clonado
    cd "$INSTALL_DIR"
    REPO_ROOT=$(pwd)

    echo "✅ Repositório clonado com sucesso (branch $BRANCH)"
fi

# Ir para diretório do instalador
SCRIPT_DIR="$REPO_ROOT/InstaladorVPS"
cd "$SCRIPT_DIR"

echo "📂 Diretório de trabalho: $(pwd)"
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
# CONFIGURAÇÃO DOS NOMES
# ============================================

echo "🏷️  Configuração dos Nomes"
echo ""
echo "Pressione ENTER para usar os nomes padrão."
echo ""

# Nome do banco de dados PostgreSQL
read -p "Nome do Banco de Dados PostgreSQL [prevencao_db]: " POSTGRES_DB_NAME </dev/tty
POSTGRES_DB_NAME=${POSTGRES_DB_NAME:-prevencao_db}
echo "✅ Banco de Dados: $POSTGRES_DB_NAME"

# Nome do bucket MinIO
read -p "Nome do Bucket MinIO [market-security]: " MINIO_BUCKET_NAME </dev/tty
MINIO_BUCKET_NAME=${MINIO_BUCKET_NAME:-market-security}
echo "✅ Bucket MinIO: $MINIO_BUCKET_NAME"

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
# MINIO - Armazenamento de Arquivos
# ============================================
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET_NAME=$MINIO_BUCKET_NAME
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

# Garantir que estamos no diretório correto
cd "$SCRIPT_DIR"

# Parar containers de produção anteriores
docker compose -f docker-compose-producao.yml down -v 2>/dev/null || true

# Parar TODOS os containers prevencao que possam estar rodando
echo "🔍 Verificando containers avulsos..."
docker stop $(docker ps -a -q --filter "name=prevencao" --filter "name=-prod") 2>/dev/null || true
docker rm $(docker ps -a -q --filter "name=prevencao" --filter "name=-prod") 2>/dev/null || true

echo "✅ Limpeza concluída"
echo ""

# ============================================
# CONFIGURAR TIMEZONE DO SERVIDOR
# ============================================

echo "🌍 Configurando timezone para Brasil (America/Sao_Paulo)..."

# Verificar se timedatectl está disponível
if command -v timedatectl &> /dev/null; then
    timedatectl set-timezone America/Sao_Paulo 2>/dev/null || true
    echo "✅ Timezone configurado: $(timedatectl | grep 'Time zone' | awk '{print $3}')"
else
    # Fallback para sistemas sem systemd
    ln -sf /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime 2>/dev/null || true
    echo "✅ Timezone configurado: America/Sao_Paulo"
fi

echo "📅 Data/Hora atual: $(date)"
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
# CRIAR TABELAS DO BANCO DE DADOS
# ============================================

echo ""
echo "📊 Criando tabelas do banco de dados..."

# Aguardar backend estar pronto
sleep 5

# Criar script para inicializar o banco com synchronize
cat > /tmp/init-database.js << 'ENDOFSCRIPT'
const { AppDataSource } = require('./dist/config/database');

// Criar nova instância com synchronize ativo
const options = { ...AppDataSource.options, synchronize: true, migrations: [] };
const { DataSource } = require('typeorm');
const dataSource = new DataSource(options);

dataSource.initialize()
  .then(async () => {
    console.log('✅ Tabelas criadas com sucesso');
    await dataSource.destroy();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro ao criar tabelas:', err.message);
    process.exit(1);
  });
ENDOFSCRIPT

# Executar criação de tabelas
docker cp /tmp/init-database.js prevencao-backend-prod:/app/init-database.js 2>/dev/null
docker exec prevencao-backend-prod node /app/init-database.js 2>/dev/null || echo "⚠️  Tabelas já existem ou erro ao criar"

# Limpar arquivo temporário
rm -f /tmp/init-database.js

# Registrar todas as migrations como já executadas para evitar conflitos
echo "📝 Registrando migrations no banco..."
docker exec -i prevencao-postgres-prod psql -U postgres -d prevencao_db << 'EOSQL' > /dev/null 2>&1
INSERT INTO migrations (timestamp, name) VALUES
  (1735566000000, 'AddIACharacteristicsToProducts1735566000000'),
  (1758045672125, 'CreateUsersTable1758045672125'),
  (1758062371000, 'CreateBipsTable1758062371000'),
  (1758080000000, 'CreateProductsTable1758080000000'),
  (1758080001000, 'CreateProductActivationHistoryTable1758080001000'),
  (1758090000000, 'CreateSellsTable1758090000000'),
  (1758161394993, 'AddNumCupomFiscalToSells1758161394993'),
  (1758229581610, 'AddCancelledStatusToBips1758229581610'),
  (1758394113356, 'AddUniqueIndexToSells1758394113356'),
  (1758749391000, 'AddCancelledStatusToSells1758749391000'),
  (1758756405482, 'AddDiscountCentsToSells1758756405482'),
  (1758923139254, 'AlterSellDateToTimestamp1758923139254'),
  (1759074839394, 'AddNotifiedAtToBips1759074839394'),
  (1759078749185, 'ChangeNotifiedToNotVerified1759078749185'),
  (1759200000000, 'CreateSectorsTable1759200000000'),
  (1759493626143, 'CreateEquipmentsTable1759493626143'),
  (1759496345428, 'AddEquipmentIdToBips1759496345428'),
  (1759496400000, 'AddPointOfSaleCodeToSells1759496400000'),
  (1759500000000, 'CreateEmployeesTable1759500000000'),
  (1759600000000, 'CreateEquipmentSessionsTable1759600000000'),
  (1759700000000, 'AddEmployeeIdToBips1759700000000'),
  (1765080280169, 'CreateConfigurationsTable1765080280169'),
  (1765200000000, 'CreateCompaniesAndUpdateUsers1765200000000'),
  (1765300000000, 'AddPortNumberToEquipments1765300000000'),
  (1765400000000, 'AddMotivoCancelamentoToBips1765400000000'),
  (1765400000000, 'AddVideoUrlToBips1765400000000'),
  (1765500000000, 'AddEmployeeResponsavelToBips1765500000000'),
  (1765500000000, 'AddImageUrlToBips1765500000000'),
  (1765563000000, 'AddCompanyFields1765563000000'),
  (1765570000000, 'AddMissingFieldsToUsers1765570000000'),
  (1765580000000, 'AddAddressFieldsToCompanies1765580000000'),
  (1765600000000, 'CreateEmailMonitorLogsTable1765600000000'),
  (1765700000000, 'AddImagePathToEmailMonitorLogs1765700000000'),
  (1765800000000, 'AddValidacaoIAToBips1765800000000'),
  (1765900000000, 'AddIACharacteristicsToProducts1765900000000'),
  (1735600000000, 'CreateRuptureTables1735600000000'),
  (1736900000000, 'CreateHortFrutTables1736900000000')
ON CONFLICT DO NOTHING;
EOSQL

echo "✅ Banco de dados inicializado"

# ============================================
# CORRIGIR CONFIGURAÇÕES MINIO NO BANCO
# ============================================

echo ""
echo "🔧 Corrigindo configurações MinIO no banco de dados..."

# Criar script temporário para corrigir MinIO config
cat > /tmp/fix-minio-config.js << 'ENDOFSCRIPT'
const { AppDataSource } = require('./dist/config/database');
const { Configuration } = require('./dist/entities/Configuration');

AppDataSource.initialize().then(async () => {
  const repo = AppDataSource.getRepository(Configuration);

  // Atualizar configurações MinIO para usar rede interna Docker
  await repo.update({ key: 'minio_endpoint' }, { value: 'minio' });
  await repo.update({ key: 'minio_port' }, { value: '9000' });

  console.log('✅ Configurações MinIO atualizadas para rede interna Docker');
  process.exit(0);
}).catch(err => {
  console.error('❌ Erro ao atualizar configurações:', err.message);
  process.exit(1);
});
ENDOFSCRIPT

# Copiar script para container e executar
docker cp /tmp/fix-minio-config.js prevencao-backend-prod:/app/fix-minio-config.js 2>/dev/null
docker exec prevencao-backend-prod node /app/fix-minio-config.js 2>/dev/null

# Reiniciar backend para aplicar mudanças
echo "🔄 Reiniciando backend para aplicar configurações..."
docker restart prevencao-backend-prod > /dev/null 2>&1
sleep 5

# Limpar arquivo temporário
rm -f /tmp/fix-minio-config.js

# ============================================
# CRIAR USUÁRIO MASTER PADRÃO
# ============================================

echo ""
echo "👤 Criando usuário master padrão..."

# Executar script de criação do usuário master dentro do container
docker exec prevencao-backend-prod npm run create-master-user 2>&1 || echo "⚠️  Aviso: Erro ao criar usuário master (pode já existir)"

echo "✅ Usuário master configurado"
echo "   Username: Roberto"
echo "   Senha: Beto3107@@##"

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
║           Gerado em: $(date)
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
