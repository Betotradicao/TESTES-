/**
 * AI Consultant Controller
 * Endpoints do consultor IA
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AIConsultantService } from '../services/ai-consultant.service';

export class AIConsultantController {
  /**
   * POST /api/ai-consultant/chat
   * Envia mensagem para a IA e recebe resposta
   */
  static async chat(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const { message, conversationId } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Mensagem é obrigatória' });
      }

      const result = await AIConsultantService.chat(parseInt(userId), conversationId || null, message.trim());
      res.json(result);
    } catch (error: any) {
      console.error('❌ [AI Controller] Erro no chat:', error.message);
      res.status(500).json({ error: error.message || 'Erro ao processar mensagem' });
    }
  }

  /**
   * GET /api/ai-consultant/conversations
   * Lista conversas do usuário
   */
  static async getConversations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const conversations = await AIConsultantService.getConversations(parseInt(userId));
      res.json(conversations);
    } catch (error: any) {
      console.error('❌ [AI Controller] Erro ao listar conversas:', error.message);
      res.status(500).json({ error: 'Erro ao listar conversas' });
    }
  }

  /**
   * GET /api/ai-consultant/conversations/:id
   * Busca histórico de uma conversa
   */
  static async getConversationHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const history = await AIConsultantService.getConversationHistory(conversationId, parseInt(userId));
      res.json(history);
    } catch (error: any) {
      console.error('❌ [AI Controller] Erro ao buscar histórico:', error.message);
      res.status(500).json({ error: error.message || 'Erro ao buscar histórico' });
    }
  }

  /**
   * DELETE /api/ai-consultant/conversations/:id
   * Deleta uma conversa
   */
  static async deleteConversation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      await AIConsultantService.deleteConversation(conversationId, parseInt(userId));
      res.json({ message: 'Conversa deletada com sucesso' });
    } catch (error: any) {
      console.error('❌ [AI Controller] Erro ao deletar conversa:', error.message);
      res.status(500).json({ error: 'Erro ao deletar conversa' });
    }
  }
}
