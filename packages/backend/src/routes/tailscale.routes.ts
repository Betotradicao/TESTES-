import { Router } from 'express';
import { TailscaleController } from '../controllers/tailscale.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const tailscaleController = new TailscaleController();

// Todas as rotas requerem autenticação
router.get('/config', authenticateToken, tailscaleController.getConfig.bind(tailscaleController));
router.put('/config', authenticateToken, tailscaleController.updateConfig.bind(tailscaleController));
router.post('/test', authenticateToken, tailscaleController.testConnectivity.bind(tailscaleController));

export default router;
