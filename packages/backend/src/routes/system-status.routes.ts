import { Router } from 'express';
import { getCronStatus, getBarcodeStatus, testZanthusConnection } from '../controllers/system-status.controller';

const router: Router = Router();

/**
 * @swagger
 * /api/cron/status:
 *   get:
 *     summary: Retorna o status do cron de verificação diária
 *     description: Busca informações sobre a última execução do cron que cruza vendas com bipagens
 *     tags: [System Status]
 *     responses:
 *       200:
 *         description: Status do cron retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, warning, error]
 *                   example: ok
 *                 lastRun:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-12-24T10:30:00.000Z
 *                 vendasProcessadas:
 *                   type: number
 *                   example: 150
 *                 bipagensVerificadas:
 *                   type: number
 *                   example: 148
 *                 lastError:
 *                   type: string
 *                   nullable: true
 *                   example: null
 */
router.get('/cron/status', getCronStatus);

/**
 * @swagger
 * /api/barcode/status:
 *   get:
 *     summary: Retorna o status do barcode scanner
 *     description: Busca informações sobre as últimas bipagens e status de conexão
 *     tags: [System Status]
 *     responses:
 *       200:
 *         description: Status do barcode retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, warning, error]
 *                   example: ok
 *                 lastBipTime:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-12-24T10:25:00.000Z
 *                 totalToday:
 *                   type: number
 *                   example: 50
 *                 pendentes:
 *                   type: number
 *                   example: 2
 *                 token:
 *                   type: string
 *                   nullable: true
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
router.get('/barcode/status', getBarcodeStatus);

/**
 * @swagger
 * /api/zanthus/test:
 *   get:
 *     summary: Testa conectividade com a API Zanthus
 *     description: Faz uma query de teste para verificar se a API Zanthus está respondendo
 *     tags: [System Status]
 *     responses:
 *       200:
 *         description: Teste de conexão bem sucedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                   example: ok
 *                 responseTime:
 *                   type: number
 *                   example: 245
 *                 statusCode:
 *                   type: number
 *                   example: 200
 */
router.get('/zanthus/test', testZanthusConnection);

export default router;
