import { Router, type Router as ExpressRouter } from 'express';
import multer from 'multer';
import { LossController } from '../controllers/loss.controller';
import { authenticateToken } from '../middleware/auth';

const router: ExpressRouter = Router();

// Configurar multer para upload
const upload = multer({
  dest: 'uploads/',
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
