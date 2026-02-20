/**
 * Abastecimento Routes
 * Rotas para módulo de Prevenção Abastecimento
 */

import { Router } from 'express';
import { AbastecimentoController } from '../controllers/abastecimento.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

router.get('/prioridade-reposicao', AbastecimentoController.getPrioridadeReposicao);

export default router;
