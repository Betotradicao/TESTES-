/**
 * Análise de Ponderação Controller
 * Endpoints para relatório de ponderação de produtos
 */

import { Request, Response } from 'express';
import { PonderacaoService } from '../services/ponderacao.service';
import { CompraVendaService } from '../services/compra-venda.service';

export class PonderacaoController {

  /**
   * GET /ponderacao/dados
   * Busca dados completos de ponderação
   */
  static async getDados(req: Request, res: Response) {
    try {
      const {
        dataInicio, dataFim, codLoja, codSecao,
        codGrupo, codSubGrupo, codSegmento,
        pesoFat, pesoVol, pesoCont, diagnostico
      } = req.query;

      if (!dataInicio || !dataFim || !codLoja || !codSecao) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: dataInicio, dataFim, codLoja, codSecao' });
      }

      const result = await PonderacaoService.getDados({
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codLoja: Number(codLoja),
        codSecao: Number(codSecao),
        codGrupo: codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo: codSubGrupo ? Number(codSubGrupo) : undefined,
        codSegmento: codSegmento ? Number(codSegmento) : undefined,
        pesoFat: Number(pesoFat) || 35,
        pesoVol: Number(pesoVol) || 35,
        pesoCont: Number(pesoCont) || 30,
        diagnostico: Number(diagnostico) || 95,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('[Ponderação] Erro getDados:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/secoes - Reutiliza de CompraVendaService
   */
  static async getSecoes(req: Request, res: Response) {
    try {
      const secoes = await CompraVendaService.getSecoes();
      return res.json(secoes);
    } catch (error: any) {
      console.error('[Ponderação] Erro getSecoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/grupos
   */
  static async getGrupos(req: Request, res: Response) {
    try {
      const codSecao = Number(req.query.codSecao);
      if (!codSecao) return res.status(400).json({ error: 'codSecao obrigatório' });
      const grupos = await CompraVendaService.getGrupos(codSecao);
      return res.json(grupos);
    } catch (error: any) {
      console.error('[Ponderação] Erro getGrupos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/subgrupos
   */
  static async getSubGrupos(req: Request, res: Response) {
    try {
      const codSecao = Number(req.query.codSecao);
      const codGrupo = Number(req.query.codGrupo);
      if (!codSecao || !codGrupo) return res.status(400).json({ error: 'codSecao e codGrupo obrigatórios' });
      const subgrupos = await CompraVendaService.getSubGrupos(codSecao, codGrupo);
      return res.json(subgrupos);
    } catch (error: any) {
      console.error('[Ponderação] Erro getSubGrupos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/lojas - Reutiliza de CompraVendaService
   */
  static async getLojas(req: Request, res: Response) {
    try {
      const lojas = await CompraVendaService.getLojas();
      return res.json(lojas);
    } catch (error: any) {
      console.error('[Ponderação] Erro getLojas:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/segmentos
   */
  static async getSegmentos(req: Request, res: Response) {
    try {
      const codSecao = req.query.codSecao ? Number(req.query.codSecao) : undefined;
      const codGrupo = req.query.codGrupo ? Number(req.query.codGrupo) : undefined;
      const codSubGrupo = req.query.codSubGrupo ? Number(req.query.codSubGrupo) : undefined;
      console.log(`[Ponderação] getSegmentos - codSecao=${codSecao}, codGrupo=${codGrupo}, codSubGrupo=${codSubGrupo}`);
      const segmentos = await PonderacaoService.getSegmentos(codSecao, codGrupo, codSubGrupo);
      console.log(`[Ponderação] getSegmentos - ${segmentos.length} segmentos retornados`);
      return res.json(segmentos);
    } catch (error: any) {
      console.error('[Ponderação] Erro getSegmentos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/sugestao-pesos
   */
  static async getSugestaoPesos(req: Request, res: Response) {
    try {
      const codLoja = Number(req.query.codLoja);
      const dataInicio = String(req.query.dataInicio || '');
      const dataFim = String(req.query.dataFim || '');
      if (!codLoja || !dataInicio || !dataFim) {
        return res.status(400).json({ error: 'codLoja, dataInicio e dataFim obrigatórios' });
      }
      console.log(`[Ponderação] getSugestaoPesos - Loja=${codLoja}, ${dataInicio} a ${dataFim}`);
      const dados = await PonderacaoService.getSugestaoPesos(codLoja, dataInicio, dataFim);
      console.log(`[Ponderação] getSugestaoPesos - ${dados.length} subgrupos analisados`);
      return res.json(dados);
    } catch (error: any) {
      console.error('[Ponderação] Erro getSugestaoPesos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/hierarquia
   */
  static async getHierarquia(req: Request, res: Response) {
    try {
      console.log('[Ponderação] getHierarquia');
      const dados = await PonderacaoService.getHierarquia();
      console.log(`[Ponderação] getHierarquia - ${dados.length} registros`);
      return res.json(dados);
    } catch (error: any) {
      console.error('[Ponderação] Erro getHierarquia:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ponderacao/pesos-loja
   */
  static async getPesosLoja(req: Request, res: Response) {
    try {
      const codLoja = Number(req.query.codLoja);
      if (!codLoja) return res.status(400).json({ error: 'codLoja obrigatório' });
      const pesos = await PonderacaoService.getPesosLoja(codLoja);
      return res.json(pesos);
    } catch (error: any) {
      console.error('[Ponderação] Erro getPesosLoja:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
