import { Router, IRouter } from 'express';
import { PendenciasNotasController } from '../controllers/pendencias-notas.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

router.get('/', authenticateToken, PendenciasNotasController.listarNotas);
router.get('/:idNota/itens', authenticateToken, PendenciasNotasController.listarItensNota);

export default router;
