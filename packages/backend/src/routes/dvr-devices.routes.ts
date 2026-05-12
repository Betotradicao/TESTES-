import { Router } from 'express';
import { DvrDevicesController } from '../controllers/dvr-devices.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.get('/', authenticateToken, DvrDevicesController.list);
router.get('/:id', authenticateToken, DvrDevicesController.getOne);
router.post('/', authenticateToken, DvrDevicesController.create);
router.put('/:id', authenticateToken, DvrDevicesController.update);
router.delete('/:id', authenticateToken, DvrDevicesController.remove);
router.post('/:id/test', authenticateToken, DvrDevicesController.test);

export default router;
