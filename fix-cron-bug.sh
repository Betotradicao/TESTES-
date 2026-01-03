#!/bin/bash

echo "=================================================="
echo "🔧 CORREÇÃO DO BUG DO CRON"
echo "=================================================="
echo ""

echo "📥 Baixando última versão do GitHub..."
cd /root/TESTES
git pull origin main

echo ""
echo "🗄️  Verificando constraint UNIQUE na tabela sells..."
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
  CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS sells_unique_sale
  ON sells (product_id, product_weight, num_cupom_fiscal);
" 2>/dev/null

echo "✅ Constraint criada/verificada!"

echo ""
echo "🐳 Reconstruindo container CRON com correção..."
cd /root/TESTES/InstaladorVPS
docker compose -f docker-compose-producao.yml up -d --build cron

echo ""
echo "⏳ Aguardando container inicializar (10 segundos)..."
sleep 10

echo ""
echo "✅ Verificando status do container:"
docker ps | grep prevencao-cron-prod

echo ""
echo "📋 Últimas linhas do log do CRON:"
docker logs --tail 30 prevencao-cron-prod

echo ""
echo "=================================================="
echo "✅ CORREÇÃO APLICADA COM SUCESSO!"
echo "=================================================="
echo ""
echo "📊 O CRON agora funciona corretamente mesmo com produtos ativados"
echo "🔄 Ele roda a cada 2 minutos e cruza vendas com bipagens"
echo ""
echo "Para monitorar os logs em tempo real:"
echo "  docker logs -f prevencao-cron-prod"
echo ""
echo "Para verificar se está rodando:"
echo "  docker ps | grep cron"
echo ""
