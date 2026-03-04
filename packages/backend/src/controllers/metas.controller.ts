import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MetasService } from '../services/metas.service';

export class MetasController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const ano = req.query.ano ? parseInt(req.query.ano as string) : undefined;
      const mes = req.query.mes ? parseInt(req.query.mes as string) : undefined;
      const metas = await MetasService.findAll(codLoja, ano, mes);
      res.json(metas);
    } catch (error) {
      console.error('Get all metas error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const meta = await MetasService.findById(id);
      res.json(meta);
    } catch (error: any) {
      console.error('Get meta by ID error:', error);
      if (error.message === 'Meta not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { nome, tipo, indicador, mes, ano, cod_loja, inflacao, crescimento, total_crescimento, responsaveis } = req.body;

      if (!nome || !mes || !ano) {
        return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });
      }

      const meta = await MetasService.create({
        nome, tipo, indicador, mes, ano, cod_loja, inflacao, crescimento, total_crescimento, responsaveis,
      });
      res.status(201).json(meta);
    } catch (error: any) {
      console.error('Create meta error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const meta = await MetasService.update(id, req.body);
      res.json(meta);
    } catch (error: any) {
      console.error('Update meta error:', error);
      if (error.message === 'Meta not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await MetasService.delete(id);
      res.json({ message: 'Meta removida com sucesso' });
    } catch (error: any) {
      console.error('Delete meta error:', error);
      if (error.message === 'Meta not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async toggle(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const meta = await MetasService.toggleStatus(id);
      res.json(meta);
    } catch (error: any) {
      console.error('Toggle meta error:', error);
      if (error.message === 'Meta not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
