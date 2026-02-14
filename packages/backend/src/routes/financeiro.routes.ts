/**
 * Financeiro Routes
 * Rotas para tela de Entradas e Saídas
 */

import { Router } from 'express';
import { FinanceiroController } from '../controllers/financeiro.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Dados principais
router.get('/dados', FinanceiroController.getEntradasSaidas);
router.get('/resumo', FinanceiroController.getResumo);

// Dropdowns
router.get('/bancos', FinanceiroController.getBancos);
router.get('/entidades', FinanceiroController.getEntidades);
router.get('/categorias', FinanceiroController.getCategorias);

export default router;
