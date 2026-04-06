import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
import { MappingService } from '../services/mapping.service';
import { OracleService } from '../services/oracle.service';
import oracledb from 'oracledb';

const connectionRepository = AppDataSource.getRepository(DatabaseConnection);

export class DatabaseConnectionsController {
  /**
   * GET /api/database-connections
   * Lista todas as conexões de banco
   */
  async index(req: Request, res: Response) {
    try {
      const connections = await connectionRepository.find({
        order: { created_at: 'DESC' }
      });

      return res.json(connections);
    } catch (error) {
      console.error('Error fetching database connections:', error);
      return res.status(500).json({ error: 'Failed to fetch database connections' });
    }
  }

  /**
   * GET /api/database-connections/:id
   * Busca conexão específica
   */
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const connection = await connectionRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      return res.json(connection);
    } catch (error) {
      console.error('Error fetching database connection:', error);
      return res.status(500).json({ error: 'Failed to fetch database connection' });
    }
  }

  /**
   * POST /api/database-connections
   * Cria nova conexão
   */
  async create(req: Request, res: Response) {
    try {
      const { name, type, host, host_vps, port, service, database, username, password, schema, is_default, status } = req.body;

      if (!name || !type || !host || !port || !username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Se é a primeira conexão, automaticamente vira default
      const existingCount = await connectionRepository.count();
      const shouldBeDefault = is_default || existingCount === 0;

      // Se é default, remove default de outras conexões
      if (shouldBeDefault) {
        await connectionRepository
          .createQueryBuilder()
          .update(DatabaseConnection)
          .set({ is_default: false })
          .where("is_default = :val", { val: true })
          .execute();
      }

      // Mapear status do frontend para o enum
      let connectionStatus = ConnectionStatus.INACTIVE;
      if (status === 'active') {
        connectionStatus = ConnectionStatus.ACTIVE;
      } else if (status === 'error') {
        connectionStatus = ConnectionStatus.ERROR;
      }

      const connection = connectionRepository.create({
        name,
        type,
        host,
        host_vps: host_vps || '172.20.0.1', // Padrão gateway Docker
        port: parseInt(port),
        service,
        database,
        username,
        password,
        schema,
        is_default: shouldBeDefault,
        status: connectionStatus
      });

      const saved = await connectionRepository.save(connection);

      console.log(`✅ Database connection created: ${saved.name} (${saved.type})`);

      // Auto-reload Oracle se a conexão criada é Oracle e está ativa
      if (saved.type === DatabaseType.ORACLE && saved.status === ConnectionStatus.ACTIVE) {
        OracleService.reloadConfig().then(r => {
          console.log(`🔄 Oracle auto-reload após criar conexão: ${r.message}`);
        }).catch(e => console.error('Oracle reload error:', e));
      }
      MappingService.clearCache();

      return res.status(201).json(saved);
    } catch (error) {
      console.error('Error creating database connection:', error);
      return res.status(500).json({ error: 'Failed to create database connection' });
    }
  }

  /**
   * PUT /api/database-connections/:id
   * Atualiza conexão existente
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, type, host, host_vps, port, service, database, username, password, schema, is_default, status } = req.body;

      const connection = await connectionRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Se está mudando para default, remove default de outras
      if (is_default && !connection.is_default) {
        await connectionRepository
          .createQueryBuilder()
          .update(DatabaseConnection)
          .set({ is_default: false })
          .where("is_default = :val", { val: true })
          .execute();
      }

      // Atualizar campos (password só se fornecida nova)
      connection.name = name || connection.name;
      connection.type = type || connection.type;
      connection.host = host || connection.host;
      connection.host_vps = host_vps !== undefined ? host_vps : connection.host_vps;
      connection.port = port ? parseInt(port) : connection.port;
      connection.service = service !== undefined ? service : connection.service;
      connection.database = database !== undefined ? database : connection.database;
      connection.username = username || connection.username;
      if (password && password !== '***') {
        connection.password = password;
      }
      connection.schema = schema !== undefined ? schema : connection.schema;
      connection.is_default = is_default !== undefined ? is_default : connection.is_default;

      // Atualizar status se fornecido
      if (status === 'active') {
        connection.status = ConnectionStatus.ACTIVE;
      } else if (status === 'inactive') {
        connection.status = ConnectionStatus.INACTIVE;
      } else if (status === 'error') {
        connection.status = ConnectionStatus.ERROR;
      }

      const saved = await connectionRepository.save(connection);

      console.log(`✅ Database connection updated: ${saved.name}`);

      // Auto-reload Oracle se a conexão atualizada é Oracle e está ativa
      if (saved.type === DatabaseType.ORACLE && saved.status === ConnectionStatus.ACTIVE) {
        OracleService.reloadConfig().then(r => {
          console.log(`🔄 Oracle auto-reload após atualizar conexão: ${r.message}`);
        }).catch(e => console.error('Oracle reload error:', e));
      }
      MappingService.clearCache();

      return res.json(saved);
    } catch (error) {
      console.error('Error updating database connection:', error);
      return res.status(500).json({ error: 'Failed to update database connection' });
    }
  }

  /**
   * DELETE /api/database-connections/:id
   * Remove conexão
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const connection = await connectionRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      await connectionRepository.remove(connection);

      console.log(`🗑️ Database connection deleted: ${connection.name}`);

      return res.json({ message: 'Connection deleted successfully' });
    } catch (error) {
      console.error('Error deleting database connection:', error);
      return res.status(500).json({ error: 'Failed to delete database connection' });
    }
  }

  /**
   * POST /api/database-connections/:id/test
   * Testa conexão com o banco de dados
   */
  async testConnection(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const connection = await connectionRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      console.log(`🔍 Testing connection: ${connection.name} (${connection.type})`);

      let testResult: { success: boolean; message: string };

      switch (connection.type) {
        case DatabaseType.ORACLE:
          testResult = await this.testOracleConnection(connection);
          break;
        case DatabaseType.SQLSERVER:
          testResult = await this.testSqlServerConnection(connection);
          break;
        case DatabaseType.MYSQL:
          testResult = await this.testMySqlConnection(connection);
          break;
        case DatabaseType.POSTGRESQL:
          testResult = await this.testPostgresConnection(connection);
          break;
        default:
          testResult = { success: false, message: `Tipo de banco não suportado: ${connection.type}` };
      }

      // Atualizar status da conexão
      connection.last_test_at = new Date();
      if (testResult.success) {
        connection.status = ConnectionStatus.ACTIVE;
        connection.last_error = '';
      } else {
        connection.status = ConnectionStatus.ERROR;
        connection.last_error = testResult.message;
      }
      await connectionRepository.save(connection);

      // Auto-reload Oracle quando teste passa com sucesso
      if (testResult.success && connection.type === DatabaseType.ORACLE) {
        OracleService.reloadConfig().then(r => {
          console.log(`🔄 Oracle auto-reload após teste OK: ${r.message}`);
        }).catch(e => console.error('Oracle reload error:', e));
        MappingService.clearCache();
      }

      return res.json(testResult);
    } catch (error: any) {
      console.error('Error testing database connection:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar conexão: ${error.message}`
      });
    }
  }

  /**
   * POST /api/database-connections/test-new
   * Testa uma nova conexão sem salvar
   */
  async testNewConnection(req: Request, res: Response) {
    try {
      const { type, host, host_vps, port, service, database, username, password, schema } = req.body;

      if (!type || !host || !port || !username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: type, host, port, username, password'
        });
      }

      console.log(`🔍 Testing new connection: ${type} @ ${host}:${port}`);

      const tempConnection = {
        type,
        host,
        host_vps: host_vps || 'host.docker.internal',
        port: parseInt(port),
        service,
        database,
        username,
        password,
        schema
      } as DatabaseConnection;

      let testResult: { success: boolean; message: string };

      switch (type) {
        case DatabaseType.ORACLE:
          testResult = await this.testOracleConnection(tempConnection);
          break;
        case DatabaseType.SQLSERVER:
          testResult = await this.testSqlServerConnection(tempConnection);
          break;
        case DatabaseType.MYSQL:
          testResult = await this.testMySqlConnection(tempConnection);
          break;
        case DatabaseType.POSTGRESQL:
          testResult = await this.testPostgresConnection(tempConnection);
          break;
        default:
          testResult = { success: false, message: `Tipo de banco não suportado: ${type}` };
      }

      return res.json(testResult);
    } catch (error: any) {
      console.error('Error testing new database connection:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar conexão: ${error.message}`
      });
    }
  }

  /**
   * POST /api/database-connections/test-mapping
   * Testa se uma tabela/coluna existe e retorna um exemplo de dado
   * Suporta Oracle, PostgreSQL, SQL Server e MySQL
   */
  async testMapping(req: Request, res: Response) {
    try {
      const { connectionId, tableName, columnName } = req.body;

      if (!connectionId || !tableName || !columnName) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: connectionId, tableName, columnName'
        });
      }

      // Buscar a conexão
      const dbConnection = await connectionRepository.findOne({
        where: { id: parseInt(connectionId) }
      });

      if (!dbConnection) {
        return res.status(404).json({
          success: false,
          message: 'Conexão não encontrada'
        });
      }

      console.log(`🔍 Testing mapping: ${tableName}.${columnName} on ${dbConnection.name} (${dbConnection.type})`);

      // Sanitizar nomes de tabela e coluna (prevenir SQL injection)
      const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const safeColumnName = columnName.replace(/[^a-zA-Z0-9_]/g, '');
      const safeSchema = dbConnection.schema ? dbConnection.schema.replace(/[^a-zA-Z0-9_]/g, '') : null;

      let result: { success: boolean; message: string; sample?: string; count?: number };

      switch (dbConnection.type) {
        case DatabaseType.ORACLE:
          result = await this.testMappingOracle(dbConnection, safeTableName, safeColumnName, safeSchema);
          break;
        case DatabaseType.POSTGRESQL:
          result = await this.testMappingPostgres(dbConnection, safeTableName, safeColumnName, safeSchema);
          break;
        case DatabaseType.SQLSERVER:
          result = await this.testMappingSqlServer(dbConnection, safeTableName, safeColumnName, safeSchema);
          break;
        case DatabaseType.MYSQL:
          result = await this.testMappingMySql(dbConnection, safeTableName, safeColumnName, safeSchema);
          break;
        default:
          result = { success: false, message: `Tipo de banco não suportado: ${dbConnection.type}` };
      }

      return res.json(result);

    } catch (error: any) {
      console.error('Error testing mapping:', error.message);
      return res.status(500).json({
        success: false,
        message: `Erro ao testar mapeamento: ${error.message}`
      });
    }
  }

  /**
   * Testa mapeamento em Oracle
   */
  private async testMappingOracle(
    conn: DatabaseConnection,
    tableName: string,
    columnName: string,
    schema: string | null
  ): Promise<{ success: boolean; message: string; sample?: string; count?: number }> {
    let connection: oracledb.Connection | null = null;

    try {
      // Detecta se está em ambiente VPS/Docker
      const isVps = process.env.NODE_ENV === 'production' || process.env.DOCKER_CONTAINER === 'true';
      const hostToUse = isVps && conn.host_vps ? conn.host_vps : conn.host;
      const connectString = `${hostToUse}:${conn.port}/${conn.service || 'orcl'}`;

      // Inicializa Thick Mode se necessário
      try {
        const isWindows = process.platform === 'win32';
        const oracleClientPath = isWindows
          ? 'C:\\oracle\\instantclient_64\\instantclient_23_4'
          : '/opt/oracle/instantclient_23_4';
        oracledb.initOracleClient({ libDir: oracleClientPath });
      } catch (initError: any) {
        if (!initError.message?.includes('already been initialized')) {
          console.log('⚠️ Thick mode not available, trying thin mode');
        }
      }

      connection = await oracledb.getConnection({
        user: conn.username,
        password: conn.password,
        connectString
      });

      const fullTableName = schema
        ? `${schema.toUpperCase()}.${tableName.toUpperCase()}`
        : tableName.toUpperCase();

      // Buscar exemplo de dados
      const sampleQuery = `SELECT ${columnName.toUpperCase()} FROM ${fullTableName} WHERE ROWNUM <= 3`;
      console.log(`📋 Oracle query: ${sampleQuery}`);

      let sampleResult: any;
      try {
        sampleResult = await connection.execute(sampleQuery, [], { outFormat: oracledb.OUT_FORMAT_ARRAY });
      } catch (queryError: any) {
        if (queryError.message.includes('table or view does not exist')) {
          return { success: false, message: `Tabela '${tableName}' não encontrada` };
        }
        if (queryError.message.includes('invalid identifier')) {
          return { success: false, message: `Coluna '${columnName}' não encontrada na tabela '${tableName}'` };
        }
        return { success: false, message: `Erro na consulta: ${queryError.message}` };
      }

      // Buscar contagem
      const countQuery = `SELECT COUNT(*) FROM ${fullTableName}`;
      const countResult = await connection.execute(countQuery, [], { outFormat: oracledb.OUT_FORMAT_ARRAY });

      const rows = sampleResult.rows || [];
      const sampleValues = rows.map((row: any[]) => row[0]).filter((v: any) => v !== null && v !== undefined);
      const sampleValue = sampleValues.length > 0 ? sampleValues.slice(0, 3).join(', ') : null;
      const totalCount = (countResult.rows as any)?.[0]?.[0] || 0;

      console.log(`✅ Oracle mapping test successful: ${tableName}.${columnName} = "${sampleValue}" (${totalCount} rows)`);

      return {
        success: true,
        message: 'Mapeamento válido!',
        sample: sampleValue !== null ? String(sampleValue) : '(vazio)',
        count: totalCount
      };

    } finally {
      if (connection) {
        try { await connection.close(); } catch (e) { }
      }
    }
  }

  /**
   * Testa mapeamento em PostgreSQL
   */
  private async testMappingPostgres(
    conn: DatabaseConnection,
    tableName: string,
    columnName: string,
    schema: string | null
  ): Promise<{ success: boolean; message: string; sample?: string; count?: number }> {
    let client: any = null;

    try {
      const { Client } = require('pg');

      client = new Client({
        host: conn.host,
        port: conn.port,
        user: conn.username,
        password: conn.password,
        database: conn.database || 'postgres',
        connectionTimeoutMillis: 30000
      });

      await client.connect();

      const fullTableName = schema
        ? `"${schema}"."${tableName}"`
        : `"${tableName}"`;

      // Buscar exemplo de dados
      const sampleQuery = `SELECT "${columnName}" FROM ${fullTableName} LIMIT 3`;
      console.log(`📋 PostgreSQL query: ${sampleQuery}`);

      let sampleResult: any;
      try {
        sampleResult = await client.query(sampleQuery);
      } catch (queryError: any) {
        if (queryError.message.includes('does not exist')) {
          if (queryError.message.includes('column')) {
            return { success: false, message: `Coluna '${columnName}' não encontrada na tabela '${tableName}'` };
          }
          return { success: false, message: `Tabela '${tableName}' não encontrada` };
        }
        return { success: false, message: `Erro na consulta: ${queryError.message}` };
      }

      // Buscar contagem
      const countQuery = `SELECT COUNT(*) FROM ${fullTableName}`;
      const countResult = await client.query(countQuery);

      const rows = sampleResult.rows || [];
      const sampleValues = rows.map((row: any) => row[columnName]).filter((v: any) => v !== null && v !== undefined);
      const sampleValue = sampleValues.length > 0 ? sampleValues.slice(0, 3).join(', ') : null;
      const totalCount = parseInt(countResult.rows?.[0]?.count) || 0;

      console.log(`✅ PostgreSQL mapping test successful: ${tableName}.${columnName} = "${sampleValue}" (${totalCount} rows)`);

      return {
        success: true,
        message: 'Mapeamento válido!',
        sample: sampleValue !== null ? String(sampleValue) : '(vazio)',
        count: totalCount
      };

    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return { success: false, message: 'Driver PostgreSQL (pg) não está instalado no servidor' };
      }
      return { success: false, message: `Erro PostgreSQL: ${error.message}` };
    } finally {
      if (client) {
        try { await client.end(); } catch (e) { }
      }
    }
  }

  /**
   * Testa mapeamento em SQL Server
   */
  private async testMappingSqlServer(
    conn: DatabaseConnection,
    tableName: string,
    columnName: string,
    schema: string | null
  ): Promise<{ success: boolean; message: string; sample?: string; count?: number }> {
    let pool: any = null;

    try {
      const mssql = require('mssql');

      const config = {
        user: conn.username,
        password: conn.password,
        server: conn.host,
        port: conn.port,
        database: conn.database || 'master',
        options: {
          encrypt: false,
          trustServerCertificate: true
        },
        connectionTimeout: 30000
      };

      pool = await mssql.connect(config);

      const fullTableName = schema
        ? `[${schema}].[${tableName}]`
        : `[${tableName}]`;

      // Buscar exemplo de dados
      const sampleQuery = `SELECT TOP 3 [${columnName}] FROM ${fullTableName}`;
      console.log(`📋 SQL Server query: ${sampleQuery}`);

      let sampleResult: any;
      try {
        sampleResult = await pool.request().query(sampleQuery);
      } catch (queryError: any) {
        if (queryError.message.includes('Invalid object name')) {
          return { success: false, message: `Tabela '${tableName}' não encontrada` };
        }
        if (queryError.message.includes('Invalid column name')) {
          return { success: false, message: `Coluna '${columnName}' não encontrada na tabela '${tableName}'` };
        }
        return { success: false, message: `Erro na consulta: ${queryError.message}` };
      }

      // Buscar contagem
      const countQuery = `SELECT COUNT(*) as count FROM ${fullTableName}`;
      const countResult = await pool.request().query(countQuery);

      const rows = sampleResult.recordset || [];
      const sampleValues = rows.map((row: any) => row[columnName]).filter((v: any) => v !== null && v !== undefined);
      const sampleValue = sampleValues.length > 0 ? sampleValues.slice(0, 3).join(', ') : null;
      const totalCount = countResult.recordset?.[0]?.count || 0;

      console.log(`✅ SQL Server mapping test successful: ${tableName}.${columnName} = "${sampleValue}" (${totalCount} rows)`);

      return {
        success: true,
        message: 'Mapeamento válido!',
        sample: sampleValue !== null ? String(sampleValue) : '(vazio)',
        count: totalCount
      };

    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return { success: false, message: 'Driver SQL Server (mssql) não está instalado no servidor' };
      }
      return { success: false, message: `Erro SQL Server: ${error.message}` };
    } finally {
      if (pool) {
        try { await pool.close(); } catch (e) { }
      }
    }
  }

  /**
   * Testa mapeamento em MySQL
   */
  private async testMappingMySql(
    conn: DatabaseConnection,
    tableName: string,
    columnName: string,
    schema: string | null
  ): Promise<{ success: boolean; message: string; sample?: string; count?: number }> {
    let connection: any = null;

    try {
      const mysql = require('mysql2/promise');

      connection = await mysql.createConnection({
        host: conn.host,
        port: conn.port,
        user: conn.username,
        password: conn.password,
        database: conn.database || schema || undefined,
        connectTimeout: 10000
      });

      const fullTableName = schema && !conn.database
        ? `\`${schema}\`.\`${tableName}\``
        : `\`${tableName}\``;

      // Buscar exemplo de dados
      const sampleQuery = `SELECT \`${columnName}\` FROM ${fullTableName} LIMIT 3`;
      console.log(`📋 MySQL query: ${sampleQuery}`);

      let sampleResult: any;
      try {
        [sampleResult] = await connection.execute(sampleQuery);
      } catch (queryError: any) {
        if (queryError.message.includes("doesn't exist")) {
          if (queryError.message.includes('Unknown column')) {
            return { success: false, message: `Coluna '${columnName}' não encontrada na tabela '${tableName}'` };
          }
          return { success: false, message: `Tabela '${tableName}' não encontrada` };
        }
        if (queryError.message.includes('Unknown column')) {
          return { success: false, message: `Coluna '${columnName}' não encontrada na tabela '${tableName}'` };
        }
        return { success: false, message: `Erro na consulta: ${queryError.message}` };
      }

      // Buscar contagem
      const countQuery = `SELECT COUNT(*) as count FROM ${fullTableName}`;
      const [countResult] = await connection.execute(countQuery);

      const rows = sampleResult || [];
      const sampleValues = rows.map((row: any) => row[columnName]).filter((v: any) => v !== null && v !== undefined);
      const sampleValue = sampleValues.length > 0 ? sampleValues.slice(0, 3).join(', ') : null;
      const totalCount = countResult?.[0]?.count || 0;

      console.log(`✅ MySQL mapping test successful: ${tableName}.${columnName} = "${sampleValue}" (${totalCount} rows)`);

      return {
        success: true,
        message: 'Mapeamento válido!',
        sample: sampleValue !== null ? String(sampleValue) : '(vazio)',
        count: totalCount
      };

    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return { success: false, message: 'Driver MySQL (mysql2) não está instalado no servidor' };
      }
      return { success: false, message: `Erro MySQL: ${error.message}` };
    } finally {
      if (connection) {
        try { await connection.end(); } catch (e) { }
      }
    }
  }

  /**
   * POST /api/database-connections/save-mappings
   * Salva os mapeamentos de tabela/coluna no banco (formato v1)
   */
  async saveMappings(req: Request, res: Response) {
    try {
      const { connectionId, module, mappings } = req.body;

      if (!connectionId || !module || !mappings) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: connectionId, module, mappings'
        });
      }

      // Buscar a conexão
      const dbConnection = await connectionRepository.findOne({
        where: { id: parseInt(connectionId) }
      });

      if (!dbConnection) {
        return res.status(404).json({
          success: false,
          message: 'Conexão não encontrada'
        });
      }

      // Salvar os mapeamentos como JSON na conexão
      // Extrair apenas os campos do módulo atual e remover o prefixo do módulo
      // Ex: "notas_fiscais_numero_nf_table" -> "numero_nf_table"

      const modulePrefix = `${module}_`;
      const moduleMappings: Record<string, string> = {};

      Object.keys(mappings).forEach(key => {
        if (key.startsWith(modulePrefix)) {
          // Remove o prefixo do módulo para salvar
          const fieldKey = key.substring(modulePrefix.length);
          moduleMappings[fieldKey] = mappings[key];
        }
      });

      // Atualizar a conexão com os mapeamentos
      const existingMappings = dbConnection.mappings ? JSON.parse(dbConnection.mappings as string) : {};
      existingMappings[module] = moduleMappings;

      dbConnection.mappings = JSON.stringify(existingMappings);
      await connectionRepository.save(dbConnection);

      console.log(`✅ Mappings saved for connection ${dbConnection.name}, module: ${module}`);

      return res.json({
        success: true,
        message: 'Mapeamentos salvos com sucesso!'
      });

    } catch (error: any) {
      console.error('Error saving mappings:', error.message);
      return res.status(500).json({
        success: false,
        message: `Erro ao salvar mapeamentos: ${error.message}`
      });
    }
  }

  /**
   * POST /api/database-connections/save-table-mapping
   * Salva o mapeamento de uma tabela específica (formato v2)
   * Compartilha automaticamente com outros módulos que usam a mesma tabela
   */
  async saveTableMapping(req: Request, res: Response) {
    try {
      const { connectionId, tableId, realTableName, columns, tabelas_campo }: {
        connectionId: number;
        tableId: string;           // Ex: "TAB_PRODUTO"
        realTableName: string;     // Nome real no banco: "TAB_PRODUTO"
        columns: Record<string, string>; // Ex: { "codigo_produto": "COD_PRODUTO" }
        tabelas_campo?: Record<string, string>; // Tabela específica por campo: { "preco_venda": "TAB_PRODUTO_LOJA" }
      } = req.body;

      if (!connectionId || !tableId || !realTableName || !columns) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: connectionId, tableId, realTableName, columns'
        });
      }

      // Buscar a conexão
      const dbConnection = await connectionRepository.findOne({
        where: { id: parseInt(String(connectionId)) }
      });

      if (!dbConnection) {
        return res.status(404).json({
          success: false,
          message: 'Conexão não encontrada'
        });
      }

      // Carregar mapeamentos existentes
      let existingMappings: any = {};
      if (dbConnection.mappings) {
        try {
          existingMappings = JSON.parse(dbConnection.mappings as string);
        } catch {
          existingMappings = {};
        }
      }

      // Migrar para formato v2 com estrutura hierárquica (módulos → submódulos)
      if (existingMappings.version !== 2) {
        existingMappings = {
          version: 2,
          tabelas: existingMappings.tabelas || {},
          modulos: existingMappings.modulos || {
            prevencao: {
              nome: 'Prevenção no Radar',
              icone: '🛡️',
              submodulos: {
                bipagens: {
                  nome: 'Prevenção de Bipagens',
                  icone: '📡',
                  tabelas_usadas: ['TAB_PRODUTO', 'TAB_PRODUTO_PDV', 'TAB_OPERADORES']
                },
                pdv: {
                  nome: 'Prevenção PDV',
                  icone: '💳',
                  tabelas_usadas: ['TAB_PRODUTO_PDV', 'TAB_OPERADORES']
                },
                facial: {
                  nome: 'Prevenção Facial',
                  icone: '👤',
                  tabelas_usadas: ['TAB_OPERADORES']
                },
                rupturas: {
                  nome: 'Prevenção Rupturas',
                  icone: '🔍',
                  tabelas_usadas: ['TAB_PRODUTO'] // TAB_RUPTURA é interna (PostgreSQL)
                },
                etiquetas: {
                  nome: 'Prevenção Etiquetas',
                  icone: '🏷️',
                  tabelas_usadas: ['TAB_PRODUTO'] // TAB_ETIQUETA é interna (PostgreSQL)
                },
                quebras: {
                  nome: 'Prevenção Quebras',
                  icone: '💔',
                  tabelas_usadas: ['TAB_PRODUTO'] // TAB_QUEBRA é interna (PostgreSQL)
                },
                producao: {
                  nome: 'Produção',
                  icone: '🏭',
                  tabelas_usadas: ['TAB_PRODUTO'] // TAB_PRODUCAO - verificar se existe no ERP
                },
                hortfruti: {
                  nome: 'Hort Fruti',
                  icone: '🥬',
                  tabelas_usadas: ['TAB_PRODUTO'] // TAB_HORTFRUTI é interna (PostgreSQL)
                }
              }
            },
            gestao: {
              nome: 'Gestão no Radar',
              icone: '📊',
              submodulos: {
                gestao_inteligente: {
                  nome: 'Gestão Inteligente',
                  icone: '🧠',
                  tabelas_usadas: ['TAB_PRODUTO', 'TAB_PRODUTO_PDV']
                },
                estoque_margem: {
                  nome: 'Estoque e Margem',
                  icone: '📦',
                  tabelas_usadas: ['TAB_PRODUTO', 'TAB_PRODUTO_LOJA', 'TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ITENS']
                },
                compra_venda: {
                  nome: 'Compra e Venda',
                  icone: '🛒',
                  tabelas_usadas: ['TAB_PRODUTO', 'TAB_FORNECEDOR', 'TAB_NOTA_FISCAL']
                },
                pedidos: {
                  nome: 'Pedidos',
                  icone: '📋',
                  tabelas_usadas: ['TAB_PRODUTO', 'TAB_FORNECEDOR', 'TAB_PEDIDO']
                },
                ruptura_industria: {
                  nome: 'Ruptura Indústria',
                  icone: '🏭',
                  tabelas_usadas: ['TAB_PRODUTO', 'TAB_FORNECEDOR'] // TAB_RUPTURA é interna
                }
              }
            }
          }
        };
      }

      // Filtrar colunas vazias (não salvar mapeamentos em branco)
      const filteredColumns: Record<string, string> = {};
      for (const [key, value] of Object.entries(columns)) {
        if (value && String(value).trim() !== '') {
          filteredColumns[key] = String(value).trim();
        }
      }

      // Atualizar ou criar mapeamento da tabela
      existingMappings.tabelas[tableId] = {
        nome_real: realTableName,
        colunas: filteredColumns,
        tabelas_campo: tabelas_campo || {} // Tabela específica por campo (quando diferente da tabela principal)
      };

      // Salvar
      dbConnection.mappings = JSON.stringify(existingMappings);
      await connectionRepository.save(dbConnection);

      // Identificar quais submódulos usam essa tabela
      const sharingModules: string[] = [];
      for (const [moduleId, moduleConfig] of Object.entries(existingMappings.modulos)) {
        const mod = moduleConfig as any;
        // Verificar submódulos
        if (mod.submodulos) {
          for (const [subId, subConfig] of Object.entries(mod.submodulos)) {
            const sub = subConfig as any;
            if (sub.tabelas_usadas?.includes(tableId)) {
              sharingModules.push(`${mod.nome} › ${sub.nome}`);
            }
          }
        }
        // Compatibilidade com formato antigo (sem submódulos)
        else if (mod.tabelas_usadas?.includes(tableId)) {
          sharingModules.push(mod.nome || moduleId);
        }
      }

      console.log(`✅ Table mapping saved: ${tableId} -> ${realTableName} (shared with: ${sharingModules.join(', ')})`);
      MappingService.clearCache();

      return res.json({
        success: true,
        message: 'Mapeamento de tabela salvo com sucesso!',
        sharingModules
      });

    } catch (error: any) {
      console.error('Error saving table mapping:', error.message);
      return res.status(500).json({
        success: false,
        message: `Erro ao salvar mapeamento de tabela: ${error.message}`
      });
    }
  }

  /**
   * GET /api/database-connections/:id/mappings
   * Retorna os mapeamentos de uma conexão específica
   */
  async getMappings(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const connection = await connectionRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      let mappings = {};
      if (connection.mappings) {
        try {
          mappings = JSON.parse(connection.mappings as string);
        } catch {
          mappings = {};
        }
      }

      return res.json({
        success: true,
        mappings
      });
    } catch (error: any) {
      console.error('Error getting mappings:', error.message);
      return res.status(500).json({
        success: false,
        message: `Erro ao buscar mapeamentos: ${error.message}`
      });
    }
  }

  /**
   * Testa conexão Oracle
   */
  private async testOracleConnection(conn: DatabaseConnection): Promise<{ success: boolean; message: string }> {
    let connection: oracledb.Connection | null = null;

    try {
      // Detecta se está em ambiente VPS/Docker (NODE_ENV=production ou rodando em container)
      const isVps = process.env.NODE_ENV === 'production' || process.env.DOCKER_CONTAINER === 'true';
      // Usa host_vps quando na VPS, senão usa host local
      const hostToUse = isVps && conn.host_vps ? conn.host_vps : conn.host;
      // Na VPS, usa a porta do túnel SSH ao invés da porta local do Oracle
      let portToUse = conn.port;
      if (isVps && process.env.TUNNEL_ORACLE_PORT) {
        portToUse = parseInt(process.env.TUNNEL_ORACLE_PORT);
      }
      const connectString = `${hostToUse}:${portToUse}/${conn.service || 'orcl'}`;

      console.log(`🔌 Connecting to Oracle: ${connectString} (ambiente: ${isVps ? 'VPS' : 'Local'}, porta original: ${conn.port})`);

      // Inicializa Thick Mode se necessário
      try {
        const isWindows = process.platform === 'win32';
        const oracleClientPath = isWindows
          ? 'C:\\oracle\\instantclient_64\\instantclient_23_4'
          : '/opt/oracle/instantclient_23_4';
        oracledb.initOracleClient({ libDir: oracleClientPath });
      } catch (initError: any) {
        // Ignora se já inicializado
        if (!initError.message?.includes('already been initialized')) {
          console.log('⚠️ Thick mode not available, trying thin mode');
        }
      }

      connection = await oracledb.getConnection({
        user: conn.username,
        password: conn.password,
        connectString
      });

      // Testa com query simples
      const result = await connection.execute("SELECT 'OK' as STATUS FROM DUAL");

      if (result.rows && result.rows.length > 0) {
        console.log(`✅ Oracle connection successful: ${connectString}`);
        return { success: true, message: 'Conexão Oracle estabelecida com sucesso!' };
      }

      return { success: false, message: 'Conexão estabelecida mas query de teste falhou' };
    } catch (error: any) {
      console.error(`❌ Oracle connection failed:`, error.message);
      return { success: false, message: `Falha na conexão Oracle: ${error.message}` };
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (closeError) {
          console.error('Error closing Oracle test connection:', closeError);
        }
      }
    }
  }

  /**
   * Testa conexão SQL Server
   */
  private async testSqlServerConnection(conn: DatabaseConnection): Promise<{ success: boolean; message: string }> {
    try {
      // Importar mssql dinamicamente (pode não estar instalado)
      const mssql = require('mssql');

      const config = {
        user: conn.username,
        password: conn.password,
        server: conn.host,
        port: conn.port,
        database: conn.database || 'master',
        options: {
          encrypt: false,
          trustServerCertificate: true
        },
        connectionTimeout: 30000
      };

      console.log(`🔌 Connecting to SQL Server: ${conn.host}:${conn.port}`);

      const pool = await mssql.connect(config);
      const result = await pool.request().query('SELECT 1 as status');

      await pool.close();

      if (result.recordset && result.recordset.length > 0) {
        console.log(`✅ SQL Server connection successful: ${conn.host}`);
        return { success: true, message: 'Conexão SQL Server estabelecida com sucesso!' };
      }

      return { success: false, message: 'Conexão estabelecida mas query de teste falhou' };
    } catch (error: any) {
      console.error(`❌ SQL Server connection failed:`, error.message);

      // Verificar se o módulo não está instalado
      if (error.code === 'MODULE_NOT_FOUND') {
        return { success: false, message: 'Driver SQL Server (mssql) não está instalado no servidor' };
      }

      return { success: false, message: `Falha na conexão SQL Server: ${error.message}` };
    }
  }

  /**
   * Testa conexão MySQL
   */
  private async testMySqlConnection(conn: DatabaseConnection): Promise<{ success: boolean; message: string }> {
    try {
      // Importar mysql2 dinamicamente (pode não estar instalado)
      const mysql = require('mysql2/promise');

      console.log(`🔌 Connecting to MySQL: ${conn.host}:${conn.port}`);

      const connection = await mysql.createConnection({
        host: conn.host,
        port: conn.port,
        user: conn.username,
        password: conn.password,
        database: conn.database || undefined,
        connectTimeout: 10000
      });

      const [rows] = await connection.execute('SELECT 1 as status');

      await connection.end();

      if (rows && rows.length > 0) {
        console.log(`✅ MySQL connection successful: ${conn.host}`);
        return { success: true, message: 'Conexão MySQL estabelecida com sucesso!' };
      }

      return { success: false, message: 'Conexão estabelecida mas query de teste falhou' };
    } catch (error: any) {
      console.error(`❌ MySQL connection failed:`, error.message);

      if (error.code === 'MODULE_NOT_FOUND') {
        return { success: false, message: 'Driver MySQL (mysql2) não está instalado no servidor' };
      }

      return { success: false, message: `Falha na conexão MySQL: ${error.message}` };
    }
  }

  /**
   * Testa conexão PostgreSQL
   */
  private async testPostgresConnection(conn: DatabaseConnection): Promise<{ success: boolean; message: string }> {
    try {
      // Importar pg dinamicamente (pode não estar instalado)
      const { Client } = require('pg');

      console.log(`🔌 Connecting to PostgreSQL: ${conn.host}:${conn.port}`);

      const client = new Client({
        host: conn.host,
        port: conn.port,
        user: conn.username,
        password: conn.password,
        database: conn.database || 'postgres',
        connectionTimeoutMillis: 30000
      });

      await client.connect();
      const result = await client.query('SELECT 1 as status');
      await client.end();

      if (result.rows && result.rows.length > 0) {
        console.log(`✅ PostgreSQL connection successful: ${conn.host}`);
        return { success: true, message: 'Conexão PostgreSQL estabelecida com sucesso!' };
      }

      return { success: false, message: 'Conexão estabelecida mas query de teste falhou' };
    } catch (error: any) {
      console.error(`❌ PostgreSQL connection failed:`, error.message);

      if (error.code === 'MODULE_NOT_FOUND') {
        return { success: false, message: 'Driver PostgreSQL (pg) não está instalado no servidor' };
      }

      return { success: false, message: `Falha na conexão PostgreSQL: ${error.message}` };
    }
  }
}
