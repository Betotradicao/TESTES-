import { Router } from 'express';
import { MetasController } from '../controllers/metas.controller';
import { authenticateToken, isAdmin } from '../middleware/auth';

const router: Router = Router();

// List metas - available for all authenticated users
router.get('/', authenticateToken, MetasController.getAll);

// Admin-only routes
router.get('/:id', authenticateToken, isAdmin, MetasController.getById);
router.post('/', authenticateToken, isAdmin, MetasController.create);
router.put('/:id', authenticateToken, isAdmin, MetasController.update);
router.delete('/:id', authenticateToken, isAdmin, MetasController.delete);
router.patch('/:id/toggle', authenticateToken, isAdmin, MetasController.toggle);

export default router;
