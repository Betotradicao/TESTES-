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

// Listar produtos de padaria disponíveis (apenas ativos)
router.get('/bakery-products', ProductionAuditController.getBakeryProducts);

// Listar todas as seções do ERP (sem filtrar por ativos)
router.get('/erp-sections', ProductionAuditController.getErpSections);

// Listar todos os produtos de uma seção do ERP (sem filtrar por ativos)
router.get('/erp-products-by-section', ProductionAuditController.getErpProductsBySection);

// Criar ou atualizar auditoria
router.post('/audits', ProductionAuditController.createOrUpdateAudit);

// Salvar item individual (cria auditoria se não existir)
router.post('/audits/save-item', ProductionAuditController.saveItem);

// Remover item individual de uma auditoria
router.delete('/audits/:id/items/:productCode', ProductionAuditController.deleteItem);

// Finalizar auditoria
router.put('/audits/:id/complete', ProductionAuditController.completeAudit);

// Deletar auditoria
router.delete('/audits/:id', ProductionAuditController.deleteAudit);

// Enviar relatório para WhatsApp
router.post('/audits/:id/send-whatsapp', ProductionAuditController.sendToWhatsApp);

// Limpar cache de produtos (força recarregar do Oracle)
router.post('/clear-cache', ProductionAuditController.clearCache);

// Atualizar responsável do produto
router.patch('/products/:productCode/responsible', ProductionAuditController.updateProductResponsible);

export default router;
