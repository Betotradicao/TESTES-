import { Router } from 'express';
import { CotacaoController } from '../controllers/cotacao.controller';
import { authenticateToken } from '../middleware/auth';

// Rotas autenticadas (comprador)
const cotacaoRouter: Router = Router();
cotacaoRouter.use(authenticateToken);
cotacaoRouter.post('/criar', CotacaoController.criar);
cotacaoRouter.get('/pedido/:numPedido', CotacaoController.buscarPorPedido);
cotacaoRouter.delete('/pedido/:numPedido', CotacaoController.excluir);

// Rotas públicas (fornecedor, sem auth)
const cotacaoPublicRouter: Router = Router();
cotacaoPublicRouter.get('/:token', CotacaoController.buscarPorToken);
cotacaoPublicRouter.post('/:token/responder', CotacaoController.responder);

export { cotacaoRouter, cotacaoPublicRouter };
