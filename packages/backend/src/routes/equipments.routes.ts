import { Router } from 'express';
import { EquipmentsController } from '../controllers/equipments.controller';
import { authenticateToken, isAdmin } from '../middleware/auth';

const router: Router = Router();

// GET routes - available for all authenticated users (for viewing scanner status)
router.get('/', authenticateToken, EquipmentsController.getAll);
router.get('/:id', authenticateToken, EquipmentsController.getById);

// Modification routes - any authenticated user with access
router.put('/:id', authenticateToken, EquipmentsController.update);
router.patch('/:id/toggle', authenticateToken, EquipmentsController.toggle);
router.delete('/:id', authenticateToken, isAdmin, EquipmentsController.delete);

export default router;
