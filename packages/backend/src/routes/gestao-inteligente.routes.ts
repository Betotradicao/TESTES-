/**
 * Gestao Inteligente Routes
 * Rotas para consulta de indicadores consolidados de vendas
 */

import { Router } from 'express';
import { GestaoInteligenteController } from '../controllers/gestao-inteligente.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Busca indicadores consolidados
router.get('/indicadores', GestaoInteligenteController.getIndicadores);

// Lista lojas disponíveis
router.get('/lojas', GestaoInteligenteController.getLojas);

// Limpa o cache (força recarga do Oracle)
router.post('/clear-cache', GestaoInteligenteController.clearCache);

export default router;
