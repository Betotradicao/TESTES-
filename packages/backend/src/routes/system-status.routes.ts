import { Router } from 'express';
import { getCronStatus, getBarcodeStatus, restartCronService, getWebhookLogs } from '../controllers/system-status.controller';

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
 * /api/cron/restart:
 *   post:
 *     summary: Reinicia o serviço CRON
 *     description: Reinicia o container do CRON para resolver problemas
 *     tags: [System Status]
 *     responses:
 *       200:
 *         description: CRON reiniciado com sucesso
 */
router.post('/cron/restart', restartCronService);

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
 * /api/webhook/logs:
 *   get:
 *     summary: Retorna logs de webhooks recebidos
 *     description: Lista todos os webhooks com status OK, rejeitados e erros
 *     tags: [System Status]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Página atual (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Itens por página (default 50)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, ok, rejected, error]
 *         description: Filtrar por status
 *     responses:
 *       200:
 *         description: Logs retornados com sucesso
 */
router.get('/webhook/logs', getWebhookLogs);

export default router;
