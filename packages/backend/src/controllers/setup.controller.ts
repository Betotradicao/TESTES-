import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import emailService from '../services/email.service';

export class SetupController {
  /**
   * Verifica se o sistema já foi configurado
   */
  async checkSetupStatus(req: Request, res: Response): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT is_setup_completed FROM system_config LIMIT 1'
      );

      const isSetupCompleted = result.rows.length > 0
        ? result.rows[0].is_setup_completed
        : false;

      res.json({ isSetupCompleted });
    } catch (error) {
      console.error('Error checking setup status:', error);
      res.status(500).json({
        error: 'Erro ao verificar status de configuração'
      });
    }
  }

  /**
   * Realiza o setup inicial do sistema
   * Cria o primeiro usuário administrador e configura SMTP
   */
  async performSetup(req: Request, res: Response): Promise<void> {
    try {
      const {
        adminName,
        adminEmail,
        adminPassword,
        recoveryEmail,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpSecure,
        smtpFromEmail,
        smtpFromName
      } = req.body;

      // Validar dados obrigatórios
      if (!adminName || !adminEmail || !adminPassword || !recoveryEmail) {
        res.status(400).json({
          error: 'Nome, email, senha e email de recuperação são obrigatórios'
        });
        return;
      }

      // Validar configuração SMTP (obrigatória)
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFromEmail) {
        res.status(400).json({
          error: 'Configuração SMTP completa é obrigatória para envio de emails'
        });
        return;
      }

      // Verificar se já existe configuração
      const configCheck = await pool.query(
        'SELECT is_setup_completed FROM system_config LIMIT 1'
      );

      if (configCheck.rows.length > 0 && configCheck.rows[0].is_setup_completed) {
        res.status(400).json({
          error: 'Sistema já foi configurado anteriormente'
        });
        return;
      }

      // Verificar se já existe usuário com este email
      const userCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [adminEmail]
      );

      if (userCheck.rows.length > 0) {
        res.status(400).json({
          error: 'Já existe um usuário com este email'
        });
        return;
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Iniciar transação
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Criar usuário administrador
        const userResult = await client.query(
          `INSERT INTO users
           (name, email, password, role, recovery_email, is_first_login, last_password_change)
           VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
           RETURNING id, name, email`,
          [adminName, adminEmail, hashedPassword, 'admin', recoveryEmail]
        );

        const newUser = userResult.rows[0];

        // Salvar/atualizar configuração do sistema
        if (configCheck.rows.length > 0) {
          // Atualizar configuração existente
          await client.query(
            `UPDATE system_config
             SET is_setup_completed = TRUE,
                 smtp_host = $1,
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
        } else {
          // Criar nova configuração
          await client.query(
            `INSERT INTO system_config
             (is_setup_completed, smtp_host, smtp_port, smtp_user, smtp_password,
              smtp_secure, smtp_from_email, smtp_from_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              true,
              smtpHost,
              smtpPort,
              smtpUser,
              smtpPassword,
              smtpSecure !== false,
              smtpFromEmail,
              smtpFromName || 'Sistema Prevenção no Radar'
            ]
          );
        }

        // Registrar log de criação de senha
        await client.query(
          `INSERT INTO password_change_logs
           (user_id, change_type, changed_by_user_id, change_ip, change_user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            newUser.id,
            'initial_setup',
            newUser.id,
            req.ip,
            req.get('user-agent') || 'unknown'
          ]
        );

        await client.query('COMMIT');

        // Enviar email de boas-vindas (não bloquear resposta)
        emailService.sendWelcomeEmail({
          userName: newUser.name,
          userEmail: newUser.email,
          recoveryEmail: recoveryEmail
        }).catch(error => {
          console.error('Error sending welcome email:', error);
        });

        res.status(201).json({
          message: 'Sistema configurado com sucesso',
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email
          }
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error performing setup:', error);
      res.status(500).json({
        error: 'Erro ao configurar sistema'
      });
    }
  }

  /**
   * Testa a conexão SMTP antes de salvar
   */
  async testSmtpConnection(req: Request, res: Response): Promise<void> {
    try {
      const {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpSecure
      } = req.body;

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
        res.status(400).json({
          error: 'Configuração SMTP incompleta'
        });
        return;
      }

      // Temporariamente salvar config para teste
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Verificar se já existe config
        const configCheck = await client.query(
          'SELECT id FROM system_config LIMIT 1'
        );

        if (configCheck.rows.length > 0) {
          await client.query(
            `UPDATE system_config
             SET smtp_host = $1,
                 smtp_port = $2,
                 smtp_user = $3,
                 smtp_password = $4,
                 smtp_secure = $5,
                 updated_at = NOW()`,
            [smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure !== false]
          );
        } else {
          await client.query(
            `INSERT INTO system_config
             (smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure)
             VALUES ($1, $2, $3, $4, $5)`,
            [smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure !== false]
          );
        }

        // Testar conexão
        const isValid = await emailService.testSmtpConnection();

        if (isValid) {
          await client.query('COMMIT');
          res.json({
            success: true,
            message: 'Conexão SMTP estabelecida com sucesso'
          });
        } else {
          await client.query('ROLLBACK');
          res.status(400).json({
            error: 'Falha ao conectar com servidor SMTP. Verifique as credenciais.'
          });
        }

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error testing SMTP:', error);
      res.status(500).json({
        error: 'Erro ao testar conexão SMTP'
      });
    }
  }
}

export default new SetupController();
