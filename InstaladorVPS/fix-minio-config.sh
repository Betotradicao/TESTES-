#!/bin/bash

echo "🔧 Corrigindo configuração do MinIO no banco de dados..."
echo ""

# Entrar no container do PostgreSQL e atualizar as configurações (sem -it para funcionar no pipe)
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "UPDATE configurations SET value = 'minio' WHERE key = 'minio_endpoint';"
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "UPDATE configurations SET value = '9000' WHERE key = 'minio_port';"

echo ""
echo "📋 Configurações atualizadas:"
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "SELECT key, value FROM configurations WHERE key LIKE 'minio%' ORDER BY key;"

echo ""
echo "✅ Configuração atualizada! Reiniciando backend..."
echo ""

# Reiniciar o backend para aplicar as mudanças
docker restart prevencao-backend-prod

echo ""
echo "⏳ Aguardando backend reiniciar (10 segundos)..."
sleep 10

echo ""
echo "📋 Verificando logs do backend..."
docker logs prevencao-backend-prod --tail 20

echo ""
echo "✅ Pronto! Tente enviar a imagem novamente."
echo ""
