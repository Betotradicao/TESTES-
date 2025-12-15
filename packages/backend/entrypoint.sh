#!/bin/sh
set -e

echo "🚀 Iniciando backend em modo produção..."

# Aguardar PostgreSQL estar pronto
echo "⏳ Aguardando PostgreSQL ficar disponível..."
until node -e "const { Client } = require('pg'); const client = new Client({host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME}); client.connect().then(() => {console.log('✅ PostgreSQL conectado'); client.end(); process.exit(0);}).catch(() => {console.log('⏳ Aguardando...'); process.exit(1);});" 2>/dev/null; do
  sleep 2
done

echo "🔄 Executando migrations automaticamente..."
npm run migration:run:prod || echo "⚠️ Nenhuma migration pendente ou erro ao executar migrations"

echo "🌱 Populando configurações iniciais..."
npm run seed:configurations:prod || echo "⚠️ Seed já executado ou erro ao popular configurações"

echo "✅ Iniciando servidor..."
exec node dist/index.js
