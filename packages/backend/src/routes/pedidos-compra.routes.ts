/**
 * Pedidos de Compra Routes
 * Rotas para consulta de pedidos de compra do Oracle (TAB_PEDIDO)
 */

import { Router } from 'express';
import { PedidosCompraController } from '../controllers/pedidos-compra.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Lista pedidos com filtros e paginação
router.get('/', PedidosCompraController.listarPedidos);

// Lista compradores disponíveis
router.get('/compradores', PedidosCompraController.listarCompradores);

// Lista classificações de fornecedores
router.get('/classificacoes', PedidosCompraController.listarClassificacoes);

// Lista NFs com bloqueio pendente de liberação
router.get('/nf-com-bloqueio', PedidosCompraController.listarNfComBloqueio);

// Lista NFs sem pedido de compra
router.get('/nf-sem-pedido', PedidosCompraController.listarNfSemPedido);

// Lista contatos com totais de NFs sem pedido
router.get('/nf-sem-pedido/contatos', PedidosCompraController.listarContatosNfSemPedido);

// Itens de uma NF específica
router.get('/nf/:numNf/:codFornecedor/:codLoja/itens', PedidosCompraController.itensNf);

// Detalhes de um pedido específico
router.get('/:numPedido', PedidosCompraController.detalhesPedido);

// Itens de um pedido
router.get('/:numPedido/itens', PedidosCompraController.itensPedido);

export default router;
