import { Router } from 'express';
import { SellsController } from '../controllers/sells.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Sell:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         activated_product_id:
 *           type: integer
 *           example: 5
 *         product_id:
 *           type: string
 *           example: "00005685"
 *         product_description:
 *           type: string
 *           example: "FLV MACA FUJI"
 *         sell_date:
 *           type: string
 *           format: date
 *           example: "2025-09-15"
 *         sell_value:
 *           type: number
 *           example: 12.54
 *         sell_value_cents:
 *           type: integer
 *           example: 1254
 *         product_weight:
 *           type: number
 *           example: 1.395
 *         bip_id:
 *           type: integer
 *           nullable: true
 *           example: 123
 *         bip_ean:
 *           type: string
 *           nullable: true
 *           example: "2000000012345"
 *         num_cupom_fiscal:
 *           type: integer
 *           nullable: true
 *           example: 426436
 *         status:
 *           type: string
 *           enum: [verified, not_verified]
 *           example: "verified"
 *         status_description:
 *           type: string
 *           example: "Venda verificada - bipagem encontrada"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2025-09-16T08:30:00Z"
 *         activated_product:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 5
 *             erp_product_id:
 *               type: string
 *               example: "00005685"
 *             description:
 *               type: string
 *               example: "FLV MACA FUJI"
 *     SellsResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Sell'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             total:
 *               type: integer
 *               example: 150
 *             totalPages:
 *               type: integer
 *               example: 8
 *             hasNextPage:
 *               type: boolean
 *               example: true
 *             hasPrevPage:
 *               type: boolean
 *               example: false
 *         filters:
 *           type: object
 *           properties:
 *             date:
 *               type: string
 *               example: "2025-09-15"
 *             status:
 *               type: string
 *               nullable: true
 *               example: "verified"
 *             product:
 *               type: string
 *               nullable: true
 *               example: "00005685"
 *         summary:
 *           type: object
 *           properties:
 *             total_sells:
 *               type: integer
 *               example: 150
 *             verified_count:
 *               type: integer
 *               example: 120
 *             not_verified_count:
 *               type: integer
 *               example: 30
 */

/**
 * @swagger
 * tags:
 *   name: Sells
 *   description: Sales validation results management
 */

/**
 * @swagger
 * /api/sells:
 *   get:
 *     summary: Get validated sales records
 *     tags: [Sells]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of records per page
 *         example: 20
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by sell date in format YYYY-MM-DD
 *         example: "2025-09-15"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [verified, not_verified]
 *         description: Filter by validation status
 *         example: "not_verified"
 *       - in: query
 *         name: product
 *         schema:
 *           type: string
 *         description: Filter by product ID or description (searches both fields with partial matching)
 *         examples:
 *           by_id:
 *             value: "00005685"
 *             summary: "Search by product ID"
 *           by_description:
 *             value: "LINGUICA"
 *             summary: "Search by product description"
 *     description: |-
 *       Retrieves validated sales records from the fraud detection system.
 *
 *       **Status meanings:**
 *       - `verified`: Sale has matching bipagem - transaction is legitimate
 *       - `not_verified`: Sale has no matching bipagem - potential theft detected
 *
 *       **Filtering:**
 *       - Multiple filters can be combined
 *       - Date defaults to today if not specified
 *       - Only shows sales for activated products
 *       - Product search works on both ID and description fields (case-insensitive partial matching)
 *
 *       **Pagination:**
 *       - Results are paginated with configurable page size
 *       - Maximum 100 records per page
 *       - Ordered by creation date (newest first)
 *     responses:
 *       200:
 *         description: Sales records retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SellsResponse'
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Access token required"
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
router.get('/', authenticateToken, SellsController.getSells);

export default router;