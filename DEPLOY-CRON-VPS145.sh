#!/bin/bash

echo "========================================================"
echo "🚀 DEPLOY CRON - VPS 145 (PASTA TESTES)"
echo "========================================================"
echo ""

# 1. Fazer commit das mudanças locais
echo "📝 Fazendo commit das alterações..."
git add .
git commit -m "fix: Deploy CRON via docker-compose (seguindo regras de deploy)" || echo "Nada para commitar"

# 2. Push para o repositório
echo "📤 Fazendo push para o repositório..."
git push origin main

echo ""
echo "🔄 Conectando na VPS 145 e fazendo deploy..."
echo ""

# 3. Deploy usando docker-compose (REGRAS DE DEPLOY)
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 << 'EOF'

echo "📍 Conectado na VPS 145"
echo ""

# Navegar para a pasta correta (InstaladorVPS)
cd /root/prevencao-radar-install/InstaladorVPS

echo "📥 Fazendo git pull..."
cd /root/prevencao-radar-install
git pull origin main

echo ""
echo "🔨 Fazendo build do CRON (docker compose)..."
cd /root/prevencao-radar-install/InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache cron

echo ""
echo "🚀 Subindo container CRON (--no-deps para não mexer em postgres/minio)..."
docker compose -f docker-compose-producao.yml up -d --no-deps cron

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
echo "📝 Últimas 30 linhas do log:"
docker logs --tail 30 prevencao-cron-prod 2>/dev/null || echo "Container ainda não tem logs"

echo ""
echo "✅ Deploy do CRON concluído na VPS 145!"

EOF

echo ""
echo "========================================================"
echo "✅ DEPLOY COMPLETO!"
echo "========================================================"
echo ""
echo "📌 Comandos úteis:"
echo ""
echo "  Verificar logs em tempo real:"
echo "    ssh -i ~/.ssh/vps_prevencao root@145.223.92.152"
echo "    docker logs -f prevencao-cron-prod"
echo ""
echo "  Executar verificação manualmente:"
echo "    docker exec prevencao-cron-prod node dist/commands/daily-verification.command.js"
echo ""
echo "  Verificar status dos containers:"
echo "    docker ps | grep prevencao"
echo ""
echo "  Reiniciar CRON:"
echo "    docker restart prevencao-cron-prod"
echo ""
