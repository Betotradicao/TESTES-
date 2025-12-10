import { Router, Request, Response } from 'express';
import { SystemController } from '../controllers/system.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

/**
 * Rotas de configuração do sistema
 * Requer autenticação
 */

// Visualizar token atual (apenas admin)
router.get('/token', authenticateToken, (req: Request, res: Response) => SystemController.getToken(req, res));

// Gerar novo token (apenas admin)
router.post('/token/generate', authenticateToken, (req: Request, res: Response) => SystemController.generateToken(req, res));

// Atualizar token (apenas admin)
router.put('/token', authenticateToken, (req: Request, res: Response) => SystemController.updateToken(req, res));

export default router;
