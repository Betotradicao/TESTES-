/**
 * AI Consultant Routes
 * Rotas do consultor IA
 */

import { Router } from 'express';
import { AIConsultantController } from '../controllers/ai-consultant.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Chat com a IA
router.post('/chat', AIConsultantController.chat);

// Listar conversas
router.get('/conversations', AIConsultantController.getConversations);

// Histórico de uma conversa
router.get('/conversations/:id', AIConsultantController.getConversationHistory);

// Deletar conversa
router.delete('/conversations/:id', AIConsultantController.deleteConversation);

export default router;
