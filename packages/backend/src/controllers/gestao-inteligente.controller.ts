/**
 * Gestao Inteligente Controller
 * Controller para endpoints de indicadores consolidados de vendas
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { GestaoInteligenteService } from '../services/gestao-inteligente.service';

export class GestaoInteligenteController {
  /**
   * GET /api/gestao-inteligente/indicadores
   * Busca indicadores consolidados de vendas
   * Query params: dataInicio, dataFim, codLoja (opcional)
   */
  static async getIndicadores(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, codLoja } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio e dataFim são obrigatórios'
        });
      }

      const filters = {
        dataInicio: String(dataInicio),
        dataFim: String(dataFim),
        codLoja: codLoja ? parseInt(String(codLoja)) : undefined
      };

      const indicadores = await GestaoInteligenteService.getIndicadores(filters);
      res.json(indicadores);
    } catch (error: any) {
      console.error('Erro ao buscar indicadores:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  /**
   * GET /api/gestao-inteligente/lojas
   * Busca lojas disponíveis para filtro
   */
  static async getLojas(req: AuthRequest, res: Response) {
    try {
      const lojas = await GestaoInteligenteService.getLojas();
      res.json(lojas);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  /**
   * POST /api/gestao-inteligente/clear-cache
   * Limpa o cache de indicadores (força recarga do Oracle)
   */
  static async clearCache(req: AuthRequest, res: Response) {
    try {
      await GestaoInteligenteService.clearCache();
      res.json({ message: 'Cache limpo com sucesso' });
    } catch (error: any) {
      console.error('Erro ao limpar cache:', error);
      res.status(500).json({ error: 'Erro ao limpar cache' });
    }
  }

  /**
   * GET /api/gestao-inteligente/vendas-por-setor
   * Busca vendas agrupadas por setor
   * Query params: dataInicio, dataFim, codLoja (opcional)
   */
  static async getVendasPorSetor(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, codLoja } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio e dataFim são obrigatórios'
        });
      }

      const filters = {
        dataInicio: String(dataInicio),
        dataFim: String(dataFim),
        codLoja: codLoja ? parseInt(String(codLoja)) : undefined
      };

      const vendasPorSetor = await GestaoInteligenteService.getVendasPorSetor(filters);
      res.json(vendasPorSetor);
    } catch (error: any) {
      console.error('Erro ao buscar vendas por setor:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  /**
   * GET /api/gestao-inteligente/grupos-por-secao
   * Busca grupos de uma seção específica
   * Query params: dataInicio, dataFim, codSecao, codLoja (opcional)
   */
  static async getGruposPorSecao(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, codSecao, codLoja } = req.query;

      if (!dataInicio || !dataFim || !codSecao) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio, dataFim e codSecao são obrigatórios'
        });
      }

      const filters = {
        dataInicio: String(dataInicio),
        dataFim: String(dataFim),
        codSecao: parseInt(String(codSecao)),
        codLoja: codLoja ? parseInt(String(codLoja)) : undefined
      };

      const grupos = await GestaoInteligenteService.getGruposPorSecao(filters);
      res.json(grupos);
    } catch (error: any) {
      console.error('Erro ao buscar grupos por seção:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  /**
   * GET /api/gestao-inteligente/subgrupos-por-grupo
   * Busca subgrupos de um grupo específico
   * Query params: dataInicio, dataFim, codGrupo, codSecao (opcional), codLoja (opcional)
   */
  static async getSubgruposPorGrupo(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, codGrupo, codSecao, codLoja } = req.query;

      if (!dataInicio || !dataFim || !codGrupo) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio, dataFim e codGrupo são obrigatórios'
        });
      }

      const filters = {
        dataInicio: String(dataInicio),
        dataFim: String(dataFim),
        codGrupo: parseInt(String(codGrupo)),
        codSecao: codSecao ? parseInt(String(codSecao)) : undefined,
        codLoja: codLoja ? parseInt(String(codLoja)) : undefined
      };

      const subgrupos = await GestaoInteligenteService.getSubgruposPorGrupo(filters);
      res.json(subgrupos);
    } catch (error: any) {
      console.error('Erro ao buscar subgrupos por grupo:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  /**
   * GET /api/gestao-inteligente/itens-por-subgrupo
   * Busca itens de um subgrupo específico
   * Query params: dataInicio, dataFim, codSubgrupo, codGrupo (opcional), codSecao (opcional), codLoja (opcional)
   */
  static async getItensPorSubgrupo(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, codSubgrupo, codGrupo, codSecao, codLoja } = req.query;

      if (!dataInicio || !dataFim || !codSubgrupo) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio, dataFim e codSubgrupo são obrigatórios'
        });
      }

      const filters = {
        dataInicio: String(dataInicio),
        dataFim: String(dataFim),
        codSubgrupo: parseInt(String(codSubgrupo)),
        codGrupo: codGrupo ? parseInt(String(codGrupo)) : undefined,
        codSecao: codSecao ? parseInt(String(codSecao)) : undefined,
        codLoja: codLoja ? parseInt(String(codLoja)) : undefined
      };

      const itens = await GestaoInteligenteService.getItensPorSubgrupo(filters);
      res.json(itens);
    } catch (error: any) {
      console.error('Erro ao buscar itens por subgrupo:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  /**
   * GET /api/gestao-inteligente/vendas-por-ano
   * Busca vendas mensais do ano com indicadores consolidados
   * Query params: ano, codLoja (opcional)
   */
  static async getVendasPorAno(req: AuthRequest, res: Response) {
    try {
      const { ano, codLoja } = req.query;

      if (!ano) {
        return res.status(400).json({
          error: 'Parâmetro ano é obrigatório'
        });
      }

      const anoNum = parseInt(String(ano));
      const codLojaNum = codLoja ? parseInt(String(codLoja)) : undefined;

      const vendasPorAno = await GestaoInteligenteService.getVendasPorAno(anoNum, codLojaNum);
      res.json(vendasPorAno);
    } catch (error: any) {
      console.error('Erro ao buscar vendas por ano:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  /**
   * GET /api/gestao-inteligente/vendas-por-dia-semana
   * Busca vendas agrupadas por dia da semana, mês a mês
   * Query params: ano, codLoja (opcional)
   */
  /**
   * GET /api/gestao-inteligente/vendas-analiticas-setor
   * Vendas por setor com comparativos (atual, mês passado, ano passado, média linear)
   */
  static async getVendasAnaliticasPorSetor(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, codLoja } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros dataInicio e dataFim são obrigatórios'
        });
      }

      const filters = {
        dataInicio: String(dataInicio),
        dataFim: String(dataFim),
        codLoja: codLoja ? parseInt(String(codLoja)) : undefined
      };

      const resultado = await GestaoInteligenteService.getVendasAnaliticasPorSetor(filters);
      res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao buscar vendas analíticas por setor:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  static async getVendasPorSetorAnual(req: AuthRequest, res: Response) {
    try {
      const { ano, codLoja } = req.query;
      if (!ano) {
        return res.status(400).json({ error: 'Parâmetro ano é obrigatório' });
      }
      const anoNum = parseInt(String(ano));
      const codLojaNum = codLoja ? parseInt(String(codLoja)) : undefined;
      const resultado = await GestaoInteligenteService.getVendasPorSetorAnual(anoNum, codLojaNum);
      res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao buscar vendas por setor anual:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }

  static async getVendasPorDiaSemana(req: AuthRequest, res: Response) {
    try {
      const { ano, codLoja } = req.query;

      if (!ano) {
        return res.status(400).json({
          error: 'Parâmetro ano é obrigatório'
        });
      }

      const anoNum = parseInt(String(ano));
      const codLojaNum = codLoja ? parseInt(String(codLoja)) : undefined;

      const resultado = await GestaoInteligenteService.getVendasPorDiaSemana(anoNum, codLojaNum);
      res.json(resultado);
    } catch (error: any) {
      console.error('Erro ao buscar vendas por dia da semana:', error);
      res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
}
