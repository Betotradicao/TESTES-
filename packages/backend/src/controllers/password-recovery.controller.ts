import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { emailService } from '../services/email.service';

export class PasswordRecoveryController {
  // Solicitar recuperação de senha
  static async requestPasswordRecovery(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });

      // Por segurança, sempre retornar sucesso mesmo se o email não existir
      // Isso previne que atacantes descubram quais emails estão cadastrados
      if (!user) {
        return res.json({
          message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação',
          success: true
        });
      }

      // Gerar token de recuperação
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hora

      // Salvar token no usuário
      user.resetPasswordToken = resetTokenHash;
      user.resetPasswordExpires = resetTokenExpires;
      await userRepository.save(user);

      // URL de recuperação (frontend)
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3004'}/reset-password?token=${resetToken}`;

      // Enviar email de recuperação
      const emailSent = await emailService.sendPasswordRecoveryEmail(
        user.email,
        resetUrl,
        user.name || 'Usuário'
      );

      if (emailSent) {
        console.log(`✅ Email de recuperação enviado para: ${user.email}`);
      } else {
        // Se falhar ao enviar email, mostrar o link no console
        console.log('\n========================================');
        console.log('📧 RECUPERAÇÃO DE SENHA SOLICITADA');
        console.log('❌ Falha ao enviar email - Link gerado:');
        console.log('========================================');
        console.log(`Usuário: ${user.name} (${user.email})`);
        console.log(`Link de recuperação (válido por 1 hora):`);
        console.log(resetUrl);
        console.log('========================================\n');
      }

      return res.json({
        message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação',
        success: true
      });

    } catch (error) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      return res.status(500).json({ error: 'Erro ao processar solicitação' });
    }
  }

  // Validar token de recuperação
  static async validateResetToken(req: Request, res: Response) {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token inválido' });
      }

      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const userRepository = AppDataSource.getRepository(User);

      const user = await userRepository.findOne({
        where: {
          resetPasswordToken: resetTokenHash
        }
      });

      if (!user || !user.resetPasswordExpires) {
        return res.status(400).json({ error: 'Token inválido ou expirado' });
      }

      if (user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ error: 'Token expirado' });
      }

      return res.json({
        valid: true,
        message: 'Token válido',
        email: user.email
      });

    } catch (error) {
      console.error('Erro ao validar token:', error);
      return res.status(500).json({ error: 'Erro ao validar token' });
    }
  }

  // Resetar senha usando token
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
      }

      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const userRepository = AppDataSource.getRepository(User);

      const user = await userRepository.findOne({
        where: {
          resetPasswordToken: resetTokenHash
        }
      });

      if (!user || !user.resetPasswordExpires) {
        return res.status(400).json({ error: 'Token inválido ou expirado' });
      }

      if (user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ error: 'Token expirado. Solicite uma nova recuperação de senha.' });
      }

      // Atualizar senha (será hasheada pelo @BeforeInsert/@BeforeUpdate do User entity)
      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await userRepository.save(user);

      console.log(`✅ Senha redefinida para usuário: ${user.email}`);

      return res.json({
        message: 'Senha redefinida com sucesso',
        success: true
      });

    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      return res.status(500).json({ error: 'Erro ao resetar senha' });
    }
  }
}
