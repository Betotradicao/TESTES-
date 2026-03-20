/**
 * Margens por Categoria Controller
 * Endpoints para consulta de margens, precos e estoque por classificacao mercadologica
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MargensCategoriaService } from '../services/margens-categoria.service';

export class MargensCategoriaController {

  /**
   * Busca produtos com margens, precos, estoque e classificacao
   * Query params: codLoja (obrigatorio), codSecao, codGrupo, codSubGrupo, codSegmento
   */
  static async getProdutos(req: AuthRequest, res: Response) {
    try {
      const codLoja = Number(req.query.codLoja);
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja e obrigatorio' });
      }

      const codSecao = req.query.codSecao ? Number(req.query.codSecao) : undefined;
      const codGrupo = req.query.codGrupo ? Number(req.query.codGrupo) : undefined;
      const codSubGrupo = req.query.codSubGrupo ? Number(req.query.codSubGrupo) : undefined;
      const codSegmento = req.query.codSegmento ? Number(req.query.codSegmento) : undefined;

      const rows = await MargensCategoriaService.getProdutos(codLoja, codSecao, codGrupo, codSubGrupo, codSegmento);
      return res.json(rows);
    } catch (error: any) {
      console.error('[MargensCategoria] Erro getProdutos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Busca secoes disponiveis
   */
  static async getSecoes(req: AuthRequest, res: Response) {
    try {
      const rows = await MargensCategoriaService.getSecoes();
      return res.json(rows);
    } catch (error: any) {
      console.error('[MargensCategoria] Erro getSecoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Busca grupos disponiveis
   * Query params: codSecao
   */
  static async getGrupos(req: AuthRequest, res: Response) {
    try {
      const codSecao = req.query.codSecao ? Number(req.query.codSecao) : undefined;
      const rows = await MargensCategoriaService.getGrupos(codSecao);
      return res.json(rows);
    } catch (error: any) {
      console.error('[MargensCategoria] Erro getGrupos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Busca subgrupos disponiveis
   * Query params: codSecao, codGrupo
   */
  static async getSubGrupos(req: AuthRequest, res: Response) {
    try {
      const codSecao = req.query.codSecao ? Number(req.query.codSecao) : undefined;
      const codGrupo = req.query.codGrupo ? Number(req.query.codGrupo) : undefined;
      const rows = await MargensCategoriaService.getSubGrupos(codSecao, codGrupo);
      return res.json(rows);
    } catch (error: any) {
      console.error('[MargensCategoria] Erro getSubGrupos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Busca segmentos disponiveis
   * Query params: codSecao, codGrupo, codSubGrupo
   */
  static async getSegmentos(req: AuthRequest, res: Response) {
    try {
      const codSecao = req.query.codSecao ? Number(req.query.codSecao) : undefined;
      const codGrupo = req.query.codGrupo ? Number(req.query.codGrupo) : undefined;
      const codSubGrupo = req.query.codSubGrupo ? Number(req.query.codSubGrupo) : undefined;
      const rows = await MargensCategoriaService.getSegmentos(codSecao, codGrupo, codSubGrupo);
      return res.json(rows);
    } catch (error: any) {
      console.error('[MargensCategoria] Erro getSegmentos:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
