import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PrazoFornecedoresService } from '../services/prazo-fornecedores.service';

export class PrazoFornecedoresController {

  /**
   * GET /api/prazo-fornecedores
   * Lista fornecedores com últimas 10 NFs e prazos de pagamento reais
   */
  static async listar(req: AuthRequest, res: Response) {
    try {
      const codLoja = req.query.codLoja ? Number(req.query.codLoja) : undefined;
      const dataInicio = req.query.dataInicio ? String(req.query.dataInicio) : undefined;
      const dataFim = req.query.dataFim ? String(req.query.dataFim) : undefined;

      const fornecedores = await PrazoFornecedoresService.listarFornecedoresComPrazo(codLoja, dataInicio, dataFim);

      res.json({
        fornecedores,
        total: fornecedores.length,
        resumo: {
          totalFornecedores: fornecedores.length,
          prazoMedioGeral: fornecedores.length > 0
            ? Math.round(
                (fornecedores.filter(f => f.PRAZO_MEDIO > 0).reduce((s, f) => s + f.PRAZO_MEDIO, 0) /
                (fornecedores.filter(f => f.PRAZO_MEDIO > 0).length || 1)) * 10
              ) / 10
            : 0,
          totalNFs: fornecedores.reduce((s, f) => s + f.QTD_NFS, 0),
          valorTotal: Math.round(fornecedores.reduce((s, f) => s + f.VAL_TOTAL, 0) * 100) / 100,
        }
      });
    } catch (error: any) {
      console.error('[PrazoFornecedores] Erro:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/prazo-fornecedores/itens-nota
   * Busca os produtos de uma nota fiscal de fornecedor
   */
  static async itensNota(req: AuthRequest, res: Response) {
    try {
      const codFornecedor = req.query.codFornecedor ? Number(req.query.codFornecedor) : 0;
      const numNf = req.query.numNf ? String(req.query.numNf) : '';
      const codLoja = req.query.codLoja ? Number(req.query.codLoja) : undefined;
      const prazoAtual = req.query.prazoAtual != null ? Number(req.query.prazoAtual) : undefined;
      const mesesHistorico = req.query.meses ? Number(req.query.meses) : undefined;

      if (!codFornecedor || !numNf) {
        return res.status(400).json({ error: 'codFornecedor e numNf são obrigatórios' });
      }

      const itens = await PrazoFornecedoresService.buscarItensNota(codFornecedor, numNf, codLoja, prazoAtual, mesesHistorico);
      res.json({ itens, total: itens.length });
    } catch (error: any) {
      console.error('[PrazoFornecedores] Erro itens nota:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/prazo-fornecedores/fornecedores-alternativos
   * Busca outros fornecedores que vendem o mesmo produto com prazo maior
   */
  static async fornecedoresAlternativos(req: AuthRequest, res: Response) {
    try {
      const codProduto = req.query.codProduto ? Number(req.query.codProduto) : 0;
      const codFornecedorAtual = req.query.codFornecedorAtual ? Number(req.query.codFornecedorAtual) : 0;
      const mesesHistorico = req.query.meses ? Number(req.query.meses) : 6;
      const codLoja = req.query.codLoja ? Number(req.query.codLoja) : undefined;

      if (!codProduto || !codFornecedorAtual) {
        return res.status(400).json({ error: 'codProduto e codFornecedorAtual são obrigatórios' });
      }

      const fornecedores = await PrazoFornecedoresService.buscarFornecedoresAlternativos(codProduto, codFornecedorAtual, mesesHistorico, codLoja);
      res.json({ fornecedores, total: fornecedores.length });
    } catch (error: any) {
      console.error('[PrazoFornecedores] Erro fornecedores alternativos:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
