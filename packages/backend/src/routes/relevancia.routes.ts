/**
 * Análise de Relevância Routes
 */

import { Router } from 'express';
import { RelevanciaController } from '../controllers/relevancia.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Processamento principal
router.get('/processar', RelevanciaController.processar);

// Filtros - dropdowns
router.get('/secoes', RelevanciaController.getSecoes);
router.get('/grupos', RelevanciaController.getGrupos);
router.get('/subgrupos', RelevanciaController.getSubGrupos);

export default router;
