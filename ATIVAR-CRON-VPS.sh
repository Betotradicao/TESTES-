#!/bin/bash

echo "========================================================"
echo "🚀 ATIVANDO CONTAINER CRON NA VPS 145"
echo "========================================================"
echo ""

# Verificar se está na VPS certa
echo "📍 Verificando VPS..."
hostname

echo ""
echo "📦 Parando container CRON antigo (se existir)..."
docker stop prevencao-cron-prod 2>/dev/null || echo "Container não estava rodando"
docker rm prevencao-cron-prod 2>/dev/null || echo "Container não existia"

echo ""
echo "🔨 Fazendo build do container CRON..."
cd /root/roberto-prevencao-no-radar-main

# Build do container CRON
docker build -t prevencao-cron:latest -f packages/backend/Dockerfile.cron packages/backend/

echo ""
echo "🚀 Subindo container CRON..."
docker run -d \
  --name prevencao-cron-prod \
  --restart always \
  --network prevencao-network \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD="${POSTGRES_PASSWORD}" \
  -e DB_NAME=prevencao_db \
  -e MINIO_ENDPOINT=minio \
  -e MINIO_PORT=9000 \
  -e MINIO_ACCESS_KEY="${MINIO_ROOT_USER}" \
  -e MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD}" \
  -e MINIO_USE_SSL="false" \
  -e MINIO_BUCKET_NAME=market-security \
  -e NODE_ENV=production \
  prevencao-cron:latest

echo ""
echo "⏳ Aguardando 5 segundos para container iniciar..."
sleep 5

echo ""
echo "📊 Status do container CRON:"
docker ps | grep prevencao-cron-prod

echo ""
echo "📋 Verificando crontab configurado:"
docker exec prevencao-cron-prod cat /etc/crontabs/root

echo ""
echo "📝 Últimas 30 linhas do log:"
docker logs --tail 30 prevencao-cron-prod

echo ""
echo "========================================================"
echo "✅ Container CRON ativado com sucesso!"
echo "========================================================"
echo ""
echo "📌 Comandos úteis:"
echo "  Ver logs em tempo real:"
echo "    docker logs -f prevencao-cron-prod"
echo ""
echo "  Executar verificação manualmente:"
echo "    docker exec prevencao-cron-prod node dist/commands/daily-verification.command.js"
echo ""
echo "  Reiniciar container:"
echo "    docker restart prevencao-cron-prod"
echo ""
