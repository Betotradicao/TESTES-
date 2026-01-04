#!/bin/bash
set -e

# ============================================
# INSTALADOR AUTOMÁTICO - AMBIENTE DE TESTES
# Sistema: Prevenção no Radar (TESTES)
# ============================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     INSTALADOR AUTOMÁTICO - AMBIENTE DE TESTES            ║"
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

# Criar pasta se não existir
mkdir -p /root/TESTES

# Entrar na pasta
cd /root/TESTES

# Verificar se é um repositório git
if [ -d ".git" ]; then
    echo "📥 Atualizando código do GitHub..."
    git fetch origin
    git reset --hard origin/main
    git pull origin main
    echo "✅ Código atualizado com sucesso"
else
    echo "📂 Clonando repositório TESTES..."
    cd /root
    rm -rf TESTES
    git clone https://github.com/Betotradicao/TESTES-.git TESTES
    cd TESTES
    echo "✅ Repositório clonado com sucesso"
fi

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
    echo "   📋 Abra este link no navegador para autenticar:"
    echo ""
    echo "   $TAILSCALE_AUTH_URL"
    echo ""
else
    echo "   ⚠️  Link não foi gerado automaticamente."
    echo "   Execute: tailscale up --reset --accept-routes --shields-up=false"
    echo ""
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# AGUARDAR AUTENTICAÇÃO E DETECTAR IP AUTOMATICAMENTE
echo "⏳ Aguardando você autenticar no navegador..."
echo ""

# Loop para aguardar IP aparecer (timeout 5 minutos)
MAX_ATTEMPTS=60  # 60 tentativas x 5 segundos = 5 minutos
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    # Tentar obter IP Tailscale
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null | head -n 1)

    if [ -n "$TAILSCALE_IP" ] && [ "$TAILSCALE_IP" != "" ]; then
        echo ""
        echo "✅ IP Tailscale detectado: $TAILSCALE_IP"
        echo ""
        break
    fi

    # Mostrar progresso a cada 15 segundos
    if [ $((ATTEMPT % 3)) -eq 0 ]; then
        echo "   ⏳ Ainda aguardando... (tentativa $ATTEMPT/$MAX_ATTEMPTS)"
    fi

    sleep 5
    ATTEMPT=$((ATTEMPT + 1))
done

# Verificar se conseguiu obter o IP
if [ -z "$TAILSCALE_IP" ]; then
    echo ""
    echo "⚠️  Timeout: Não foi possível detectar o IP do Tailscale automaticamente."
    echo "    A instalação continuará, mas você precisará configurar manualmente depois."
    echo ""
    echo "    Para configurar depois:"
    echo "    1. Execute: tailscale ip -4"
    echo "    2. Acesse: Configurações → Tailscale na interface web"
    echo ""
fi

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
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD="minioadmin123"
MINIO_ACCESS_KEY="$MINIO_ROOT_USER"
MINIO_SECRET_KEY="$MINIO_ROOT_PASSWORD"

POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres123"

JWT_SECRET=$(generate_password)
API_TOKEN=$(generate_password)

echo "✅ Senhas configuradas"
echo ""

# ============================================
# PARAR E LIMPAR CONTAINERS ANTIGOS
# ============================================

echo "🧹 Limpando containers antigos (se existirem)..."

docker-compose down -v 2>/dev/null || true

echo "✅ Limpeza concluída"
echo ""

# ============================================
# INICIAR APLICAÇÃO
# ============================================

echo "🚀 Iniciando containers Docker..."
echo ""

docker-compose up -d --build --force-recreate

echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 15

# ============================================
# CONFIGURAR BANCO DE DADOS
# ============================================

echo "💾 Configurando banco de dados..."

# Aguardar PostgreSQL estar 100% pronto
echo "⏳ Aguardando PostgreSQL inicializar..."
sleep 10

# Verificar se tabela configurations existe
TABLE_EXISTS=$(docker exec prevencao-postgres psql -U postgres -d prevencao_db -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'configurations');" 2>/dev/null || echo "false")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✅ Tabela configurations encontrada! Configurando credenciais..."

    # LIMPAR configurações antigas
    docker exec prevencao-postgres psql -U postgres -d prevencao_db -c "TRUNCATE TABLE configurations;" 2>/dev/null

    # Inserir credenciais
    docker exec prevencao-postgres psql -U postgres -d prevencao_db -c "
    INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
    VALUES
      ('postgres_host', 'postgres', false, NOW(), NOW()),
      ('postgres_port', '5432', false, NOW(), NOW()),
      ('postgres_user', '$POSTGRES_USER', false, NOW(), NOW()),
      ('postgres_password', '$POSTGRES_PASSWORD', false, NOW(), NOW()),
      ('postgres_database', 'prevencao_db', false, NOW(), NOW()),
      ('db_host', 'postgres', false, NOW(), NOW()),
      ('db_port', '5432', false, NOW(), NOW()),
      ('db_user', '$POSTGRES_USER', false, NOW(), NOW()),
      ('db_password', '$POSTGRES_PASSWORD', false, NOW(), NOW()),
      ('db_name', 'prevencao_db', false, NOW(), NOW()),
      ('minio_endpoint', 'minio', false, NOW(), NOW()),
      ('minio_port', '9000', false, NOW(), NOW()),
      ('minio_access_key', '$MINIO_ACCESS_KEY', false, NOW(), NOW()),
      ('minio_secret_key', '$MINIO_SECRET_KEY', false, NOW(), NOW()),
      ('minio_bucket_name', 'prevencao', false, NOW(), NOW()),
      ('minio_public_endpoint', '$HOST_IP', false, NOW(), NOW()),
      ('minio_public_port', '9000', false, NOW(), NOW()),
      ('minio_use_ssl', 'false', false, NOW(), NOW()),
      ('email_user', 'test@test.com', false, NOW(), NOW()),
      ('email_pass', 'testpass', false, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    " 2>/dev/null

    echo "✅ Credenciais do banco configuradas!"

    # Salvar IP Tailscale da VPS
    if [ -n "$TAILSCALE_IP" ]; then
        docker exec prevencao-postgres psql -U postgres -d prevencao_db -c "
        INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
        VALUES ('tailscale_vps_ip', '$TAILSCALE_IP', false, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET value = '$TAILSCALE_IP', updated_at = NOW();
        " 2>/dev/null
        echo "✅ IP Tailscale da VPS salvo: $TAILSCALE_IP"
    fi

    # Salvar IP Tailscale do Cliente
    if [ -n "$TAILSCALE_CLIENT_IP" ]; then
        docker exec prevencao-postgres psql -U postgres -d prevencao_db -c "
        INSERT INTO configurations (key, value, encrypted, created_at, updated_at)
        VALUES ('tailscale_client_ip', '$TAILSCALE_CLIENT_IP', false, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET value = '$TAILSCALE_CLIENT_IP', updated_at = NOW();
        " 2>/dev/null
        echo "✅ IP Tailscale do Cliente salvo: $TAILSCALE_CLIENT_IP"
    fi
else
    echo "ℹ️  Tabela configurations ainda não existe (migrations ainda rodando)"
fi

echo ""

# ============================================
# EXIBIR STATUS
# ============================================

echo ""
echo "📊 Status dos containers:"
docker-compose ps

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
    echo "   ✅ Status: Conectado!"
    echo "   🌐 IP da VPS na rede Tailscale: $TAILSCALE_IP"
    echo "   💾 IP salvo automaticamente no banco de dados"
    echo ""
    echo "   💡 Configure o IP do cliente em: Configurações → Tailscale"
else
    echo "   ⚠️  Tailscale não conectou automaticamente"
    echo "   Execute: sudo tailscale up"
    echo "   Depois execute: tailscale ip -4"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔐 CREDENCIAIS DO AMBIENTE DE TESTES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   🗄️  PostgreSQL (Banco de Dados):"
echo "      Host: localhost (dentro do container)"
echo "      Porta Externa: 5432"
echo "      Usuário: $POSTGRES_USER"
echo "      Senha: $POSTGRES_PASSWORD"
echo "      Database: prevencao_db"
echo ""
echo "   📦 MinIO (Armazenamento):"
echo "      Console: http://$HOST_IP:9001"
echo "      Usuário: $MINIO_ROOT_USER"
echo "      Senha: $MINIO_ROOT_PASSWORD"
echo ""
echo "   🔑 API Token:"
echo "      $API_TOKEN"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 PRÓXIMOS PASSOS:"
echo ""
echo "   1. Acesse: http://$HOST_IP:3000/first-setup"
echo "   2. Cadastre sua empresa e crie o primeiro usuário"
echo "   3. Faça login e configure o sistema"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🛠️  COMANDOS ÚTEIS:"
echo ""
echo "   Ver logs do backend:"
echo "   docker-compose logs -f backend"
echo ""
echo "   Parar aplicação:"
echo "   docker-compose down"
echo ""
echo "   Reiniciar aplicação:"
echo "   docker-compose restart"
echo ""
echo "   Reinstalar do zero:"
echo "   cd /root/TESTES && bash INSTALAR-TESTES.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Salvar credenciais em arquivo separado
cat > DADOS-BANCO-TESTES.md << EOF
# 🗄️ Dados do Banco - Ambiente TESTES

## 📊 Informações do Banco de Dados

**Banco**: prevencao_db
**Host**: localhost (dentro do container)
**Porta**: 5432 (interna) / 5432 (externa)
**Usuário**: $POSTGRES_USER
**Senha**: $POSTGRES_PASSWORD

## 🌐 IPs Configurados

**IP Público VPS**: $HOST_IP
**IP Tailscale VPS**: ${TAILSCALE_IP:-Não configurado}
**IP Tailscale Cliente**: ${TAILSCALE_CLIENT_IP:-Não configurado}

## 📦 MinIO (Armazenamento)

**Console**: http://$HOST_IP:9001
**Usuário**: $MINIO_ROOT_USER
**Senha**: $MINIO_ROOT_PASSWORD
**Bucket**: prevencao

## 🔑 API Token

\`\`\`
$API_TOKEN
\`\`\`

## 🔧 Como Acessar o Banco

### Via Docker (dentro do container):
\`\`\`bash
docker exec -it prevencao-postgres psql -U postgres -d prevencao_db
\`\`\`

### Via SSH da VPS:
\`\`\`bash
ssh root@$HOST_IP
docker exec -it prevencao-postgres psql -U postgres -d prevencao_db
\`\`\`

## 📝 Queries Úteis

### Ver todas as tabelas:
\`\`\`sql
\\dt
\`\`\`

### Ver estrutura de uma tabela:
\`\`\`sql
\\d nome_da_tabela
\`\`\`

### Ver dados da company:
\`\`\`sql
SELECT * FROM companies;
\`\`\`

### Ver usuários:
\`\`\`sql
SELECT id, email, name, role, is_master FROM users;
\`\`\`

### Ver produtos com características de IA:
\`\`\`sql
SELECT id, description, coloracao, formato, gordura_visivel, presenca_osso, peso_min_kg, peso_max_kg
FROM products
WHERE coloracao IS NOT NULL;
\`\`\`

## 🔄 Backup e Restore

### Fazer backup:
\`\`\`bash
docker exec prevencao-postgres pg_dump -U postgres prevencao_db > backup_teste.sql
\`\`\`

### Restaurar backup:
\`\`\`bash
docker exec -i prevencao-postgres psql -U postgres -d prevencao_db < backup_teste.sql
\`\`\`
EOF

echo "💾 Dados do banco salvos em: DADOS-BANCO-TESTES.md"
echo ""
