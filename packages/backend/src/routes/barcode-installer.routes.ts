import { Router, IRouter } from 'express';
import { BarcodeInstallerController } from '../controllers/barcode-installer.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();
const controller = new BarcodeInstallerController();

// Defaults (API token, host IP) para pré-preencher formulário
router.get('/defaults', authenticateToken, controller.getDefaults.bind(controller));

// Gerar ZIP com instalador completo (requer autenticação)
router.post('/generate', authenticateToken, controller.generate.bind(controller));

export default router;
