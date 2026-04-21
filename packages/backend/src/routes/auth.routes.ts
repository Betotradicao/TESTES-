import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken, isMaster } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

// Rate limiting: max 10 tentativas de login por IP a cada 15 minutos
// Após 10 tentativas erradas, bloqueia por 15 min (protege contra brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // max 10 tentativas
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router: Router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: password123
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Login successful
 *         token:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: 123e4567-e89b-12d3-a456-426614174000
 *             email:
 *               type: string
 *               example: user@example.com
 */

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Authentication endpoints
 */


/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, AuthController.login);
router.get('/me', authenticateToken, AuthController.me);
router.put('/update-profile', authenticateToken, AuthController.updateProfile);

// Master-only: reseta a senha de um admin (gerencial) usando a senha do master
router.get('/admin-users', authenticateToken, isMaster, AuthController.listAdminUsers);
router.post('/master-reset-admin-password', authenticateToken, isMaster, AuthController.masterResetAdminPassword);

export default router;