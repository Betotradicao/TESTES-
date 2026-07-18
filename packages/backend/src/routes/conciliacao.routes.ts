import { Router } from 'express';
import { ConciliacaoController } from '../controllers/conciliacao.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
router.use(authenticateToken);

router.get('/dados', ConciliacaoController.getDados);
router.get('/bancos', ConciliacaoController.getBancos);
router.get('/contas-correntes', ConciliacaoController.getContasCorrentes);
router.post('/conciliar', ConciliacaoController.conciliar);
router.post('/transferencia', ConciliacaoController.registrarTransferencia);
router.delete('/transferencia/:id', ConciliacaoController.removerTransferencia);

// Modo "Direto Manual"
router.get('/dados-manual', ConciliacaoController.getDadosManual);
router.get('/demonstrativo-manual', ConciliacaoController.getDemonstrativoManual);
router.get('/amarracoes', ConciliacaoController.getAmarracoes);
router.post('/amarracoes', ConciliacaoController.salvarAmarracao);
router.delete('/amarracoes', ConciliacaoController.removerAmarracao);
// Ações por movimento (Bloco A): única / transferência
router.post('/movimento/unica', ConciliacaoController.movimentoUnica);
router.post('/movimento/transferencia', ConciliacaoController.movimentoTransferencia);
router.post('/movimento/fatura', ConciliacaoController.movimentoFatura);
router.delete('/movimento', ConciliacaoController.removerMovimento);

export default router;
