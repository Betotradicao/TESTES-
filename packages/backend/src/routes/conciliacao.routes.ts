import { Router } from 'express';
import multer from 'multer';
import { ConciliacaoController } from '../controllers/conciliacao.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
router.use(authenticateToken);

// PDF de fatura fica em memória (não precisa gravar em disco pra parsear)
const uploadFatura = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
// Lote: 1 requisição pra N amarrações (evita estourar o rate limit de 200/min)
router.post('/amarracoes/lote', ConciliacaoController.salvarAmarracoesLote);
router.delete('/amarracoes', ConciliacaoController.removerAmarracao);
// Ações por movimento (Bloco A): única / transferência
router.post('/movimento/unica', ConciliacaoController.movimentoUnica);
router.post('/movimento/unica/lote', ConciliacaoController.movimentoUnicaLote);
router.post('/movimento/transferencia', ConciliacaoController.movimentoTransferencia);
router.post('/movimento/fatura', ConciliacaoController.movimentoFatura);
router.delete('/movimento', ConciliacaoController.removerMovimento);
// Importar PDF de fatura de cartão -> lança os itens já com sugestão de conta
router.post('/fatura/importar-pdf', uploadFatura.single('pdf'), ConciliacaoController.importarFaturaPdf);

export default router;
