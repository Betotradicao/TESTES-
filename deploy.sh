#!/bin/bash

# Script de Deploy - Módulo Produção
# Execute: bash deploy.sh

echo "🚀 Iniciando deploy do módulo de Produção..."

# Conectar ao servidor e fazer deploy
ssh vps-145 << 'EOF'
cd /root/prevencao-no-radar

echo "📥 Fazendo git pull..."
git pull

echo "🔨 Rebuilding backend e frontend (--no-deps para não tocar no DB)..."
docker-compose up -d --no-deps --build backend frontend

echo "📋 Verificando logs..."
docker-compose logs --tail=50 backend frontend

echo "✅ Deploy concluído!"
echo "🌐 Acesse: http://145.223.92.152"
EOF

echo "✨ Processo finalizado!"
