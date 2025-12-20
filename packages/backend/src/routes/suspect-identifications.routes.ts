import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { getNextNumber, create, list } from '../controllers/suspect-identifications.controller';
import { authenticateToken } from '../middleware/auth';

const router: RouterType = Router();

// Buscar o próximo número disponível
router.get('/next-number', authenticateToken, getNextNumber);

// Criar nova identificação
router.post('/', authenticateToken, create);

// Listar todas as identificações
router.get('/', authenticateToken, list);

export default router;
