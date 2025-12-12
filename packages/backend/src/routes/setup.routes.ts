import { Router, type Router as ExpressRouter } from 'express';
import { SetupController } from '../controllers/setup.controller';

const router: ExpressRouter = Router();

// Verifica se o sistema precisa de setup
router.get('/status', SetupController.checkSetupStatus);

// Realiza o setup inicial
router.post('/initialize', SetupController.performSetup);

export default router;
