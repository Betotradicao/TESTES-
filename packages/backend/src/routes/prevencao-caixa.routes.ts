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

// Itens de um cupom cancelado (via cupom seguinte)
router.get('/cupom-itens/:numCupom', PrevencaoCaixaController.getCupomItens);

// Resumo de vendas com desconto
router.get('/descontos', PrevencaoCaixaController.getDescontos);

// Lista de itens vendidos com desconto
router.get('/itens-desconto', PrevencaoCaixaController.getItensDesconto);

export default router;
