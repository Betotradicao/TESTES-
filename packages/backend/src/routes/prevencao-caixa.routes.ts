/**
 * Prevenção de Caixa Routes
 * Rotas para relatórios de cancelamentos (Item, Cupom, Venda)
 */

import { Router } from 'express';
import { PrevencaoCaixaController } from '../controllers/prevencao-caixa.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Resumo de cancelamentos (totais por tipo)
router.get('/resumo', PrevencaoCaixaController.getResumo);

// Lista unificada de cancelamentos
router.get('/cancelamentos', PrevencaoCaixaController.getCancelamentos);

export default router;
