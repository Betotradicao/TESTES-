import { Router, IRouter } from 'express';
import multer from 'multer';
import { HortFrutController } from '../controllers/hortfrut.controller';
import { authenticateToken } from '../middleware/auth';

const router: IRouter = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo inválido'));
    }
  },
});

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

// Rota de Upload de Imagem
router.post('/upload', authenticateToken, upload.single('file'), HortFrutController.uploadImage);

export default router;
