import { Router } from 'express';
import { CompetitividadeController } from '../controllers/competitividade.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

router.get('/dados', CompetitividadeController.getDados);
router.get('/secoes', CompetitividadeController.getSecoes);

export default router;
