#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🚀 INSTALAÇÃO RÁPIDA - PREVENÇÃO NO RADAR                    ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Detectar diretório do projeto
PROJECT_DIR="$HOME/roberto-prevencao-no-radar-main"

# ============================================
# CONFIRMAÇÃO DE LIMPEZA
# ============================================

echo "⚠️  ATENÇÃO: Este script vai reinstalar o sistema do ZERO."
echo ""
read -p "Deseja EXCLUIR tudo e reinstalar? (SIM/não): " CONFIRMA_LIMPEZA
echo ""

if [ "$CONFIRMA_LIMPEZA" != "SIM" ]; then
  echo "❌ Instalação cancelada pelo usuário."
  exit 0
fi

# ============================================
# LIMPEZA COMPLETA
# ============================================

echo "🧹 Limpando instalação anterior..."
echo ""

# Parar containers se existirem
if [ -d "$PROJECT_DIR/InstaladorVPS" ]; then
  cd "$PROJECT_DIR/InstaladorVPS" && docker compose -f docker-compose-producao.yml down -v 2>/dev/null || true
fi

# Remover containers relacionados
docker ps -a | grep prevencao | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true

# Remover volumes
docker volume ls | grep prevencao | awk '{print $2}' | xargs -r docker volume rm 2>/dev/null || true

# Limpar imagens antigas
docker image prune -af 2>/dev/null || true

# Remover diretório antigo
if [ -d "$PROJECT_DIR" ]; then
  rm -rf "$PROJECT_DIR"
fi

echo "✅ Limpeza concluída"
echo ""

# ============================================
# CLONAR REPOSITÓRIO
# ============================================

echo "📥 Clonando repositório do GitHub..."
cd "$HOME"
git clone https://github.com/Betotradicao/NOVO-PREVEN-O.git roberto-prevencao-no-radar-main
echo "✅ Repositório clonado"
echo ""

# ============================================
# CONFIGURAÇÃO DO TAILSCALE DO CLIENTE
# ============================================

echo "🏪 Configuração do Cliente (Loja)"
echo ""
echo "Se o cliente possui Tailscale instalado na máquina onde roda o ERP,"
echo "informe o IP Tailscale para conectar automaticamente."
echo ""
echo "Exemplo: 100.69.131.40"
echo ""
read -p "IP Tailscale da máquina do cliente (deixe vazio se não usar): " TAILSCALE_CLIENT_IP
echo ""

# ============================================
# EXECUTAR INSTALADOR
# ============================================

echo "🚀 Iniciando instalação automática..."
echo ""

cd "$PROJECT_DIR/InstaladorVPS"

# Exportar variável para o INSTALAR-AUTO.sh usar
export TAILSCALE_CLIENT_IP_AUTO="$TAILSCALE_CLIENT_IP"

bash INSTALAR-AUTO.sh

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║            ✅ INSTALAÇÃO CONCLUÍDA!                            ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
