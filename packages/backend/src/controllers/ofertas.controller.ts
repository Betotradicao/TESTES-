/**
 * Ofertas Controller
 * Endpoints para consulta de programacoes e produtos em oferta
 */

import { Request, Response } from 'express';
import { OfertasService } from '../services/ofertas.service';

export class OfertasController {

  /**
   * GET /ofertas/programacoes?codLoja=1&ativas=true
   */
  static async getProgramacoes(req: Request, res: Response) {
    try {
      const { codLoja, ativas } = req.query;
      console.log('[Ofertas] GET /programacoes - codLoja:', codLoja, 'ativas:', ativas);
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja obrigatorio' });
      }
      const result = await OfertasService.getProgramacoes(
        Number(codLoja),
        ativas !== 'false'
      );
      return res.json(result);
    } catch (error: any) {
      console.error('[Ofertas] Erro getProgramacoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ofertas/produtos/:codProg?codLoja=1&mesAtual=true
   * codProg=0 significa "todas as programacoes"
   */
  static async getProdutos(req: Request, res: Response) {
    try {
      const codProg = Number(req.params.codProg);
      const { codLoja, mesAtual } = req.query;
      if (codProg == null || isNaN(codProg) || !codLoja) {
        return res.status(400).json({ error: 'codProg e codLoja obrigatorios' });
      }
      const result = await OfertasService.getProdutos(codProg, Number(codLoja), mesAtual === 'true');
      return res.json(result);
    } catch (error: any) {
      console.error('[Ofertas] Erro getProdutos:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
