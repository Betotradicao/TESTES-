/**
 * Ofertas Routes
 * Rotas para gestao de ofertas / programacao atual
 */

import { Router } from 'express';
import { OfertasController } from '../controllers/ofertas.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Lista programacoes (ativas ou todas)
router.get('/programacoes', OfertasController.getProgramacoes);

// Produtos de uma programacao com dados enriquecidos
router.get('/produtos/:codProg', OfertasController.getProdutos);

export default router;
