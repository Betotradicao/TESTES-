import { Router } from 'express';
import { LgpdController } from '../controllers/lgpd.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

router.get('/aceites', LgpdController.listarAceites);
router.post('/aceites', LgpdController.registrarAceite);
router.post('/aceites/:id/revogar', LgpdController.revogarAceite);

router.get('/configuracoes', LgpdController.obterConfiguracoes);
router.put('/configuracoes', LgpdController.atualizarConfiguracoes);

export default router;
