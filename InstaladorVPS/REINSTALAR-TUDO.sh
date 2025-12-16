#!/bin/bash

##############################################
# Script Master de Reinstalação Completa
# Faz TUDO: permissões + limpeza + instalação
##############################################

set -e  # Para em caso de erro

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🔄 REINSTALAÇÃO COMPLETA - Prevenção no Radar           ║"
echo "║  ⚠️  Este script irá APAGAR TUDO e reinstalar do zero    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Detecta o diretório do script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Diretório de trabalho: $SCRIPT_DIR"
echo ""

# ====================
# ETAPA 1: PERMISSÕES
# ====================
echo "🔐 [1/4] Configurando permissões dos scripts..."
chmod +x LIMPAR-TOTAL.sh
chmod +x REINSTALAR-COMPLETO.sh
chmod +x INSTALAR-AUTO.sh
echo "   ✅ Permissões configuradas"
echo ""

# ====================
# ETAPA 2: CONFIRMAÇÃO
# ====================
echo "⚠️  [2/4] ATENÇÃO: Este processo irá:"
echo "   • Parar e remover todos os containers Docker"
echo "   • Apagar banco de dados PostgreSQL"
echo "   • Apagar arquivos do MinIO"
echo "   • Apagar arquivo .env"
echo "   • Reinstalar tudo do zero"
echo ""
read -p "Digite 'SIM' (maiúsculo) para confirmar: " confirmacao

if [ "$confirmacao" != "SIM" ]; then
    echo "❌ Operação cancelada pelo usuário"
    exit 1
fi

echo ""

# ====================
# ETAPA 3: LIMPEZA
# ====================
echo "🗑️  [3/4] Limpando sistema..."
./LIMPAR-TOTAL.sh <<< "SIM"
echo ""

# ====================
# ETAPA 4: INSTALAÇÃO
# ====================
echo "📦 [4/4] Instalando sistema do zero..."
echo ""

# Atualizar código do GitHub
echo "📥 Baixando última versão do GitHub..."
cd ..
git pull origin main
cd InstaladorVPS

echo ""
echo "🚀 Iniciando instalação..."
echo ""

# Rodar instalador
sudo ./INSTALAR-AUTO.sh

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ REINSTALAÇÃO COMPLETA FINALIZADA!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Acesse o sistema em:"
echo "   Frontend: http://$(hostname -I | awk '{print $1}'):3000"
echo "   Backend:  http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "🔑 Login padrão:"
echo "   Email: admin@admin.com"
echo "   Senha: admin"
echo ""
