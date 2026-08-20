import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';

export class AcougueController {

  /**
   * ===================================================================
   * FONTE DE VERDADE = ERP (Intersolid). Nada de copia local.
   * ===================================================================
   * Os templates de rendimento ficavam gravados em `acougue_rendimento_templates`
   * e NUNCA sincronizavam com o ERP. Os do Tradicao foram cadastrados em 04/2026 e
   * ficaram congelados: quando o Roberto mexeu na (De)Composicao do Intersolid em
   * 19/08/2026, a tela continuou com os numeros velhos — e o preco de venda idem.
   *
   * Impacto medido: OSSO/SEBO 25,53% no ERP contra 20,44% aqui, e 8 de 15 precos
   * defasados (FILE MIGNON R$ 65,99 aqui / R$ 69,99 no ERP). Osso subestimado
   * inflava o lucro; precos velhos deprimiam a receita. Numero errado dos dois lados.
   *
   * Agora o rendimento vem de TAB_PRODUTO_DECOMPOSICAO e o preco de TAB_PRODUTO_LOJA,
   * lidos a cada consulta. Mexeu no ERP, refletiu aqui.
   */

  /** Prefixo que identifica as matrizes de carne. Configuravel: a tabela do ERP mistura
   *  carne com COMBO de mercearia (COMBO PIZZA, COMBO BALA...), e filtrar so por
   *  "soma = 100%" nao basta porque alguns combos tambem somam 100. */
  private static async getPrefixoMatriz(): Promise<string> {
    const { ConfigurationService } = await import('../services/configuration.service');
    const v = await ConfigurationService.get('acougue_prefixo_matriz', 'AC MATRIZ');
    return (v || 'AC MATRIZ').toUpperCase();
  }

  /** Nomes reais de tabela/coluna via mapeamento (nunca hardcode). */
  private static async mapa() {
    const schema = await MappingService.getSchema();
    const [tDecomp, tProd, tProdLoja] = await Promise.all([
      MappingService.getRealTableName('TAB_PRODUTO_DECOMPOSICAO'),
      MappingService.getRealTableName('TAB_PRODUTO'),
      MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
    ]);
    const [dCod, dCodDecom, dQtd, pCod, pDes, plCod, plLoja, plVenda] = await Promise.all([
      MappingService.getColumnFromTable('TAB_PRODUTO_DECOMPOSICAO', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO_DECOMPOSICAO', 'codigo_produto_decom'),
      MappingService.getColumnFromTable('TAB_PRODUTO_DECOMPOSICAO', 'quantidade_decomp'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda'),
    ]);
    return { schema, tDecomp, tProd, tProdLoja, dCod, dCodDecom, dQtd, pCod, pDes, plCod, plLoja, plVenda };
  }

  /** Cortes de uma matriz, com % e preco de venda ATUAIS do ERP. */
  private static async itensDoERP(codMatriz: string, codLoja: number) {
    const m = await AcougueController.mapa();
    const rows = await OracleService.query(
      `SELECT d.${m.dCodDecom} AS COD, p.${m.pDes} AS NOME, d.${m.dQtd} AS PCT,
              NVL(pl.${m.plVenda}, 0) AS VENDA
         FROM ${m.schema}.${m.tDecomp} d
         LEFT JOIN ${m.schema}.${m.tProd} p ON p.${m.pCod} = d.${m.dCodDecom}
         LEFT JOIN ${m.schema}.${m.tProdLoja} pl
                ON pl.${m.plCod} = d.${m.dCodDecom} AND pl.${m.plLoja} = :loja
        WHERE LPAD(TRIM(d.${m.dCod}), 20, '0') = LPAD(TRIM(:cod), 20, '0')
        ORDER BY d.${m.dQtd} DESC`,
      { cod: String(codMatriz), loja: codLoja },
    );
    return rows.map((r: any, i: number) => {
      const preco = parseFloat(r.VENDA) || 0;
      return {
        ordem: i,
        codigo_produto: String(r.COD || '').trim(),
        nome_corte: String(r.NOME || '').trim(),
        percentual: parseFloat(r.PCT) || 0,
        preco_venda: preco,
        // Osso/sebo e afins nao geram receita: no ERP ficam com preco 0 (ou centavos).
        vende: preco > 0.01,
      };
    });
  }


  // Busca rapida de produtos no Oracle por codigo ou nome
  static async buscarProdutos(req: AuthRequest, res: Response) {
    try {
      const search = (req.query.search as string || '').trim();
      if (search.length < 2) return res.json([]);

      const schema = await MappingService.getSchema();
      const codProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const desProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA');
      const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
      const plValVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
      const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const plInativo = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
      const plPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media');
      const plPesquisaConc = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_concorrente');
      const plMargemFixa = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa');

      // Buscar por codigo (numerico) ou nome (texto)
      const isNumeric = /^\d+$/.test(search);
      const whereClause = isNumeric
        ? `WHERE p.${codProduto} = :search`
        : `WHERE UPPER(p.${desProduto}) LIKE UPPER(:search)`;
      const params = isNumeric ? { search: parseInt(search) } : { search: `%${search}%` };

      const sql = `
        SELECT p.${codProduto} AS CODIGO, p.${desProduto} AS DESCRICAO,
               NVL(pl.${plValVenda}, 0) AS VAL_VENDA,
               NVL(pl.${plPesquisaMedia}, 0) AS PRECO_CONCORRENTE,
               pl.${plPesquisaConc} AS NOME_CONCORRENTE,
               NVL(pl.${plMargemFixa}, 0) AS META_MARGEM
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${schema}.${tabProdutoLoja} pl ON p.${codProduto} = pl.${plCodProduto} AND pl.${plCodLoja} = 1
        ${whereClause}
        AND NVL(pl.${plInativo}, 'N') = 'N'
        AND ROWNUM <= 15
        ORDER BY p.${desProduto}
      `;

      const rows = await OracleService.query(sql, params);
      const produtos = rows.map((r: any) => ({
        codigo: String(r.CODIGO),
        descricao: r.DESCRICAO || '',
        preco_venda: parseFloat(r.VAL_VENDA) || 0,
        preco_concorrente: parseFloat(r.PRECO_CONCORRENTE) || 0,
        nome_concorrente: r.NOME_CONCORRENTE || '',
        meta_margem: parseFloat(r.META_MARGEM) || 0,
      }));

      res.json(produtos);
    } catch (error) {
      console.error('Buscar produtos error:', error);
      res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
  }
  // === TEMPLATES DE RENDIMENTO ===

  /** Lista as matrizes de rendimento direto do ERP (nao ha mais copia local). */
  static async listarTemplates(req: AuthRequest, res: Response) {
    try {
      const m = await AcougueController.mapa();
      const prefixo = await AcougueController.getPrefixoMatriz();

      // Duas travas juntas, porque nenhuma sozinha separa carne de combo:
      //  - prefixo do nome (as matrizes do ERP se chamam "AC MATRIZ CARNE ...")
      //  - soma dos percentuais ~100% (uma matriz de rendimento sempre fecha 100)
      const rows = await OracleService.query(
        `SELECT d.${m.dCod} AS COD, p.${m.pDes} AS NOME,
                COUNT(*) AS CORTES, SUM(d.${m.dQtd}) AS SOMA
           FROM ${m.schema}.${m.tDecomp} d
           JOIN ${m.schema}.${m.tProd} p ON p.${m.pCod} = d.${m.dCod}
          WHERE UPPER(p.${m.pDes}) LIKE :prefixo
          GROUP BY d.${m.dCod}, p.${m.pDes}
         HAVING SUM(d.${m.dQtd}) BETWEEN 99 AND 101
          ORDER BY p.${m.pDes}`,
        { prefixo: `${prefixo}%` },
      );

      res.json(rows.map((r: any) => ({
        id: String(r.COD || '').trim(),
        nome: String(r.NOME || '').trim(),
        ativo: true,
        origem: 'erp',
        total_cortes: Number(r.CORTES) || 0,
        total_percentual: Math.round((parseFloat(r.SOMA) || 0) * 100) / 100,
      })));
    } catch (error: any) {
      console.error('List templates error:', error?.message || error);
      res.status(500).json({ error: 'Nao foi possivel ler os rendimentos do ERP: ' + (error?.message || 'erro desconhecido') });
    }
  }

  /** Detalhe da matriz + cortes, com % e preco ATUAIS do ERP. */
  static async getTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const codLoja = Number(req.query.codLoja) || 1;
      const m = await AcougueController.mapa();

      const cab = await OracleService.query(
        `SELECT p.${m.pDes} AS NOME FROM ${m.schema}.${m.tProd} p
          WHERE LPAD(TRIM(p.${m.pCod}), 20, '0') = LPAD(TRIM(:cod), 20, '0')`,
        { cod: String(id) },
      );
      if (!cab.length) return res.status(404).json({ error: 'Rendimento nao encontrado no ERP' });

      const itens = await AcougueController.itensDoERP(String(id), codLoja);
      res.json({
        id: String(id),
        nome: String(cab[0].NOME || '').trim(),
        ativo: true,
        origem: 'erp',
        itens,
      });
    } catch (error: any) {
      console.error('Get template error:', error?.message || error);
      res.status(500).json({ error: 'Nao foi possivel ler o rendimento do ERP: ' + (error?.message || 'erro desconhecido') });
    }
  }

  static async criarTemplate(req: AuthRequest, res: Response) {
    try {
      const { nome, descricao, itens } = req.body;
      if (!nome || !itens || itens.length === 0) {
        return res.status(400).json({ error: 'Nome e itens sao obrigatorios' });
      }

      // Validar que percentuais somam ~100%
      const totalPct = itens.reduce((sum: number, item: any) => sum + (parseFloat(item.percentual) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.5) {
        return res.status(400).json({ error: `Percentuais somam ${totalPct.toFixed(2)}%. Devem somar 100%.` });
      }

      const result = await AppDataSource.query(
        'INSERT INTO acougue_rendimento_templates (nome, descricao) VALUES ($1, $2) RETURNING *',
        [nome, descricao || null]
      );
      const templateId = result[0].id;

      for (let i = 0; i < itens.length; i++) {
        const item = itens[i];
        await AppDataSource.query(
          `INSERT INTO acougue_rendimento_itens (template_id, nome_corte, codigo_produto, percentual, preco_venda, vende, ordem)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [templateId, item.nome_corte, item.codigo_produto || null, item.percentual, item.preco_venda || null, item.vende !== false, i]
        );
      }

      res.status(201).json({ ...result[0], itens });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nome, descricao, itens } = req.body;

      if (itens) {
        const totalPct = itens.reduce((sum: number, item: any) => sum + (parseFloat(item.percentual) || 0), 0);
        if (Math.abs(totalPct - 100) > 0.5) {
          return res.status(400).json({ error: `Percentuais somam ${totalPct.toFixed(2)}%. Devem somar 100%.` });
        }
      }

      await AppDataSource.query(
        'UPDATE acougue_rendimento_templates SET nome = $1, descricao = $2, updated_at = NOW() WHERE id = $3',
        [nome, descricao || null, id]
      );

      if (itens) {
        await AppDataSource.query('DELETE FROM acougue_rendimento_itens WHERE template_id = $1', [id]);
        for (let i = 0; i < itens.length; i++) {
          const item = itens[i];
          await AppDataSource.query(
            `INSERT INTO acougue_rendimento_itens (template_id, nome_corte, codigo_produto, percentual, preco_venda, vende, ordem)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, item.nome_corte, item.codigo_produto || null, item.percentual, item.preco_venda || null, item.vende !== false, i]
          );
        }
      }

      res.json({ message: 'Template atualizado com sucesso' });
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await AppDataSource.query('UPDATE acougue_rendimento_templates SET ativo = false WHERE id = $1', [id]);
      res.json({ message: 'Template removido' });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // === DESMEMBRAMENTO ===

  static async calcularDesmembramento(req: AuthRequest, res: Response) {
    try {
      const { template_id, peso_total, custo_kg } = req.body;
      if (!template_id || !peso_total || !custo_kg) {
        return res.status(400).json({ error: 'Template, peso e custo sao obrigatorios' });
      }

      // Rendimento E preco vem do ERP na hora do calculo — nada de copia local.
      const codLojaCalc = Number(req.body?.cod_loja) || 1;
      const m0 = await AcougueController.mapa();
      const cabRows = await OracleService.query(
        `SELECT p.${m0.pDes} AS NOME FROM ${m0.schema}.${m0.tProd} p
          WHERE LPAD(TRIM(p.${m0.pCod}), 20, '0') = LPAD(TRIM(:cod), 20, '0')`,
        { cod: String(template_id) },
      );
      if (!cabRows.length) return res.status(404).json({ error: 'Rendimento nao encontrado no ERP' });
      const template = [{ nome: String(cabRows[0].NOME || '').trim() }];

      const itens = await AcougueController.itensDoERP(String(template_id), codLojaCalc);
      if (!itens.length) return res.status(404).json({ error: 'Rendimento sem cortes cadastrados no ERP' });

      // Buscar dados extras do Oracle (preco concorrente, meta margem)
      let oracleData: Map<string, any> = new Map();
      try {
        const codigos = itens.filter((i: any) => i.codigo_produto).map((i: any) => i.codigo_produto.replace(/^0+/, ''));
        if (codigos.length > 0) {
          const schema = await MappingService.getSchema();
          const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
          const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
          const plPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media');
          const plPesquisaConc = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_concorrente');
          const plMargemFixa = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa');
          const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA');

          const inList = codigos.map((_: any, i: number) => `:cod${i}`).join(',');
          const params: any = {};
          codigos.forEach((cod: string, i: number) => { params[`cod${i}`] = parseInt(cod); });
          params.codLoja = 1;

          const rows = await OracleService.query(
            `SELECT ${plCodProduto} AS COD, NVL(${plPesquisaMedia}, 0) AS PRECO_CONC, ${plPesquisaConc} AS NOME_CONC, NVL(${plMargemFixa}, 0) AS META_MG
             FROM ${schema}.${tabProdutoLoja} WHERE ${plCodProduto} IN (${inList}) AND ${plCodLoja} = :codLoja`, params
          );
          rows.forEach((r: any) => oracleData.set(String(r.COD), { preco_concorrente: parseFloat(r.PRECO_CONC) || 0, nome_concorrente: r.NOME_CONC || '', meta_margem: parseFloat(r.META_MG) || 0 }));
        }
      } catch (e: any) { console.log('⚠️ Dados Oracle extras nao disponiveis:', e.message); }

      const custoTotal = peso_total * custo_kg;
      let receitaTotal = 0;

      const resultado = itens.map((item: any) => {
        const pesoCorte = (peso_total * item.percentual) / 100;
        const receita = item.vende && item.preco_venda ? pesoCorte * item.preco_venda : 0;
        receitaTotal += receita;
        const codNorm = item.codigo_produto ? item.codigo_produto.replace(/^0+/, '') : '';
        const extra = oracleData.get(codNorm) || { preco_concorrente: 0, nome_concorrente: '', meta_margem: 0 };
        return {
          nome_corte: item.nome_corte,
          codigo_produto: item.codigo_produto,
          percentual: parseFloat(item.percentual),
          peso_kg: Math.round(pesoCorte * 1000) / 1000,
          preco_venda_kg: item.preco_venda ? parseFloat(item.preco_venda) : 0,
          vende: item.vende,
          receita: Math.round(receita * 100) / 100,
          preco_concorrente: extra.preco_concorrente,
          nome_concorrente: extra.nome_concorrente,
          meta_margem: extra.meta_margem,
        };
      });

      // Calcular custo proporcional ao preco de venda (margem uniforme)
      const margemPct = receitaTotal > 0 ? ((receitaTotal - custoTotal) / receitaTotal) * 100 : 0;
      const fatorCusto = receitaTotal > 0 ? custoTotal / receitaTotal : 1;

      const resultadoFinal = resultado.map((item: any) => ({
        ...item,
        custo_kg: item.vende ? Math.round(item.preco_venda_kg * fatorCusto * 100) / 100 : 0,
        custo_total: Math.round(item.receita * fatorCusto * 100) / 100,
        lucro: Math.round(item.receita * (1 - fatorCusto) * 100) / 100,
        margem_pct: Math.round(margemPct * 100) / 100,
      }));

      const lucroTotal = receitaTotal - custoTotal;

      res.json({
        template_nome: template[0].nome,
        peso_total: parseFloat(peso_total),
        custo_kg: parseFloat(custo_kg),
        custo_total: Math.round(custoTotal * 100) / 100,
        receita_total: Math.round(receitaTotal * 100) / 100,
        lucro_total: Math.round(lucroTotal * 100) / 100,
        margem_pct: Math.round(margemPct * 100) / 100,
        itens: resultadoFinal,
      });
    } catch (error) {
      console.error('Calcular desmembramento error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async salvarDesmembramento(req: AuthRequest, res: Response) {
    try {
      const { template_id, template_nome, peso_total, custo_kg, custo_total, receita_total, lucro_total, margem_pct, itens } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO acougue_desmembramentos (template_id, template_nome, peso_total, custo_kg, custo_total, receita_total, lucro_total, margem_pct, itens)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [template_id, template_nome, peso_total, custo_kg, custo_total, receita_total, lucro_total, margem_pct, JSON.stringify(itens)]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Save desmembramento error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async listarDesmembramentos(req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        'SELECT * FROM acougue_desmembramentos ORDER BY created_at DESC LIMIT 50'
      );
      res.json(rows);
    } catch (error) {
      console.error('List desmembramentos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
