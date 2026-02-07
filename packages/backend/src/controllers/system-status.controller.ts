import { Request, Response } from 'express';
import { Pool } from 'pg';
import { SellsSyncService } from '../services/sells-sync.service';

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
 * Força sincronização de vendas manualmente
 */
export async function forceSyncSells(_req: Request, res: Response) {
  try {
    console.log('🔄 Forçando sincronização de vendas...');

    // Disparar sync em background (não bloqueia a resposta)
    SellsSyncService.syncToday().catch(err => {
      console.error('❌ Erro no sync forçado:', err);
    });

    const lastStats = SellsSyncService.getLastStats();

    res.json({
      success: true,
      message: 'Sincronização iniciada',
      lastStats,
    });
  } catch (error: any) {
    console.error('❌ Erro ao forçar sync:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao forçar sincronização',
      details: error.message,
    });
  }
}

/**
 * Retorna logs de webhook com paginação e filtros
 */
export async function getWebhookLogs(req: Request, res: Response) {
  try {
    const client = await pool.connect();

    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      // Construir query com filtro opcional
      let whereClause = '';
      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        whereClause = `WHERE status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Buscar logs com paginação
      const logsQuery = `
        SELECT *
        FROM webhook_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const result = await client.query(logsQuery, params);

      // Contar total para paginação
      const countParams = status && status !== 'all' ? [status] : [];
      const countQuery = `
        SELECT COUNT(*) as total
        FROM webhook_logs
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Contar por status para mostrar resumo
      const summaryQuery = `
        SELECT
          status,
          COUNT(*) as count
        FROM webhook_logs
        WHERE created_at >= CURRENT_DATE
        GROUP BY status
      `;
      const summaryResult = await client.query(summaryQuery);

      const summary = {
        ok: 0,
        rejected: 0,
        error: 0
      };
      summaryResult.rows.forEach((row: any) => {
        if (row.status === 'ok') summary.ok = parseInt(row.count);
        else if (row.status === 'rejected') summary.rejected = parseInt(row.count);
        else if (row.status === 'error') summary.error = parseInt(row.count);
      });

      res.json({
        logs: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        summary
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Erro ao buscar logs de webhook:', error);
    res.status(500).json({
      error: 'Erro ao buscar logs de webhook',
      details: error.message,
    });
  }
}
