/**
 * Rotas para controle do DVR via NetSDK
 */

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import DVRController from '../controllers/dvr.controller';
import { authenticateToken } from '../middleware/auth';

const router: RouterType = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

/**
 * @swagger
 * /api/dvr/test:
 *   post:
 *     summary: Testa conexão com o DVR
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resultado do teste de conexão
 */
router.post('/test', DVRController.testConnection);

/**
 * @swagger
 * /api/dvr/status:
 *   get:
 *     summary: Obtém status da conexão com o DVR
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status da conexão
 */
router.get('/status', DVRController.getStatus);

/**
 * @swagger
 * /api/dvr/snapshot:
 *   post:
 *     summary: Captura snapshot de um canal
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 type: integer
 *                 description: Número do canal (0-15)
 *                 default: 0
 *     responses:
 *       200:
 *         description: Snapshot capturado com sucesso
 */
router.post('/snapshot', DVRController.captureSnapshot);

/**
 * @swagger
 * /api/dvr/ptz/control:
 *   post:
 *     summary: Envia comando PTZ genérico
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *               - command
 *             properties:
 *               channel:
 *                 type: integer
 *                 description: Número do canal
 *               command:
 *                 type: integer
 *                 description: Código do comando PTZ
 *               speed:
 *                 type: integer
 *                 description: Velocidade (1-8)
 *                 default: 4
 *     responses:
 *       200:
 *         description: Comando enviado com sucesso
 */
router.post('/ptz/control', DVRController.controlPTZ);

/**
 * @swagger
 * /api/dvr/ptz/up:
 *   post:
 *     summary: Move câmera PTZ para cima
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *             properties:
 *               channel:
 *                 type: integer
 *               speed:
 *                 type: integer
 *                 default: 4
 *     responses:
 *       200:
 *         description: PTZ movido para cima
 */
router.post('/ptz/up', DVRController.movePTZUp);

/**
 * @swagger
 * /api/dvr/ptz/down:
 *   post:
 *     summary: Move câmera PTZ para baixo
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *             properties:
 *               channel:
 *                 type: integer
 *               speed:
 *                 type: integer
 *                 default: 4
 *     responses:
 *       200:
 *         description: PTZ movido para baixo
 */
router.post('/ptz/down', DVRController.movePTZDown);

/**
 * @swagger
 * /api/dvr/ptz/left:
 *   post:
 *     summary: Move câmera PTZ para esquerda
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 */
router.post('/ptz/left', DVRController.movePTZLeft);

/**
 * @swagger
 * /api/dvr/ptz/right:
 *   post:
 *     summary: Move câmera PTZ para direita
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 */
router.post('/ptz/right', DVRController.movePTZRight);

/**
 * @swagger
 * /api/dvr/ptz/zoom-in:
 *   post:
 *     summary: Aplica zoom in na câmera
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 */
router.post('/ptz/zoom-in', DVRController.ptzZoomIn);

/**
 * @swagger
 * /api/dvr/ptz/zoom-out:
 *   post:
 *     summary: Aplica zoom out na câmera
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 */
router.post('/ptz/zoom-out', DVRController.ptzZoomOut);

/**
 * @swagger
 * /api/dvr/ptz/preset/set:
 *   post:
 *     summary: Define um preset PTZ
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *               - presetNumber
 *             properties:
 *               channel:
 *                 type: integer
 *               presetNumber:
 *                 type: integer
 *                 description: Número do preset (1-255)
 *     responses:
 *       200:
 *         description: Preset definido com sucesso
 */
router.post('/ptz/preset/set', DVRController.setPTZPreset);

/**
 * @swagger
 * /api/dvr/ptz/preset/goto:
 *   post:
 *     summary: Move câmera para um preset
 *     tags: [DVR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *               - presetNumber
 *             properties:
 *               channel:
 *                 type: integer
 *               presetNumber:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Movendo para preset
 */
router.post('/ptz/preset/goto', DVRController.gotoPTZPreset);

export default router;
