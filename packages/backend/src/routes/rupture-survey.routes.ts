import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { RuptureSurveyController } from '../controllers/rupture-survey.controller';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import * as path from 'path';

const router: ExpressRouter = Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/temp'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'rupture-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV e Excel são permitidos'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Rotas
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  RuptureSurveyController.uploadAndCreate
);

router.get(
  '/',
  authenticateToken,
  RuptureSurveyController.getAll
);

// IMPORTANTE: Rotas específicas devem vir ANTES das rotas com parâmetros
router.get(
  '/agregado',
  authenticateToken,
  RuptureSurveyController.getAgregated
);

router.get(
  '/filters/produtos',
  authenticateToken,
  RuptureSurveyController.getProdutos
);

router.get(
  '/filters/fornecedores',
  authenticateToken,
  RuptureSurveyController.getFornecedores
);

router.get(
  '/:id',
  authenticateToken,
  RuptureSurveyController.getById
);

router.post(
  '/:id/start',
  authenticateToken,
  RuptureSurveyController.startSurvey
);

router.post(
  '/:id/finalize',
  authenticateToken,
  RuptureSurveyController.finalizeSurvey
);

router.patch(
  '/items/:itemId/status',
  authenticateToken,
  RuptureSurveyController.updateItemStatus
);

router.delete(
  '/:id',
  authenticateToken,
  RuptureSurveyController.deleteSurvey
);

export default router;
