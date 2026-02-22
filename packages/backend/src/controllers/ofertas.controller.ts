/**
 * Ofertas Controller
 * Endpoints para consulta de programacoes e produtos em oferta
 */

import { Request, Response } from 'express';
import { OfertasService } from '../services/ofertas.service';
import { AppDataSource } from '../config/database';
import { OfertaSalva } from '../entities/OfertaSalva';

export class OfertasController {

  /**
   * GET /ofertas/programacoes?codLoja=1&ativas=true
   */
  static async getProgramacoes(req: Request, res: Response) {
    try {
      const { codLoja, ativas } = req.query;
      console.log('[Ofertas] GET /programacoes - codLoja:', codLoja, 'ativas:', ativas);
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja obrigatorio' });
      }
      const result = await OfertasService.getProgramacoes(
        Number(codLoja),
        ativas !== 'false'
      );
      return res.json(result);
    } catch (error: any) {
      console.error('[Ofertas] Erro getProgramacoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ofertas/produtos/:codProg?codLoja=1&mesAtual=true
   * codProg=0 significa "todas as programacoes"
   */
  static async getProdutos(req: Request, res: Response) {
    try {
      const codProg = Number(req.params.codProg);
      const { codLoja, mesAtual } = req.query;
      if (codProg == null || isNaN(codProg) || !codLoja) {
        return res.status(400).json({ error: 'codProg e codLoja obrigatorios' });
      }
      const result = await OfertasService.getProdutos(codProg, Number(codLoja), mesAtual === 'true');
      return res.json(result);
    } catch (error: any) {
      console.error('[Ofertas] Erro getProdutos:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ofertas/historico-produto/:codProduto?codLoja=1
   * Retorna historico de todas as ofertas em que o produto participou
   */
  static async getHistoricoProduto(req: Request, res: Response) {
    try {
      const { codProduto } = req.params;
      const { codLoja } = req.query;
      console.log('[Ofertas] GET /historico-produto - codProduto:', codProduto, 'codLoja:', codLoja);
      if (!codProduto || !codLoja) {
        return res.status(400).json({ error: 'codProduto e codLoja obrigatorios' });
      }
      const result = await OfertasService.getHistoricoProduto(String(codProduto), Number(codLoja));
      console.log('[Ofertas] Historico resultado:', result.length, 'registros');
      return res.json(result);
    } catch (error: any) {
      console.error('[Ofertas] Erro getHistoricoProduto:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ofertas/compra-venda-excedido?codLoja=1&tipoEspecie=0&tipoEvento=0
   * Retorna produtos estourados (compra > custo de venda) no ano corrente
   * tipoEspecie: 0=Mercadoria, 2=Servico, 3=Imobilizado, 4=Insumo, null=Todos
   * tipoEvento: 0=Direta, 1=Decomposicao, 2=Composicao, 3=Producao, null=Todos
   */
  static async getCompraVendaExcedido(req: Request, res: Response) {
    try {
      const { codLoja, tipoEspecie, tipoEvento } = req.query;
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja obrigatorio' });
      }
      const especie = tipoEspecie === 'todos' || tipoEspecie === '' ? null : Number(tipoEspecie ?? 0);
      const evento = tipoEvento === 'todos' || tipoEvento === '' ? null : Number(tipoEvento ?? 0);
      const result = await OfertasService.getCompraVendaExcedido(Number(codLoja), especie, evento);
      return res.json(result);
    } catch (error: any) {
      console.error('[Ofertas] Erro getCompraVendaExcedido:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /ofertas/salvar-sugestoes
   * Salva sugestoes de oferta no PostgreSQL
   */
  static async salvarSugestoes(req: Request, res: Response) {
    try {
      const { codLoja, produtos, nomeOferta, vigenciaInicio, vigenciaFim } = req.body;
      if (!codLoja || !produtos || !Array.isArray(produtos) || produtos.length === 0) {
        return res.status(400).json({ error: 'codLoja e array de produtos obrigatorios' });
      }
      const repo = AppDataSource.getRepository(OfertaSalva);
      const entities = produtos.map((p: any) => repo.create({
        cod_loja: Number(codLoja),
        cod_produto: String(p.codProduto),
        descricao: p.descricao || '',
        cod_barras: p.codBarras || null,
        secao: p.secao || null,
        curva: p.curva || null,
        preco_normal: p.precoNormal || 0,
        custo: p.custo || 0,
        preco_rebaixo: p.precoRebaixo || null,
        preco_club: p.precoClub || null,
        preco_leve_mais: p.precoLeveMais || null,
        tipo_oferta_escolhido: p.tipoOfertaEscolhido || null,
        status: 'sugestao',
        origem: p.origem || null,
        nome_oferta: nomeOferta || null,
        vigencia_inicio: vigenciaInicio || null,
        vigencia_fim: vigenciaFim || null,
        created_by: (req as any).user?.id || null,
      }));
      const saved = await repo.save(entities);
      console.log('[Ofertas] Sugestoes salvas:', saved.length, '- Oferta:', nomeOferta);
      return res.json({ success: true, count: saved.length });
    } catch (error: any) {
      console.error('[Ofertas] Erro salvarSugestoes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /ofertas/sugestoes-salvas?codLoja=1
   * Lista sugestoes de oferta salvas no PostgreSQL
   */
  static async getSugestoesSalvas(req: Request, res: Response) {
    try {
      const { codLoja } = req.query;
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja obrigatorio' });
      }
      const repo = AppDataSource.getRepository(OfertaSalva);
      const result = await repo.find({
        where: { cod_loja: Number(codLoja) },
        order: { created_at: 'DESC' },
      });
      return res.json(result);
    } catch (error: any) {
      console.error('[Ofertas] Erro getSugestoesSalvas:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /ofertas/sugestoes-salvas/:id
   * Remove uma sugestao de oferta
   */
  static async deleteSugestao(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const repo = AppDataSource.getRepository(OfertaSalva);
      const result = await repo.delete(Number(id));
      return res.json({ success: true, affected: result.affected });
    } catch (error: any) {
      console.error('[Ofertas] Erro deleteSugestao:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /ofertas/sugestoes-salvas-por-nome
   * Remove todos os itens de uma oferta pelo nome
   */
  static async deleteSugestaoPorNome(req: Request, res: Response) {
    try {
      const { codLoja, nomeOferta, itemIds } = req.body;
      if (!codLoja) {
        return res.status(400).json({ error: 'codLoja obrigatorio' });
      }
      const repo = AppDataSource.getRepository(OfertaSalva);
      let result;
      if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
        // Delete by specific IDs (for offers with null nome_oferta)
        result = await repo.delete(itemIds.map((id: any) => Number(id)));
      } else if (nomeOferta) {
        result = await repo.delete({ cod_loja: Number(codLoja), nome_oferta: nomeOferta });
      } else {
        return res.status(400).json({ error: 'nomeOferta ou itemIds obrigatorio' });
      }
      return res.json({ success: true, affected: result.affected });
    } catch (error: any) {
      console.error('[Ofertas] Erro deleteSugestaoPorNome:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
