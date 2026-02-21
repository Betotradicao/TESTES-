import { Router } from 'express';
import { DDAController } from '../controllers/dda.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const ddaController = new DDAController();

router.get('/boletos', authenticateToken, ddaController.getBoletos.bind(ddaController));
router.get('/workspace-status', authenticateToken, ddaController.getWorkspaceStatus.bind(ddaController));

export default router;
