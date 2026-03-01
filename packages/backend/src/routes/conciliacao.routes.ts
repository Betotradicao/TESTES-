import { Router } from 'express';
import { ConciliacaoController } from '../controllers/conciliacao.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
router.use(authenticateToken);

router.get('/dados', ConciliacaoController.getDados);
router.get('/bancos', ConciliacaoController.getBancos);
router.get('/contas-correntes', ConciliacaoController.getContasCorrentes);
router.post('/conciliar', ConciliacaoController.conciliar);
router.post('/transferencia', ConciliacaoController.registrarTransferencia);
router.delete('/transferencia/:id', ConciliacaoController.removerTransferencia);

export default router;
