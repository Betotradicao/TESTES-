import { Router } from 'express';
import setupController from '../controllers/setup.controller';

const router = Router();

/**
 * @route   GET /api/setup/status
 * @desc    Verifica se o sistema já foi configurado
 * @access  Public
 */
router.get('/status', setupController.checkSetupStatus.bind(setupController));

/**
 * @route   POST /api/setup/perform
 * @desc    Realiza configuração inicial do sistema
 * @access  Public (apenas se setup não foi completo)
 */
router.post('/perform', setupController.performSetup.bind(setupController));

/**
 * @route   POST /api/setup/test-smtp
 * @desc    Testa conexão SMTP
 * @access  Public (durante setup)
 */
router.post('/test-smtp', setupController.testSmtpConnection.bind(setupController));

export default router;
