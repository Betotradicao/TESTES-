import { Response } from 'express';
import { LossService } from '../services/loss.service';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import * as fs from 'fs';

export class LossController {
  /**
   * Helper para obter company_id do usuário logado
   * Busca no banco se não estiver no token JWT
   */
  private static async getCompanyId(req: AuthRequest): Promise<string | null> {
    // Se o token já tem companyId, usar
    if (req.user?.companyId !== undefined) {
      console.log(`📋 Company ID do token: ${req.user.companyId || 'null (MASTER)'}`);
      return req.user.companyId;
    }

    // Token antigo sem companyId - buscar no banco
    if (req.user?.id) {
      console.log(`🔍 Token sem companyId, buscando no banco para user: ${req.user.id}`);
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.user.id }
      });

      if (user) {
        console.log(`📋 Company ID do banco: ${user.companyId || 'null (MASTER)'}`);
        return user.companyId;
      }
    }

    console.log(`⚠️  Company ID não encontrado, usando null`);
    return null;
  }

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

      // Pegar company_id do usuário logado (do token ou do banco)
      const companyId = await LossController.getCompanyId(req);

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
      const companyId = await LossController.getCompanyId(req);

      const lotes = await LossService.getAllLotes(companyId || undefined);

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
      const companyId = await LossController.getCompanyId(req);

      const losses = await LossService.getByLote(nomeLote, companyId || undefined);

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
      const companyId = await LossController.getCompanyId(req);

      const aggregated = await LossService.getAggregatedBySection(
        nomeLote,
        companyId || undefined
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
      const companyId = await LossController.getCompanyId(req);

      await LossService.deleteLote(nomeLote, companyId || undefined);

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
      const companyId = await LossController.getCompanyId(req);

      console.log('📊 Filtros recebidos:', { data_inicio, data_fim, motivo, produto, page, limit, tipo, companyId });

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
        companyId: companyId || undefined,
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
      const companyId = await LossController.getCompanyId(req);

      if (!motivo) {
        return res.status(400).json({ error: 'Motivo é obrigatório' });
      }

      const result = await LossService.toggleMotivoIgnorado(motivo, companyId || undefined);
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
      const companyId = await LossController.getCompanyId(req);

      const motivos = await LossService.getMotivosIgnorados(companyId || undefined);
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
      const companyId = await LossController.getCompanyId(req);

      const secoes = await LossService.getUniqueSecoes(companyId || undefined);
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
      const companyId = await LossController.getCompanyId(req);

      const produtos = await LossService.getUniqueProdutos(companyId || undefined);
      res.json(produtos);
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
