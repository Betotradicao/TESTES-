/**
 * Análise de Relevância Service
 * Metodologia ATKearney - Processamento de relevância de produtos
 *
 * CRITÉRIOS (4 pesos que somam 100%):
 * - Participação Vendas R$ = vendas produto / total vendas seção × 100
 * - Participação Vendas Qtde = qtde produto / total qtde seção × 100
 * - Penetração Cupons = cupons distintos com produto / total cupons distintos seção × 100
 * - Penetração SubCategoria = cupons distintos com produto / cupons distintos da mesma subcategoria × 100
 *
 * SCORE = (Part.VendasRS × peso + Part.VendasQtde × peso + Penet.Cupons × peso + Penet.SubCateg × peso) / 100
 *
 * CLASSIFICAÇÃO por percentil (ordenado por SCORE DESC):
 * - N (Notável): top X% dos itens
 * - SP (Sensível a Preço): próximos Y%
 * - R (Regular): restante
 *
 * IMPORTANTE: Quando "todas as seções" é selecionado, cada seção é processada
 * independentemente (ranking e classificação por seção), igual ao Intersolid.
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export interface RelevanciaFilters {
  dataInicio: string;       // DD/MM/YYYY
  dataFim: string;          // DD/MM/YYYY
  codLoja: number;
  codSecao?: number;
  codGrupo?: number;
  codSubGrupo?: number;
  pesoVendasRS: number;     // ex: 25
  pesoVendasQtde: number;   // ex: 25
  pesoPenetCupons: number;  // ex: 30
  pesoPenetSubCateg: number;// ex: 20
  pctNotavel: number;       // ex: 2
  pctSensivel: number;      // ex: 7
  subcategoriaPor: 'grupo' | 'subgrupo';
}

interface ResolvedColumns {
  schema: string;
  tabProduto: string;
  tabProdutoLoja: string;
  tabProdutoPdv: string;
  colCodProduto: string;
  colDesProduto: string;
  colCodBarras: string;
  colCodSecaoProd: string;
  colCodGrupoProd: string;
  colCodSubgrupoProd: string;
  colCodProdutoLoja: string;
  colCodLojaLoja: string;
  colCodProdutoPdv: string;
  colCodLojaPdv: string;
  colDtaVenda: string;
  colQtdVenda: string;
  colValTotal: string;
  colNumCupom: string;
  colSubcateg: string;
  hasRelevanciaCol: boolean;
  colTipoRelevancia: string;
  colPrecoVenda: string;
  colPesquisaMedia: string;
  hasPesquisaMedia: boolean;
}

export class RelevanciaService {

  /**
   * Resolve todas as colunas e tabelas (feito uma vez)
   */
  private static async resolveColumns(filters: RelevanciaFilters): Promise<ResolvedColumns> {
    const schema = await MappingService.getSchema();

    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;

    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');

    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');

    const colTipoRelevancia = 'TIPO_RELEVANCIA';
    let hasRelevanciaCol = true;
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colTipoRelevancia}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length === 0) hasRelevanciaCol = false;
    } catch (e) {
      hasRelevanciaCol = false;
    }

    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colDtaVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colQtdVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colValTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colNumCupom = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom');

    const colSubcateg = filters.subcategoriaPor === 'subgrupo' ? colCodSubgrupoProd : colCodGrupoProd;

    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    let colPesquisaMedia = 'VAL_PESQUISA_MEDIA';
    let hasPesquisaMedia = true;
    try {
      colPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media');
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkPM = await OracleService.query<any>(`SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colPesquisaMedia.replace(/"/g, '')}'`);
      if (checkPM.length === 0) hasPesquisaMedia = false;
    } catch (e) {
      hasPesquisaMedia = false;
    }

    return {
      schema, tabProduto, tabProdutoLoja, tabProdutoPdv,
      colCodProduto, colDesProduto, colCodBarras, colCodSecaoProd, colCodGrupoProd, colCodSubgrupoProd,
      colCodProdutoLoja, colCodLojaLoja,
      colCodProdutoPdv, colCodLojaPdv, colDtaVenda, colQtdVenda, colValTotal, colNumCupom,
      colSubcateg, hasRelevanciaCol, colTipoRelevancia,
      colPrecoVenda, colPesquisaMedia, hasPesquisaMedia,
    };
  }

  /**
   * Processa relevância de UMA seção (score + classificação)
   * Base: TAB_PRODUTO_LOJA (todos os produtos ativos da loja/seção)
   * LEFT JOIN com vendas do período - produtos sem venda ficam com score 0
   */
  private static async processarSecao(
    ctx: ResolvedColumns,
    filters: RelevanciaFilters,
    codSecao: number
  ): Promise<any[]> {
    const filtroSecao = `AND p.${ctx.colCodSecaoProd} = :codSecao`;
    let filtroGrupo = '';
    let filtroSubgrupo = '';
    const params: any = {
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
      codLoja: filters.codLoja,
      codSecao,
    };

    if (filters.codGrupo) {
      filtroGrupo = `AND p.${ctx.colCodGrupoProd} = :codGrupo`;
      params.codGrupo = filters.codGrupo;
    }
    if (filters.codSubGrupo) {
      filtroSubgrupo = `AND p.${ctx.colCodSubgrupoProd} = :codSubGrupo`;
      params.codSubGrupo = filters.codSubGrupo;
    }

    // JOIN com TAB_PRODUTO_LOJA (preço, concorrente, relevância)
    const joinProdutoLoja = `LEFT JOIN ${ctx.tabProdutoLoja} pl ON pv.${ctx.colCodProdutoPdv} = pl.${ctx.colCodProdutoLoja} AND pl.${ctx.colCodLojaLoja} = :codLoja`;
    const selectRelevIntersolid = ctx.hasRelevanciaCol
      ? `, MAX(pl.${ctx.colTipoRelevancia}) AS TIPO_RELEVANCIA_INTERSOLID`
      : '';
    const selectPreco = `, MAX(pl.${ctx.colPrecoVenda}) AS PRECO_VENDA`;
    const selectConcorrente = ctx.hasPesquisaMedia
      ? `, MAX(NVL(pl.${ctx.colPesquisaMedia}, 0)) AS CONC_BARATO`
      : '';

    // QUERY 1: Vendas por produto (base = produtos com vendas no período)
    const sqlProdutos = `
      SELECT
        pv.${ctx.colCodProdutoPdv} AS COD_PRODUTO,
        p.${ctx.colCodBarras} AS COD_BARRAS,
        p.${ctx.colDesProduto} AS DESCRICAO,
        p.${ctx.colCodSecaoProd} AS COD_SECAO,
        p.${ctx.colCodGrupoProd} AS COD_GRUPO,
        p.${ctx.colCodSubgrupoProd} AS COD_SUBGRUPO,
        SUM(pv.${ctx.colValTotal}) AS VAL_VENDA,
        SUM(pv.${ctx.colQtdVenda}) AS QTD_VENDA,
        COUNT(DISTINCT pv.${ctx.colNumCupom}) AS QTD_CUPONS
        ${selectPreco}
        ${selectConcorrente}
        ${selectRelevIntersolid}
      FROM ${ctx.tabProdutoPdv} pv
      JOIN ${ctx.tabProduto} p ON pv.${ctx.colCodProdutoPdv} = p.${ctx.colCodProduto}
      ${joinProdutoLoja}
      WHERE pv.${ctx.colCodLojaPdv} = :codLoja
        AND pv.${ctx.colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${filtroSecao}
        ${filtroGrupo}
        ${filtroSubgrupo}
      GROUP BY pv.${ctx.colCodProdutoPdv}, p.${ctx.colCodBarras}, p.${ctx.colDesProduto}, p.${ctx.colCodSecaoProd}, p.${ctx.colCodGrupoProd}, p.${ctx.colCodSubgrupoProd}
      HAVING SUM(pv.${ctx.colValTotal}) > 0
    `;

    // QUERY 2: Total cupons da seção (só dos que venderam)
    const sqlTotalCupons = `
      SELECT COUNT(DISTINCT pv.${ctx.colNumCupom}) AS TOTAL_CUPONS
      FROM ${ctx.tabProdutoPdv} pv
      JOIN ${ctx.tabProduto} p ON pv.${ctx.colCodProdutoPdv} = p.${ctx.colCodProduto}
      WHERE pv.${ctx.colCodLojaPdv} = :codLoja
        AND pv.${ctx.colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${filtroSecao}
        ${filtroGrupo}
        ${filtroSubgrupo}
    `;

    // QUERY 3: Cupons por subcategoria
    const sqlCuponsSubcateg = `
      SELECT
        p.${ctx.colSubcateg} AS COD_SUBCATEG,
        COUNT(DISTINCT pv.${ctx.colNumCupom}) AS CUPONS_SUBCATEG
      FROM ${ctx.tabProdutoPdv} pv
      JOIN ${ctx.tabProduto} p ON pv.${ctx.colCodProdutoPdv} = p.${ctx.colCodProduto}
      WHERE pv.${ctx.colCodLojaPdv} = :codLoja
        AND pv.${ctx.colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${filtroSecao}
        ${filtroGrupo}
        ${filtroSubgrupo}
      GROUP BY p.${ctx.colSubcateg}
    `;

    const [produtos, totalCuponsRes, cuponsSubcategRes] = await Promise.all([
      OracleService.query<any>(sqlProdutos, params),
      OracleService.query<any>(sqlTotalCupons, params),
      OracleService.query<any>(sqlCuponsSubcateg, params),
    ]);

    if (produtos.length === 0) return [];

    const totalCupons = Number(totalCuponsRes[0]?.TOTAL_CUPONS) || 1;
    const cuponsSubcategMap: Record<string, number> = {};
    for (const r of cuponsSubcategRes) {
      cuponsSubcategMap[String(r.COD_SUBCATEG)] = Number(r.CUPONS_SUBCATEG) || 1;
    }

    // Totais só dos que venderam (para participação %)
    const totalVendas = produtos.reduce((s: number, r: any) => s + (Number(r.VAL_VENDA) || 0), 0);
    const totalQtde = produtos.reduce((s: number, r: any) => s + (Number(r.QTD_VENDA) || 0), 0);

    // Calcular métricas e score
    const rows = produtos.map((r: any) => {
      const valVenda = Number(r.VAL_VENDA) || 0;
      const qtdVenda = Number(r.QTD_VENDA) || 0;
      const qtdCupons = Number(r.QTD_CUPONS) || 0;

      const subcategKey = filters.subcategoriaPor === 'subgrupo'
        ? String(r.COD_SUBGRUPO)
        : String(r.COD_GRUPO);
      const cuponsSubcateg = cuponsSubcategMap[subcategKey] || 1;

      const partVendasRS = totalVendas > 0 ? (valVenda / totalVendas) * 100 : 0;
      const partVendasQtde = totalQtde > 0 ? (qtdVenda / totalQtde) * 100 : 0;
      const penetCupons = totalCupons > 0 ? (qtdCupons / totalCupons) * 100 : 0;
      const penetSubcategBruto = cuponsSubcateg > 0 ? (qtdCupons / cuponsSubcateg) * 100 : 0;
      // Cap SubCateg: evita inflação em grupos pequenos (min do bruto vs PC * 5)
      const penetSubcateg = filters.pesoPenetSubCateg > 0
        ? Math.min(penetSubcategBruto, penetCupons * 5)
        : 0;

      const score = (
        partVendasRS * filters.pesoVendasRS +
        partVendasQtde * filters.pesoVendasQtde +
        penetCupons * filters.pesoPenetCupons +
        penetSubcateg * filters.pesoPenetSubCateg
      ) / 100;

      // Mapear TIPO_RELEVANCIA do Intersolid: 0=N, 1=SP, 2=R, -1=não classificado
      const tipoRelev = r.TIPO_RELEVANCIA_INTERSOLID;
      let curvaAtual = '-';
      if (tipoRelev === 0) curvaAtual = 'N';
      else if (tipoRelev === 1) curvaAtual = 'SP';
      else if (tipoRelev === 2) curvaAtual = 'R';

      return {
        COD_PRODUTO: r.COD_PRODUTO,
        COD_BARRAS: r.COD_BARRAS || '',
        DESCRICAO: r.DESCRICAO || '',
        COD_SECAO: r.COD_SECAO,
        COD_GRUPO: r.COD_GRUPO,
        COD_SUBGRUPO: r.COD_SUBGRUPO,
        VAL_VENDA: valVenda,
        QTD_VENDA: qtdVenda,
        QTD_CUPONS: qtdCupons,
        PART_VENDAS_RS: partVendasRS,
        PART_VENDAS_QTDE: partVendasQtde,
        PENET_CUPONS: penetCupons,
        PENET_SUBCATEG: penetSubcateg,
        SCORE: score,
        CURVA_ATUAL: curvaAtual,
        PRECO_VENDA: Number(r.PRECO_VENDA) || 0,
        CONC_BARATO: Number(r.CONC_BARATO) || 0,
      };
    });

    // Ordenar por SCORE DESC dentro da seção
    rows.sort((a: any, b: any) => b.SCORE - a.SCORE);

    // Classificar por percentil DENTRO DA SEÇÃO
    const totalItens = rows.length;
    const limiteN = Math.max(1, Math.round(totalItens * filters.pctNotavel / 100));
    const limiteSP = Math.max(limiteN + 1, Math.round(totalItens * (filters.pctNotavel + filters.pctSensivel) / 100));

    rows.forEach((r: any, idx: number) => {
      if (idx < limiteN) {
        r.RELEVANCIA = 'N';
      } else if (idx < limiteSP) {
        r.RELEVANCIA = 'SP';
      } else {
        r.RELEVANCIA = 'R';
      }
    });

    return rows;
  }

  /**
   * Processa relevância dos produtos
   * Se codSecao é fornecido: processa só aquela seção
   * Se não (todas as seções): processa CADA seção separadamente e junta
   */
  static async processar(filters: RelevanciaFilters): Promise<{ data: any[]; totais: any }> {
    const ctx = await this.resolveColumns(filters);

    let allRows: any[] = [];

    if (filters.codSecao) {
      // Seção específica
      console.log(`[Relevância] Processando seção ${filters.codSecao}: Loja=${filters.codLoja}, Período=${filters.dataInicio} a ${filters.dataFim}`);
      allRows = await this.processarSecao(ctx, filters, filters.codSecao);
      console.log(`[Relevância] Seção ${filters.codSecao}: ${allRows.length} produtos`);
    } else {
      // Todas as seções - buscar seções com vendas e processar cada uma
      console.log(`[Relevância] Processando TODAS as seções: Loja=${filters.codLoja}, Período=${filters.dataInicio} a ${filters.dataFim}`);

      const sqlSecoes = `
        SELECT DISTINCT p.${ctx.colCodSecaoProd} AS COD_SECAO
        FROM ${ctx.tabProdutoPdv} pv
        JOIN ${ctx.tabProduto} p ON pv.${ctx.colCodProdutoPdv} = p.${ctx.colCodProduto}
        WHERE pv.${ctx.colCodLojaPdv} = :codLoja
          AND pv.${ctx.colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        ORDER BY p.${ctx.colCodSecaoProd}
      `;
      const secoesRes = await OracleService.query<any>(sqlSecoes, {
        codLoja: filters.codLoja,
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
      });

      const secoes = secoesRes.map((r: any) => Number(r.COD_SECAO)).filter((s: number) => s > 0);
      console.log(`[Relevância] ${secoes.length} seções encontradas: ${secoes.join(', ')}`);

      // Processar cada seção separadamente (classificação independente por seção)
      for (const codSecao of secoes) {
        const rows = await this.processarSecao(ctx, filters, codSecao);
        console.log(`[Relevância] Seção ${codSecao}: ${rows.length} produtos (N=${rows.filter((r: any) => r.RELEVANCIA === 'N').length}, SP=${rows.filter((r: any) => r.RELEVANCIA === 'SP').length}, R=${rows.filter((r: any) => r.RELEVANCIA === 'R').length})`);
        allRows = allRows.concat(rows);
      }
    }

    if (allRows.length === 0) {
      return {
        data: [],
        totais: { totalItens: 0, totalVendas: 0, totalCupons: 0, notaveis: 0, sensiveis: 0, regulares: 0 }
      };
    }

    // Ordenar resultado final por SCORE DESC
    allRows.sort((a: any, b: any) => b.SCORE - a.SCORE);

    // Contagens globais
    const totalItens = allRows.length;
    const totalVendas = allRows.reduce((s: number, r: any) => s + r.VAL_VENDA, 0);
    const totalCuponsSet = new Set(allRows.map((r: any) => r.QTD_CUPONS)); // Aproximação
    const notaveis = allRows.filter((r: any) => r.RELEVANCIA === 'N').length;
    const sensiveis = allRows.filter((r: any) => r.RELEVANCIA === 'SP').length;
    const regulares = allRows.filter((r: any) => r.RELEVANCIA === 'R').length;

    console.log(`[Relevância] Total: ${totalItens} itens, N=${notaveis}, SP=${sensiveis}, R=${regulares}`);

    return {
      data: allRows,
      totais: {
        totalItens,
        totalVendas,
        totalCupons: 0, // Não somamos cupons entre seções (duplos)
        notaveis,
        sensiveis,
        regulares,
      }
    };
  }
}
