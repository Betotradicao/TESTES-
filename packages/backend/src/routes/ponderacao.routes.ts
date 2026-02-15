/**
 * Análise de Ponderação Routes
 */

import { Router } from 'express';
import { PonderacaoController } from '../controllers/ponderacao.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Dados principais
router.get('/dados', PonderacaoController.getDados);

// Filtros - dropdowns
router.get('/secoes', PonderacaoController.getSecoes);
router.get('/grupos', PonderacaoController.getGrupos);
router.get('/subgrupos', PonderacaoController.getSubGrupos);
router.get('/lojas', PonderacaoController.getLojas);
router.get('/segmentos', PonderacaoController.getSegmentos);

// Hierarquia Seção > Grupo > Subgrupo
router.get('/hierarquia', PonderacaoController.getHierarquia);

// Sugestão de pesos por subgrupo (análise de dados)
router.get('/sugestao-pesos', PonderacaoController.getSugestaoPesos);

// Config
router.get('/pesos-loja', PonderacaoController.getPesosLoja);

export default router;
