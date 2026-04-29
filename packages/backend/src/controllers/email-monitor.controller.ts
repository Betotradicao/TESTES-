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

      // Return full config including password (internal system, not public facing)
      return res.json(config);
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
      if (app_password !== undefined && app_password !== '') {
        // Only update if a new password is provided
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
   * GET /api/email-monitor/facial-logs
   * Logs com anexo + status=success + image_path (Reconhecimento Facial)
   */
  async getFacialLogs(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
      const logs = await EmailMonitorService.getFacialLogs(limit);
      return res.json({ logs, total: logs.length });
    } catch (error) {
      console.error('Error fetching facial logs:', error);
      return res.status(500).json({ error: 'Failed to fetch facial logs' });
    }
  }

  /**
   * GET /api/email-monitor/view/:id
   * Pagina publica que exibe o conteudo do email (usado em link curto no WhatsApp)
   */
  async viewEmail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const log = await EmailMonitorService.getLogById(id);
      if (!log) {
        return res.status(404).send('<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>❌ Email não encontrado</h2></body></html>');
      }
      const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const body = esc(log.email_body || '(sem corpo)').replace(/\n/g, '<br>');
      const html = `<!DOCTYPE html>
<html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(log.email_subject)}</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:0;background:#f5f5f5;color:#222}
.container{max-width:640px;margin:0 auto;background:white;min-height:100vh;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.header{background:linear-gradient(135deg,#ea580c,#f97316);color:white;padding:20px}
.header h1{margin:0;font-size:18px}
.meta{background:#fafafa;padding:16px 20px;border-bottom:1px solid #eee;font-size:13px;color:#555}
.meta div{margin:4px 0}
.meta strong{color:#222;display:inline-block;min-width:72px}
.body{padding:20px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.footer{padding:16px 20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
</style></head>
<body><div class="container">
<div class="header"><h1>📧 ${esc(log.email_subject)}</h1></div>
<div class="meta">
<div><strong>De:</strong> ${esc(log.sender)}</div>
<div><strong>Data:</strong> ${new Date(log.processed_at).toLocaleString('pt-BR')}</div>
<div><strong>Status:</strong> ${esc(log.status)}</div>
</div>
<div class="body">${body}</div>
<div class="footer">Radar 360 — Monitor de Emails</div>
</div></body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (error) {
      console.error('Error viewing email:', error);
      return res.status(500).send('<html><body><h2>Erro ao carregar email</h2></body></html>');
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
