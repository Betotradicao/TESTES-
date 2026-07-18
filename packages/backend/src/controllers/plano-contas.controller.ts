import { Request, Response } from 'express';
import { PlanoContasService } from '../services/plano-contas.service';

function getCodLoja(req: Request): number {
  const raw = (req.query.codLoja ?? req.body?.cod_loja ?? req.body?.codLoja);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export class PlanoContasController {
  /** GET /api/plano-contas?codLoja= -> árvore Grupo->Contas */
  static async listar(req: Request, res: Response) {
    try {
      const arvore = await PlanoContasService.listarArvore(getCodLoja(req));
      res.json({ success: true, data: arvore });
    } catch (e: any) {
      console.error('[PlanoContas] listar:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  }

  /** POST /api/plano-contas -> cria grupo ou conta */
  static async criar(req: Request, res: Response) {
    try {
      const { tipo, parent_id, nome, is_receita, num_ordem } = req.body || {};
      if (tipo !== 'grupo' && tipo !== 'conta') {
        return res.status(400).json({ success: false, message: "tipo deve ser 'grupo' ou 'conta'" });
      }
      const row = await PlanoContasService.criar({
        cod_loja: getCodLoja(req),
        tipo,
        parent_id: parent_id != null ? Number(parent_id) : null,
        nome,
        is_receita,
        num_ordem,
      });
      res.json({ success: true, data: row });
    } catch (e: any) {
      console.error('[PlanoContas] criar:', e.message);
      res.status(400).json({ success: false, message: e.message });
    }
  }

  /** PUT /api/plano-contas/:id -> edita nome/ordem/ativo/is_receita */
  static async editar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const row = await PlanoContasService.editar(id, req.body || {});
      if (!row) return res.status(404).json({ success: false, message: 'Não encontrado' });
      res.json({ success: true, data: row });
    } catch (e: any) {
      console.error('[PlanoContas] editar:', e.message);
      res.status(400).json({ success: false, message: e.message });
    }
  }

  /** DELETE /api/plano-contas/:id -> remove grupo (cascata) ou conta */
  static async excluir(req: Request, res: Response) {
    try {
      const ok = await PlanoContasService.excluir(Number(req.params.id));
      res.json({ success: ok });
    } catch (e: any) {
      console.error('[PlanoContas] excluir:', e.message);
      res.status(400).json({ success: false, message: e.message });
    }
  }

  /** POST /api/plano-contas/importar -> importa plano atual do ERP (Oracle) */
  static async importar(req: Request, res: Response) {
    try {
      const result = await PlanoContasService.importarDoOracle(getCodLoja(req));
      res.json({ success: true, ...result });
    } catch (e: any) {
      console.error('[PlanoContas] importar:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  }
}
