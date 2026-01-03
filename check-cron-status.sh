#!/bin/bash

echo "=================================================="
echo "🔍 VERIFICAÇÃO DO STATUS DO CRON"
echo "=================================================="
echo ""

echo "📊 Status do container CRON:"
docker ps -a | grep prevencao-cron-prod
echo ""

echo "📋 Últimas 50 linhas do log do CRON:"
docker logs --tail 50 prevencao-cron-prod
echo ""

echo "🔄 Processos rodando no container CRON:"
docker exec prevencao-cron-prod ps aux
echo ""

echo "📅 Crontab configurado:"
docker exec prevencao-cron-prod cat /etc/crontabs/root
echo ""

echo "=================================================="
echo "✅ Verificação concluída!"
echo "=================================================="
