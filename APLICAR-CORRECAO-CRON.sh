#!/bin/bash

echo "=================================================="
echo "🔧 APLICANDO CORREÇÃO DO BUG DO CRON"
echo "=================================================="
echo ""

echo "📥 1. Baixando código corrigido do GitHub..."
cd /root/TESTES
git pull origin main

echo ""
echo "🐳 2. Reconstruindo container CRON com correção..."
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml up -d --build cron

echo ""
echo "⏳ 3. Aguardando container inicializar..."
sleep 10

echo ""
echo "✅ 4. Container CRON rodando:"
docker ps | grep prevencao-cron-prod

echo ""
echo "🚀 5. FORÇANDO EXECUÇÃO MANUAL para processar tudo que está PENDENTE..."
docker exec prevencao-cron-prod node dist/commands/daily-verification.command.js

echo ""
echo "=================================================="
echo "✅ CORREÇÃO APLICADA E EXECUTADA!"
echo "=================================================="
echo ""
echo "📊 Verifique agora no sistema:"
echo "   - Bipagens PENDENTES devem ter mudado para VERIFICADO"
echo "   - CRON rodará automaticamente a cada 2 minutos"
echo ""
echo "Para ver os logs do CRON em tempo real:"
echo "  docker logs -f prevencao-cron-prod"
echo ""
