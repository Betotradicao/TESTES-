/**
 * Margens por Categoria Routes
 * Rotas para consulta de margens, precos e estoque por classificacao mercadologica
 */

import { Router, IRouter } from 'express';
import { MargensCategoriaController } from '../controllers/margens-categoria.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

// Todas as rotas requerem autenticacao
router.use(authenticateToken);

// Dados principais
router.get('/produtos', MargensCategoriaController.getProdutos);

// Filtros - Dados para dropdowns
router.get('/secoes', MargensCategoriaController.getSecoes);
router.get('/grupos', MargensCategoriaController.getGrupos);
router.get('/subgrupos', MargensCategoriaController.getSubGrupos);
router.get('/segmentos', MargensCategoriaController.getSegmentos);

export default router;
