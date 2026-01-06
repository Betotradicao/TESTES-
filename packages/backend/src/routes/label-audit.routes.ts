import { Router } from 'express';
import { LabelAuditController, upload } from '../controllers/label-audit.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Upload e criação de auditoria
router.post('/upload', upload.single('file'), LabelAuditController.uploadAndCreateAudit);

// Listar todas as auditorias
router.get('/', LabelAuditController.getAllAudits);

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
