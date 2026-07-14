import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DisparoContato } from '../entities/DisparoContato';
import { DisparoCampanha } from '../entities/DisparoCampanha';
import { DisparoMensagem } from '../entities/DisparoMensagem';
import { DisparoWhatsAppService } from '../services/disparo-whatsapp.service';
import { MktChatbotService } from '../services/mkt-chatbot.service';

interface AuthRequest extends Request {
  user?: any;
}

export class DisparoWhatsAppController {

  // ========== STATS ==========

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await DisparoWhatsAppService.getStats();
      res.json(stats);
    } catch (err: any) {
      console.error('Erro getStats disparo:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // ========== LISTAS ==========

  static async listListas(req: AuthRequest, res: Response) {
    try {
      const result = await AppDataSource.query(`
        SELECT l.*, (SELECT count(*) FROM disparo_contatos c WHERE c.lista_id = l.id) as total_contatos
        FROM disparo_listas l ORDER BY l.nome
      `);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createLista(req: AuthRequest, res: Response) {
    try {
      const { nome, cor } = req.body;
      if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
      const result = await AppDataSource.query(
        `INSERT INTO disparo_listas (nome, cor) VALUES ($1, $2) RETURNING *`, [nome, cor || '#3b82f6']
      );
      res.json(result[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async deleteLista(req: AuthRequest, res: Response) {
    try {
      await AppDataSource.query(`UPDATE disparo_contatos SET lista_id = NULL WHERE lista_id = $1`, [req.params.id]);
      await AppDataSource.query(`DELETE FROM disparo_listas WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async moveContactsToList(req: AuthRequest, res: Response) {
    try {
      const { ids, lista_id } = req.body;
      if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs obrigatórios' });
      const repo = AppDataSource.getRepository(DisparoContato);
      await repo.createQueryBuilder().update().set({ lista_id: lista_id || null }).whereInIds(ids).execute();
      res.json({ success: true, moved: ids.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async autoClassifyContacts(req: AuthRequest, res: Response) {
    try {
      // Nome só números = Clientes (lista 1), Nome com letras = Outros (lista 2)
      const r1 = await AppDataSource.query(`UPDATE disparo_contatos SET lista_id = 1 WHERE nome ~ '^[0-9]+$'`);
      const r2 = await AppDataSource.query(`UPDATE disparo_contatos SET lista_id = 2 WHERE nome ~ '[a-zA-Z]'`);
      const r3 = await AppDataSource.query(`UPDATE disparo_contatos SET lista_id = 1 WHERE lista_id IS NULL`);
      res.json({ clientes: r1[1], outros: r2[1], semNome: r3[1] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // ========== CONTATOS ==========

  static async listContacts(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoContato);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || '';
      const sortCol = (req.query.sortCol as string) || 'nome';
      const sortDir = ((req.query.sortDir as string) || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      const listaId = (req.query.lista_id as string) || '';

      const qb = repo.createQueryBuilder('c');

      if (search) {
        qb.where('(c.telefone ILIKE :s OR c.nome ILIKE :s)', { s: `%${search}%` });
      }
      if (status) {
        qb.andWhere('c.status = :status', { status });
      }
      if (listaId) {
        qb.andWhere('c.lista_id = :listaId', { listaId: parseInt(listaId) });
      }

      const allowedCols: Record<string, string> = {
        nome: 'c.nome', telefone: 'c.telefone', score: 'c.score', status: 'c.status',
        enviadas: 'c.total_enviados', lidas: 'c.total_lidos', falhas: 'c.total_falhas',
        ultima_interacao: 'c.last_interaction_at'
      };
      const orderCol = allowedCols[sortCol] || 'c.nome';
      qb.orderBy(orderCol, sortDir as 'ASC' | 'DESC', 'NULLS LAST')
        .skip((page - 1) * limit)
        .take(limit);

      const [items, total] = await qb.getManyAndCount();
      res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (err: any) {
      console.error('Erro listContacts:', err);
      res.status(500).json({ error: err.message });
    }
  }

  static async createContact(req: AuthRequest, res: Response) {
    try {
      const { telefone, nome, tags } = req.body;
      if (!telefone) return res.status(400).json({ error: 'Telefone é obrigatório' });

      const repo = AppDataSource.getRepository(DisparoContato);
      const tel = telefone.replace(/\D/g, '');

      const existing = await repo.findOne({ where: { telefone: tel } });
      if (existing) return res.status(409).json({ error: 'Contato já existe' });

      const contato = new DisparoContato();
      contato.telefone = tel;
      contato.nome = nome || null;
      contato.tags = tags || null;
      await repo.save(contato);

      res.json(contato);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async updateContact(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoContato);
      const contato = await repo.findOne({ where: { id: parseInt(req.params.id) } });
      if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });

      if (req.body.nome !== undefined) contato.nome = req.body.nome;
      if (req.body.tags !== undefined) contato.tags = req.body.tags;
      if (req.body.status !== undefined) contato.status = req.body.status;

      await repo.save(contato);
      res.json(contato);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async deleteContact(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoContato);
      await repo.delete(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async deleteMultipleContacts(req: AuthRequest, res: Response) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs obrigatórios' });

      const repo = AppDataSource.getRepository(DisparoContato);
      await repo.delete(ids);
      res.json({ success: true, deleted: ids.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async syncFromWhatsApp(req: AuthRequest, res: Response) {
    try {
      const result = await DisparoWhatsAppService.syncFromWhatsApp();
      res.json(result);
    } catch (err: any) {
      console.error('Erro syncFromWhatsApp:', err);
      res.status(500).json({ error: err.message });
    }
  }

  static async importContacts(req: AuthRequest, res: Response) {
    try {
      const { contacts } = req.body;
      if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Array de contatos obrigatório' });
      }

      const result = await DisparoWhatsAppService.importContacts(contacts);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async clearAllContacts(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoContato);
      await AppDataSource.query('TRUNCATE TABLE "disparo_mensagens"');
      await AppDataSource.query('TRUNCATE TABLE "disparo_contatos" CASCADE');
      res.json({ success: true, message: 'Todos os contatos removidos' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async reactivateContact(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoContato);
      await repo.update(parseInt(req.params.id), {
        status: 'active',
        score: 50,
        inactivated_at: null as any
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // ========== CAMPANHAS ==========

  static async listCampaigns(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoCampanha);
      const campanhas = await repo.find({ order: { created_at: 'DESC' } });

      // Adicionar flag de running in-memory
      const result = campanhas.map(c => ({
        ...c,
        isRunningInMemory: DisparoWhatsAppService.getCampaignRunning(c.id)
      }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createCampaign(req: AuthRequest, res: Response) {
    try {
      const { nome, mensagem_texto, imagem_base64, imagens_base64, lista_id } = req.body;
      if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

      const repo = AppDataSource.getRepository(DisparoCampanha);
      const campanha = new DisparoCampanha();
      campanha.nome = nome;
      campanha.mensagem_texto = mensagem_texto || null;
      campanha.imagem_base64 = imagem_base64 || null;
      campanha.imagens_base64 = imagens_base64 || null;
      campanha.lista_id = lista_id || null;
      await repo.save(campanha);

      res.json(campanha);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async updateCampaign(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoCampanha);
      const campanha = await repo.findOne({ where: { id: req.params.id } });
      if (!campanha) return res.status(404).json({ error: 'Campanha não encontrada' });
      if (campanha.status === 'running') return res.status(400).json({ error: 'Não é possível editar campanha em execução' });

      if (req.body.nome !== undefined) campanha.nome = req.body.nome;
      if (req.body.mensagem_texto !== undefined) campanha.mensagem_texto = req.body.mensagem_texto;
      if (req.body.imagem_base64 !== undefined) campanha.imagem_base64 = req.body.imagem_base64;

      await repo.save(campanha);
      res.json(campanha);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async deleteCampaign(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoCampanha);
      const campanha = await repo.findOne({ where: { id: req.params.id } });
      if (!campanha) return res.status(404).json({ error: 'Campanha não encontrada' });
      if (campanha.status === 'running') return res.status(400).json({ error: 'Pare a campanha antes de deletar' });

      await repo.delete(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async startCampaign(req: AuthRequest, res: Response) {
    try {
      const campanhaId = req.params.id;
      // Start async - don't wait
      DisparoWhatsAppService.startCampaign(campanhaId)
        .catch(err => console.error('Erro campanha:', err));

      res.json({ success: true, message: 'Campanha iniciada' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async pauseCampaign(req: AuthRequest, res: Response) {
    try {
      DisparoWhatsAppService.pauseCampaign(req.params.id);
      const repo = AppDataSource.getRepository(DisparoCampanha);
      await repo.update(req.params.id, { status: 'paused' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async resumeCampaign(req: AuthRequest, res: Response) {
    try {
      await DisparoWhatsAppService.resumeCampaign(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async cancelCampaign(req: AuthRequest, res: Response) {
    try {
      await DisparoWhatsAppService.cancelCampaign(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // ========== MENSAGENS / HISTÓRICO ==========

  static async getCampaignMessages(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoMensagem);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const statusFilter = (req.query.status as string) || '';

      const qb = repo.createQueryBuilder('m')
        .where('m.campanha_id = :id', { id: req.params.id });

      if (statusFilter) {
        qb.andWhere('m.status = :status', { status: statusFilter });
      }

      qb.orderBy('m.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      const [items, total] = await qb.getManyAndCount();
      res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // ========== WEBHOOK ==========

  static async webhook(req: Request, res: Response) {
    // Responde na hora: a Evolution nao pode ficar esperando o fluxo do bot rodar
    // (o chatbot tem delay/typing proposital de varios segundos).
    res.json({ received: true });

    const body = req.body;

    // Recibo de entrega/leitura -> disparo
    DisparoWhatsAppService.handleWebhook(body).catch(err =>
      console.error('Erro webhook disparo:', err?.message || err)
    );

    // Mensagem recebida do cliente -> chatbot.
    // Disparo e chatbot dividem a instancia MARKETING, e a Evolution so aceita um
    // webhook por instancia — entao os dois eventos entram por aqui e sao
    // separados por tipo: 'messages.update' = recibo, 'messages.upsert' = mensagem.
    MktChatbotService.processarPayloadEvolution(body).catch(err =>
      console.error('Erro webhook chatbot:', err?.message || err)
    );
  }
}
