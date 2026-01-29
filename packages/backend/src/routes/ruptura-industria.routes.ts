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

// Histórico de compras de um produto (todos os fornecedores)
router.get('/produto/:codProduto/compras', RupturaIndustriaController.historicoComprasProduto);

// Pedidos detalhados de um produto (mostra cada pedido individual)
router.get('/produto/:codProduto/pedidos', RupturaIndustriaController.pedidosProduto);

// Nota fiscal relacionada a um pedido
router.get('/pedido/:numPedido/nota-fiscal', RupturaIndustriaController.notaFiscalPedido);

// Top produtos mais cancelados (geral)
router.get('/top-produtos', RupturaIndustriaController.topProdutosCancelados);

// Evolução mensal de cancelamentos
router.get('/evolucao-mensal', RupturaIndustriaController.evolucaoMensal);

// Ranking de produtos com dados por fornecedor (para aba Ranking)
router.get('/ranking-produtos-fornecedores', RupturaIndustriaController.rankingProdutosFornecedores);

export default router;
