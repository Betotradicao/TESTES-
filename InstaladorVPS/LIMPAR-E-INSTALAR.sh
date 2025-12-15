#!/bin/bash

################################################################################
# SCRIPT DE LIMPEZA TOTAL E INSTALAÇÃO DO ZERO
# Prevenção no Radar - VPS Installer
#
# Este script:
# 1. Remove TUDO relacionado ao projeto
# 2. Remove Docker completamente (opcional)
# 3. Reinstala Docker
# 4. Instala o sistema do zero
#
# USO: sudo bash LIMPAR-E-INSTALAR.sh
################################################################################

set -e  # Parar em caso de erro

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🧹 LIMPEZA TOTAL + INSTALAÇÃO COMPLETA                       ║"
echo "║   Prevenção no Radar - VPS Installer                          ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Confirmar com o usuário
echo "⚠️  ATENÇÃO: Este script vai:"
echo "   1. Parar e remover TODOS os containers Docker"
echo "   2. Remover TODOS os volumes e dados"
echo "   3. Remover o diretório do projeto"
echo "   4. Limpar cache do Docker"
echo "   5. Reinstalar o sistema do ZERO"
echo ""
read -p "Deseja continuar? (digite 'SIM' para confirmar): " confirm

if [ "$confirm" != "SIM" ]; then
    echo "❌ Operação cancelada pelo usuário."
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🧹 ETAPA 1/5: Parando e removendo containers..."
echo "════════════════════════════════════════════════════════════════"

# Parar e remover containers do projeto (se existirem)
if [ -d ~/NOVO-PREVEN-O/InstaladorVPS ]; then
    cd ~/NOVO-PREVEN-O/InstaladorVPS
    if [ -f docker-compose-producao.yml ]; then
        echo "🛑 Parando containers..."
        docker compose -f docker-compose-producao.yml down -v 2>/dev/null || true
    fi
fi

# Parar TODOS os containers Docker
echo "🛑 Parando TODOS os containers Docker..."
docker stop $(docker ps -aq) 2>/dev/null || true

# Remover TODOS os containers
echo "🗑️  Removendo TODOS os containers..."
docker rm -f $(docker ps -aq) 2>/dev/null || true

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🧹 ETAPA 2/5: Removendo volumes, imagens e cache..."
echo "════════════════════════════════════════════════════════════════"

# Remover TODOS os volumes
echo "🗑️  Removendo TODOS os volumes..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true

# Limpar TUDO do Docker (imagens, cache, build cache, networks)
echo "🧹 Limpando cache e imagens do Docker..."
docker system prune -a --volumes -f 2>/dev/null || true

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🧹 ETAPA 3/5: Removendo diretório do projeto..."
echo "════════════════════════════════════════════════════════════════"

# Remover diretório do projeto
if [ -d ~/NOVO-PREVEN-O ]; then
    echo "🗑️  Removendo ~/NOVO-PREVEN-O..."
    rm -rf ~/NOVO-PREVEN-O
    echo "✅ Diretório removido"
else
    echo "ℹ️  Diretório não existe, pulando..."
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📦 ETAPA 4/5: Verificando dependências..."
echo "════════════════════════════════════════════════════════════════"

# Atualizar sistema
echo "📦 Atualizando lista de pacotes..."
apt-get update -qq

# Verificar e instalar Git
if ! command -v git &> /dev/null; then
    echo "📦 Instalando Git..."
    apt-get install -y git
    echo "✅ Git instalado"
else
    echo "✅ Git já instalado"
fi

# Verificar e instalar Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker $USER
    echo "✅ Docker instalado"
else
    echo "✅ Docker já instalado"
fi

# Verificar e instalar Docker Compose
if ! docker compose version &> /dev/null; then
    echo "📦 Instalando Docker Compose..."
    apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose instalado"
else
    echo "✅ Docker Compose já instalado"
fi

# Garantir que Docker está rodando
echo "🔄 Iniciando Docker..."
systemctl start docker
systemctl enable docker

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🚀 ETAPA 5/5: Instalando sistema do ZERO..."
echo "════════════════════════════════════════════════════════════════"

# Clonar repositório
echo "📥 Clonando repositório..."
cd ~
git clone https://github.com/Betotradicao/NOVO-PREVEN-O.git
echo "✅ Repositório clonado"

# Entrar no diretório
cd ~/NOVO-PREVEN-O/InstaladorVPS

# Dar permissão de execução
echo "🔑 Dando permissão de execução..."
chmod +x INSTALAR-AUTO.sh

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ LIMPEZA CONCLUÍDA!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🚀 Iniciando instalador automático em 3 segundos..."
echo ""
sleep 3

# Executar instalador
./INSTALAR-AUTO.sh
