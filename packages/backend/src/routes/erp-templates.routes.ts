import { Router, IRouter } from 'express';
import { ErpTemplatesController, uploadLogoMiddleware } from '../controllers/erp-templates.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();
const controller = new ErpTemplatesController();

// Todas as rotas requerem autenticação
router.get('/', authenticateToken, controller.index.bind(controller));
router.get('/:id', authenticateToken, controller.show.bind(controller));
router.post('/', authenticateToken, controller.create.bind(controller));
router.put('/:id', authenticateToken, controller.update.bind(controller));
router.delete('/:id', authenticateToken, controller.delete.bind(controller));

// Upload de logo
router.post('/upload-logo', authenticateToken, uploadLogoMiddleware, controller.uploadLogo.bind(controller));

export default router;
