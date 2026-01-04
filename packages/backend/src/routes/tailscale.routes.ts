import { Router } from 'express';
import { TailscaleController } from '../controllers/tailscale.controller';
import { authenticateToken, isMaster } from '../middleware/auth';

const router: Router = Router();
const tailscaleController = new TailscaleController();

// Todas as rotas requerem autenticação MASTER (Configurações de REDE)
router.get('/config', authenticateToken, isMaster, tailscaleController.getConfig.bind(tailscaleController));
router.put('/config', authenticateToken, isMaster, tailscaleController.updateConfig.bind(tailscaleController));
router.post('/test', authenticateToken, isMaster, tailscaleController.testConnectivity.bind(tailscaleController));

export default router;
