import { Router, IRouter } from 'express';
import { BarcodeInstallerController } from '../controllers/barcode-installer.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();
const controller = new BarcodeInstallerController();

// Download do ZIP com instalador completo (requer autenticação)
router.get('/download', authenticateToken, controller.download.bind(controller));

export default router;
