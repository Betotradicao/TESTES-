import { Router } from 'express';
import { SetupController } from '../controllers/setup.controller';

const router = Router();

// Verifica se o sistema precisa de setup
router.get('/status', SetupController.checkSetupStatus);

// Realiza o setup inicial
router.post('/initialize', SetupController.performSetup);

export default router;
