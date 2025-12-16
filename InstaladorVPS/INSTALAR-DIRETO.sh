#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🚀 INSTALAÇÃO AUTOMÁTICA - SEM CONFIRMAÇÃO                   ║"
echo "║   Prevenção no Radar                                          ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Detectar diretório do projeto
PROJECT_DIR="$HOME/roberto-prevencao-no-radar-main"

# ============================================
# LIMPEZA COMPLETA
# ============================================

echo "🧹 Limpando instalação anterior..."
echo ""

# Parar containers
cd "$PROJECT_DIR/InstaladorVPS" 2>/dev/null && docker compose -f docker-compose-producao.yml down -v 2>/dev/null || true

# Remover containers relacionados
docker ps -a | grep prevencao | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true

# Remover volumes
docker volume ls | grep prevencao | awk '{print $2}' | xargs -r docker volume rm 2>/dev/null || true

# Limpar imagens antigas
docker image prune -af 2>/dev/null || true

echo "✅ Limpeza concluída"
echo ""

# ============================================
# ATUALIZAR CÓDIGO
# ============================================

echo "📥 Atualizando código do GitHub..."

cd "$PROJECT_DIR"
git fetch origin
git reset --hard origin/main
git pull origin main

echo "✅ Código atualizado"
echo ""

# ============================================
# EXECUTAR INSTALADOR
# ============================================

echo "🚀 Iniciando instalação automática..."
echo ""

cd "$PROJECT_DIR/InstaladorVPS"
bash INSTALAR-AUTO.sh

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║            ✅ INSTALAÇÃO CONCLUÍDA!                            ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
