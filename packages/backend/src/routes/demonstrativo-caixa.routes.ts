/**
 * Demonstrativo de Caixa Routes
 * Orçamento Gerencial - Regime de Caixa
 */

import { Router } from 'express';
import { DemonstrativoCaixaController } from '../controllers/demonstrativo-caixa.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

router.get('/dados', DemonstrativoCaixaController.getDados);
router.get('/categorias', DemonstrativoCaixaController.getCategorias);
router.get('/titulos', DemonstrativoCaixaController.getTitulos);
router.get('/titulos/itens-nf', DemonstrativoCaixaController.getItensNF);

export default router;
