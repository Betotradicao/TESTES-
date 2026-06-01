import { Router } from 'express';
import { WhatsappAgenteController } from '../controllers/whatsapp-agente.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Webhook publico (Evolution chama sem token)
router.post('/webhook', WhatsappAgenteController.webhook);

// Rotas protegidas
router.get('/config', authenticateToken, WhatsappAgenteController.getConfig);
router.put('/config', authenticateToken, WhatsappAgenteController.putConfig);
router.get('/tools', authenticateToken, WhatsappAgenteController.listTools);
router.get('/logs', authenticateToken, WhatsappAgenteController.listLogs);
router.post('/test', authenticateToken, WhatsappAgenteController.test);
router.post('/send-ping', authenticateToken, WhatsappAgenteController.sendPing);

export default router;
