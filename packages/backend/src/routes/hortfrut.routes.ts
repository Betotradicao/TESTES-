import { Router, IRouter } from 'express';
import { HortFrutController } from '../controllers/hortfrut.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

// Rotas de Caixas
router.get('/boxes', authenticateToken, HortFrutController.getBoxes);
router.post('/boxes', authenticateToken, HortFrutController.createBox);
router.put('/boxes/:id', authenticateToken, HortFrutController.updateBox);
router.delete('/boxes/:id', authenticateToken, HortFrutController.deleteBox);

// Rotas de Conferências
router.get('/conferences', authenticateToken, HortFrutController.getConferences);
router.get('/conferences/by-date', authenticateToken, HortFrutController.getConferencesByDate);
router.get('/conferences/:id', authenticateToken, HortFrutController.getConferenceById);
router.post('/conferences', authenticateToken, HortFrutController.createConference);
router.put('/conferences/:id', authenticateToken, HortFrutController.updateConference);
router.delete('/conferences/:id', authenticateToken, HortFrutController.deleteConference);
router.post('/conferences/:id/finalize', authenticateToken, HortFrutController.finalizeConference);

// Rotas de Itens
router.post('/conferences/:id/items', authenticateToken, HortFrutController.importItems);
router.put('/conferences/:id/items/:itemId', authenticateToken, HortFrutController.updateItem);

export default router;
