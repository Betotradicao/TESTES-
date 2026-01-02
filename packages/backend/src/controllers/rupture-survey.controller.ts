import { Request, Response } from 'express';
import { RuptureSurveyService } from '../services/rupture-survey.service';
import { AuthRequest } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

export class RuptureSurveyController {
  /**
   * Upload de arquivo CSV e criação de pesquisa
   */
  static async uploadAndCreate(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const { nome_pesquisa } = req.body;

      if (!nome_pesquisa) {
        // Remover arquivo temporário
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Nome da pesquisa é obrigatório' });
      }

      const userId = req.user!.id;

      // Processar arquivo
      const survey = await RuptureSurveyService.createSurveyFromFile(
        req.file.path,
        nome_pesquisa,
        userId
      );

      // Remover arquivo temporário
      fs.unlinkSync(req.file.path);

      res.json({
        message: 'Pesquisa criada com sucesso',
        survey,
      });
    } catch (error: any) {
      console.error('❌ Erro ao criar pesquisa:', error);

      // Tentar remover arquivo temporário em caso de erro
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: error.message || 'Erro ao processar arquivo',
      });
    }
  }

  /**
   * Listar todas as pesquisas
   */
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const surveys = await RuptureSurveyService.getAllSurveys();
      res.json(surveys);
    } catch (error: any) {
      console.error('❌ Erro ao listar pesquisas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar pesquisa por ID com estatísticas
   */
  static async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const survey = await RuptureSurveyService.getSurveyWithStats(parseInt(id));
      res.json(survey);
    } catch (error: any) {
      console.error('❌ Erro ao buscar pesquisa:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Iniciar pesquisa (mudar para em_andamento)
   */
  static async startSurvey(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const survey = await RuptureSurveyService.startSurvey(parseInt(id));
      res.json({
        message: 'Pesquisa iniciada',
        survey,
      });
    } catch (error: any) {
      console.error('❌ Erro ao iniciar pesquisa:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Atualizar status de um item (usado pelo mobile)
   */
  static async updateItemStatus(req: AuthRequest, res: Response) {
    try {
      const { itemId } = req.params;
      const { status, verificado_por, observacao } = req.body;

      if (!status || !verificado_por) {
        return res.status(400).json({
          error: 'Status e verificado_por são obrigatórios',
        });
      }

      const item = await RuptureSurveyService.updateItemStatus(
        parseInt(itemId),
        status,
        verificado_por,
        observacao
      );

      res.json({
        message: 'Item atualizado',
        item,
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar item:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Deletar pesquisa
   */
  static async deleteSurvey(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await RuptureSurveyService.deleteSurvey(parseInt(id));
      res.json({
        message: 'Pesquisa deletada com sucesso',
      });
    } catch (error: any) {
      console.error('❌ Erro ao deletar pesquisa:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar resultados agregados com filtros
   */
  static async getAgregated(req: AuthRequest, res: Response) {
    try {
      const { data_inicio, data_fim, produto, fornecedor, auditor } = req.query;

      console.log('📊 Filtros recebidos:', { data_inicio, data_fim, produto, fornecedor, auditor });

      if (!data_inicio || !data_fim) {
        return res.status(400).json({
          error: 'data_inicio e data_fim são obrigatórios',
        });
      }

      const results = await RuptureSurveyService.getAgregatedResults({
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        produto: produto as string | undefined,
        fornecedor: fornecedor as string | undefined,
        auditor: auditor as string | undefined,
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
   * Buscar produtos únicos para filtro
   */
  static async getProdutos(req: AuthRequest, res: Response) {
    try {
      const produtos = await RuptureSurveyService.getUniqueProdutos();
      res.json(produtos);
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar fornecedores únicos para filtro
   */
  static async getFornecedores(req: AuthRequest, res: Response) {
    try {
      const fornecedores = await RuptureSurveyService.getUniqueFornecedores();
      res.json(fornecedores);
    } catch (error: any) {
      console.error('❌ Erro ao buscar fornecedores:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Finalizar auditoria e enviar relatório para WhatsApp
   */
  static async finalizeSurvey(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await RuptureSurveyService.finalizeSurveyAndSendReport(parseInt(id));

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error('❌ Erro ao finalizar auditoria:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
