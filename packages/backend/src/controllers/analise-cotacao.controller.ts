import { Request, Response } from 'express';
import { AnaliseCotacaoService } from '../services/analise-cotacao.service';

interface AuthRequest extends Request {
  user?: any;
}

export class AnaliseCotacaoController {

  /**
   * GET /api/analise-cotacao/cotacoes
   * Lista todas as cotações disponíveis
   */
  static async getCotacoes(req: AuthRequest, res: Response) {
    try {
      const codLoja = req.query.codLoja ? Number(req.query.codLoja) : undefined;
      const cotacoes = await AnaliseCotacaoService.listarCotacoes(codLoja);
      return res.json({ success: true, cotacoes });
    } catch (error: any) {
      console.error('❌ [AnaliseCotacao] Erro ao listar cotações:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/analise-cotacao/detalhes?codCota=238&codLoja=1
   * Retorna produtos + preços de fornecedores de uma cotação
   */
  static async getDetalhes(req: AuthRequest, res: Response) {
    try {
      const codCota = Number(req.query.codCota);
      const codLoja = Number(req.query.codLoja || 1);

      if (!codCota) {
        return res.status(400).json({ success: false, error: 'codCota é obrigatório' });
      }

      const produtos = await AnaliseCotacaoService.detalhesCotacao(codCota, codLoja);
      return res.json({ success: true, produtos });
    } catch (error: any) {
      console.error('❌ [AnaliseCotacao] Erro ao buscar detalhes:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/analise-cotacao/ranking?codCota=238&codLoja=1
   * Retorna ranking de fornecedores (quem cotou mais barato)
   */
  static async getRanking(req: AuthRequest, res: Response) {
    try {
      const codCota = Number(req.query.codCota);
      const codLoja = Number(req.query.codLoja || 1);

      if (!codCota) {
        return res.status(400).json({ success: false, error: 'codCota é obrigatório' });
      }

      const ranking = await AnaliseCotacaoService.rankingFornecedores(codCota, codLoja);
      return res.json({ success: true, ranking });
    } catch (error: any) {
      console.error('❌ [AnaliseCotacao] Erro ao buscar ranking:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
