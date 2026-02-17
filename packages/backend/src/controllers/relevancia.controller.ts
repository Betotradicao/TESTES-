/**
 * Análise de Relevância Controller
 * Endpoints para processamento de relevância ATKearney
 */

import { Request, Response } from 'express';
import { RelevanciaService } from '../services/relevancia.service';
import { CompraVendaService } from '../services/compra-venda.service';

export class RelevanciaController {

  /**
   * GET /relevancia/processar
   * Processa relevância dos produtos
   */
  static async processar(req: Request, res: Response) {
    try {
      const {
        dataInicio, dataFim, codLoja, codSecao,
        codGrupo, codSubGrupo, todasSecoes,
        pesoVendasRS, pesoVendasQtde, pesoPenetCupons, pesoPenetSubCateg,
        pctNotavel, pctSensivel, subcategoriaPor
      } = req.query;

      if (!dataInicio || !dataFim || !codLoja) {
        return res.status(400).json({ success: false, error: 'Parâmetros obrigatórios: dataInicio, dataFim, codLoja' });
      }

      if (!todasSecoes && !codSecao) {
        return res.status(400).json({ success: false, error: 'Selecione uma seção ou marque "Processar todas as seções"' });
      }

      const result = await RelevanciaService.processar({
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codLoja: Number(codLoja),
        codSecao: codSecao ? Number(codSecao) : undefined,
        codGrupo: codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo: codSubGrupo ? Number(codSubGrupo) : undefined,
        pesoVendasRS: pesoVendasRS != null ? Number(pesoVendasRS) : 25,
        pesoVendasQtde: pesoVendasQtde != null ? Number(pesoVendasQtde) : 25,
        pesoPenetCupons: pesoPenetCupons != null ? Number(pesoPenetCupons) : 30,
        pesoPenetSubCateg: pesoPenetSubCateg != null ? Number(pesoPenetSubCateg) : 20,
        pctNotavel: Number(pctNotavel) || 2,
        pctSensivel: Number(pctSensivel) || 7,
        subcategoriaPor: (subcategoriaPor as string) === 'subgrupo' ? 'subgrupo' : 'grupo',
      });

      return res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('[Relevância] Erro processar:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /relevancia/secoes
   */
  static async getSecoes(req: Request, res: Response) {
    try {
      const secoes = await CompraVendaService.getSecoes();
      return res.json(secoes);
    } catch (error: any) {
      console.error('[Relevância] Erro getSecoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /relevancia/grupos
   */
  static async getGrupos(req: Request, res: Response) {
    try {
      const codSecao = Number(req.query.codSecao);
      if (!codSecao) return res.status(400).json({ error: 'codSecao obrigatório' });
      const grupos = await CompraVendaService.getGrupos(codSecao);
      return res.json(grupos);
    } catch (error: any) {
      console.error('[Relevância] Erro getGrupos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /relevancia/subgrupos
   */
  static async getSubGrupos(req: Request, res: Response) {
    try {
      const codSecao = Number(req.query.codSecao);
      const codGrupo = Number(req.query.codGrupo);
      if (!codSecao || !codGrupo) return res.status(400).json({ error: 'codSecao e codGrupo obrigatórios' });
      const subgrupos = await CompraVendaService.getSubGrupos(codSecao, codGrupo);
      return res.json(subgrupos);
    } catch (error: any) {
      console.error('[Relevância] Erro getSubGrupos:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
