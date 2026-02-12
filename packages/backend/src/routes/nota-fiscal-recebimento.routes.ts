import { Router } from 'express';
import { NotaFiscalRecebimentoController } from '../controllers/nota-fiscal-recebimento.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
router.use(authenticateToken);

router.get('/', NotaFiscalRecebimentoController.listar);
router.get('/colaboradores', NotaFiscalRecebimentoController.listarColaboradores);
router.get('/fornecedores', NotaFiscalRecebimentoController.listarFornecedores);
router.get('/notas-a-chegar', NotaFiscalRecebimentoController.listarNotasAChegar);
router.get('/buscar-nf-oracle/:numNota', NotaFiscalRecebimentoController.buscarNfOracle);
router.get('/debug-nota/:nrNota', NotaFiscalRecebimentoController.debugNota);
router.post('/verificar-entradas', NotaFiscalRecebimentoController.verificarEntradas);
router.post('/assinar-lote', NotaFiscalRecebimentoController.assinarLote);
router.post('/', NotaFiscalRecebimentoController.criar);
router.put('/:id', NotaFiscalRecebimentoController.editar);
router.delete('/:id', NotaFiscalRecebimentoController.excluir);
router.post('/:id/assinar', NotaFiscalRecebimentoController.assinar);

export default router;
