import { Router, IRouter } from 'express';
import { TopQuedasController } from '../controllers/top-quedas.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

router.get('/preview', authenticateToken, TopQuedasController.preview);

export default router;
