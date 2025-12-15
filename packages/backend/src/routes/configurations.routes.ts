import { Router } from 'express';
import { ConfigurationsController } from '../controllers/configurations.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const configurationsController = new ConfigurationsController();

// Todas as rotas requerem autenticação
router.get('/', authenticateToken, configurationsController.index.bind(configurationsController));
router.get('/:key', authenticateToken, configurationsController.show.bind(configurationsController));
router.put('/:key', authenticateToken, configurationsController.update.bind(configurationsController));

export default router;
