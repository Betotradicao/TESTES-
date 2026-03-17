import { Router, IRouter } from 'express';
import { authenticateToken } from '../middleware/auth';
import { TributacaoController } from '../controllers/tributacao.controller';

const router: IRouter = Router();

router.get('/produtos', authenticateToken, TributacaoController.getProdutos);

export default router;
