import { Router } from 'express';
import { EmailMonitorController } from '../controllers/email-monitor.controller';
import { authenticateToken, isMaster } from '../middleware/auth';

const router: Router = Router();
const emailMonitorController = new EmailMonitorController();

// Todas as rotas requerem autenticação MASTER (Configurações de REDE)
router.get('/config', authenticateToken, isMaster, emailMonitorController.getConfig.bind(emailMonitorController));
router.put('/config', authenticateToken, isMaster, emailMonitorController.updateConfig.bind(emailMonitorController));
router.post('/test', authenticateToken, isMaster, emailMonitorController.testConnection.bind(emailMonitorController));
router.post('/check', authenticateToken, isMaster, emailMonitorController.checkEmails.bind(emailMonitorController));
router.post('/fetch-latest', authenticateToken, isMaster, emailMonitorController.fetchLatestEmails.bind(emailMonitorController));
router.post('/reprocess-last', authenticateToken, isMaster, emailMonitorController.reprocessLastEmail.bind(emailMonitorController));
router.get('/logs', authenticateToken, isMaster, emailMonitorController.getLogs.bind(emailMonitorController));
router.delete('/logs/:id', authenticateToken, isMaster, emailMonitorController.deleteLog.bind(emailMonitorController));
router.get('/whatsapp-groups', authenticateToken, isMaster, emailMonitorController.getWhatsAppGroups.bind(emailMonitorController));

export default router;
