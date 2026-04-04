import { Router } from 'express';
import { RhController } from '../controllers/rh.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.get('/colaboradores', authenticateToken, RhController.listColaboradores);
router.get('/colaboradores/stats', authenticateToken, RhController.getStats);
router.get('/colaboradores/:id', authenticateToken, RhController.getColaboradorById);
router.post('/colaboradores', authenticateToken, RhController.createColaborador);
router.put('/colaboradores/:id', authenticateToken, RhController.updateColaborador);
router.delete('/colaboradores/:id', authenticateToken, RhController.deleteColaborador);

export default router;
