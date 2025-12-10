import { Router } from 'express';
import { SectorsController } from '../controllers/sectors.controller';
import { authenticateToken, isAdmin } from '../middleware/auth';

const router: Router = Router();

// List sectors - available for all authenticated users (for filters)
router.get('/', authenticateToken, SectorsController.getAll);

// Admin-only routes require authentication and admin access
router.get('/:id', authenticateToken, isAdmin, SectorsController.getById);
router.post('/', authenticateToken, isAdmin, SectorsController.create);
router.put('/:id', authenticateToken, isAdmin, SectorsController.update);
router.patch('/:id/toggle', authenticateToken, isAdmin, SectorsController.toggle);

export default router;
