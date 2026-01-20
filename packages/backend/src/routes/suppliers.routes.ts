import { Router } from 'express';
import { SuppliersController } from '../controllers/suppliers.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// CRUD de Fornecedores
router.get('/', SuppliersController.getAll);
router.get('/:id', SuppliersController.getById);
router.post('/', SuppliersController.create);
router.put('/:id', SuppliersController.update);
router.delete('/:id', SuppliersController.delete);

export default router;
