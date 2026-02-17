import { Request, Response } from 'express';
import { CompetitividadeService } from '../services/competitividade.service';

export class CompetitividadeController {

  static async getDados(req: Request, res: Response) {
    try {
      const { codLoja, codSecao, codGrupo, concorrente } = req.query;
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja obrigatório' });
      }
      const result = await CompetitividadeService.getDados({
        codLoja: codLoja as string,
        codSecao: codSecao as string || undefined,
        codGrupo: codGrupo as string || undefined,
        concorrente: concorrente as string || undefined,
      });
      res.json(result);
    } catch (error: any) {
      console.error('[Competitividade] Erro:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  static async getSecoes(req: Request, res: Response) {
    try {
      const codLoja = req.query.codLoja as string;
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja obrigatório' });
      }
      const secoes = await CompetitividadeService.getSecoes(codLoja);
      res.json(secoes);
    } catch (error: any) {
      console.error('[Competitividade] Erro secoes:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
