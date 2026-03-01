import { Request, Response } from 'express';
import { GarimpadorService } from '../services/garimpador.service';
import { GarimpadorProcessadorService } from '../services/garimpador-processador.service';
import { ConfigurationService } from '../services/configuration.service';
import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';

export class GarimpadorController {

  /**
   * POST /api/garimpador/webhook
   * Recebe webhook da Evolution API (público, sem auth)
   */
  static async webhook(req: Request, res: Response) {
    try {
      const result = await GarimpadorService.processarWebhook(req.body);

      if (result) {
        res.json({ ok: true, contato: result.contato.nome || result.contato.telefone });
      } else {
        res.json({ ok: true, ignored: true });
      }
    } catch (error: any) {
      console.error('[Garimpador] Erro no webhook:', error);
      // Sempre retorna 200 pro webhook não ficar retentando
      res.json({ ok: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/contatos
   * Lista todos os contatos com contagem de mensagens
   */
  static async listarContatos(req: Request, res: Response) {
    try {
      const contatos = await GarimpadorService.listarContatos();
      res.json(contatos);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao listar contatos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/garimpador/contatos/:id/tipo
   * Atualiza o tipo de um contato (fornecedor/concorrente/nao_classificado)
   */
  static async atualizarTipoContato(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { tipo } = req.body;

      if (!tipo) {
        return res.status(400).json({ error: 'Campo "tipo" é obrigatório' });
      }

      const contato = await GarimpadorService.atualizarTipoContato(id, tipo);
      if (!contato) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      res.json(contato);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao atualizar tipo:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/garimpador/mensagens
   * Lista mensagens com filtros e paginação
   */
  static async listarMensagens(req: Request, res: Response) {
    try {
      const filtros = {
        contatoId: req.query.contatoId ? parseInt(req.query.contatoId as string) : undefined,
        tipoMidia: req.query.tipoMidia as string | undefined,
        processado: req.query.processado !== undefined ? req.query.processado === 'true' : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      };

      const result = await GarimpadorService.listarMensagens(filtros);
      res.json(result);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao listar mensagens:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/garimpador/estatisticas
   * Retorna estatísticas gerais
   */
  static async getEstatisticas(req: Request, res: Response) {
    try {
      const stats = await GarimpadorService.getEstatisticas();
      res.json(stats);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/garimpador/configurar-webhook
   * Configura o webhook na Evolution API para receber mensagens
   */
  static async configurarWebhook(req: Request, res: Response) {
    try {
      const { enabled, webhookUrl } = req.body;

      // Buscar configs da Evolution
      const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
      const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
      const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

      if (!apiUrl || !apiToken || !instance) {
        return res.status(400).json({
          success: false,
          error: 'Configurações da Evolution API não encontradas. Configure URL, Token e Instância primeiro.'
        });
      }

      // URL do webhook do garimpador (detecta HTTPS atrás de proxy)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');
      const url = webhookUrl || `${protocol}://${host}/api/garimpador/webhook`;

      // Payload no formato Evolution API v2.3.x (requer wrapper "webhook")
      const webhookPayload = {
        webhook: enabled
          ? { enabled: true, url, webhookByEvents: false, webhookBase64: false, events: ['MESSAGES_UPSERT'] }
          : { enabled: false, url: '', webhookByEvents: false, webhookBase64: false, events: ['MESSAGES_UPSERT'] }
      };

      const setWebhookUrl = `${apiUrl}/webhook/set/${encodeURIComponent(instance)}`;

      const response = await fetch(setWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Garimpador] Erro ao configurar webhook na Evolution:', errorText);
        return res.status(500).json({
          success: false,
          error: `Erro na Evolution API: ${response.status} - ${errorText}`
        });
      }

      const result = await response.json();
      console.log(`[Garimpador] Webhook ${enabled ? 'configurado' : 'removido'} com sucesso:`, result);

      res.json({
        success: true,
        message: enabled ? 'Webhook configurado com sucesso na Evolution API' : 'Webhook removido da Evolution API',
        webhookUrl: enabled ? url : null,
        data: result
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao configurar webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/garimpador/webhook-status
   * Verifica se o webhook está configurado na Evolution API
   */
  static async webhookStatus(req: Request, res: Response) {
    try {
      const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
      const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
      const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

      if (!apiUrl || !apiToken || !instance) {
        return res.json({ success: true, configured: false, reason: 'Evolution API não configurada' });
      }

      const findWebhookUrl = `${apiUrl}/webhook/find/${encodeURIComponent(instance)}`;

      const response = await fetch(findWebhookUrl, {
        method: 'GET',
        headers: { 'apikey': apiToken }
      });

      if (!response.ok) {
        return res.json({ success: true, configured: false, reason: 'Não foi possível consultar webhook' });
      }

      const data = await response.json() as any;
      const hasGarimpadorWebhook = data?.url?.includes('/api/garimpador/webhook');

      res.json({
        success: true,
        configured: hasGarimpadorWebhook,
        currentUrl: data?.url || null,
        events: data?.events || []
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao verificar webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/processar
   * Processa todas as mensagens nao processadas
   */
  static async processarTodas(req: Request, res: Response) {
    try {
      const resultado = await GarimpadorProcessadorService.processarMensagensNaoProcessadas();
      res.json({
        success: true,
        ...resultado,
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao processar mensagens:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/garimpador/processar/:id
   * Processa uma mensagem especifica
   */
  static async processarUma(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(GarimpadorMensagem);
      const mensagem = await repo.findOne({ where: { id } });

      if (!mensagem) {
        return res.status(404).json({ success: false, error: 'Mensagem nao encontrada' });
      }

      const extraido = await GarimpadorProcessadorService.processarMensagem(mensagem);
      res.json({
        success: true,
        processado: true,
        conteudo_extraido: extraido,
      });
    } catch (error: any) {
      console.error('[Garimpador] Erro ao processar mensagem:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
