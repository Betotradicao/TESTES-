import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { LabelAuditController, upload } from '../controllers/label-audit.controller';
import { authenticateToken } from '../middleware/auth';

const router: ExpressRouter = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Upload e criação de auditoria
router.post('/upload', upload.single('file'), LabelAuditController.uploadAndCreateAudit);

// Listar todas as auditorias
router.get('/', LabelAuditController.getAllAudits);

// IMPORTANTE: Rotas específicas devem vir ANTES das rotas com parâmetros
router.get('/agregado', LabelAuditController.getAgregated);

// Criar auditoria a partir de itens (Direto Sistema)
router.post('/from-items', LabelAuditController.createFromItems);

// Buscar auditoria por ID
router.get('/:id', LabelAuditController.getAuditById);

// Buscar itens pendentes
router.get('/:id/pending-items', LabelAuditController.getPendingItems);

// Verificar item
router.put('/items/:itemId/verify', LabelAuditController.verifyItem);

// Enviar relatório via WhatsApp
router.post('/:id/send-report', LabelAuditController.sendReport);

// Download PDF
router.get('/:id/report-pdf', LabelAuditController.downloadReport);

// Deletar auditoria
router.delete('/:id', LabelAuditController.deleteAudit);

export default router;
