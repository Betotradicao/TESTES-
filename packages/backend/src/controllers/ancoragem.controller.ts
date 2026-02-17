/**
 * Ancoragem de Preco Controller
 * Endpoints para classificacao de marcas, regua de preco e analise
 */

import { Request, Response } from 'express';
import { AncoragemService } from '../services/ancoragem.service';

export class AncoragemController {

  /**
   * GET /ancoragem/products
   */
  static async getProducts(req: Request, res: Response) {
    try {
      const { codLoja, codSecao, codGrupo, codSubGrupo, codSegmento } = req.query;
      if (!codLoja || !codSecao) {
        return res.status(400).json({ error: 'codLoja e codSecao obrigatorios' });
      }
      const result = await AncoragemService.getProducts(
        Number(codLoja),
        Number(codSecao),
        codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo ? Number(codSubGrupo) : undefined,
        codSegmento ? Number(codSegmento) : undefined
      );
      return res.json(result);
    } catch (error: any) {
      console.error('[Ancoragem] Erro getProducts:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ancoragem/classificacoes
   */
  static async getClassificacoes(req: Request, res: Response) {
    try {
      const { codLoja, codSecao, codGrupo, codSubGrupo, codSegmento } = req.query;
      if (!codLoja || !codSecao) {
        return res.status(400).json({ error: 'codLoja e codSecao obrigatorios' });
      }
      const result = await AncoragemService.getClassificacoes(
        Number(codLoja),
        Number(codSecao),
        codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo ? Number(codSubGrupo) : undefined,
        codSegmento ? Number(codSegmento) : undefined
      );
      return res.json(result);
    } catch (error: any) {
      console.error('[Ancoragem] Erro getClassificacoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /ancoragem/classificacoes
   */
  static async saveClassificacoes(req: Request, res: Response) {
    try {
      const { codLoja, items } = req.body;
      if (!codLoja || !items) {
        return res.status(400).json({ error: 'codLoja e items obrigatorios' });
      }
      await AncoragemService.saveClassificacoes(Number(codLoja), items);
      return res.json({ success: true, count: items.length });
    } catch (error: any) {
      console.error('[Ancoragem] Erro saveClassificacoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ancoragem/regras
   */
  static async getRegras(req: Request, res: Response) {
    try {
      const { codLoja, codSecao, codGrupo, codSubGrupo, codSegmento } = req.query;
      if (!codLoja || !codSecao) {
        return res.status(400).json({ error: 'codLoja e codSecao obrigatorios' });
      }
      const result = await AncoragemService.getRegras(
        Number(codLoja),
        Number(codSecao),
        codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo ? Number(codSubGrupo) : undefined,
        codSegmento ? Number(codSegmento) : undefined
      );
      return res.json(result);
    } catch (error: any) {
      console.error('[Ancoragem] Erro getRegras:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /ancoragem/regras
   */
  static async saveRegras(req: Request, res: Response) {
    try {
      const { codLoja, regras } = req.body;
      if (!codLoja || !regras) {
        return res.status(400).json({ error: 'codLoja e regras obrigatorios' });
      }
      await AncoragemService.saveRegras(Number(codLoja), regras);
      return res.json({ success: true, count: regras.length });
    } catch (error: any) {
      console.error('[Ancoragem] Erro saveRegras:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ancoragem/analise
   */
  static async getAnalise(req: Request, res: Response) {
    try {
      const { codLoja, codSecao, codGrupo, codSubGrupo, codSegmento } = req.query;
      if (!codLoja || !codSecao) {
        return res.status(400).json({ error: 'codLoja e codSecao obrigatorios' });
      }
      const result = await AncoragemService.getAnalise(
        Number(codLoja),
        Number(codSecao),
        codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo ? Number(codSubGrupo) : undefined,
        codSegmento ? Number(codSegmento) : undefined
      );
      return res.json(result);
    } catch (error: any) {
      console.error('[Ancoragem] Erro getAnalise:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ancoragem/stats - contagem agregada por status em todas as secoes
   */
  static async getStats(req: Request, res: Response) {
    try {
      const codLoja = Number(req.query.codLoja);
      if (!codLoja) return res.status(400).json({ error: 'codLoja obrigatorio' });
      const result = await AncoragemService.getStats(codLoja);
      return res.json(result);
    } catch (error: any) {
      console.error('[Ancoragem] Erro getStats:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ancoragem/tiers
   */
  static async getTiers(req: Request, res: Response) {
    try {
      const codLoja = Number(req.query.codLoja);
      if (!codLoja) return res.status(400).json({ error: 'codLoja obrigatorio' });
      const result = await AncoragemService.getCustomTiers(codLoja);
      return res.json(result);
    } catch (error: any) {
      console.error('[Ancoragem] Erro getTiers:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /ancoragem/tiers
   */
  static async saveTier(req: Request, res: Response) {
    try {
      const { codLoja, nome, ordem, cor } = req.body;
      if (!codLoja || !nome) {
        return res.status(400).json({ error: 'codLoja e nome obrigatorios' });
      }
      const result = await AncoragemService.saveCustomTier(Number(codLoja), nome, ordem || 99, cor || '#6B7280');
      return res.json(result);
    } catch (error: any) {
      console.error('[Ancoragem] Erro saveTier:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /ancoragem/tiers
   */
  static async deleteTier(req: Request, res: Response) {
    try {
      const { codLoja, nome } = req.query;
      if (!codLoja || !nome) {
        return res.status(400).json({ error: 'codLoja e nome obrigatorios' });
      }
      await AncoragemService.deleteCustomTier(Number(codLoja), String(nome));
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Ancoragem] Erro deleteTier:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
