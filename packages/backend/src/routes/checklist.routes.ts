import { Router } from 'express';
import multer from 'multer';
import { ChecklistController } from '../controllers/checklist.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticateToken);

// Templates
router.get('/templates', ChecklistController.listarTemplates);
router.get('/templates/:id', ChecklistController.obterTemplate);
router.post('/templates', ChecklistController.criarTemplate);
router.put('/templates/:id', ChecklistController.atualizarTemplate);
router.delete('/templates/:id', ChecklistController.deletarTemplate);

// Sections
router.post('/templates/:templateId/sections', ChecklistController.criarSection);
router.put('/sections/:id', ChecklistController.atualizarSection);
router.delete('/sections/:id', ChecklistController.deletarSection);

// Questions
router.post('/sections/:sectionId/questions', ChecklistController.criarQuestion);
router.put('/questions/:id', ChecklistController.atualizarQuestion);
router.delete('/questions/:id', ChecklistController.deletarQuestion);

// Modelos de alternativas (reutilizaveis)
router.get('/modelos', ChecklistController.listarModelos);
router.get('/modelos/:id', ChecklistController.obterModelo);
router.post('/modelos', ChecklistController.criarModelo);
router.put('/modelos/:id', ChecklistController.atualizarModelo);
router.delete('/modelos/:id', ChecklistController.deletarModelo);

// Cadastros auxiliares
router.get('/auditores', ChecklistController.listarAuditores);
router.get('/auditados', ChecklistController.listarAuditados);
router.get('/setores', ChecklistController.listarSetores);

// Inspections
router.get('/inspections', ChecklistController.listarInspections);
router.get('/inspections/:id', ChecklistController.obterInspection);
router.post('/inspections', ChecklistController.criarInspection);
router.post('/inspections/:id/responses', ChecklistController.salvarResposta);
router.post('/inspections/:id/finalizar', ChecklistController.finalizarInspection);

// Actions
router.get('/actions', ChecklistController.listarActions);
router.post('/actions', ChecklistController.criarAction);
router.put('/actions/:id/status', ChecklistController.atualizarActionStatus);

// Upload de imagem (referencia / evidencia)
router.post('/upload-imagem', upload.single('imagem'), ChecklistController.uploadImagem);

// Dashboard
router.get('/dashboard/resumo', ChecklistController.dashboardResumo);
router.get('/dashboard/completo', ChecklistController.dashboardCompleto);

export default router;
