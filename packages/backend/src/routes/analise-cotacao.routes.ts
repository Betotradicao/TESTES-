import { Router } from 'express';
import { AnaliseCotacaoController } from '../controllers/analise-cotacao.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

router.get('/cotacoes', AnaliseCotacaoController.getCotacoes);
router.get('/detalhes', AnaliseCotacaoController.getDetalhes);
router.get('/ranking', AnaliseCotacaoController.getRanking);

export default router;
