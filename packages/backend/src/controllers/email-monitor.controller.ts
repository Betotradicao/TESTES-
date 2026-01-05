import { Request, Response } from 'express';
import { EmailMonitorService } from '../services/email-monitor.service';

export class EmailMonitorController {
  /**
   * GET /api/email-monitor/config
   * Buscar configurações do email monitor
   */
  async getConfig(req: Request, res: Response) {
    try {
      const config = await EmailMonitorService.getConfig();

      // Don't send the app_password to frontend for security
      return res.json({
        ...config,
        app_password: config.app_password ? '***************' : ''
      });
    } catch (error) {
      console.error('Error fetching email monitor config:', error);
      return res.status(500).json({ error: 'Failed to fetch email monitor configuration' });
    }
  }

  /**
   * PUT /api/email-monitor/config
   * Atualizar configurações do email monitor
   */
  async updateConfig(req: Request, res: Response) {
    try {
      const {
        email,
        app_password,
        subject_filter,
        check_interval_seconds,
        whatsapp_group_id,
        enabled
      } = req.body;

      const updates: any = {};

      if (email !== undefined) updates.email = email;
      if (app_password !== undefined && app_password !== '***************') {
        // Only update if it's not the masked value
        updates.app_password = app_password;
      }
      if (subject_filter !== undefined) updates.subject_filter = subject_filter;
      if (check_interval_seconds !== undefined) {
        updates.check_interval_seconds = parseInt(check_interval_seconds);
      }
      if (whatsapp_group_id !== undefined) updates.whatsapp_group_id = whatsapp_group_id;
      if (enabled !== undefined) updates.enabled = enabled === true || enabled === 'true';

      await EmailMonitorService.saveConfig(updates);

      return res.json({
        message: 'Configurações atualizadas com sucesso',
        config: {
          ...updates,
          app_password: updates.app_password ? '***************' : undefined
        }
      });
    } catch (error) {
      console.error('Error updating email monitor config:', error);
      return res.status(500).json({ error: 'Failed to update email monitor configuration' });
    }
  }

  /**
   * POST /api/email-monitor/test
   * Testar conexão com Gmail
   */
  async testConnection(req: Request, res: Response) {
    try {
      const result = await EmailMonitorService.testConnection();

      if (result.success) {
        return res.json({
          success: true,
          message: result.message
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.message
        });
      }
    } catch (error) {
      console.error('Error testing email connection:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao testar conexão'
      });
    }
  }

  /**
   * POST /api/email-monitor/check
   * Verificar emails manualmente (para teste)
   */
  async checkEmails(req: Request, res: Response) {
    try {
      // Run check in background
      EmailMonitorService.checkNewEmails().catch(err => {
        console.error('Error checking emails:', err);
      });

      return res.json({
        message: 'Verificação de emails iniciada em segundo plano'
      });
    } catch (error) {
      console.error('Error triggering email check:', error);
      return res.status(500).json({ error: 'Failed to trigger email check' });
    }
  }

  /**
   * GET /api/email-monitor/logs
   * Buscar logs de emails processados
   */
  async getLogs(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await EmailMonitorService.getLogs(limit);

      return res.json({
        logs,
        total: logs.length
      });
    } catch (error) {
      console.error('Error fetching email monitor logs:', error);
      return res.status(500).json({ error: 'Failed to fetch email monitor logs' });
    }
  }

  /**
   * GET /api/email-monitor/whatsapp-groups
   * Buscar grupos do WhatsApp via Evolution API
   */
  async getWhatsAppGroups(req: Request, res: Response) {
    try {
      const groups = await EmailMonitorService.getWhatsAppGroups();
      return res.json({ groups });
    } catch (error) {
      console.error('Error fetching WhatsApp groups:', error);
      return res.status(500).json({
        error: 'Failed to fetch WhatsApp groups',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/email-monitor/reprocess-last
   * Reprocessar o último email recebido (para testes)
   */
  async reprocessLastEmail(req: Request, res: Response) {
    try {
      const result = await EmailMonitorService.reprocessLastEmail();

      if (result.success) {
        return res.json({
          success: true,
          message: result.message
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.message
        });
      }
    } catch (error) {
      console.error('Error reprocessing last email:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao reprocessar email'
      });
    }
  }

  /**
   * DELETE /api/email-monitor/logs/:id
   * Deletar um log específico e sua imagem associada
   */
  async deleteLog(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'ID do log é obrigatório'
        });
      }

      const result = await EmailMonitorService.deleteLog(id);

      if (result.success) {
        return res.json({
          success: true,
          message: result.message
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.message
        });
      }
    } catch (error) {
      console.error('Error deleting log:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao deletar log'
      });
    }
  }
}
