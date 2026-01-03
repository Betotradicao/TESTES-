#!/bin/bash

echo "=================================================="
echo "🕐 CORREÇÃO DOS HORÁRIOS DAS VENDAS"
echo "=================================================="
echo ""

echo "📋 Problema identificado:"
echo "   Vendas com horário +6 horas à frente"
echo "   Exemplo: 12:30 mostrava como 18:30"
echo ""
echo "🔧 Solução:"
echo "   Subtrair 6 horas de todas as vendas já inseridas"
echo ""

read -p "Deseja continuar com a correção? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Operação cancelada."
    exit 1
fi

echo ""
echo "⏳ Corrigindo horários das vendas..."

docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
  UPDATE sells
  SET sell_date = sell_date - INTERVAL '6 hours'
  WHERE sell_date IS NOT NULL;
"

echo ""
echo "✅ Verificando resultado..."

docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "
  SELECT
    id,
    product_id,
    sell_date AT TIME ZONE 'America/Sao_Paulo' as sell_date_br,
    num_cupom_fiscal
  FROM sells
  ORDER BY id DESC
  LIMIT 5;
"

echo ""
echo "=================================================="
echo "✅ CORREÇÃO CONCLUÍDA!"
echo "=================================================="
echo ""
echo "📊 Próximos passos:"
echo "   1. Verificar na interface se horários estão corretos"
echo "   2. Rebuild do backend para aplicar código corrigido"
echo ""
echo "Para rebuild do backend:"
echo "   cd /root/TESTES/InstaladorVPS"
echo "   docker compose -f docker-compose-producao.yml up -d --build backend"
echo "   docker compose -f docker-compose-producao.yml up -d --build cron"
echo ""
