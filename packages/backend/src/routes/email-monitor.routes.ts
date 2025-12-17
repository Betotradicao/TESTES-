import { Router } from 'express';
import { EmailMonitorController } from '../controllers/email-monitor.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const emailMonitorController = new EmailMonitorController();

// Todas as rotas requerem autenticação
router.get('/config', authenticateToken, emailMonitorController.getConfig.bind(emailMonitorController));
router.put('/config', authenticateToken, emailMonitorController.updateConfig.bind(emailMonitorController));
router.post('/test', authenticateToken, emailMonitorController.testConnection.bind(emailMonitorController));
router.post('/check', authenticateToken, emailMonitorController.checkEmails.bind(emailMonitorController));
router.get('/logs', authenticateToken, emailMonitorController.getLogs.bind(emailMonitorController));

export default router;
