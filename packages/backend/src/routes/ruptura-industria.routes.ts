/**
 * Ruptura Indústria Routes
 * Rotas para análise de cancelamentos de pedidos por fornecedor
 */

import { Router } from 'express';
import { RupturaIndustriaController } from '../controllers/ruptura-industria.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Ranking de fornecedores com mais cancelamentos
router.get('/ranking-fornecedores', RupturaIndustriaController.rankingFornecedores);

// Produtos cancelados de um fornecedor específico
router.get('/fornecedor/:codFornecedor/produtos', RupturaIndustriaController.produtosFornecedor);

// Histórico de cancelamentos de um produto
router.get('/produto/:codProduto/historico', RupturaIndustriaController.historicoProduto);

// Top produtos mais cancelados (geral)
router.get('/top-produtos', RupturaIndustriaController.topProdutosCancelados);

// Evolução mensal de cancelamentos
router.get('/evolucao-mensal', RupturaIndustriaController.evolucaoMensal);

export default router;
