/**
 * Prazo Fornecedores Routes
 * Rotas para análise de prazos de pagamento por fornecedor
 */

import { Router } from 'express';
import { PrazoFornecedoresController } from '../controllers/prazo-fornecedores.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Lista fornecedores com prazos de pagamento
router.get('/', PrazoFornecedoresController.listar);

// Itens (produtos) de uma nota fiscal
router.get('/itens-nota', PrazoFornecedoresController.itensNota);

// Fornecedores alternativos para um produto (com prazo maior)
router.get('/fornecedores-alternativos', PrazoFornecedoresController.fornecedoresAlternativos);

export default router;
