import { Router } from 'express';
import { Banco24horasController } from '../controllers/banco24horas.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const banco24horasController = new Banco24horasController();

router.get('/depositos', authenticateToken, banco24horasController.getDepositos.bind(banco24horasController));
router.get('/config', authenticateToken, banco24horasController.getConfig.bind(banco24horasController));
router.post('/test', authenticateToken, banco24horasController.testConnection.bind(banco24horasController));

export default router;
