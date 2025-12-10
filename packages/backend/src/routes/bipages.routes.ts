import { Router } from 'express';
import { BipagesController } from '../controllers/bipages.controller';
import { authenticateApiToken, authenticateWebhook } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router: Router = Router();

// Middleware para validação do payload do webhook
const validateWebhookPayload = [
  body('raw')
    .notEmpty()
    .withMessage('Campo raw é obrigatório')
    .isString()
    .withMessage('Campo raw deve ser uma string'),

  body('event_date')
    .optional()
    .isISO8601()
    .withMessage('Campo event_date deve estar no formato ISO8601'),

  (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }
    next();
  }
];

/**
 * @swagger
 * /api/bipagens/webhook:
 *   post:
 *     summary: Webhook para receber bipagens em tempo real
 *     tags: [Bipages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - raw
 *             properties:
 *               raw:
 *                 type: string
 *                 description: Código EAN-13 da bipagem
 *                 example: "2037040050854"
 *               event_date:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora do evento (opcional)
 *                 example: "2025-09-28T17:54:43.673217Z"
 *     responses:
 *       200:
 *         description: Bipagem processada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bipagem processada com sucesso"
 *                 bip:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *                     ean:
 *                       type: string
 *                       example: "2037040050854"
 *                     product_id:
 *                       type: string
 *                       example: "03704"
 *                     product_description:
 *                       type: string
 *                       example: "AC BOV C1 COXAO MOLE"
 *                     bip_price_cents:
 *                       type: integer
 *                       example: 5085
 *                     bip_weight:
 *                       type: number
 *                       example: 1.155944532848374
 *                     event_date:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-28T14:54:43.000Z"
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                 error:
 *                   type: string
 *                   description: Mensagem de erro (quando success=false)
 *                   example: "Produto não encontrado no ERP"
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/webhook',
  authenticateWebhook,
  validateWebhookPayload,
  BipagesController.receiveWebhook
);

/**
 * @swagger
 * /api/bipagens/simulate-sale:
 *   post:
 *     summary: Simula uma venda para conciliar com bipagem
 *     tags: [Bipages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bip_id
 *             properties:
 *               bip_id:
 *                 type: integer
 *                 description: ID da bipagem para conciliar
 *                 example: 123
 *               cupom_fiscal:
 *                 type: string
 *                 description: Número do cupom fiscal (opcional)
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Venda simulada e bipagem verificada
 *       404:
 *         description: Bipagem não encontrada
 *       500:
 *         description: Erro interno
 */
router.post('/simulate-sale',
  authenticateWebhook,
  BipagesController.simulateSale
);

export default router;