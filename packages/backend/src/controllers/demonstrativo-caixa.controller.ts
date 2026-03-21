/**
 * Demonstrativo de Caixa Controller
 * Endpoints para tela de Orçamento Gerencial
 */

import { Request, Response } from 'express';
import { DemonstrativoCaixaService } from '../services/demonstrativo-caixa.service';

export class DemonstrativoCaixaController {

  static async getDados(req: Request, res: Response) {
    try {
      const filters = {
        dataInicio: req.query.dataInicio as string,
        dataFim: req.query.dataFim as string,
        codLoja: req.query.codLoja as string,
        regime: req.query.regime as string,
        tipoFluxo: req.query.tipoFluxo as string,
        incluirMovBanco: (req.query.incluirMovBanco as string) || 'sim',
      };

      const result = await DemonstrativoCaixaService.getDados(filters);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar demonstrativo de caixa:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getCategorias(req: Request, res: Response) {
    try {
      const data = await DemonstrativoCaixaService.getCategorias();
      return res.json(data);
    } catch (error: any) {
      console.error('Erro ao buscar categorias:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTitulos(req: Request, res: Response) {
    try {
      const result = await DemonstrativoCaixaService.getTitulos({
        codCategoria: Number(req.query.codCategoria),
        codSubcategoria: req.query.codSubcategoria ? Number(req.query.codSubcategoria) : undefined,
        dataInicio: req.query.dataInicio as string,
        dataFim: req.query.dataFim as string,
        codLoja: req.query.codLoja as string,
        regime: req.query.regime as string,
        status: req.query.status as string,
      });
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar títulos:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getItensNF(req: Request, res: Response) {
    try {
      const result = await DemonstrativoCaixaService.getItensNF({
        numNf: req.query.numNf as string,
        numSerieNf: req.query.numSerieNf as string,
        codParceiro: Number(req.query.codParceiro),
      });
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar itens NF:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
