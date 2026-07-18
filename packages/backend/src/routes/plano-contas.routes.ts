import { Router } from 'express';
import { PlanoContasController } from '../controllers/plano-contas.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
router.use(authenticateToken);

router.get('/', PlanoContasController.listar);
router.post('/', PlanoContasController.criar);
router.post('/importar', PlanoContasController.importar);
router.put('/:id', PlanoContasController.editar);
router.delete('/:id', PlanoContasController.excluir);

export default router;
