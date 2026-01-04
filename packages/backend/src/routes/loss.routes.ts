import { Router, type Router as ExpressRouter } from 'express';
import multer from 'multer';
import { LossController } from '../controllers/loss.controller';
import { authenticateToken } from '../middleware/auth';
<<<<<<< HEAD
import * as path from 'path';
=======
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

const router: ExpressRouter = Router();

// Configurar multer para upload
<<<<<<< HEAD
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/temp'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'loss-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
=======
const upload = multer({
  dest: 'uploads/',
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV e Excel são permitidos'));
    }
  },
});

<<<<<<< HEAD
// Middleware de debug MUITO CEDO - ANTES de tudo
router.use((req, res, next) => {
  console.log('🟢 LOSS ROUTE - REQUISIÇÃO CHEGOU!', {
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
// Upload e importação de arquivo
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  LossController.upload
);

// IMPORTANTE: Rotas específicas devem vir ANTES das rotas com parâmetros

// Buscar resultados agregados com filtros
router.get(
  '/agregado',
  authenticateToken,
  LossController.getAgregated
);

// Buscar seções únicas para filtro
router.get(
  '/filters/secoes',
  authenticateToken,
  LossController.getSecoes
);

// Buscar produtos únicos para filtro
router.get(
  '/filters/produtos',
  authenticateToken,
  LossController.getProdutos
);

// Alternar motivo ignorado
router.post(
  '/motivos/toggle',
  authenticateToken,
  LossController.toggleMotivoIgnorado
);

// Listar motivos ignorados
router.get(
  '/motivos/ignorados',
  authenticateToken,
  LossController.getMotivosIgnorados
);

// Listar todos os lotes
router.get(
  '/',
  authenticateToken,
  LossController.getAllLotes
);

// Buscar perdas de um lote
router.get(
  '/:nomeLote/items',
  authenticateToken,
  LossController.getByLote
);

// Buscar dados agregados por seção
router.get(
  '/:nomeLote/aggregated',
  authenticateToken,
  LossController.getAggregatedBySection
);

// Deletar lote
router.delete(
  '/:nomeLote',
  authenticateToken,
  LossController.deleteLote
);

export default router;
