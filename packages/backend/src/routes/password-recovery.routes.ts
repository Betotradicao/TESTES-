import { Router } from 'express';
import { PasswordRecoveryController } from '../controllers/password-recovery.controller';

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
router.post('/request', PasswordRecoveryController.requestPasswordRecovery);

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
router.post('/reset', PasswordRecoveryController.resetPassword);

export default router;
