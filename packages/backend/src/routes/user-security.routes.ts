import { Router } from 'express';
import userSecurityController from '../controllers/user-security.controller';

const router = Router();

/**
 * @route   GET /api/user-security/settings
 * @desc    Obtém configurações de segurança do usuário
 * @access  Private
 */
router.get(
  '/settings',
  userSecurityController.getSecuritySettings.bind(userSecurityController)
);

/**
 * @route   PUT /api/user-security/recovery-email
 * @desc    Atualiza email de recuperação
 * @access  Private
 */
router.put(
  '/recovery-email',
  userSecurityController.updateRecoveryEmail.bind(userSecurityController)
);

/**
 * @route   POST /api/user-security/change-password
 * @desc    Altera senha do usuário
 * @access  Private
 */
router.post(
  '/change-password',
  userSecurityController.changePassword.bind(userSecurityController)
);

/**
 * @route   GET /api/user-security/password-history
 * @desc    Obtém histórico de alterações de senha
 * @access  Private
 */
router.get(
  '/password-history',
  userSecurityController.getPasswordHistory.bind(userSecurityController)
);

/**
 * @route   GET /api/user-security/login-attempts
 * @desc    Obtém tentativas de login recentes
 * @access  Private
 */
router.get(
  '/login-attempts',
  userSecurityController.getLoginAttempts.bind(userSecurityController)
);

/**
 * @route   GET /api/user-security/smtp-settings
 * @desc    Obtém configurações SMTP (apenas admin)
 * @access  Private (Admin only)
 */
router.get(
  '/smtp-settings',
  userSecurityController.getSmtpSettings.bind(userSecurityController)
);

/**
 * @route   PUT /api/user-security/smtp-settings
 * @desc    Atualiza configurações SMTP (apenas admin)
 * @access  Private (Admin only)
 */
router.put(
  '/smtp-settings',
  userSecurityController.updateSmtpSettings.bind(userSecurityController)
);

export default router;
