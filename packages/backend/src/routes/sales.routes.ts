import { Router } from 'express';
import { SalesController } from '../controllers/sales.controller';
import { authenticateApiToken } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Sale:
 *       type: object
 *       properties:
 *         codLoja:
 *           type: integer
 *           example: 1
 *         desProduto:
 *           type: string
 *           example: "FLV MACA FUJI"
 *         codProduto:
 *           type: string
 *           example: "00005685"
 *         codBarraPrincipal:
 *           type: string
 *           example: "0000000005685"
 *         dtaSaida:
 *           type: string
 *           example: "20250916"
 *         numCupomFiscal:
 *           type: integer
 *           example: 426436
 *         valVenda:
 *           type: number
 *           example: 11.99
 *         qtdTotalProduto:
 *           type: number
 *           example: 1.395
 *         valTotalProduto:
 *           type: number
 *           example: 12.54
 *         totalCusto:
 *           type: number
 *           example: 9.9643455
 *     SalesResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Sale'
 *         total:
 *           type: integer
 *           example: 100
 *         filters:
 *           type: object
 *           properties:
 *             from:
 *               type: string
 *               example: "2025-09-15"
 *             to:
 *               type: string
 *               example: "2025-09-15"
 */

/**
 * @swagger
 * tags:
 *   name: Sales
 *   description: Sales management (proxy to ERP with caching)
 */

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Get sales from ERP for a date range
 *     tags: [Sales]
 *     security:
 *       - apiTokenAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: Start date in format YYYY-MM-DD
 *         example: "2025-09-15"
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         description: End date in format YYYY-MM-DD
 *         example: "2025-09-15"
 *     description: |-
 *       Fetches sales from the ERP API for a specific date range.
 *
 *       **Important restrictions:**
 *       - Cannot fetch sales from today (only yesterday onwards)
 *       - Dates must be in YYYY-MM-DD format
 *       - Both from and to parameters are required
 *
 *       **Caching:**
 *       - Results are cached for 1 hour to improve performance
 *       - Cache key includes the date range
 *     responses:
 *       200:
 *         description: Sales retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SalesResponse'
 *       400:
 *         description: Bad request - Invalid parameters or dates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   examples:
 *                     missing_params:
 *                       value: "Parameters from and to are required in format YYYY-MM-DD"
 *                     invalid_format:
 *                       value: "Dates must be in format YYYY-MM-DD"
 *                     today_restriction:
 *                       value: "Cannot fetch sales from today. Only sales from yesterday onwards are allowed."
 *       401:
 *         description: Unauthorized - Missing or invalid API token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "API token required. Use: Authorization: Bearer YOUR_TOKEN"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/', authenticateApiToken, SalesController.getSales);

export default router;