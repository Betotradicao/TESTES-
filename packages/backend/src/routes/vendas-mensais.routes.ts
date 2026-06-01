import { Router } from 'express';
import { VendasMensaisController } from '../controllers/vendas-mensais.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.get('/preview', authenticateToken, VendasMensaisController.preview);
router.post('/send-test', authenticateToken, VendasMensaisController.sendTest);

export default router;
