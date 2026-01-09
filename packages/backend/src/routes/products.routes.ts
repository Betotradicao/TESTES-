import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         codigo:
 *           type: string
 *           example: "00012874"
 *         descricao:
 *           type: string
 *           example: "PET RACAO AGN FIUCAO ADULTO"
 *         desReduzida:
 *           type: string
 *           example: "RACAO AGN FIUCAO ADULTO"
 *         valvenda:
 *           type: number
 *           example: 6.99
 *         valOferta:
 *           type: number
 *           example: 0
 *         active:
 *           type: boolean
 *           description: Indicates if this product is being monitored
 *           example: false
 *     ProductsResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Product'
 *         total:
 *           type: integer
 *           example: 100
 *     ActivateProductRequest:
 *       type: object
 *       required:
 *         - active
 *       properties:
 *         active:
 *           type: boolean
 *           description: Whether to activate or deactivate the product
 *           example: true
 *     ActivateProductResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Product activated successfully"
 *         product:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             erp_product_id:
 *               type: string
 *               example: "00012874"
 *             description:
 *               type: string
 *               example: "PET RACAO AGN FIUCAO ADULTO"
 *             active:
 *               type: boolean
 *               example: true
 */

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management (proxy to ERP with activation control)
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products from ERP with activation status
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Fetches products from the ERP API and enriches them with activation status from our database.
 *       Products marked as active are being monitored for fraud detection.
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductsResponse'
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
router.get('/', authenticateToken, ProductsController.getProducts);

/**
 * @swagger
 * /api/products/{id}/activate:
 *   put:
 *     summary: Activate or deactivate a product for monitoring
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ERP product ID (codigo)
 *         example: "00012874"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ActivateProductRequest'
 *     responses:
 *       200:
 *         description: Product activation status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActivateProductResponse'
 *       400:
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Active field must be a boolean"
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
 *       404:
 *         description: Product not found in ERP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Product not found in ERP"
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
router.put('/:id/activate', authenticateToken, ProductsController.activateProduct);

/**
 * @swagger
 * /api/products/bulk-activate:
 *   put:
 *     summary: Bulk activate or deactivate multiple products
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productIds
 *               - active
 *             properties:
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of ERP product IDs (codigo)
 *                 example: ["00012874", "00013456", "00014789"]
 *               active:
 *                 type: boolean
 *                 description: Whether to activate or deactivate the products
 *                 example: true
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bulk activation completed"
 *                 processed:
 *                   type: integer
 *                   example: 2
 *                 errorCount:
 *                   type: integer
 *                   example: 1
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                         example: "00012874"
 *                       success:
 *                         type: boolean
 *                         example: true
 *                       description:
 *                         type: string
 *                         example: "PET RACAO AGN FIUCAO ADULTO"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                         example: "00013456"
 *                       error:
 *                         type: string
 *                         example: "Product not found in ERP"
 *       400:
 *         description: Bad request - Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/bulk-activate', authenticateToken, ProductsController.bulkActivateProducts);

// Upload de foto com análise automática por IA
router.post('/:id/upload-photo', authenticateToken, ProductsController.uploadAndAnalyzePhoto);

// Capturar foto da câmera do DVR e analisar com YOLO
router.post('/:id/capture-from-camera', authenticateToken, ProductsController.captureFromCamera);

// Atualizar características de IA do produto
router.put('/:id/ai-characteristics', authenticateToken, ProductsController.updateAICharacteristics);

// Atualizar peso médio do produto
router.put('/:id/peso-medio', authenticateToken, ProductsController.updatePesoMedio);

export default router;