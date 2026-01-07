import { Router, Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';

const router: Router = Router();

/**
 * POST /api/whatsapp/test-group
 * Envia mensagem de teste para um grupo do WhatsApp
 */
router.post('/test-group', async (req, res) => {
  try {
    const { groupId, message } = req.body;

    if (!groupId || !message) {
      return res.status(400).json({
        success: false,
        error: 'groupId e message são obrigatórios'
      });
    }

    const success = await WhatsAppService.sendMessage(groupId, message);

    if (success) {
      res.json({
        success: true,
        message: 'Mensagem de teste enviada com sucesso!'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Falha ao enviar mensagem de teste'
      });
    }
  } catch (error: any) {
    console.error('Erro ao enviar mensagem de teste:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao enviar mensagem de teste'
    });
  }
});

export default router;
