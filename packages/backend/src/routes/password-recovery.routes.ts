import { Router } from 'express';
import passwordRecoveryController from '../controllers/password-recovery.controller';

const router = Router();

/**
 * @route   POST /api/password-recovery/request
 * @desc    Solicita recuperação de senha (envia email)
 * @access  Public
 */
router.post(
  '/request',
  passwordRecoveryController.requestPasswordReset.bind(passwordRecoveryController)
);

/**
 * @route   GET /api/password-recovery/validate/:token
 * @desc    Valida token de recuperação
 * @access  Public
 */
router.get(
  '/validate/:token',
  passwordRecoveryController.validateResetToken.bind(passwordRecoveryController)
);

/**
 * @route   POST /api/password-recovery/reset
 * @desc    Reseta senha usando token
 * @access  Public
 */
router.post(
  '/reset',
  passwordRecoveryController.resetPassword.bind(passwordRecoveryController)
);

export default router;
