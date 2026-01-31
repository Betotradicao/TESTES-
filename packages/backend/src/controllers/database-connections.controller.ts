import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
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

      // Não retornar senha real
      const sanitized = connections.map(conn => ({
        ...conn,
        password: '***'
      }));

      return res.json(sanitized);
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

      // Não retornar senha real
      return res.json({
        ...connection,
        password: '***'
      });
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
      const { name, type, host, port, service, database, username, password, schema, is_default } = req.body;

      if (!name || !type || !host || !port || !username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Se é default, remove default de outras conexões
      if (is_default) {
        await connectionRepository.update({}, { is_default: false });
      }

      const connection = connectionRepository.create({
        name,
        type,
        host,
        port: parseInt(port),
        service,
        database,
        username,
        password,
        schema,
        is_default: is_default || false,
        status: ConnectionStatus.INACTIVE
      });

      const saved = await connectionRepository.save(connection);

      console.log(`✅ Database connection created: ${saved.name} (${saved.type})`);

      return res.status(201).json({
        ...saved,
        password: '***'
      });
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
      const { name, type, host, port, service, database, username, password, schema, is_default } = req.body;

      const connection = await connectionRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Se está mudando para default, remove default de outras
      if (is_default && !connection.is_default) {
        await connectionRepository.update({}, { is_default: false });
      }

      // Atualizar campos (password só se fornecida nova)
      connection.name = name || connection.name;
      connection.type = type || connection.type;
      connection.host = host || connection.host;
      connection.port = port ? parseInt(port) : connection.port;
      connection.service = service !== undefined ? service : connection.service;
      connection.database = database !== undefined ? database : connection.database;
      connection.username = username || connection.username;
      if (password && password !== '***') {
        connection.password = password;
      }
      connection.schema = schema !== undefined ? schema : connection.schema;
      connection.is_default = is_default !== undefined ? is_default : connection.is_default;

      const saved = await connectionRepository.save(connection);

      console.log(`✅ Database connection updated: ${saved.name}`);

      return res.json({
        ...saved,
        password: '***'
      });
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
      const { type, host, port, service, database, username, password, schema } = req.body;

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
   * Testa conexão Oracle
   */
  private async testOracleConnection(conn: DatabaseConnection): Promise<{ success: boolean; message: string }> {
    let connection: oracledb.Connection | null = null;

    try {
      const connectString = `${conn.host}:${conn.port}/${conn.service || 'orcl'}`;

      console.log(`🔌 Connecting to Oracle: ${connectString}`);

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
        console.log(`✅ Oracle connection successful: ${conn.host}`);
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
        connectionTimeout: 10000
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
        connectionTimeoutMillis: 10000
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
