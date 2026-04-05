import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AcougueController } from '../controllers/acougue.controller';

const router: ReturnType<typeof Router> = Router();

// Busca de produtos Oracle
router.get('/buscar-produtos', authenticateToken, AcougueController.buscarProdutos);

// Templates de Rendimento
router.get('/templates', authenticateToken, AcougueController.listarTemplates);
router.get('/templates/:id', authenticateToken, AcougueController.getTemplate);
router.post('/templates', authenticateToken, AcougueController.criarTemplate);
router.put('/templates/:id', authenticateToken, AcougueController.atualizarTemplate);
router.delete('/templates/:id', authenticateToken, AcougueController.deletarTemplate);

// Desmembramento
router.post('/desmembramento/calcular', authenticateToken, AcougueController.calcularDesmembramento);
router.post('/desmembramento/salvar', authenticateToken, AcougueController.salvarDesmembramento);
router.get('/desmembramentos', authenticateToken, AcougueController.listarDesmembramentos);

export default router;
