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
}
