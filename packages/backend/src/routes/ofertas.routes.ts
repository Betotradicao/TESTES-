/**
 * Ofertas Routes
 * Rotas para gestao de ofertas / programacao atual
 */

import { Router } from 'express';
import { OfertasController } from '../controllers/ofertas.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Lista programacoes (ativas ou todas)
router.get('/programacoes', OfertasController.getProgramacoes);

// Produtos de uma programacao com dados enriquecidos
router.get('/produtos/:codProg', OfertasController.getProdutos);

// Historico de ofertas de um produto
router.get('/historico-produto/:codProduto', OfertasController.getHistoricoProduto);

// Compra e Venda excedido (produtos estourados no ano corrente)
router.get('/compra-venda-excedido', OfertasController.getCompraVendaExcedido);

// Sugestoes de oferta (PostgreSQL)
router.post('/salvar-sugestoes', OfertasController.salvarSugestoes);
router.get('/sugestoes-salvas', OfertasController.getSugestoesSalvas);
router.delete('/sugestoes-salvas/:id', OfertasController.deleteSugestao);
router.post('/sugestoes-salvas-por-nome/deletar', OfertasController.deleteSugestaoPorNome);

export default router;
