import { Router } from 'express';
import { HolidaysController } from '../controllers/holidays.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

router.get('/', HolidaysController.getAll);
router.post('/', HolidaysController.create);
router.put('/:id', HolidaysController.update);
router.delete('/:id', HolidaysController.delete);
router.post('/seed/:codLoja', HolidaysController.seedNational);

export default router;
