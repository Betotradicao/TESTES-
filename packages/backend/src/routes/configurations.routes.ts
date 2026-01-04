import { Router } from 'express';
import { ConfigurationsController } from '../controllers/configurations.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const configurationsController = new ConfigurationsController();

// Todas as rotas requerem autenticação
router.get('/', authenticateToken, configurationsController.index.bind(configurationsController));

// Rotas específicas para email (devem vir ANTES da rota /:key)
router.get('/email', authenticateToken, configurationsController.getEmailConfig.bind(configurationsController));
router.put('/email', authenticateToken, configurationsController.updateEmailConfig.bind(configurationsController));
router.post('/email/test', authenticateToken, configurationsController.testEmailConnection.bind(configurationsController));

// Rota genérica por chave (deve vir POR ÚLTIMO)
router.get('/:key', authenticateToken, configurationsController.show.bind(configurationsController));
router.put('/:key', authenticateToken, configurationsController.update.bind(configurationsController));

export default router;
