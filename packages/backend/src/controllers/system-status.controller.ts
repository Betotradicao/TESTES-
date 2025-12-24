import { Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'prevencao_db',
});

/**
 * Retorna o status do cron de verificação diária
 */
export async function getCronStatus(req: Request, res: Response) {
  try {
    const client = await pool.connect();

    try {
      // Buscar última execução do cron (verificações de hoje)
      // Última vez que vendas foram cruzadas com bipagens (updated_at da tabela sells)
      const lastRunQuery = `
        SELECT
          MAX(s.updated_at) as last_run,
          COUNT(DISTINCT s.id) as vendas_processadas,
          COUNT(DISTINCT s.bip_id) as bipagens_verificadas
        FROM sells s
        WHERE s.bip_id IS NOT NULL
          AND DATE(s.updated_at) = CURRENT_DATE
      `;

      const result = await client.query(lastRunQuery);
      const row = result.rows[0];

      // Determinar status
      let status = 'ok';
      const lastRunTime = row.last_run ? new Date(row.last_run) : null;
      const now = new Date();

      if (!lastRunTime || (now.getTime() - lastRunTime.getTime()) > 300000) {
        // Mais de 5 minutos sem executar
        status = 'warning';
      }

      res.json({
        status,
        lastRun: lastRunTime,
        vendasProcessadas: parseInt(row.vendas_processadas) || 0,
        bipagensVerificadas: parseInt(row.bipagens_verificadas) || 0,
        lastError: null,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Erro ao buscar status do cron:', error);
    res.status(500).json({
      error: 'Erro ao buscar status do cron',
      details: error.message,
    });
  }
}

/**
 * Retorna o status do barcode scanner
 */
export async function getBarcodeStatus(req: Request, res: Response) {
  try {
    const client = await pool.connect();

    try {
      // Buscar estatísticas de bipagens
      const statsQuery = `
        SELECT
          MAX(event_date) as last_bip_time,
          COUNT(*) FILTER (WHERE DATE(event_date) = CURRENT_DATE) as total_today,
          COUNT(*) FILTER (WHERE status = 'pending') as pendentes
        FROM bips
      `;

      const result = await client.query(statsQuery);
      const row = result.rows[0];

      // Buscar token atual (da tabela configurations)
      const tokenQuery = `
        SELECT value
        FROM configurations
        WHERE key = 'api_token'
        LIMIT 1
      `;

      const tokenResult = await client.query(tokenQuery);
      const token = tokenResult.rows[0]?.value;

      // Determinar status
      let status = 'ok';
      const lastBipTime = row.last_bip_time ? new Date(row.last_bip_time) : null;
      const now = new Date();

      if (!lastBipTime) {
        status = 'warning';
      } else if (now.getTime() - lastBipTime.getTime() > 3600000) {
        // Mais de 1 hora sem bipar
        status = 'warning';
      }

      res.json({
        status,
        lastBipTime,
        totalToday: parseInt(row.total_today) || 0,
        pendentes: parseInt(row.pendentes) || 0,
        token: token || null,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Erro ao buscar status do barcode:', error);
    res.status(500).json({
      error: 'Erro ao buscar status do barcode',
      details: error.message,
    });
  }
}

/**
 * Testa conectividade com a API Zanthus
 */
export async function testZanthusConnection(req: Request, res: Response) {
  try {
    const zanthusUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

    const testQuery = {
      ZMI: {
        DATABASES: {
          DATABASE: {
            '@attributes': {
              NAME: 'MANAGER',
              AUTOCOMMIT_VALUE: '1000',
              AUTOCOMMIT_ENABLED: '1',
              HALTONERROR: '1',
            },
            COMMANDS: {
              SELECT: {
                MERCADORIAS: {
                  MERCADORIA: {
                    SQL: 'SELECT 1 as TEST FROM DUAL',
                  },
                },
              },
            },
          },
        },
      },
    };

    const startTime = Date.now();
    const response = await axios.post(
      zanthusUrl,
      `str_json=${encodeURIComponent(JSON.stringify(testQuery))}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const responseTime = Date.now() - startTime;

    res.json({
      status: response.status === 200 ? 'ok' : 'error',
      responseTime,
      statusCode: response.status,
      data: response.data,
    });
  } catch (error: any) {
    console.error('❌ Erro ao testar conexão Zanthus:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      code: error.code,
      responseStatus: error.response?.status,
    });
  }
}
