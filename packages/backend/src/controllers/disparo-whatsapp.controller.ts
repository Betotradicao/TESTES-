import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DisparoContato } from '../entities/DisparoContato';
import { DisparoCampanha } from '../entities/DisparoCampanha';
import { DisparoMensagem } from '../entities/DisparoMensagem';
import { DisparoWhatsAppService } from '../services/disparo-whatsapp.service';

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

  // ========== CONTATOS ==========

  static async listContacts(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(DisparoContato);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || '';

      const qb = repo.createQueryBuilder('c');

      if (search) {
        qb.where('(c.telefone ILIKE :s OR c.nome ILIKE :s)', { s: `%${search}%` });
      }
      if (status) {
        qb.andWhere('c.status = :status', { status });
      }

      qb.orderBy('c.score', 'DESC')
        .addOrderBy('c.nome', 'ASC')
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
      const { nome, mensagem_texto, imagem_base64 } = req.body;
      if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

      const repo = AppDataSource.getRepository(DisparoCampanha);
      const campanha = new DisparoCampanha();
      campanha.nome = nome;
      campanha.mensagem_texto = mensagem_texto || null;
      campanha.imagem_base64 = imagem_base64 || null;
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
    try {
      await DisparoWhatsAppService.handleWebhook(req.body);
      res.json({ received: true });
    } catch (err: any) {
      console.error('Erro webhook disparo:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
