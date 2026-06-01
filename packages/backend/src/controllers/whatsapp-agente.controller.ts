import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { processarWebhook } from '../services/whatsapp-agente/webhook-handler';
import { loadAgenteConfig, runAgent } from '../services/whatsapp-agente/agent-runner';
import { ALL_TOOLS, getToolsForUI } from '../services/whatsapp-agente/tools-registry';
import { WhatsAppService } from '../services/whatsapp.service';

export class WhatsappAgenteController {
  /** GET /api/whatsapp-agente/config */
  static async getConfig(_req: Request, res: Response): Promise<void> {
    try {
      const config = await loadAgenteConfig();
      res.json(config || {});
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** PUT /api/whatsapp-agente/config */
  static async putConfig(req: Request, res: Response): Promise<void> {
    try {
      const allowed = [
        'ativo', 'group_id', 'group_name', 'prefixo',
        'whitelist_numeros', 'horario_inicio', 'horario_fim', 'dias_semana', 'mensagem_fora_horario',
        'nome_agente', 'avatar_emoji', 'persona_descricao', 'tom_comunicacao',
        'modelo_ia', 'max_tokens_resposta', 'temperatura', 'instrucoes_extras',
        'tools_habilitadas', 'notificacoes_proativas',
        'budget_mensal_brl', 'alertar_em_pct', 'bloquear_em_pct',
        'lojas_permitidas', 'setores_permitidos', 'esconder_custo',
      ];
      const sets: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const f of allowed) {
        if (req.body[f] !== undefined) {
          const v = req.body[f];
          // JSON / array fields
          const isJsonish = typeof v === 'object' && v !== null && !Array.isArray(v);
          const isArr = Array.isArray(v);
          sets.push(`${f} = $${p++}`);
          params.push(isJsonish ? JSON.stringify(v) : isArr ? v : v);
        }
      }
      sets.push(`updated_at = NOW()`);

      const existing = await AppDataSource.query(`SELECT id FROM whatsapp_agente_config ORDER BY id ASC LIMIT 1`);
      if (existing?.length) {
        params.push(existing[0].id);
        const r = await AppDataSource.query(
          `UPDATE whatsapp_agente_config SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
          params
        );
        res.json(r[0]);
      } else {
        // Cria primeira linha
        const cols = allowed.filter(f => req.body[f] !== undefined);
        const vals = cols.map(f => {
          const v = req.body[f];
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) return JSON.stringify(v);
          return v;
        });
        const r = await AppDataSource.query(
          `INSERT INTO whatsapp_agente_config (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
          vals
        );
        res.json(r[0]);
      }
    } catch (e: any) {
      console.error('[WhatsappAgente] putConfig erro:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /** POST /api/whatsapp-agente/webhook  -- recebe da Evolution */
  static async webhook(req: Request, res: Response): Promise<void> {
    // Responde rapido pra Evolution nao reenviar - processa async
    res.json({ ok: true });
    processarWebhook(req.body).catch(e => console.error('[WhatsappAgente] webhook bg erro:', e));
  }

  /** POST /api/whatsapp-agente/test  -- testa o agente sem precisar do whatsapp */
  static async test(req: Request, res: Response): Promise<void> {
    try {
      const { pergunta } = req.body;
      if (!pergunta) { res.status(400).json({ error: 'pergunta obrigatoria' }); return; }
      const config = await loadAgenteConfig();
      if (!config) { res.status(400).json({ error: 'Agente nao configurado' }); return; }
      const result = await runAgent(config, pergunta, {
        fromNumber: 'TEST',
        fromName: 'Tester',
        esconderCusto: config.esconder_custo,
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** POST /api/whatsapp-agente/send-test  -- envia mensagem de ping no grupo */
  static async sendPing(_req: Request, res: Response): Promise<void> {
    try {
      const config = await loadAgenteConfig();
      if (!config?.group_id) { res.status(400).json({ error: 'Sem grupo configurado' }); return; }
      const msg = `🤖 *${config.nome_agente}* aqui!\n\nMe chame com *${config.prefixo} <pergunta>* — ex: *${config.prefixo} venda hoje*`;
      const ok = await WhatsAppService.sendMessage(config.group_id, msg);
      res.json({ success: ok });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** GET /api/whatsapp-agente/tools  -- lista tools disponiveis */
  static async listTools(_req: Request, res: Response): Promise<void> {
    res.json({
      all: ALL_TOOLS.map(t => ({ name: t.name, categoria: t.categoria, descricao: t.descricao })),
      byCategoria: getToolsForUI(),
    });
  }

  /** POST /api/whatsapp-agente/setup-webhook  -- configura webhook na Evolution */
  static async setupWebhook(req: Request, res: Response): Promise<void> {
    try {
      const ConfigService = require('../services/configuration.service').ConfigurationService;
      const url = await ConfigService.get('evolution_api_url');
      const token = await ConfigService.get('evolution_api_token');
      const instancia = req.body.instancia || await ConfigService.get('evolution_instance');
      const frontendUrl = await ConfigService.get('frontend_url', process.env.FRONTEND_URL || '');

      if (!url || !token || !instancia) {
        res.status(400).json({ error: 'Evolution nao configurado (URL/Token/Instancia)' });
        return;
      }
      if (!frontendUrl) {
        res.status(400).json({ error: 'FRONTEND_URL nao configurado' });
        return;
      }

      const webhookUrl = `${frontendUrl.replace(/\/$/, '')}/api/whatsapp-agente/webhook`;
      const axios = require('axios');
      const headers = { apikey: token, 'Content-Type': 'application/json' };
      const payload = {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ['MESSAGES_UPSERT'],
        }
      };

      try {
        const r = await axios.post(`${url}/webhook/set/${encodeURIComponent(instancia)}`,
          payload, { headers, timeout: 15000 });
        res.json({ success: true, method: 'POST v2', webhook_url: webhookUrl, data: r.data });
        return;
      } catch (e1: any) {
        console.log('[Agente Webhook] falhou:', e1.response?.status, e1.response?.data);
      }

      // Listar instancias pra debug
      try {
        const r = await axios.get(`${url}/instance/fetchInstances`, { headers, timeout: 10000 });
        res.status(500).json({
          error: 'Falha em ambas APIs. Instancias disponiveis:',
          instances: r.data?.map((i: any) => i.name || i.instance?.instanceName),
        });
      } catch (e3: any) {
        res.status(500).json({ error: 'Falha total', details: e3.response?.data || e3.message });
      }
    } catch (e: any) {
      console.error('[Agente] setupWebhook erro:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /** GET /api/whatsapp-agente/logs?limit=50 */
  static async listLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
      const rows = await AppDataSource.query(
        `SELECT id, timestamp_recebido, from_number, from_name, mensagem_recebida,
                LEFT(resposta_enviada, 200) AS resposta_preview, tool_name,
                tokens_input, tokens_output, custo_estimado_brl, modelo,
                sucesso, erro, ignorada, motivo_ignorada
         FROM whatsapp_agente_logs
         ORDER BY timestamp_recebido DESC
         LIMIT $1`,
        [limit]
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
}
