/**
 * Ancoragem de Preco Routes
 */

import { Router } from 'express';
import { AncoragemController } from '../controllers/ancoragem.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

router.use(authenticateToken);

// Produtos Oracle com marca
router.get('/products', AncoragemController.getProducts);

// Classificacoes (tier por produto)
router.get('/classificacoes', AncoragemController.getClassificacoes);
router.post('/classificacoes', AncoragemController.saveClassificacoes);

// Regras de gap entre tiers
router.get('/regras', AncoragemController.getRegras);
router.post('/regras', AncoragemController.saveRegras);

// Analise completa
router.get('/analise', AncoragemController.getAnalise);

// Stats agregados (contagem por status em todas secoes)
router.get('/stats', AncoragemController.getStats);

// Tiers customizados
router.get('/tiers', AncoragemController.getTiers);
router.post('/tiers', AncoragemController.saveTier);
router.delete('/tiers', AncoragemController.deleteTier);

export default router;
