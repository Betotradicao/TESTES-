import { Router } from 'express';
import { BipsController } from '../controllers/bips.controller';
import { authenticateToken } from '../middleware/auth';
import { uploadService } from '../services/upload.service';

const router: Router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Bip:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         ean:
 *           type: string
 *           maxLength: 20
 *           example: "7891234567890"
 *         event_date:
 *           type: string
 *           format: date-time
 *           example: "2024-09-16T10:30:00Z"
 *         bip_price_cents:
 *           type: integer
 *           example: 1250
 *         product_id:
 *           type: string
 *           maxLength: 20
 *           example: "PROD001"
 *         product_description:
 *           type: string
 *           nullable: true
 *           example: "Carne Bovina Kg"
 *         product_full_price_cents_kg:
 *           type: integer
 *           nullable: true
 *           example: 5000
 *         product_discount_price_cents_kg:
 *           type: integer
 *           nullable: true
 *           example: 4500
 *         bip_weight:
 *           type: number
 *           format: decimal
 *           nullable: true
 *           example: 0.275
 *         tax_cupon:
 *           type: string
 *           maxLength: 50
 *           nullable: true
 *           example: "CF001234567890"
 *         status:
 *           type: string
 *           enum: [pending, verified, notified]
 *           example: "pending"
 *     BipsResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Bip'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 10
 *             total:
 *               type: integer
 *               example: 50
 *             totalPages:
 *               type: integer
 *               example: 5
 *             hasNextPage:
 *               type: boolean
 *               example: true
 *             hasPreviousPage:
 *               type: boolean
 *               example: false
 *         filters:
 *           type: object
 *           properties:
 *             date:
 *               type: string
 *               example: "2024-09-16"
 *             status:
 *               type: string
 *               example: "pending"
 *             product_id:
 *               type: string
 *               nullable: true
 *               example: "PROD001"
 *             product_description:
 *               type: string
 *               nullable: true
 *               example: "Carne"
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Bips
 *   description: Bipagens (barcode scans) management
 */

/**
 * @swagger
 * /api/bips:
 *   get:
 *     summary: Get bips with filters and pagination
 *     tags: [Bips]
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
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date (YYYY-MM-DD). Optional filter
 *         example: "2024-09-16"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, notified]
 *         description: Filter by bip status
 *         example: "pending"
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *         description: Filter by product ID
 *         example: "PROD001"
 *       - in: query
 *         name: product_description
 *         schema:
 *           type: string
 *         description: Filter by product description (partial match, case-insensitive)
 *         example: "Carne"
 *     responses:
 *       200:
 *         description: Bips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BipsResponse'
 *       400:
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid date format. Use YYYY-MM-DD"
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
 *       403:
 *         description: Forbidden - Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid or expired token"
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
router.get('/', authenticateToken, BipsController.getBips);

/**
 * @swagger
 * /api/bips/{id}/cancel:
 *   put:
 *     summary: Cancel a pending bip
 *     tags: [Bips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Bip ID
 *     responses:
 *       200:
 *         description: Bip cancelled successfully
 *       404:
 *         description: Bip not found
 *       400:
 *         description: Bip cannot be cancelled
 */
router.put('/:id/cancel', authenticateToken, BipsController.cancelBip);

/**
 * @swagger
 * /api/bips/{id}/reactivate:
 *   put:
 *     summary: Reactivate a cancelled bip
 *     tags: [Bips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Bip ID
 *     responses:
 *       200:
 *         description: Bip reactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 reactivatedCount:
 *                   type: integer
 *                   example: 3
 *                 reactivatedBips:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bip'
 *       404:
 *         description: Bip not found
 *       400:
 *         description: Bip cannot be reactivated
 */
router.put('/:id/reactivate', authenticateToken, BipsController.reactivateBip);

// Configurar multer para upload de vídeos
const videoUpload = uploadService.getVideoMulterConfig();

/**
 * @swagger
 * /api/bips/{id}/video:
 *   post:
 *     summary: Upload de vídeo para uma bipagem
 *     tags: [Bips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da bipagem
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Vídeo enviado com sucesso
 *       400:
 *         description: Erro de validação
 *       404:
 *         description: Bipagem não encontrada
 */
router.post('/:id/video', authenticateToken, videoUpload.single('video'), BipsController.uploadVideo);

/**
 * @swagger
 * /api/bips/{id}/video:
 *   delete:
 *     summary: Deletar vídeo de uma bipagem
 *     tags: [Bips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da bipagem
 *     responses:
 *       200:
 *         description: Vídeo deletado com sucesso
 *       404:
 *         description: Bipagem não encontrada
 *       400:
 *         description: Bipagem não possui vídeo
 */
router.delete('/:id/video', authenticateToken, BipsController.deleteVideo);

// Configurar multer para upload de imagens
const imageUpload = uploadService.getImageMulterConfig();

/**
 * @swagger
 * /api/bips/{id}/image:
 *   post:
 *     summary: Upload de imagem para uma bipagem
 *     tags: [Bips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da bipagem
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imagem enviada com sucesso
 *       400:
 *         description: Erro de validação
 *       404:
 *         description: Bipagem não encontrada
 */
router.post('/:id/image', authenticateToken, imageUpload.single('image'), BipsController.uploadImage);

/**
 * @swagger
 * /api/bips/{id}/image:
 *   delete:
 *     summary: Deletar imagem de uma bipagem
 *     tags: [Bips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da bipagem
 *     responses:
 *       200:
 *         description: Imagem deletada com sucesso
 *       404:
 *         description: Bipagem não encontrada
 *       400:
 *         description: Bipagem não possui imagem
 */
router.delete('/:id/image', authenticateToken, BipsController.deleteImage);

/**
 * @swagger
 * /api/bips/send-pending-report:
 *   post:
 *     summary: Enviar PDF de bipagens pendentes (teste manual)
 *     tags: [Bips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 example: "2026-01-07"
 *     responses:
 *       200:
 *         description: PDF enviado com sucesso
 *       400:
 *         description: Parâmetros inválidos
 */
router.post('/send-pending-report', authenticateToken, BipsController.sendPendingBipsReport);

export default router;