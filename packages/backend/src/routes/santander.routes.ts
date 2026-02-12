import { Router } from 'express';
import { SantanderController } from '../controllers/santander.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const santanderController = new SantanderController();

// Todas as rotas requerem autenticação
router.get('/saldo', authenticateToken, santanderController.getSaldo.bind(santanderController));
router.get('/extrato', authenticateToken, santanderController.getExtrato.bind(santanderController));
router.get('/transactions', authenticateToken, santanderController.getTransactions.bind(santanderController));
// Timeout de 5 minutos para extrato completo (pode buscar 500+ páginas em paralelo)
router.get('/extrato-completo', authenticateToken, (req, res, next) => {
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
}, santanderController.getExtratoCompleto.bind(santanderController));
router.get('/config', authenticateToken, santanderController.getConfig.bind(santanderController));
router.post('/test', authenticateToken, santanderController.testConnection.bind(santanderController));

export default router;
