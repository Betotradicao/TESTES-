#!/bin/bash

echo "========================================================"
echo "🚀 DEPLOY CRON - VPS 145 (PASTA TESTE)"
echo "========================================================"
echo ""

# 1. Fazer commit das mudanças locais
echo "📝 Fazendo commit das alterações..."
git add .
git commit -m "fix: Remove CRON do index.ts - volta para container Docker separado" || echo "Nada para commitar"

# 2. Push para o repositório
echo "📤 Fazendo push para o repositório..."
git push origin main

echo ""
echo "🔄 Conectando na VPS 145 e fazendo deploy..."
echo ""

# 3. Conectar na VPS e fazer deploy
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 << 'EOF'

echo "📍 Conectado na VPS 145"
echo ""

# Navegar para a pasta TESTE
cd /root/TESTE

echo "📥 Fazendo git pull..."
git pull origin main

echo ""
echo "🔨 Compilando backend..."
cd packages/backend
npm run build

echo ""
echo "📦 Parando container CRON antigo..."
cd /root/TESTE
docker stop prevencao-cron-prod 2>/dev/null || echo "Container não estava rodando"
docker rm prevencao-cron-prod 2>/dev/null || echo "Container não existia"

echo ""
echo "🏗️  Fazendo build do container CRON..."
docker build -t prevencao-cron:latest -f packages/backend/Dockerfile.cron packages/backend/

echo ""
echo "🚀 Subindo container CRON..."

# Obter variáveis de ambiente do .env
source .env 2>/dev/null || echo "Arquivo .env não encontrado"

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
  -e MINIO_PUBLIC_ENDPOINT="${HOST_IP}" \
  -e MINIO_PUBLIC_PORT=9010 \
  -e MINIO_PUBLIC_USE_SSL="false" \
  -e NODE_ENV=production \
  prevencao-cron:latest

echo ""
echo "⏳ Aguardando 10 segundos para container inicializar..."
sleep 10

echo ""
echo "📊 Status do container CRON:"
docker ps | grep prevencao-cron-prod

echo ""
echo "📋 Crontab configurado:"
docker exec prevencao-cron-prod cat /etc/crontabs/root 2>/dev/null || echo "Erro ao ler crontab"

echo ""
echo "📝 Últimas linhas do log:"
docker logs --tail 20 prevencao-cron-prod

echo ""
echo "✅ Deploy do CRON concluído na VPS 145!"

EOF

echo ""
echo "========================================================"
echo "✅ DEPLOY COMPLETO!"
echo "========================================================"
echo ""
echo "📌 Próximos passos:"
echo ""
echo "  1. Verificar logs em tempo real:"
echo "     ssh -i ~/.ssh/vps_prevencao root@145.223.92.152"
echo "     cd /root/TESTE"
echo "     docker logs -f prevencao-cron-prod"
echo ""
echo "  2. Executar verificação manualmente para testar:"
echo "     docker exec prevencao-cron-prod node dist/commands/daily-verification.command.js"
echo ""
echo "  3. Verificar status do CRON:"
echo "     docker exec prevencao-cron-prod cat /etc/crontabs/root"
echo ""
