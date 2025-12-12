import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import emailService from '../services/email.service';

export class UserSecurityController {
  /**
   * Obtém configurações de segurança do usuário atual
   */
  async getSecuritySettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Usuário não autenticado'
        });
        return;
      }

      const result = await pool.query(
        `SELECT
           email,
           recovery_email,
           last_password_change,
           is_first_login,
           failed_login_attempts,
           locked_until
         FROM users
         WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Usuário não encontrado'
        });
        return;
      }

      const user = result.rows[0];

      res.json({
        email: user.email,
        recoveryEmail: user.recovery_email,
        lastPasswordChange: user.last_password_change,
        isFirstLogin: user.is_first_login,
        failedLoginAttempts: user.failed_login_attempts,
        isLocked: user.locked_until ? new Date(user.locked_until) > new Date() : false
      });

    } catch (error) {
      console.error('Error getting security settings:', error);
      res.status(500).json({
        error: 'Erro ao buscar configurações de segurança'
      });
    }
  }

  /**
   * Atualiza email de recuperação
   */
  async updateRecoveryEmail(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { recoveryEmail } = req.body;

      if (!userId) {
        res.status(401).json({
          error: 'Usuário não autenticado'
        });
        return;
      }

      if (!recoveryEmail) {
        res.status(400).json({
          error: 'Email de recuperação é obrigatório'
        });
        return;
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recoveryEmail)) {
        res.status(400).json({
          error: 'Email de recuperação inválido'
        });
        return;
      }

      await pool.query(
        'UPDATE users SET recovery_email = $1 WHERE id = $2',
        [recoveryEmail, userId]
      );

      res.json({
        message: 'Email de recuperação atualizado com sucesso'
      });

    } catch (error) {
      console.error('Error updating recovery email:', error);
      res.status(500).json({
        error: 'Erro ao atualizar email de recuperação'
      });
    }
  }

  /**
   * Altera senha do usuário (requer senha atual)
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        res.status(401).json({
          error: 'Usuário não autenticado'
        });
        return;
      }

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: 'Senha atual e nova senha são obrigatórias'
        });
        return;
      }

      // Validar força da nova senha
      if (newPassword.length < 6) {
        res.status(400).json({
          error: 'Nova senha deve ter no mínimo 6 caracteres'
        });
        return;
      }

      // Buscar usuário
      const userResult = await pool.query(
        'SELECT id, name, email, password, recovery_email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({
          error: 'Usuário não encontrado'
        });
        return;
      }

      const user = userResult.rows[0];

      // Verificar senha atual
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        res.status(400).json({
          error: 'Senha atual incorreta'
        });
        return;
      }

      // Verificar se nova senha é diferente da atual
      const isSamePassword = await bcrypt.compare(newPassword, user.password);

      if (isSamePassword) {
        res.status(400).json({
          error: 'Nova senha deve ser diferente da senha atual'
        });
        return;
      }

      // Hash da nova senha
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Atualizar senha
        await client.query(
          `UPDATE users
           SET password = $1,
               last_password_change = NOW(),
               is_first_login = FALSE
           WHERE id = $2`,
          [hashedPassword, userId]
        );

        // Registrar log de alteração
        await client.query(
          `INSERT INTO password_change_logs
           (user_id, change_type, changed_by_user_id, change_ip, change_user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'user_change',
            userId,
            req.ip || 'unknown',
            req.get('user-agent') || 'unknown'
          ]
        );

        await client.query('COMMIT');

        // Enviar email de confirmação
        if (user.recovery_email) {
          emailService.sendPasswordChangedEmail({
            userName: user.name,
            userEmail: user.recovery_email,
            changeTime: new Date().toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo'
            }),
            changeIp: req.ip || 'Desconhecido'
          }).catch(error => {
            console.error('Error sending password changed email:', error);
          });
        }

        res.json({
          message: 'Senha alterada com sucesso'
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({
        error: 'Erro ao alterar senha'
      });
    }
  }

  /**
   * Obtém histórico de alterações de senha
   */
  async getPasswordHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Usuário não autenticado'
        });
        return;
      }

      const result = await pool.query(
        `SELECT
           change_type,
           change_ip,
           created_at
         FROM password_change_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      res.json({
        history: result.rows.map(row => ({
          type: row.change_type,
          ip: row.change_ip,
          timestamp: row.created_at
        }))
      });

    } catch (error) {
      console.error('Error getting password history:', error);
      res.status(500).json({
        error: 'Erro ao buscar histórico de senhas'
      });
    }
  }

  /**
   * Obtém tentativas de login recentes
   */
  async getLoginAttempts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          error: 'Usuário não autenticado'
        });
        return;
      }

      // Buscar email do usuário
      const userResult = await pool.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({
          error: 'Usuário não encontrado'
        });
        return;
      }

      const userEmail = userResult.rows[0].email;

      // Buscar tentativas de login
      const result = await pool.query(
        `SELECT
           success,
           attempt_ip,
           failure_reason,
           created_at
         FROM login_attempts
         WHERE email = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [userEmail]
      );

      res.json({
        attempts: result.rows.map(row => ({
          success: row.success,
          ip: row.attempt_ip,
          reason: row.failure_reason,
          timestamp: row.created_at
        }))
      });

    } catch (error) {
      console.error('Error getting login attempts:', error);
      res.status(500).json({
        error: 'Erro ao buscar tentativas de login'
      });
    }
  }

  /**
   * Atualiza configurações SMTP (apenas admin)
   */
  async updateSmtpSettings(req: Request, res: Response): Promise<void> {
    try {
      const userRole = (req as any).user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({
          error: 'Apenas administradores podem alterar configurações SMTP'
        });
        return;
      }

      const {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpSecure,
        smtpFromEmail,
        smtpFromName
      } = req.body;

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFromEmail) {
        res.status(400).json({
          error: 'Configuração SMTP incompleta'
        });
        return;
      }

      // Atualizar configuração
      await pool.query(
        `UPDATE system_config
         SET smtp_host = $1,
             smtp_port = $2,
             smtp_user = $3,
             smtp_password = $4,
             smtp_secure = $5,
             smtp_from_email = $6,
             smtp_from_name = $7,
             updated_at = NOW()`,
        [
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPassword,
          smtpSecure !== false,
          smtpFromEmail,
          smtpFromName || 'Sistema Prevenção no Radar'
        ]
      );

      // Testar conexão
      const isValid = await emailService.testSmtpConnection();

      if (!isValid) {
        res.status(400).json({
          error: 'Configuração salva mas falha ao conectar. Verifique as credenciais.'
        });
        return;
      }

      res.json({
        message: 'Configurações SMTP atualizadas com sucesso'
      });

    } catch (error) {
      console.error('Error updating SMTP settings:', error);
      res.status(500).json({
        error: 'Erro ao atualizar configurações SMTP'
      });
    }
  }

  /**
   * Obtém configurações SMTP atuais (apenas admin, sem expor senha)
   */
  async getSmtpSettings(req: Request, res: Response): Promise<void> {
    try {
      const userRole = (req as any).user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({
          error: 'Apenas administradores podem visualizar configurações SMTP'
        });
        return;
      }

      const result = await pool.query(
        `SELECT
           smtp_host,
           smtp_port,
           smtp_user,
           smtp_secure,
           smtp_from_email,
           smtp_from_name
         FROM system_config
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        res.json({
          configured: false
        });
        return;
      }

      const config = result.rows[0];

      res.json({
        configured: true,
        smtpHost: config.smtp_host,
        smtpPort: config.smtp_port,
        smtpUser: config.smtp_user,
        smtpSecure: config.smtp_secure,
        smtpFromEmail: config.smtp_from_email,
        smtpFromName: config.smtp_from_name
      });

    } catch (error) {
      console.error('Error getting SMTP settings:', error);
      res.status(500).json({
        error: 'Erro ao buscar configurações SMTP'
      });
    }
  }
}

export default new UserSecurityController();
