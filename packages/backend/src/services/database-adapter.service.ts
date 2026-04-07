/**
 * Database Adapter Service
 * Camada de abstracao que permite executar queries em Oracle ou PostgreSQL
 * de forma transparente, traduzindo sintaxe especifica de cada banco.
 *
 * USO:
 *   const adapter = await DatabaseAdapter.get(); // pega a conexao ativa
 *   const sql = `SELECT ${adapter.nvl('p.preco', 0)} FROM ${tab} ${adapter.limit(10)}`;
 *   const rows = await adapter.query(sql, params);
 *
 * IMPORTANTE: Mantem 100% compatibilidade com o codigo existente que usa
 * OracleService diretamente. Esse adapter e uma alternativa, nao substitui.
 */

import { AppDataSource } from '../config/database';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
import { OracleService } from './oracle.service';
import { PostgresErpService } from './postgres-erp.service';

export type DbType = 'oracle' | 'postgresql' | 'mssql' | 'mysql';

export interface IDatabaseAdapter {
  type: DbType;
  /** Executa uma query SELECT */
  query<T = any>(sql: string, params?: any): Promise<T[]>;
  /** NVL/COALESCE: retorna o segundo valor se o primeiro for nulo */
  nvl(field: string, defaultValue: string | number): string;
  /** Limita resultados */
  limit(n: number): string;
  /** Trunca data (remove hora) */
  truncDate(field: string): string;
  /** Concatena strings */
  concat(...args: string[]): string;
  /** Converte string pra data */
  toDate(literal: string, format?: string): string;
  /** Conversao pra string */
  toChar(field: string, format?: string): string;
  /** Extract de parte da data (year, month, day, etc) */
  extract(part: 'year' | 'month' | 'day' | 'hour', field: string): string;
  /** Aspas pra identificadores (tabelas/colunas) */
  quoteIdentifier(name: string): string;
  /** Sintaxe pra nome de bind parameter (:nome em Oracle, $1 em PG) */
  bindParam(name: string, index: number): string;
  /** Converte object de params Oracle para o formato do banco ativo */
  convertParams(params: Record<string, any>, sql: string): { sql: string; params: any };
  /** Schema padrao */
  getSchema(): string;
  /** Tipo do banco */
  getType(): DbType;
}

// ========================================
// ORACLE ADAPTER
// ========================================
class OracleAdapter implements IDatabaseAdapter {
  type: DbType = 'oracle';
  private schema: string;

  constructor(schema: string) {
    this.schema = schema;
  }

  async query<T = any>(sql: string, params: any = {}): Promise<T[]> {
    return OracleService.query<T>(sql, params);
  }

  nvl(field: string, defaultValue: string | number): string {
    return `NVL(${field}, ${defaultValue})`;
  }

  limit(n: number): string {
    // Oracle: usar com WHERE / FETCH FIRST n ROWS ONLY
    return `FETCH FIRST ${n} ROWS ONLY`;
  }

  truncDate(field: string): string {
    return `TRUNC(${field})`;
  }

  concat(...args: string[]): string {
    return args.join(' || ');
  }

  toDate(literal: string, format: string = 'YYYY-MM-DD'): string {
    return `TO_DATE('${literal}', '${format}')`;
  }

  toChar(field: string, format?: string): string {
    return format ? `TO_CHAR(${field}, '${format}')` : `TO_CHAR(${field})`;
  }

  extract(part: 'year' | 'month' | 'day' | 'hour', field: string): string {
    return `EXTRACT(${part.toUpperCase()} FROM ${field})`;
  }

  quoteIdentifier(name: string): string {
    return `"${name.toUpperCase()}"`;
  }

  bindParam(name: string, _index: number): string {
    return `:${name}`;
  }

  convertParams(params: Record<string, any>, sql: string): { sql: string; params: any } {
    // Oracle ja usa params nomeados (:nome)
    return { sql, params };
  }

  getSchema(): string {
    return this.schema;
  }

  getType(): DbType {
    return 'oracle';
  }
}

// ========================================
// POSTGRESQL ADAPTER
// ========================================
class PostgresAdapter implements IDatabaseAdapter {
  type: DbType = 'postgresql';
  private schema: string;
  private connectionId?: number;

  constructor(schema: string, connectionId?: number) {
    this.schema = schema;
    this.connectionId = connectionId;
  }

  async query<T = any>(sql: string, params: any = {}): Promise<T[]> {
    // Se params e object com :nome, converter pra array $1 $2
    let finalSql = sql;
    let finalParams: any[] = [];

    if (typeof params === 'object' && !Array.isArray(params) && Object.keys(params).length > 0) {
      const converted = this.convertParams(params, sql);
      finalSql = converted.sql;
      finalParams = converted.params;
    } else if (Array.isArray(params)) {
      finalParams = params;
    }

    return PostgresErpService.query<T>(finalSql, finalParams, this.connectionId);
  }

  nvl(field: string, defaultValue: string | number): string {
    return `COALESCE(${field}, ${defaultValue})`;
  }

  limit(n: number): string {
    return `LIMIT ${n}`;
  }

  truncDate(field: string): string {
    return `DATE_TRUNC('day', ${field})::date`;
  }

  concat(...args: string[]): string {
    return args.join(' || ');
  }

  toDate(literal: string, _format: string = 'YYYY-MM-DD'): string {
    return `'${literal}'::date`;
  }

  toChar(field: string, format?: string): string {
    return format ? `TO_CHAR(${field}, '${format}')` : `${field}::text`;
  }

  extract(part: 'year' | 'month' | 'day' | 'hour', field: string): string {
    return `EXTRACT(${part.toUpperCase()} FROM ${field})`;
  }

  quoteIdentifier(name: string): string {
    return `"${name}"`;
  }

  bindParam(_name: string, index: number): string {
    return `$${index}`;
  }

  /**
   * Converte params Oracle (:nome) pra PostgreSQL ($1, $2)
   * Mantem a ordem em que aparecem na query
   */
  convertParams(params: Record<string, any>, sql: string): { sql: string; params: any[] } {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      return { sql, params: [] };
    }

    const paramArray: any[] = [];
    let convertedSql = sql;
    let counter = 0;
    const seen: Map<string, number> = new Map();

    // Substitui :nome por $N na ordem que aparece
    convertedSql = convertedSql.replace(/:(\w+)/g, (_match, name) => {
      if (seen.has(name)) {
        return `$${seen.get(name)}`;
      }
      counter++;
      seen.set(name, counter);
      paramArray.push(params[name]);
      return `$${counter}`;
    });

    return { sql: convertedSql, params: paramArray };
  }

  getSchema(): string {
    return this.schema;
  }

  getType(): DbType {
    return 'postgresql';
  }
}

// ========================================
// FACTORY
// ========================================
export class DatabaseAdapter {
  private static cachedAdapter: IDatabaseAdapter | null = null;
  private static cachedConnectionId: number | null = null;

  /**
   * Retorna o adapter ativo (Oracle ou PostgreSQL) baseado na conexao default
   * ou na conexao especificada por id.
   */
  static async get(connectionId?: number): Promise<IDatabaseAdapter> {
    // Cache simples: se ja tem o mesmo id, retorna
    if (this.cachedAdapter && this.cachedConnectionId === (connectionId || null)) {
      return this.cachedAdapter;
    }

    // Buscar a conexao
    if (!AppDataSource.isInitialized) {
      throw new Error('AppDataSource nao inicializado');
    }

    const repo = AppDataSource.getRepository(DatabaseConnection);
    let conn: DatabaseConnection | null = null;

    if (connectionId) {
      conn = await repo.findOne({ where: { id: connectionId } });
    } else {
      // Buscar default ou primeiro conectado
      conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
      if (!conn) {
        conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
      }
      if (!conn) {
        // Pegar qualquer um (fallback)
        conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
      }
    }

    if (!conn) {
      throw new Error('Nenhuma conexao de banco encontrada');
    }

    const schema = conn.schema || (conn.type === DatabaseType.POSTGRESQL ? 'public' : 'INTERSOLID');

    let adapter: IDatabaseAdapter;
    switch (conn.type) {
      case DatabaseType.ORACLE:
        adapter = new OracleAdapter(schema);
        break;
      case DatabaseType.POSTGRESQL:
        // Garantir que o pool esteja inicializado
        try { await PostgresErpService.initialize(conn.id); } catch { /* ignore */ }
        adapter = new PostgresAdapter(schema, conn.id);
        break;
      default:
        throw new Error(`Tipo de banco nao suportado pelo adapter: ${conn.type}`);
    }

    this.cachedAdapter = adapter;
    this.cachedConnectionId = connectionId || null;

    console.log(`🔌 [DATABASE ADAPTER] Usando ${conn.type.toUpperCase()} (conexao "${conn.name}", schema: ${schema})`);

    return adapter;
  }

  /**
   * Limpa o cache (forca re-leitura na proxima chamada)
   */
  static clearCache(): void {
    this.cachedAdapter = null;
    this.cachedConnectionId = null;
  }
}
