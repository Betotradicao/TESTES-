/**
 * PostgreSQL ERP Service
 * Servico para conexao com bancos PostgreSQL externos (ERPs como RP INFO)
 *
 * IMPORTANTE: Este servico e SOMENTE LEITURA (SELECT)
 * Nao executar INSERT, UPDATE, DELETE, DROP, etc.
 *
 * Configuracao via tabela database_connections
 * (separado do AppDataSource que e o banco do proprio sistema)
 */

import { Pool, PoolClient } from 'pg';
import { AppDataSource } from '../config/database';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';

export class PostgresErpService {
  // Pool por conexao (id da database_connections)
  private static pools: Map<number, Pool> = new Map();
  private static activeConnectionId: number | null = null;
  private static activeConfig: any = null;

  /**
   * Inicializa um pool PostgreSQL para uma conexao especifica
   */
  static async initialize(connectionId?: number): Promise<void> {
    try {
      let conn: DatabaseConnection | null = null;

      if (connectionId) {
        const repo = AppDataSource.getRepository(DatabaseConnection);
        conn = await repo.findOne({ where: { id: connectionId, type: DatabaseType.POSTGRESQL as any } });
      } else {
        // Buscar conexao PostgreSQL ativa padrao
        const repo = AppDataSource.getRepository(DatabaseConnection);
        conn = await repo.findOne({
          where: { type: DatabaseType.POSTGRESQL as any, is_default: true, status: ConnectionStatus.ACTIVE }
        });
        if (!conn) {
          conn = await repo.findOne({
            where: { type: DatabaseType.POSTGRESQL as any, status: ConnectionStatus.ACTIVE }
          });
        }
      }

      if (!conn) {
        console.log('⚠️ [POSTGRES ERP] Nenhuma conexao PostgreSQL ativa encontrada');
        return;
      }

      // Detecta se esta na VPS/Docker e usa host_vps
      const isVps = process.env.NODE_ENV === 'production' || process.env.DOCKER_CONTAINER === 'true';
      const hostToUse = isVps && conn.host_vps ? conn.host_vps : conn.host;

      console.log(`📦 [POSTGRES ERP] Configurando pool para conexao "${conn.name}" em ${hostToUse}:${conn.port}/${conn.database}`);

      // Fecha pool anterior se existir
      if (this.pools.has(conn.id)) {
        try { await this.pools.get(conn.id)!.end(); } catch { /* ignore */ }
        this.pools.delete(conn.id);
      }

      const pool = new Pool({
        host: hostToUse,
        port: conn.port,
        user: conn.username,
        password: conn.password,
        database: conn.database || 'postgres',
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      });

      // Testar conexao
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.pools.set(conn.id, pool);
      this.activeConnectionId = conn.id;
      this.activeConfig = {
        id: conn.id,
        name: conn.name,
        host: hostToUse,
        port: conn.port,
        database: conn.database,
        schema: conn.schema || 'public',
      };

      console.log(`✅ [POSTGRES ERP] Pool inicializado com sucesso: ${conn.name}`);
    } catch (error: any) {
      console.error('❌ [POSTGRES ERP] Falha ao inicializar pool:', error.message);
      throw error;
    }
  }

  /**
   * Pega um client do pool ativo
   */
  private static async getClient(connectionId?: number): Promise<PoolClient> {
    const id = connectionId || this.activeConnectionId;
    if (!id) {
      // Tentar inicializar
      await this.initialize();
      if (!this.activeConnectionId) {
        throw new Error('Nenhuma conexao PostgreSQL ERP ativa');
      }
    }

    const pool = this.pools.get(id || this.activeConnectionId!);
    if (!pool) {
      // Tentar reinicializar pra esse id
      await this.initialize(id || this.activeConnectionId!);
      const retryPool = this.pools.get(id || this.activeConnectionId!);
      if (!retryPool) {
        throw new Error(`Pool PostgreSQL nao encontrado para conexao ${id}`);
      }
      return retryPool.connect();
    }

    return pool.connect();
  }

  /**
   * Executa uma query SELECT (SOMENTE LEITURA)
   * @param sql - Query SQL (deve comecar com SELECT)
   * @param params - Parametros da query (array, $1, $2, ...)
   * @param connectionId - Opcional: id da conexao especifica
   */
  static async query<T = any>(sql: string, params: any[] = [], connectionId?: number): Promise<T[]> {
    // SEGURANCA: Verifica se e apenas SELECT (ou WITH ... SELECT que e CTE read-only)
    const sqlUpper = sql.trim().toUpperCase();
    if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
      throw new Error('SEGURANCA: Apenas queries SELECT sao permitidas');
    }

    // Bloqueia comandos perigosos
    const blockedPatterns = [
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+\w+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bDROP\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA)\b/i,
      /\bTRUNCATE\s+TABLE\b/i,
      /\bALTER\s+(TABLE|INDEX|SESSION|SCHEMA)\b/i,
      /\bCREATE\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA)\b/i,
      /\bGRANT\s+\w+\s+ON\b/i,
      /\bREVOKE\s+\w+\s+ON\b/i
    ];
    for (const pattern of blockedPatterns) {
      if (pattern.test(sql)) {
        throw new Error(`SEGURANCA: Comando SQL perigoso detectado`);
      }
    }

    let client: PoolClient | null = null;

    try {
      client = await this.getClient(connectionId);

      // Timeout de 5 minutos
      await client.query("SET statement_timeout = '300s'");

      const result = await client.query(sql, params);
      return (result.rows || []) as T[];
    } catch (error: any) {
      console.error('PostgreSQL ERP query error:', error.message);
      throw error;
    } finally {
      if (client) {
        try {
          client.release();
        } catch (err) {
          console.error('Error releasing PostgreSQL client:', err);
        }
      }
    }
  }

  /**
   * Retorna info da conexao ativa
   */
  static getActiveConfig(): any {
    return this.activeConfig;
  }

  /**
   * Fecha todos os pools
   */
  static async closeAll(): Promise<void> {
    for (const [id, pool] of this.pools.entries()) {
      try {
        await pool.end();
        console.log(`✅ [POSTGRES ERP] Pool ${id} fechado`);
      } catch (err) {
        console.error(`Erro ao fechar pool ${id}:`, err);
      }
    }
    this.pools.clear();
    this.activeConnectionId = null;
    this.activeConfig = null;
  }
}
