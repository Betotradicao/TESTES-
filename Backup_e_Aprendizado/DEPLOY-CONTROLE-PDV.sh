#!/bin/bash

# Script de Deploy do Módulo Controle PDV
# Execute este script NA VPS para aplicar as mudanças

echo "🚀 DEPLOY MÓDULO CONTROLE PDV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Baixar código novo do GitHub
echo "📥 1. Baixando código do GitHub..."
cd /root/TESTES
git pull origin main

if [ $? -ne 0 ]; then
  echo "❌ Erro ao fazer git pull"
  exit 1
fi

echo "✅ Código baixado com sucesso!"
echo ""

# 2. Ir para pasta do Docker
cd /root/TESTES/InstaladorVPS

# 3. Rebuild Backend (contém migration nova)
echo "🔨 2. Reconstruindo Backend (com migrations)..."
docker compose -f docker-compose-producao.yml build --no-cache backend

if [ $? -ne 0 ]; then
  echo "❌ Erro ao fazer build do backend"
  exit 1
fi

echo "✅ Backend reconstruído!"
echo ""

# 4. Rebuild Frontend (contém página nova)
echo "🔨 3. Reconstruindo Frontend (com página Controle PDV)..."
docker compose -f docker-compose-producao.yml build --no-cache frontend

if [ $? -ne 0 ]; then
  echo "❌ Erro ao fazer build do frontend"
  exit 1
fi

echo "✅ Frontend reconstruído!"
echo ""

# 5. Reiniciar containers (SEM afetar banco de dados)
echo "🔄 4. Reiniciando containers..."
docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend cron

if [ $? -ne 0 ]; then
  echo "❌ Erro ao reiniciar containers"
  exit 1
fi

echo "✅ Containers reiniciados!"
echo ""

# 6. Aguardar backend inicializar
echo "⏳ 5. Aguardando backend inicializar e rodar migrations..."
sleep 15

# 7. Verificar logs do backend
echo "📋 6. Verificando logs do backend..."
docker logs prevencao-backend-prod --tail 30

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo ""
echo "📍 Acesse o sistema em:"
echo "   http://145.223.92.152:3000"
echo ""
echo "🔍 Para verificar se as migrations rodaram:"
echo "   docker logs prevencao-backend-prod | grep -i migration"
echo ""
echo "📊 Para acessar o Controle PDV:"
echo "   1. Faça login no sistema"
echo "   2. Clique em 'Prevenção PDV' no menu"
echo "   3. Clique em 'Controle PDV'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
