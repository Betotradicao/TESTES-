import type { Router as IRouter } from 'express';
import { Router } from 'express';
import { PDVController } from '../controllers/pdv.controller';

const router: IRouter = Router();

// Rotas de dados PDV
router.get('/resumo', PDVController.getResumo);
router.get('/vendas', PDVController.getVendas);
router.get('/descontos', PDVController.getDescontos);
router.get('/devolucoes', PDVController.getDevolucoes);

// Rotas CRUD - Operadores
router.get('/operadores', PDVController.listOperadores);
router.post('/operadores', PDVController.createOperador);
router.put('/operadores/:id', PDVController.updateOperador);
router.delete('/operadores/:id', PDVController.deleteOperador);

// Rotas CRUD - Motivos de Desconto
router.get('/motivos-desconto', PDVController.listMotivosDesconto);
router.post('/motivos-desconto', PDVController.createMotivoDesconto);
router.put('/motivos-desconto/:id', PDVController.updateMotivoDesconto);
router.delete('/motivos-desconto/:id', PDVController.deleteMotivoDesconto);

// Rotas CRUD - Autorizadores
router.get('/autorizadores', PDVController.listAutorizadores);
router.post('/autorizadores', PDVController.createAutorizador);
router.put('/autorizadores/:id', PDVController.updateAutorizador);
router.delete('/autorizadores/:id', PDVController.deleteAutorizador);

export default router;
