import { Request, Response } from 'express';
import { TributacaoService } from '../services/tributacao.service';

export class TributacaoController {
  static async getProdutos(req: Request, res: Response) {
    try {
      const {
        codLoja,
        codSecao,
        codGrupo,
        codSubGrupo,
        codSegmento,
        statusFilter
      } = req.query as Record<string, string>;

      const data = await TributacaoService.getProdutosTributacao({
        codLoja:      codLoja      ? parseInt(codLoja)      : undefined,
        codSecao:     codSecao     ? parseInt(codSecao)     : undefined,
        codGrupo:     codGrupo     ? parseInt(codGrupo)     : undefined,
        codSubGrupo:  codSubGrupo  ? parseInt(codSubGrupo)  : undefined,
        codSegmento:  codSegmento  ? parseInt(codSegmento)  : undefined,
        statusFilter: (statusFilter as any) || 'DIVERGENTES'
      });

      return res.json({ data, total: data.length });
    } catch (err: any) {
      console.error('❌ [Tributação] Erro:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
}
