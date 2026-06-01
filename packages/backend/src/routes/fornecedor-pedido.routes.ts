import { Router } from 'express';
import { FornecedorPedidoController } from '../controllers/fornecedor-pedido.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// ======== Endpoints PUBLICOS (sem auth) — usados pelo fornecedor no celular ========
router.get('/publico/lojas', FornecedorPedidoController.listarLojasPublicas);
router.get('/publico/buscar', FornecedorPedidoController.buscarFornecedor);
router.get('/publico/produtos', FornecedorPedidoController.listarProdutosFornecedor);
router.post('/publico/enviar', FornecedorPedidoController.enviarPedido);

// ======== Endpoints AUTENTICADOS (backoffice) ========
router.get('/', authenticateToken, FornecedorPedidoController.listarPedidos);
router.get('/:id', authenticateToken, FornecedorPedidoController.obterPedido);
router.put('/:id/status', authenticateToken, FornecedorPedidoController.atualizarStatus);

export default router;
