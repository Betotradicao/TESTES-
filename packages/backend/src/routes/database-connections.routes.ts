import { Router } from 'express';
import { DatabaseConnectionsController } from '../controllers/database-connections.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const controller = new DatabaseConnectionsController();

// Todas as rotas requerem autenticação
router.get('/', authenticateToken, controller.index.bind(controller));
router.get('/:id', authenticateToken, controller.show.bind(controller));
router.post('/', authenticateToken, controller.create.bind(controller));
router.put('/:id', authenticateToken, controller.update.bind(controller));
router.delete('/:id', authenticateToken, controller.delete.bind(controller));

// Rota para testar conexão existente
router.post('/:id/test', authenticateToken, controller.testConnection.bind(controller));

// Rota para testar nova conexão (sem salvar)
router.post('/test-new', authenticateToken, controller.testNewConnection.bind(controller));

export default router;
