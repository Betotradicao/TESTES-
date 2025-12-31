import { Request, Response } from 'express';
import { LossService } from '../services/loss.service';
import { AuthRequest } from '../middleware/auth';
import * as fs from 'fs';

export class LossController {
  /**
   * Upload e importação de arquivo de perdas
   */
  static async upload(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const { nomeLote, dataInicio, dataFim } = req.body;
      if (!nomeLote) {
        return res.status(400).json({ error: 'Nome do lote é obrigatório' });
      }

      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      console.log(`📤 Upload de arquivo de perdas: ${req.file.originalname}`);
      console.log(`📦 Lote: ${nomeLote}`);
      console.log(`📅 Período: ${dataInicio || 'hoje'} até ${dataFim || 'hoje'}`);

      const result = await LossService.importFromFile(
        req.file.path,
        nomeLote,
        companyId,
        dataInicio,
        dataFim
      );

      // Deletar arquivo temporário
      fs.unlinkSync(req.file.path);

      res.status(201).json({
        message: 'Arquivo importado com sucesso',
        ...result,
      });
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload de perdas:', error);

      // Deletar arquivo temporário em caso de erro
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Erro ao deletar arquivo temporário:', e);
        }
      }

      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Listar todos os lotes
   */
  static async getAllLotes(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      const lotes = await LossService.getAllLotes(companyId);

      res.json(lotes);
    } catch (error: any) {
      console.error('❌ Erro ao buscar lotes:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar perdas de um lote específico
   */
  static async getByLote(req: AuthRequest, res: Response) {
    try {
      const { nomeLote } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      const losses = await LossService.getByLote(nomeLote, companyId);

      res.json(losses);
    } catch (error: any) {
      console.error('❌ Erro ao buscar perdas por lote:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar dados agregados por seção
   */
  static async getAggregatedBySection(req: AuthRequest, res: Response) {
    try {
      const { nomeLote } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      const aggregated = await LossService.getAggregatedBySection(
        nomeLote,
        companyId
      );

      res.json(aggregated);
    } catch (error: any) {
      console.error('❌ Erro ao buscar dados agregados:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Deletar lote
   */
  static async deleteLote(req: AuthRequest, res: Response) {
    try {
      const { nomeLote } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      await LossService.deleteLote(nomeLote, companyId);

      res.json({ message: 'Lote deletado com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao deletar lote:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar resultados agregados com filtros
   */
  static async getAgregated(req: AuthRequest, res: Response) {
    try {
      const { data_inicio, data_fim, motivo, produto, page, limit, tipo } = req.query;
      const companyId = req.user?.companyId;

      console.log('📊 Filtros recebidos:', { data_inicio, data_fim, motivo, produto, page, limit, tipo, companyId });

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      if (!data_inicio || !data_fim) {
        return res.status(400).json({
          error: 'data_inicio e data_fim são obrigatórios',
        });
      }

      const results = await LossService.getAgregatedResults({
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        motivo: motivo as string | undefined,
        produto: produto as string | undefined,
        tipo: tipo as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        companyId,
      });

      console.log('✅ Resultados agregados calculados com sucesso');
      res.json(results);
    } catch (error: any) {
      console.error('❌ Erro ao buscar resultados agregados:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Alternar motivo ignorado
   */
  static async toggleMotivoIgnorado(req: AuthRequest, res: Response) {
    try {
      const { motivo } = req.body;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      if (!motivo) {
        return res.status(400).json({ error: 'Motivo é obrigatório' });
      }

      const result = await LossService.toggleMotivoIgnorado(motivo, companyId);
      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao alternar motivo ignorado:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Listar motivos ignorados
   */
  static async getMotivosIgnorados(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      const motivos = await LossService.getMotivosIgnorados(companyId);
      res.json(motivos);
    } catch (error: any) {
      console.error('❌ Erro ao buscar motivos ignorados:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar seções únicas para filtro
   */
  static async getSecoes(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      const secoes = await LossService.getUniqueSecoes(companyId);
      res.json(secoes);
    } catch (error: any) {
      console.error('❌ Erro ao buscar seções:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar produtos únicos para filtro
   */
  static async getProdutos(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID não encontrado' });
      }

      const produtos = await LossService.getUniqueProdutos(companyId);
      res.json(produtos);
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
