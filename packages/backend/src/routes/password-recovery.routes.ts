import { Router } from 'express';
import { PasswordRecoveryController } from '../controllers/password-recovery.controller';
import rateLimit from 'express-rate-limit';

// Rate limiting: max 5 tentativas de recuperação de senha por IP a cada 1 hora
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de recuperação de senha. Tente novamente em 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router: Router = Router();

/**
 * @swagger
 * /api/password-recovery/request:
 *   post:
 *     summary: Solicitar recuperação de senha
 *     tags: [Password Recovery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Solicitação processada
 *       400:
 *         description: Email inválido
 */
router.post('/request', passwordResetLimiter, PasswordRecoveryController.requestPasswordRecovery);

/**
 * @swagger
 * /api/password-recovery/validate:
 *   get:
 *     summary: Validar token de recuperação
 *     tags: [Password Recovery]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token válido
 *       400:
 *         description: Token inválido ou expirado
 */
router.get('/validate', PasswordRecoveryController.validateResetToken);

/**
 * @swagger
 * /api/password-recovery/reset:
 *   post:
 *     summary: Resetar senha usando token
 *     tags: [Password Recovery]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       400:
 *         description: Token inválido ou senha inválida
 */
router.post('/reset', passwordResetLimiter, PasswordRecoveryController.resetPassword);

export default router;
