import { Router } from 'express';
import { CompaniesController } from '../controllers/companies.controller';
import { authenticateToken, isMaster, isAdminOrMaster } from '../middleware/auth';

const router: Router = Router();
const companiesController = new CompaniesController();

// Rotas públicas para empresa do usuário logado
router.get('/my-company', authenticateToken, companiesController.getMyCompany.bind(companiesController));
router.put('/my-company', authenticateToken, isAdminOrMaster, companiesController.updateMyCompany.bind(companiesController));

// Lista de lojas para dropdown (apenas lojas com cod_loja definido)
router.get('/stores/list', authenticateToken, companiesController.listStores.bind(companiesController));

// Rotas apenas para master (Beto)
router.get('/', authenticateToken, isMaster, companiesController.index.bind(companiesController));
router.get('/:id', authenticateToken, isMaster, companiesController.show.bind(companiesController));
router.post('/', authenticateToken, isMaster, companiesController.create.bind(companiesController));
router.put('/:id', authenticateToken, isMaster, companiesController.update.bind(companiesController));
router.delete('/:id', authenticateToken, isMaster, companiesController.delete.bind(companiesController));

export default router;
