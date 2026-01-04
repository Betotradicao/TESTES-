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

<<<<<<< HEAD
// Middleware de debug MUITO CEDO - ANTES de tudo
router.use((req, res, next) => {
  console.log('🟢 RUPTURE ROUTE - REQUISIÇÃO CHEGOU!', {
    method: req.method,
    url: req.url,
    path: req.path,
    headers: {
      authorization: req.headers.authorization ? `Bearer ${req.headers.authorization.substring(7, 20)}...` : 'MISSING',
      contentType: req.headers['content-type'],
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 50)
    },
    body: Object.keys(req.body || {}),
    query: req.query
  });
  next();
});

=======
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
// Rotas
router.post(
  '/upload',
  authenticateToken,
<<<<<<< HEAD
  (req, res, next) => {
    console.log('🎯 ANTES DO MULTER - Vai processar upload');
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.log('❌ ERRO NO MULTER:', err);
        return res.status(400).json({ error: err.message });
      }
      console.log('✅ MULTER OK - Arquivo recebido:', req.file?.originalname);
      next();
    });
  },
=======
  upload.single('file'),
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
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

<<<<<<< HEAD
=======
router.post(
  '/:id/finalize',
  authenticateToken,
  RuptureSurveyController.finalizeSurvey
);

>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
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

<<<<<<< HEAD
router.post(
  '/:id/finalizar',
  authenticateToken,
  RuptureSurveyController.finalizarAuditoria
);

=======
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
export default router;
