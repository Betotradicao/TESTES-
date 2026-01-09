import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ProductionAuditController } from '../controllers/production-audit.controller';

const router: ExpressRouter = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Listar todas as auditorias
router.get('/audits', ProductionAuditController.getAudits);

// Obter auditoria por ID
router.get('/audits/:id', ProductionAuditController.getAuditById);

// Obter auditoria por data
router.get('/audits/date/:date', ProductionAuditController.getAuditByDate);

// Listar produtos de padaria disponíveis
router.get('/bakery-products', ProductionAuditController.getBakeryProducts);

// Criar ou atualizar auditoria
router.post('/audits', ProductionAuditController.createOrUpdateAudit);

// Finalizar auditoria
router.put('/audits/:id/complete', ProductionAuditController.completeAudit);

// Deletar auditoria
router.delete('/audits/:id', ProductionAuditController.deleteAudit);

export default router;
