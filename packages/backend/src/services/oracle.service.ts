/**
 * Oracle Database Service
 * Serviço para conexão direta com banco Oracle (Intersolid)
 *
 * IMPORTANTE: Este serviço é SOMENTE LEITURA (SELECT)
 * Não executar INSERT, UPDATE, DELETE, DROP, etc.
 */

import oracledb from 'oracledb';

// Configuração do Oracle
const ORACLE_CONFIG = {
  user: 'POWERBI',
  password: 'OdRz6J4LY6Y6',
  connectString: '10.6.1.100:1521/orcl.intersoul'
};

export class OracleService {
  private static pool: oracledb.Pool | null = null;
  private static thickModeInitialized = false;

  /**
   * Inicializa o Thick Mode do Oracle (necessário para versões antigas do Oracle)
   */
  private static initThickMode(): void {
    if (this.thickModeInitialized) return;

    try {
      // Caminho do Oracle Instant Client 64-bit
      const oracleClientPath = 'C:\\oracle\\instantclient_64\\instantclient_23_4';
      oracledb.initOracleClient({ libDir: oracleClientPath });
      this.thickModeInitialized = true;
      console.log('✅ Oracle Thick Mode initialized with client:', oracleClientPath);
    } catch (error: any) {
      // Pode falhar se já foi inicializado ou se o path não existe
      if (error.message && error.message.includes('already been initialized')) {
        this.thickModeInitialized = true;
        console.log('✅ Oracle Thick Mode já estava inicializado');
      } else {
        console.error('⚠️ Oracle Thick Mode init error:', error.message);
      }
    }
  }

  /**
   * Inicializa o pool de conexões Oracle
   */
  static async initialize(): Promise<void> {
    try {
      // Inicializa Thick Mode primeiro (necessário para Oracle 11g)
      this.initThickMode();

      // Configura o cliente Oracle
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.autoCommit = false; // Segurança: não permite commit

      // Cria pool de conexões
      this.pool = await oracledb.createPool({
        ...ORACLE_CONFIG,
        poolMin: 1,
        poolMax: 5,
        poolIncrement: 1,
        poolTimeout: 60
      });

      console.log('✅ Oracle connection pool initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Oracle pool:', error);
      // Não lança erro para não impedir o sistema de iniciar
      // O Oracle pode não estar acessível dependendo da rede
    }
  }

  /**
   * Obtém uma conexão do pool
   */
  static async getConnection(): Promise<oracledb.Connection> {
    if (!this.pool) {
      await this.initialize();
    }

    if (!this.pool) {
      throw new Error('Oracle connection pool not available');
    }

    return this.pool.getConnection();
  }

  /**
   * Executa uma query SELECT (SOMENTE LEITURA)
   * @param sql - Query SQL (deve começar com SELECT)
   * @param params - Parâmetros da query
   */
  static async query<T = any>(sql: string, params: any = {}): Promise<T[]> {
    // SEGURANÇA: Verifica se é apenas SELECT
    const sqlUpper = sql.trim().toUpperCase();
    if (!sqlUpper.startsWith('SELECT')) {
      throw new Error('SEGURANÇA: Apenas queries SELECT são permitidas');
    }

    // Bloqueia comandos perigosos
    const blockedCommands = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];
    for (const cmd of blockedCommands) {
      if (sqlUpper.includes(cmd)) {
        throw new Error(`SEGURANÇA: Comando ${cmd} não é permitido`);
      }
    }

    let connection: oracledb.Connection | null = null;

    try {
      connection = await this.getConnection();

      const result = await connection.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        maxRows: 10000 // Limite de segurança
      });

      return (result.rows || []) as T[];
    } catch (error: any) {
      console.error('Oracle query error:', error.message);
      throw error;
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error('Error closing Oracle connection:', err);
        }
      }
    }
  }

  /**
   * Testa a conexão com o Oracle
   */
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.query<{ RESULT: string }>(
        "SELECT 'CONEXAO OK' as RESULT FROM DUAL"
      );

      if (result.length > 0 && result[0].RESULT === 'CONEXAO OK') {
        return { success: true, message: 'Conexão com Oracle estabelecida com sucesso' };
      }

      return { success: false, message: 'Resposta inesperada do Oracle' };
    } catch (error: any) {
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }
  }

  /**
   * Fecha o pool de conexões
   */
  static async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close(0);
        this.pool = null;
        console.log('Oracle connection pool closed');
      } catch (error) {
        console.error('Error closing Oracle pool:', error);
      }
    }
  }
}
