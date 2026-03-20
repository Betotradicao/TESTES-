/**
 * Margens por Categoria Service
 * Busca dados de produtos com margens, precos, estoque e classificacao mercadologica
 * Fonte: Oracle Intersolid - TAB_PRODUTO + TAB_PRODUTO_LOJA + TAB_SECAO/GRUPO/SUBGRUPO
 *
 * Colunas calculadas:
 * - venda_media_mes: venda_media * 30
 * - dias_sem_venda: TRUNC(SYSDATE) - data_ultima_venda
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export class MargensCategoriaService {

  /**
   * Busca produtos com margens, precos, estoque e classificacao
   */
  static async getProdutos(
    codLoja: number,
    codSecao?: number,
    codGrupo?: number,
    codSubGrupo?: number,
    codSegmento?: number
  ): Promise<any[]> {
    const schema = await MappingService.getSchema();

    // Resolver tabelas
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;

    // Resolver colunas TAB_PRODUTO
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');

    let colCodSegmentoProd = 'COD_SEGMENTO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_segmento');
      if (mapped) colCodSegmentoProd = mapped;
    } catch (e) { /* usa default */ }

    // Resolver colunas TAB_PRODUTO_LOJA
    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
    const colEstoqueAtual = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const colVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

    let colMargem = 'VAL_MARGEM';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
      if (mapped) colMargem = mapped;
    } catch (e) { /* usa default */ }

    let colTipoRelevancia = 'TIPO_RELEVANCIA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'tipo_relevancia');
      if (mapped) colTipoRelevancia = mapped;
    } catch (e) { /* usa default */ }

    let colCobertura = 'QTD_COBERTURA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura');
      if (mapped) colCobertura = mapped;
    } catch (e) { /* usa default */ }

    let colDtaUltCompra = 'DTA_ULT_COMPRA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_compra');
      if (mapped) colDtaUltCompra = mapped;
    } catch (e) { /* usa default */ }

    let colDtaUltVenda = 'DTA_ULT_MOV_VENDA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_venda');
      if (mapped) colDtaUltVenda = mapped;
    } catch (e) { /* usa default */ }

    // Resolver colunas TAB_SECAO
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

    // Resolver colunas TAB_GRUPO
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    let colCodSecaoGrupo = colCodSecao;
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao');
      if (mapped) colCodSecaoGrupo = mapped;
    } catch (e) { /* usa default da secao */ }

    // Resolver colunas TAB_SUBGRUPO
    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    let colCodSecaoSub = colCodSecao;
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao');
      if (mapped) colCodSecaoSub = mapped;
    } catch (e) { /* usa default */ }
    let colCodGrupoSub = colCodGrupo;
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo');
      if (mapped) colCodGrupoSub = mapped;
    } catch (e) { /* usa default */ }

    // Filtros dinamicos
    let filtroSecao = '';
    let filtroGrupo = '';
    let filtroSubgrupo = '';
    let filtroSegmento = '';
    const params: any = { codLoja };

    if (codSecao) {
      filtroSecao = `AND p.${colCodSecaoProd} = :codSecao`;
      params.codSecao = codSecao;
    }
    if (codGrupo) {
      filtroGrupo = `AND p.${colCodGrupoProd} = :codGrupo`;
      params.codGrupo = codGrupo;
    }
    if (codSubGrupo) {
      filtroSubgrupo = `AND p.${colCodSubgrupoProd} = :codSubGrupo`;
      params.codSubGrupo = codSubGrupo;
    }
    if (codSegmento) {
      filtroSegmento = `AND p.${colCodSegmentoProd} = :codSegmento`;
      params.codSegmento = codSegmento;
    }

    const sql = `
      SELECT
        p.${colCodProduto} AS COD_PRODUTO,
        p.${colDesProduto} AS DESCRICAO,
        p.${colCodBarras} AS COD_BARRAS,
        p.${colCodSecaoProd} AS COD_SECAO,
        p.${colCodGrupoProd} AS COD_GRUPO,
        p.${colCodSubgrupoProd} AS COD_SUBGRUPO,
        p.${colCodSegmentoProd} AS COD_SEGMENTO,
        sec.${colDesSecao} AS DES_SECAO,
        grp.${colDesGrupo} AS DES_GRUPO,
        sg.${colDesSubGrupo} AS DES_SUBGRUPO,
        NVL(pl.${colTipoRelevancia}, ' ') AS RELEVANCIA,
        NVL(pl.${colCurva}, ' ') AS CURVA,
        NVL(pl.${colVendaMedia}, 0) AS VENDA_MEDIA_DIA,
        NVL(pl.${colVendaMedia}, 0) * 30 AS VENDA_MEDIA_MES,
        NVL(pl.${colEstoqueAtual}, 0) AS ESTOQUE_ATUAL,
        NVL(pl.${colCobertura}, 0) AS COBERTURA,
        pl.${colDtaUltCompra} AS DATA_ULTIMA_COMPRA,
        pl.${colDtaUltVenda} AS DATA_ULTIMA_VENDA,
        CASE
          WHEN pl.${colDtaUltVenda} IS NOT NULL
          THEN TRUNC(SYSDATE) - TRUNC(pl.${colDtaUltVenda})
          ELSE NULL
        END AS DIAS_SEM_VENDA,
        NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
        NVL(pl.${colPrecoCusto}, 0) AS PRECO_CUSTO,
        NVL(pl.${colMargem}, 0) AS MARGEM
      FROM ${tabProduto} p
      JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${colCodProdutoLoja}
        AND pl.${colCodLojaLoja} = :codLoja
      LEFT JOIN ${tabSecao} sec ON p.${colCodSecaoProd} = sec.${colCodSecao}
      LEFT JOIN ${tabGrupo} grp ON p.${colCodSecaoProd} = grp.${colCodSecaoGrupo}
        AND p.${colCodGrupoProd} = grp.${colCodGrupo}
      LEFT JOIN ${tabSubgrupo} sg ON p.${colCodSecaoProd} = sg.${colCodSecaoSub}
        AND p.${colCodGrupoProd} = sg.${colCodGrupoSub}
        AND p.${colCodSubgrupoProd} = sg.${colCodSubGrupo}
      WHERE 1=1
        ${filtroSecao}
        ${filtroGrupo}
        ${filtroSubgrupo}
        ${filtroSegmento}
      ORDER BY p.${colDesProduto}
    `;

    console.log(`[MargensCategoria] Buscando produtos: Loja=${codLoja}, Secao=${codSecao || 'todas'}, Grupo=${codGrupo || 'todos'}, SubGrupo=${codSubGrupo || 'todos'}`);

    const rows = await OracleService.query<any>(sql, params);
    console.log(`[MargensCategoria] ${rows.length} produtos encontrados`);

    return rows;
  }

  /**
   * Busca secoes disponiveis (mesma logica de compra-venda)
   */
  static async getSecoes(): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

    let colFlgInativo = 'FLG_INATIVO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SECAO', 'flag_inativo');
      if (mapped) colFlgInativo = mapped;
    } catch (e) { /* usa default */ }

    const sql = `
      SELECT ${colCodSecao} AS COD_SECAO, ${colDesSecao} AS DES_SECAO
      FROM ${tabSecao}
      WHERE ${colFlgInativo} IS NULL OR ${colFlgInativo} = 'N'
      ORDER BY ${colDesSecao}
    `;

    return OracleService.query(sql);
  }

  /**
   * Busca grupos disponiveis (mesma logica de compra-venda)
   */
  static async getGrupos(codSecao?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;

    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const colCodSecaoGrupo = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');

    let sql = `
      SELECT DISTINCT ${colCodGrupo} AS COD_GRUPO, ${colDesGrupo} AS DES_GRUPO
      FROM ${tabGrupo}
      WHERE 1=1
    `;

    const params: any = {};

    if (codSecao) {
      sql += ` AND ${colCodSecaoGrupo} = :codSecao`;
      params.codSecao = codSecao;
    }

    sql += ` ORDER BY ${colDesGrupo}`;

    return OracleService.query(sql, params);
  }

  /**
   * Busca subgrupos disponiveis (mesma logica de compra-venda)
   */
  static async getSubGrupos(codSecao?: number, codGrupo?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;

    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    const colCodSecaoSG = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colCodGrupoSG = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');

    let sql = `
      SELECT DISTINCT ${colCodSubGrupo} AS COD_SUB_GRUPO, ${colDesSubGrupo} AS DES_SUB_GRUPO
      FROM ${tabSubgrupo}
      WHERE 1=1
    `;

    const params: any = {};

    if (codSecao) {
      sql += ` AND ${colCodSecaoSG} = :codSecao`;
      params.codSecao = codSecao;
    }

    if (codGrupo) {
      sql += ` AND ${colCodGrupoSG} = :codGrupo`;
      params.codGrupo = codGrupo;
    }

    sql += ` ORDER BY ${colDesSubGrupo}`;

    return OracleService.query(sql, params);
  }

  /**
   * Busca segmentos filtrados por secao/grupo/subgrupo (mesma logica de ponderacao)
   */
  static async getSegmentos(codSecao?: number, codGrupo?: number, codSubGrupo?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');

    // Resolver TAB_SEGMENTO dinamicamente
    let tabSegmento = `${schema}.TAB_SEGMENTO`;
    try {
      tabSegmento = `${schema}.${await MappingService.getRealTableName('TAB_SEGMENTO')}`;
    } catch (e) { /* usa default */ }

    let colCodSegmento = 'COD_SEGMENTO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SEGMENTO', 'codigo_segmento');
      if (mapped) colCodSegmento = mapped;
    } catch (e) { /* usa default */ }

    let colDesSegmento = 'DES_SEGMENTO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SEGMENTO', 'descricao_segmento');
      if (mapped) colDesSegmento = mapped;
    } catch (e) { /* usa default */ }

    let colCodSegmentoProd = 'COD_SEGMENTO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_segmento');
      if (mapped) colCodSegmentoProd = mapped;
    } catch (e) { /* usa default */ }

    if (!codSecao) {
      // Sem filtro: retorna todos
      return OracleService.query(`SELECT ${colCodSegmento} AS COD_SEGMENTO, ${colDesSegmento} AS DES_SEGMENTO FROM ${tabSegmento} ORDER BY ${colDesSegmento}`);
    }

    let filtros = `WHERE p.${colCodSecao} = :codSecao AND p.${colCodSegmentoProd} IS NOT NULL`;
    const params: any = { codSecao };
    if (codGrupo) { filtros += ` AND p.${colCodGrupo} = :codGrupo`; params.codGrupo = codGrupo; }
    if (codSubGrupo) { filtros += ` AND p.${colCodSubgrupo} = :codSubGrupo`; params.codSubGrupo = codSubGrupo; }

    const sql = `
      SELECT DISTINCT s.${colCodSegmento} AS COD_SEGMENTO, s.${colDesSegmento} AS DES_SEGMENTO
      FROM ${tabProduto} p
      JOIN ${tabSegmento} s ON p.${colCodSegmentoProd} = s.${colCodSegmento}
      ${filtros}
      ORDER BY s.${colDesSegmento}
    `;
    return OracleService.query(sql, params);
  }
}
