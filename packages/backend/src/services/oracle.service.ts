/**
 * Oracle Database Service
 * Serviço para conexão direta com banco Oracle (Intersolid)
 *
 * IMPORTANTE: Este serviço é SOMENTE LEITURA (SELECT)
 * Não executar INSERT, UPDATE, DELETE, DROP, etc.
 *
 * Configuração (ordem de prioridade):
 * 1. Variáveis de ambiente ORACLE_* (desenvolvimento local)
 * 2. Tabela database_connections (Configurações de Tabelas - visual)
 * 3. Tabela configurations (legado - oracle_host, oracle_port, etc)
 * 4. Valores padrão hardcoded (fallback)
 */

import oracledb from 'oracledb';
import { AppDataSource } from '../config/database';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
import { ConfigurationService } from './configuration.service';

// Configuração padrão do Oracle (fallback)
const DEFAULT_ORACLE_CONFIG = {
  user: 'POWERBI',
  password: 'OdRz6J4LY6Y6',
  connectString: '10.6.1.100:1521/orcl.intersoul'
};

export class OracleService {
  private static pool: oracledb.Pool | null = null;
  private static thickModeInitialized = false;
  private static configLoaded = false;
  private static oracleConfig = { ...DEFAULT_ORACLE_CONFIG };

  /**
   * Carrega configuração do Oracle de forma dinâmica
   * Prioridade: 1. Variáveis de ambiente, 2. Tabela database_connections (visual), 3. Tabela configurations (legado), 4. Valores padrão
   */
  private static async loadConfig(): Promise<void> {
    if (this.configLoaded) return;

    try {
      // 1. Primeiro tenta variáveis de ambiente (desenvolvimento local)
      if (process.env.ORACLE_CONNECT_STRING) {
        this.oracleConfig = {
          user: process.env.ORACLE_USER || DEFAULT_ORACLE_CONFIG.user,
          password: process.env.ORACLE_PASSWORD || DEFAULT_ORACLE_CONFIG.password,
          connectString: process.env.ORACLE_CONNECT_STRING
        };
        console.log('📦 Oracle config loaded from environment variables');
        this.configLoaded = true;
        return;
      }

      // 2. Tenta carregar da tabela database_connections (Configurações de Tabelas - visual)
      try {
        if (AppDataSource.isInitialized) {
          const connectionRepository = AppDataSource.getRepository(DatabaseConnection);

          // Busca conexão Oracle ativa (prioriza is_default, depois status active)
          const oracleConnection = await connectionRepository.findOne({
            where: { type: DatabaseType.ORACLE, status: ConnectionStatus.ACTIVE },
            order: { is_default: 'DESC', created_at: 'ASC' }
          });

          if (oracleConnection) {
            this.oracleConfig = {
              user: oracleConnection.username,
              password: oracleConnection.password,
              connectString: `${oracleConnection.host}:${oracleConnection.port}/${oracleConnection.service || 'orcl'}`
            };
            console.log(`📦 Oracle config loaded from database_connections: ${oracleConnection.name} (${oracleConnection.host}:${oracleConnection.port}/${oracleConnection.service})`);
            this.configLoaded = true;
            return;
          }
        }
      } catch (dbConnError: any) {
        console.log('⚠️ Could not load from database_connections, trying legacy config:', dbConnError.message);
      }

      // 3. Tenta carregar da tabela configurations (legado - para retrocompatibilidade)
      const oracleHost = await ConfigurationService.get('oracle_host', null);
      if (oracleHost) {
        const oraclePort = await ConfigurationService.get('oracle_port', '1521');
        const oracleService = await ConfigurationService.get('oracle_service', 'orcl.intersoul');
        const oracleUser = await ConfigurationService.get('oracle_user', DEFAULT_ORACLE_CONFIG.user);
        const oraclePassword = await ConfigurationService.get('oracle_password', DEFAULT_ORACLE_CONFIG.password);

        this.oracleConfig = {
          user: oracleUser ?? DEFAULT_ORACLE_CONFIG.user,
          password: oraclePassword ?? DEFAULT_ORACLE_CONFIG.password,
          connectString: `${oracleHost}:${oraclePort}/${oracleService}`
        };
        console.log(`📦 Oracle config loaded from configurations (legacy): ${oracleHost}:${oraclePort}/${oracleService}`);
        this.configLoaded = true;
        return;
      }

      // 4. Usa valores padrão (fallback)
      console.log('📦 Oracle config using default values (local network)');
      this.configLoaded = true;
    } catch (error: any) {
      console.error('⚠️ Error loading Oracle config, using defaults:', error.message);
      this.configLoaded = true;
    }
  }

  /**
   * Inicializa o Thick Mode do Oracle (necessário para versões antigas do Oracle)
   */
  private static initThickMode(): void {
    if (this.thickModeInitialized) return;

    try {
      // Detecta o ambiente (Windows vs Linux)
      const isWindows = process.platform === 'win32';
      const oracleClientPath = isWindows
        ? 'C:\\oracle\\instantclient_64\\instantclient_23_4'
        : '/opt/oracle/instantclient_23_4';

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
        // Em ambiente de produção Linux, continua sem Thick mode (tentará Thin)
        console.log('📝 Continuando sem Thick Mode...');
      }
    }
  }

  /**
   * Inicializa o pool de conexões Oracle
   */
  static async initialize(): Promise<void> {
    try {
      // Carrega configuração dinâmica primeiro
      await this.loadConfig();

      // Inicializa Thick Mode (necessário para Oracle 11g)
      this.initThickMode();

      // Configura o cliente Oracle
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.autoCommit = false; // Segurança: não permite commit

      // Cria pool de conexões com a configuração carregada
      this.pool = await oracledb.createPool({
        ...this.oracleConfig,
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

    // Bloqueia comandos perigosos (verifica comandos SQL reais, não partes de nomes de colunas)
    // Usa regex para detectar comandos no início de statements ou após ponto-e-vírgula
    const blockedPatterns = [
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+\w+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bDROP\s+(TABLE|INDEX|VIEW|DATABASE)\b/i,
      /\bTRUNCATE\s+TABLE\b/i,
      /\bALTER\s+(TABLE|INDEX|SESSION)\b/i,
      /\bCREATE\s+(TABLE|INDEX|VIEW|DATABASE)\b/i,
      /\bGRANT\s+\w+\s+ON\b/i,
      /\bREVOKE\s+\w+\s+ON\b/i
    ];
    for (const pattern of blockedPatterns) {
      if (pattern.test(sql)) {
        throw new Error(`SEGURANÇA: Comando SQL perigoso detectado`);
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
   * Executa uma query SELECT que retorna campos BLOB
   * @param sql - Query SQL (deve começar com SELECT)
   * @param params - Parâmetros da query
   * @returns Resultado com BLOBs já convertidos para Buffer
   */
  static async queryWithBlob<T = any>(sql: string, params: any = {}): Promise<T[]> {
    // SEGURANÇA: Verifica se é apenas SELECT
    const sqlUpper = sql.trim().toUpperCase();
    if (!sqlUpper.startsWith('SELECT')) {
      throw new Error('SEGURANÇA: Apenas queries SELECT são permitidas');
    }

    let connection: oracledb.Connection | null = null;

    try {
      connection = await this.getConnection();

      // Configura para receber LOBs como Buffer
      const result = await connection.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: {
          // Trata colunas BLOB automaticamente
          "DF_DANFE": { type: oracledb.BUFFER }
        }
      });

      // Processa os resultados para converter Lobs em Buffers
      const rows = result.rows || [];
      const processedRows: T[] = [];

      for (const row of rows as any[]) {
        const processedRow: any = {};
        for (const key of Object.keys(row)) {
          const value = row[key];

          // Se for um Lob, lê o conteúdo
          if (value && typeof value.getData === 'function') {
            try {
              const data = await value.getData();
              processedRow[key] = data;
            } catch (lobError) {
              console.error(`Erro ao ler LOB da coluna ${key}:`, lobError);
              processedRow[key] = null;
            }
          } else {
            processedRow[key] = value;
          }
        }
        processedRows.push(processedRow as T);
      }

      return processedRows;
    } catch (error: any) {
      console.error('Oracle BLOB query error:', error.message);
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
