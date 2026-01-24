/**
 * Compra x Venda Routes
 * Rotas para análise de Compras x Vendas por Classificação Mercadológica
 */

import { Router } from 'express';
import { CompraVendaController } from '../controllers/compra-venda.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Rotas públicas para exploração (temporário)
router.get('/explorar', CompraVendaController.explorarTabelas);
router.post('/query-teste', CompraVendaController.queryTeste);

// Todas as outras rotas requerem autenticação
router.use(authenticateToken);

// Teste de conexão com Oracle
router.get('/test-connection', CompraVendaController.testConnection);

// Filtros - Dados para dropdowns
router.get('/secoes', CompraVendaController.getSecoes);
router.get('/grupos', CompraVendaController.getGrupos);
router.get('/subgrupos', CompraVendaController.getSubGrupos);
router.get('/compradores', CompraVendaController.getCompradores);
router.get('/lojas', CompraVendaController.getLojas);

// Dados principais
router.get('/dados', CompraVendaController.getCompraVenda);
router.get('/totais', CompraVendaController.getTotais);

// Drill-down (cascata)
router.get('/drill-down/grupos', CompraVendaController.getDrillDownGrupos);
router.get('/drill-down/subgrupos', CompraVendaController.getDrillDownSubGrupos);
router.get('/drill-down/itens', CompraVendaController.getDrillDownItens);

// Detalhamento de empréstimos (para tooltip)
router.get('/detalhe-emprestimo', CompraVendaController.getDetalheEmprestimo);

export default router;
