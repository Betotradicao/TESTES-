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
  // Criar tabelas automaticamente em produção (primeira instalação)
  synchronize: true,
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
    // Tempo máximo que uma conexão pode ficar idle antes de ser fechada (30 segundos)
    idleTimeoutMillis: 30000,
    // Tempo máximo para aguardar uma conexão disponível (3 segundos)
    connectionTimeoutMillis: 3000,
    // Testa a conexão antes de usar
    testOnBorrow: true,
  },

  // Pool de conexões nativo do TypeORM
  poolSize: 20,

  // Reconectar automaticamente se a conexão cair
  connectTimeoutMS: 10000,
});

// Pool pg para queries raw (usado em autenticação e serviços)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});