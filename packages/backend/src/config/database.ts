import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

dotenv.config();

// Construir DATABASE_URL a partir de variáveis separadas (Docker)
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const database = process.env.DB_NAME || 'prevencao_db';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: getDatabaseUrl(),
  // IMPORTANTE: synchronize desligado, usar migrations
  synchronize: false,
  // Rodar migrations automaticamente na inicialização (todos os ambientes)
  migrationsRun: true,
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, '../entities/*.{ts,js}')],
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  subscribers: [],

  // Configurações de pool de conexões para evitar timeout
  extra: {
    // Máximo de conexões no pool
    max: 20,
    // Mínimo de conexões sempre ativas
    min: 2,
    // Tempo que uma conexão pode ficar idle antes de ser fechada (1 minuto)
    // Subi de 30s pra 60s pra ter mais reuso e menos churn de conexao.
    idleTimeoutMillis: 60000,
    // Tempo máximo para aguardar uma conexão disponível (30 segundos).
    // Subi de 3s pra 30s — 3s estourava nos crons (Top Quedas, Vendas
    // Mensais, etc) sempre que pool precisava abrir conexao nova depois
    // de idle, com erro "Connection terminated due to connection timeout".
    connectionTimeoutMillis: 30000,
    // Testa a conexão antes de usar
    testOnBorrow: true,
  },

  // Pool de conexões nativo do TypeORM
  poolSize: 20,

  // Reconectar automaticamente se a conexão cair
  connectTimeoutMS: 10000,
});

// Pool pg para queries raw (usado em autenticação e serviços).
// Mesmos valores que o TypeORM extra acima — connectionTimeoutMillis baixo
// estourava nos crons toda hora.
export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
});