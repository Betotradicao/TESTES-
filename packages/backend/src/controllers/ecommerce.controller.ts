import { Request, Response } from 'express';
import { EcommerceService } from '../services/ecommerce.service';

interface AuthRequest extends Request {
  user?: any;
}

export class EcommerceController {

  /**
   * GET /api/ecommerce/buscar?q=oleo+de+soja&fonte=mercadolivre
   * Busca produtos em e-commerces
   */
  static async buscar(req: AuthRequest, res: Response) {
    try {
      const q = String(req.query.q || '').trim();
      const fonte = String(req.query.fonte || 'mercadolivre');

      if (!q) {
        return res.status(400).json({ success: false, error: 'Parametro q e obrigatorio' });
      }

      let resultados: any[] = [];

      if (fonte === 'mercadolivre') {
        resultados = await EcommerceService.buscarMercadoLivre(q);
      } else {
        return res.status(400).json({ success: false, error: `Fonte ${fonte} nao suportada` });
      }

      return res.json({ success: true, fonte, query: q, resultados });
    } catch (error: any) {
      console.error('[Ecommerce] Erro ao buscar:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
