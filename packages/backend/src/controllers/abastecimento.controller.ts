/**
 * Abastecimento Controller
 * Controller para Prioridade de Reposição
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AbastecimentoService } from '../services/abastecimento.service';

export class AbastecimentoController {
  /**
   * Busca prioridade de reposição para produtos que entraram via NF ontem/hoje
   */
  static async getPrioridadeReposicao(req: AuthRequest, res: Response) {
    try {
      const { codLoja, data } = req.query;
      const results = await AbastecimentoService.getPrioridadeReposicao(codLoja as string || undefined, data as string);
      return res.json(results);
    } catch (error: any) {
      console.error('❌ Erro ao buscar prioridade reposição:', error);
      return res.status(500).json({
        error: 'Erro ao buscar prioridade de reposição',
        message: error.message,
      });
    }
  }
}
