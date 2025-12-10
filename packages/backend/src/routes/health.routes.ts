import { Router } from 'express';

const router: Router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verifica o status da API
 *     description: Retorna o status de saúde da API e informações básicas do sistema
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API está funcionando corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: API is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-09-16T12:00:00.000Z
 *                 environment:
 *                   type: string
 *                   example: development
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 */
router.get('/health', async (req, res) => {
  try {
    const { AppDataSource } = require('../config/database');
    const isDatabaseConnected = AppDataSource.isInitialized;

    res.json({
      status: 'ok',
      message: 'API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: {
        connected: isDatabaseConnected
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'API is running with errors',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: {
        connected: false
      }
    });
  }
});

export default router;