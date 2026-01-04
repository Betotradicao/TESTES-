import { Router } from 'express';
import { ConfigurationsController } from '../controllers/configurations.controller';
import { authenticateToken, isMaster } from '../middleware/auth';

const router: Router = Router();
const configurationsController = new ConfigurationsController();

// Todas as rotas requerem autenticação MASTER (Configurações de REDE - APIs, Security, Email)
router.get('/', authenticateToken, isMaster, configurationsController.index.bind(configurationsController));

// Rotas específicas para email (devem vir ANTES da rota /:key)
<<<<<<< HEAD
router.get('/email', authenticateToken, isMaster, configurationsController.getEmailConfig.bind(configurationsController));
router.put('/email', authenticateToken, isMaster, configurationsController.updateEmailConfig.bind(configurationsController));
=======
router.get('/email', authenticateToken, configurationsController.getEmailConfig.bind(configurationsController));
router.put('/email', authenticateToken, configurationsController.updateEmailConfig.bind(configurationsController));
router.post('/email/test', authenticateToken, configurationsController.testEmailConnection.bind(configurationsController));
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

// Rota genérica por chave (deve vir POR ÚLTIMO)
router.get('/:key', authenticateToken, isMaster, configurationsController.show.bind(configurationsController));
router.put('/:key', authenticateToken, isMaster, configurationsController.update.bind(configurationsController));

export default router;
