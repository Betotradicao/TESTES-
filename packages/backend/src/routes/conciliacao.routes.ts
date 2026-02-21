import { Router } from 'express';
import { ConciliacaoController } from '../controllers/conciliacao.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
router.use(authenticateToken);

router.get('/dados', ConciliacaoController.getDados);
router.get('/bancos', ConciliacaoController.getBancos);
router.post('/conciliar', ConciliacaoController.conciliar);

export default router;
