/**
 * 🔍 Rotas para Monitor de Email DVR
 */

import { Router } from 'express';
import * as dvrMonitorController from '../controllers/dvr-monitor.controller';
import { authenticateToken, isMaster } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas requerem autenticação MASTER (Configurações de REDE)
router.use(authenticateToken, isMaster);

/**
 * @swagger
 * /api/dvr-monitor/iniciar:
 *   post:
 *     summary: Iniciar monitor automático de email DVR
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitor iniciado com sucesso
 *       400:
 *         description: Monitor já está em execução
 */
router.post('/iniciar', dvrMonitorController.iniciarMonitor);

/**
 * @swagger
 * /api/dvr-monitor/parar:
 *   post:
 *     summary: Parar monitor automático de email DVR
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitor parado com sucesso
 */
router.post('/parar', dvrMonitorController.pararMonitor);

/**
 * @swagger
 * /api/dvr-monitor/status:
 *   get:
 *     summary: Obter status e estatísticas do monitor
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status do monitor
 */
router.get('/status', dvrMonitorController.statusMonitor);

/**
 * @swagger
 * /api/dvr-monitor/verificar:
 *   post:
 *     summary: Forçar verificação manual imediata
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verificação concluída
 */
router.post('/verificar', dvrMonitorController.verificarAgora);

/**
 * @swagger
 * /api/dvr-monitor/senha-gmail:
 *   post:
 *     summary: Salvar senha correta do Gmail
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               senha:
 *                 type: string
 *                 description: Senha do Gmail
 *     responses:
 *       200:
 *         description: Senha salva com sucesso
 */
router.post('/senha-gmail', dvrMonitorController.salvarSenhaGmail);

/**
 * @swagger
 * /api/dvr-monitor/config:
 *   get:
 *     summary: Obter configurações atuais do DVR
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do DVR
 */
router.get('/config', dvrMonitorController.obterConfiguracao);

/**
 * @swagger
 * /api/dvr-monitor/config:
 *   post:
 *     summary: Salvar configurações do DVR
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ip:
 *                 type: string
 *               usuario:
 *                 type: string
 *               senha:
 *                 type: string
 *               intervaloMinutos:
 *                 type: number
 *     responses:
 *       200:
 *         description: Configurações salvas
 */
router.post('/config', dvrMonitorController.salvarConfigDVR);

/**
 * @swagger
 * /api/dvr-monitor/testar-conexao:
 *   post:
 *     summary: Testar conexão com o DVR
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ip:
 *                 type: string
 *               usuario:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       200:
 *         description: Teste de conexão bem-sucedido
 */
router.post('/testar-conexao', dvrMonitorController.testarConexaoDVR);

/**
 * @swagger
 * /api/dvr-monitor/camera-stream:
 *   post:
 *     summary: Obter URL do stream da câmera
 *     tags: [DVR Monitor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cameraId:
 *                 type: number
 *                 description: ID do canal da câmera
 *               rtspUrl:
 *                 type: string
 *                 description: URL RTSP da câmera
 *     responses:
 *       200:
 *         description: URL do stream obtida com sucesso
 */
router.post('/camera-stream', dvrMonitorController.getCameraStream);

export default router;
