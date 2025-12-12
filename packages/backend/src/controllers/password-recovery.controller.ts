import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import tokenService from '../services/token.service';
import emailService from '../services/email.service';

export class PasswordRecoveryController {
  /**
   * Solicita recuperação de senha
   * Envia email com link de reset
   */
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          error: 'Email é obrigatório'
        });
        return;
      }

      // Buscar usuário
      const userResult = await pool.query(
        'SELECT id, name, email, recovery_email FROM users WHERE email = $1',
        [email]
      );

      // Sempre retornar sucesso (segurança - não revelar se email existe)
      if (userResult.rows.length === 0) {
        res.json({
          message: 'Se o email existir, um link de recuperação será enviado'
        });
        return;
      }

      const user = userResult.rows[0];

      // Verificar se usuário tem email de recuperação
      if (!user.recovery_email) {
        res.status(400).json({
          error: 'Este usuário não possui email de recuperação configurado. Entre em contato com o administrador.'
        });
        return;
      }

      // Invalidar tokens antigos do usuário
      await tokenService.invalidateAllUserTokens(user.id);

      // Criar novo token
      const token = await tokenService.createPasswordResetToken(
        user.id,
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown'
      );

      // Gerar link de reset (frontend irá usar este token)
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3004'}/reset-password?token=${token}`;

      // Registrar tentativa de recuperação
      await pool.query(
        `INSERT INTO login_attempts
         (email, success, attempt_ip, attempt_user_agent, failure_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          email,
          true,
          req.ip || 'unknown',
          req.get('user-agent') || 'unknown',
          'password_reset_requested'
        ]
      );

      // Enviar email de recuperação
      await emailService.sendPasswordResetEmail({
        userName: user.name,
        userEmail: user.recovery_email,
        resetLink: resetLink,
        requestIp: req.ip || 'Desconhecido',
        requestTime: new Date().toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        })
      });

      res.json({
        message: 'Email de recuperação enviado com sucesso para o endereço cadastrado'
      });

    } catch (error) {
      console.error('Error requesting password reset:', error);
      res.status(500).json({
        error: 'Erro ao solicitar recuperação de senha'
      });
    }
  }

  /**
   * Valida token de recuperação
   */
  async validateResetToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          error: 'Token é obrigatório'
        });
        return;
      }

      // Buscar token sem consumi-lo
      const result = await pool.query(
        `SELECT id, user_id, expires_at, used
         FROM password_reset_tokens
         WHERE token = $1`,
        [token]
      );

      if (result.rows.length === 0) {
        res.status(400).json({
          error: 'Token inválido ou expirado',
          valid: false
        });
        return;
      }

      const tokenData = result.rows[0];

      // Verificar se já foi usado
      if (tokenData.used) {
        res.status(400).json({
          error: 'Este link já foi utilizado',
          valid: false
        });
        return;
      }

      // Verificar se expirou
      if (new Date(tokenData.expires_at) < new Date()) {
        res.status(400).json({
          error: 'Este link expirou. Solicite uma nova recuperação de senha.',
          valid: false
        });
        return;
      }

      // Token válido
      res.json({
        valid: true,
        message: 'Token válido'
      });

    } catch (error) {
      console.error('Error validating token:', error);
      res.status(500).json({
        error: 'Erro ao validar token'
      });
    }
  }

  /**
   * Reseta a senha usando o token
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          error: 'Token e nova senha são obrigatórios'
        });
        return;
      }

      // Validar força da senha
      if (newPassword.length < 6) {
        res.status(400).json({
          error: 'Senha deve ter no mínimo 6 caracteres'
        });
        return;
      }

      // Validar e consumir token
      const userId = await tokenService.validateAndConsumeToken(token);

      if (!userId) {
        res.status(400).json({
          error: 'Token inválido, expirado ou já utilizado'
        });
        return;
      }

      // Buscar dados do usuário
      const userResult = await pool.query(
        'SELECT id, name, email, recovery_email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({
          error: 'Usuário não encontrado'
        });
        return;
      }

      const user = userResult.rows[0];

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
               is_first_login = FALSE,
               failed_login_attempts = 0,
               locked_until = NULL
           WHERE id = $2`,
          [hashedPassword, userId]
        );

        // Registrar log de alteração
        await client.query(
          `INSERT INTO password_change_logs
           (user_id, change_type, change_ip, change_user_agent)
           VALUES ($1, $2, $3, $4)`,
          [
            userId,
            'password_reset',
            req.ip || 'unknown',
            req.get('user-agent') || 'unknown'
          ]
        );

        // Registrar tentativa de login bem-sucedida
        await client.query(
          `INSERT INTO login_attempts
           (email, success, attempt_ip, attempt_user_agent)
           VALUES ($1, $2, $3, $4)`,
          [
            user.email,
            true,
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
      console.error('Error resetting password:', error);
      res.status(500).json({
        error: 'Erro ao redefinir senha'
      });
    }
  }
}

export default new PasswordRecoveryController();
