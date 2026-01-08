import { Request, Response } from 'express';
import { PDVService } from '../services/pdv.service';
import { AppDataSource } from '../config/database';
import { Operador } from '../entities/Operador';
import { MotivoDesconto } from '../entities/MotivoDesconto';
import { Autorizador } from '../entities/Autorizador';

export class PDVController {
  // GET /api/pdv/resumo?dataInicio=2026-01-01&dataFim=2026-01-31
  static async getResumo(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio e dataFim são obrigatórios'
        });
      }

      const resumo = await PDVService.gerarResumo(
        dataInicio as string,
        dataFim as string
      );

      res.json(resumo);
    } catch (error: any) {
      console.error('Erro ao buscar resumo PDV:', error);
      res.status(500).json({
        error: 'Erro ao buscar resumo PDV',
        details: error.message
      });
    }
  }

  // GET /api/pdv/vendas?dataInicio=2026-01-01&dataFim=2026-01-31
  static async getVendas(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio e dataFim são obrigatórios'
        });
      }

      const vendas = await PDVService.buscarVendas(
        dataInicio as string,
        dataFim as string
      );

      res.json(vendas);
    } catch (error: any) {
      console.error('Erro ao buscar vendas PDV:', error);
      res.status(500).json({
        error: 'Erro ao buscar vendas PDV',
        details: error.message
      });
    }
  }

  // GET /api/pdv/descontos?dataInicio=2026-01-01&dataFim=2026-01-31
  static async getDescontos(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio e dataFim são obrigatórios'
        });
      }

      const vendas = await PDVService.buscarVendas(
        dataInicio as string,
        dataFim as string
      );

      const descontos = vendas.filter(v => v.desconto && v.desconto > 0);

      res.json(descontos);
    } catch (error: any) {
      console.error('Erro ao buscar descontos:', error);
      res.status(500).json({
        error: 'Erro ao buscar descontos',
        details: error.message
      });
    }
  }

  // GET /api/pdv/devolucoes?dataInicio=2026-01-01&dataFim=2026-01-31
  static async getDevolucoes(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio e dataFim são obrigatórios'
        });
      }

      const vendas = await PDVService.buscarVendas(
        dataInicio as string,
        dataFim as string
      );

      const devolucoes = vendas.filter(v => v.quantidade < 0);

      res.json(devolucoes);
    } catch (error: any) {
      console.error('Erro ao buscar devoluções:', error);
      res.status(500).json({
        error: 'Erro ao buscar devoluções',
        details: error.message
      });
    }
  }

  // CRUD de Operadores
  static async listOperadores(req: Request, res: Response) {
    try {
      const operadorRepo = AppDataSource.getRepository(Operador);
      const operadores = await operadorRepo.find({
        order: { codigo: 'ASC' }
      });
      res.json(operadores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createOperador(req: Request, res: Response) {
    try {
      const operadorRepo = AppDataSource.getRepository(Operador);
      const operador = operadorRepo.create(req.body);
      await operadorRepo.save(operador);
      res.status(201).json(operador);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateOperador(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operadorRepo = AppDataSource.getRepository(Operador);

      let operador = await operadorRepo.findOne({ where: { id: parseInt(id) } });
      if (!operador) {
        return res.status(404).json({ error: 'Operador não encontrado' });
      }

      operador = operadorRepo.merge(operador, req.body);
      await operadorRepo.save(operador);
      res.json(operador);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteOperador(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operadorRepo = AppDataSource.getRepository(Operador);

      const result = await operadorRepo.delete(parseInt(id));

      if (result.affected && result.affected > 0) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Operador não encontrado' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // CRUD de Motivos de Desconto
  static async listMotivosDesconto(req: Request, res: Response) {
    try {
      const motivoRepo = AppDataSource.getRepository(MotivoDesconto);
      const motivos = await motivoRepo.find({
        order: { codigo: 'ASC' }
      });
      res.json(motivos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createMotivoDesconto(req: Request, res: Response) {
    try {
      const motivoRepo = AppDataSource.getRepository(MotivoDesconto);
      const motivo = motivoRepo.create(req.body);
      await motivoRepo.save(motivo);
      res.status(201).json(motivo);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateMotivoDesconto(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const motivoRepo = AppDataSource.getRepository(MotivoDesconto);

      let motivo = await motivoRepo.findOne({ where: { id: parseInt(id) } });
      if (!motivo) {
        return res.status(404).json({ error: 'Motivo não encontrado' });
      }

      motivo = motivoRepo.merge(motivo, req.body);
      await motivoRepo.save(motivo);
      res.json(motivo);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteMotivoDesconto(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const motivoRepo = AppDataSource.getRepository(MotivoDesconto);

      const result = await motivoRepo.delete(parseInt(id));

      if (result.affected && result.affected > 0) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Motivo não encontrado' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // CRUD de Autorizadores
  static async listAutorizadores(req: Request, res: Response) {
    try {
      const autorizadorRepo = AppDataSource.getRepository(Autorizador);
      const autorizadores = await autorizadorRepo.find({
        order: { codigo: 'ASC' }
      });
      res.json(autorizadores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createAutorizador(req: Request, res: Response) {
    try {
      const autorizadorRepo = AppDataSource.getRepository(Autorizador);
      const autorizador = autorizadorRepo.create(req.body);
      await autorizadorRepo.save(autorizador);
      res.status(201).json(autorizador);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateAutorizador(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const autorizadorRepo = AppDataSource.getRepository(Autorizador);

      let autorizador = await autorizadorRepo.findOne({ where: { id: parseInt(id) } });
      if (!autorizador) {
        return res.status(404).json({ error: 'Autorizador não encontrado' });
      }

      autorizador = autorizadorRepo.merge(autorizador, req.body);
      await autorizadorRepo.save(autorizador);
      res.json(autorizador);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteAutorizador(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const autorizadorRepo = AppDataSource.getRepository(Autorizador);

      const result = await autorizadorRepo.delete(parseInt(id));

      if (result.affected && result.affected > 0) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Autorizador não encontrado' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
