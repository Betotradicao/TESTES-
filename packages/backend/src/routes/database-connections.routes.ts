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

// Rota para testar mapeamento de tabela/coluna
router.post('/test-mapping', authenticateToken, controller.testMapping.bind(controller));

// Rota para salvar mapeamentos (formato v1 - por módulo)
router.post('/save-mappings', authenticateToken, controller.saveMappings.bind(controller));

// Rota para salvar mapeamento de tabela (formato v2 - por tabela)
router.post('/save-table-mapping', authenticateToken, controller.saveTableMapping.bind(controller));

// Rota para buscar mapeamentos de uma conexão
router.get('/:id/mappings', authenticateToken, controller.getMappings.bind(controller));

export default router;
