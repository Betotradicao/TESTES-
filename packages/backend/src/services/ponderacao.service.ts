/**
 * Análise de Ponderação Service
 * Calcula relevância de produtos baseado em pesos de Faturamento, Volume e Contribuição
 * Fonte: Oracle Intersolid - TAB_PRODUTO_PDV + TAB_PRODUTO_LOJA + TAB_PRODUTO
 *
 * FÓRMULAS:
 * - Contribuição = Venda - Custo - Impostos
 * - Part.%Fat. = Venda do Produto / Total Vendas * 100
 * - Part.%Vol. = Qtd do Produto / Total Qtd * 100
 * - Part.%Cont. = Contribuição do Produto / Total Contribuição * 100
 * - Ponderação = (Part.%Fat * PesoFat + Part.%Vol * PesoVol + Part.%Cont * PesoCont) / 100
 * - Acumulado = Soma acumulada de Ponderação (ordenado DESC)
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export interface PonderacaoFilters {
  dataInicio: string;     // DD/MM/YYYY
  dataFim: string;        // DD/MM/YYYY
  codLoja: number;
  codSecao: number;
  codGrupo?: number;
  codSubGrupo?: number;
  codSegmento?: number;
  pesoFat: number;        // ex: 35
  pesoVol: number;        // ex: 35
  pesoCont: number;       // ex: 30
  diagnostico: number;    // ex: 95
}

export interface PonderacaoRow {
  COD_PRODUTO: string;
  COD_BARRAS: string;
  DESCRICAO: string;
  SEGMENTO: string;
  GRAMAGEM: number;
  QTD_TOTAL: number;
  QTD_KG_LT: number;
  QTD_CUPONS: number;
  VAL_VENDA: number;
  VAL_PROMO: number;
  VD_MEDIA: number;
  VD_KG_LT: number;
  PAPEL: string;
  QTD_EST_ATUAL: number;
  PRECO_VENDA: number;
  VAL_CUSTO: number;
  CST_MEDIO: number;
  CST_KG_LT: number;
  MARGEM_COMERCIAL: number;
  MARGEM_PCT: number;
  IMPOSTOS: number;
  CONTRIBUICAO: number;
  LB_UNIT: number;
  LB_KG_LT: number;
  PART_FAT: number;
  PART_VOL: number;
  PART_CONT: number;
  PESO_FAT: number;
  PESO_VOL: number;
  PESO_CONT: number;
  PONDERACAO: number;
  ACUMULADO: number;
  TICKET_MEDIO: number;
  CURVA: string;
  DTA_CADASTRO: string;
  DTA_ULTIMA_VENDA: string;
  FORA_LINHA: string;
  FORA_MIX: string;
  MARGEM_META: number;
  CONC_BARATO: number;
  CONC_NOME: string;
  COR: 'verde' | 'vermelho';
}

export class PonderacaoService {

  /**
   * Busca dados de ponderação de produtos
   */
  static async getDados(filters: PonderacaoFilters): Promise<{ rows: PonderacaoRow[]; totais: any }> {
    const schema = await MappingService.getSchema();

    // Resolver tabelas
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;

    // Resolver colunas TAB_PRODUTO
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');

    // Resolver colunas TAB_PRODUTO_LOJA
    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
    const colEstoqueAtual = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const colVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

    // Fora Linha e Fora Mix (Inativo)
    let colForaLinha = 'FORA_LINHA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'fora_linha');
      if (mapped) colForaLinha = mapped;
    } catch (e) { /* usa default */ }

    let colInativo = 'INATIVO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
      if (mapped) colInativo = mapped;
    } catch (e) { /* usa default */ }

    // Data de cadastro do produto
    let colDtaCadastro = 'DTA_CADASTRO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'data_cadastro');
      if (mapped) colDtaCadastro = mapped;
    } catch (e) { /* usa default */ }

    // Resolver colunas TAB_PRODUTO_PDV
    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colDtaVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colQtdVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colValTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colFlagOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');
    const colNumCupom = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom');

    // Colunas que podem não existir em todos os clientes - verificar com segurança
    let colImpostoDebito = 'VAL_IMPOSTO_DEBITO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito');
      if (mapped) colImpostoDebito = mapped;
    } catch (e) { /* usa default */ }

    let colCustoMedio = 'CUSTO_MEDIO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'custo_medio');
      if (mapped) colCustoMedio = mapped;
    } catch (e) { /* usa default */ }

    // Resolver TAB_PRODUTO extras (peso, segmento)
    let colValPeso = 'VAL_PESO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'peso');
      if (mapped) colValPeso = mapped;
    } catch (e) { /* usa default */ }

    let colCodSegmentoProd = 'COD_SEGMENTO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_segmento');
      if (mapped) colCodSegmentoProd = mapped;
    } catch (e) { /* usa default */ }

    // Resolver TAB_PRODUTO_LOJA pesos de ponderação
    let colPesoFat = 'PER_PESO_FAT';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'peso_faturamento');
      if (mapped) colPesoFat = mapped;
    } catch (e) { /* usa default */ }

    let colPesoVol = 'PER_PESO_VOL';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'peso_volume');
      if (mapped) colPesoVol = mapped;
    } catch (e) { /* usa default */ }

    let colPesoCont = 'PER_PESO_CONT';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'peso_contribuicao');
      if (mapped) colPesoCont = mapped;
    } catch (e) { /* usa default */ }

    // Resolver TAB_SEGMENTO
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

    // Margem Meta (referência)
    let colMargem = 'VAL_MARGEM';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
      if (mapped) colMargem = mapped;
    } catch (e) { /* usa default */ }

    // Pesquisa de preço do concorrente
    let colPesquisaMedia = 'VAL_PESQUISA_MEDIA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media');
      if (mapped) colPesquisaMedia = mapped;
    } catch (e) { /* usa default */ }

    let colPesquisaConcorrente = 'DES_PESQUISA_CONCORRENTE';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_concorrente');
      if (mapped) colPesquisaConcorrente = mapped;
    } catch (e) { /* usa default */ }

    // Filtros dinâmicos
    let filtroGrupo = '';
    let filtroSubgrupo = '';
    let filtroSegmento = '';
    const params: any = {
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
      codLoja: filters.codLoja,
      codSecao: filters.codSecao,
    };

    if (filters.codGrupo) {
      filtroGrupo = `AND p.${colCodGrupoProd} = :codGrupo`;
      params.codGrupo = filters.codGrupo;
    }
    if (filters.codSubGrupo) {
      filtroSubgrupo = `AND p.${colCodSubgrupoProd} = :codSubGrupo`;
      params.codSubGrupo = filters.codSubGrupo;
    }
    if (filters.codSegmento) {
      filtroSegmento = `AND p.${colCodSegmentoProd} = :codSegmento`;
      params.codSegmento = filters.codSegmento;
    }

    // Verificar se coluna de imposto existe no Oracle (pode não existir)
    let impostoSelect = '0 AS VAL_IMPOSTOS';
    let hasImpostoCol = true;
    try {
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${(await MappingService.getRealTableName('TAB_PRODUTO_PDV')).replace(/"/g, '')}' AND COLUMN_NAME = '${colImpostoDebito}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length > 0) {
        impostoSelect = `SUM(NVL(pv.${colImpostoDebito}, 0)) AS VAL_IMPOSTOS`;
      } else {
        hasImpostoCol = false;
        impostoSelect = '0 AS VAL_IMPOSTOS';
        console.log(`[Ponderação] Coluna ${colImpostoDebito} não encontrada em TAB_PRODUTO_PDV, usando 0 para impostos`);
      }
    } catch (e) {
      hasImpostoCol = false;
      console.log(`[Ponderação] Erro verificando coluna imposto, usando 0`);
    }

    // Verificar colunas de pesquisa concorrente (podem não existir)
    let pesquisaMediaSelect = '0 AS VAL_PESQUISA_MEDIA';
    let pesquisaConcorrenteSelect = "NULL AS DES_PESQUISA_CONCORRENTE";
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colPesquisaMedia}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length > 0) {
        pesquisaMediaSelect = `NVL(pl.${colPesquisaMedia}, 0) AS VAL_PESQUISA_MEDIA`;
      } else {
        console.log(`[Ponderação] Coluna ${colPesquisaMedia} não encontrada em TAB_PRODUTO_LOJA`);
      }
      const checkSql2 = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colPesquisaConcorrente}'`;
      const checkRes2 = await OracleService.query<any>(checkSql2);
      if (checkRes2.length > 0) {
        pesquisaConcorrenteSelect = `pl.${colPesquisaConcorrente} AS DES_PESQUISA_CONCORRENTE`;
      } else {
        console.log(`[Ponderação] Coluna ${colPesquisaConcorrente} não encontrada em TAB_PRODUTO_LOJA`);
      }
    } catch (e) {
      console.log(`[Ponderação] Erro verificando colunas de pesquisa concorrente`);
    }

    // Verificar coluna CUSTO_MEDIO
    let custoMedioExpr = `NVL(pl.${colPrecoCusto}, 0)`;
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${colCustoMedio}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length > 0) {
        custoMedioExpr = `NVL(pl.${colCustoMedio}, 0)`;
      } else {
        console.log(`[Ponderação] Coluna ${colCustoMedio} não encontrada em TAB_PRODUTO_LOJA, usando ${colPrecoCusto}`);
      }
    } catch (e) {
      console.log(`[Ponderação] Erro verificando coluna custo médio, usando ${colPrecoCusto}`);
    }

    const sql = `
      WITH vendas AS (
        SELECT
          pv.${colCodProdutoPdv} AS COD_PRODUTO,
          SUM(pv.${colQtdVenda}) AS QTD_TOTAL,
          SUM(pv.${colValTotal}) AS VAL_VENDA,
          SUM(CASE WHEN NVL(pv.${colFlagOferta}, 'N') = 'S' THEN pv.${colValTotal} ELSE 0 END) AS VAL_PROMO,
          COUNT(DISTINCT pv.${colNumCupom}) AS QTD_CUPONS,
          SUM(NVL(pv.${colValCustoRep}, 0) * pv.${colQtdVenda}) AS VAL_CUSTO,
          ${impostoSelect},
          MAX(pv.${colDtaVenda}) AS DTA_ULTIMA_VENDA
        FROM ${tabProdutoPdv} pv
        JOIN ${tabProduto} p ON pv.${colCodProdutoPdv} = p.${colCodProduto}
        WHERE pv.${colCodLojaPdv} = :codLoja
          AND pv.${colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND p.${colCodSecaoProd} = :codSecao
          ${filtroGrupo}
          ${filtroSubgrupo}
          ${filtroSegmento}
        GROUP BY pv.${colCodProdutoPdv}
        HAVING SUM(pv.${colValTotal}) > 0
      ),
      cupons_filtrados AS (
        SELECT DISTINCT pv.${colCodProdutoPdv} AS COD_PRODUTO, pv.${colNumCupom} AS NUM_CUPOM
        FROM ${tabProdutoPdv} pv
        JOIN ${tabProduto} p ON pv.${colCodProdutoPdv} = p.${colCodProduto}
        WHERE pv.${colCodLojaPdv} = :codLoja
          AND pv.${colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND p.${colCodSecaoProd} = :codSecao
          ${filtroGrupo}
          ${filtroSubgrupo}
          ${filtroSegmento}
      ),
      cupom_totais AS (
        SELECT cf.NUM_CUPOM, SUM(pv2.${colValTotal}) AS TOTAL_CUPOM
        FROM (SELECT DISTINCT NUM_CUPOM FROM cupons_filtrados) cf
        JOIN ${tabProdutoPdv} pv2 ON cf.NUM_CUPOM = pv2.${colNumCupom}
          AND pv2.${colCodLojaPdv} = :codLoja
          AND pv2.${colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        GROUP BY cf.NUM_CUPOM
      ),
      ticket_produto AS (
        SELECT cf.COD_PRODUTO, AVG(ct.TOTAL_CUPOM) AS TICKET_MEDIO
        FROM cupons_filtrados cf
        JOIN cupom_totais ct ON cf.NUM_CUPOM = ct.NUM_CUPOM
        GROUP BY cf.COD_PRODUTO
      )
      SELECT
        p.${colCodProduto} AS COD_PRODUTO,
        p.${colCodBarras} AS COD_BARRAS,
        p.${colDesProduto} AS DESCRICAO,
        seg.${colDesSegmento} AS SEGMENTO,
        NVL(p.${colValPeso}, 1) AS GRAMAGEM,
        v.QTD_TOTAL,
        v.QTD_TOTAL * NVL(p.${colValPeso}, 1) AS QTD_KG_LT,
        v.QTD_CUPONS,
        NVL(tk.TICKET_MEDIO, 0) AS TICKET_MEDIO,
        v.VAL_VENDA,
        v.VAL_PROMO,
        NVL(pl.${colVendaMedia}, 0) AS VD_MEDIA,
        CASE WHEN v.QTD_TOTAL * NVL(p.${colValPeso}, 1) > 0
          THEN v.VAL_VENDA / (v.QTD_TOTAL * NVL(p.${colValPeso}, 1))
          ELSE 0 END AS VD_KG_LT,
        NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
        v.VAL_CUSTO,
        ${custoMedioExpr} AS CST_MEDIO,
        CASE WHEN NVL(p.${colValPeso}, 1) > 0
          THEN ${custoMedioExpr} / NVL(p.${colValPeso}, 1)
          ELSE 0 END AS CST_KG_LT,
        CASE WHEN v.VAL_VENDA > 0
          THEN (v.VAL_VENDA - v.VAL_CUSTO) / v.VAL_VENDA * 100
          ELSE 0 END AS MARGEM_COMERCIAL,
        NVL(pl.${colCurva}, ' ') AS CURVA,
        v.VAL_IMPOSTOS,
        v.VAL_VENDA - v.VAL_CUSTO - v.VAL_IMPOSTOS AS CONTRIBUICAO,
        CASE WHEN v.QTD_TOTAL > 0
          THEN (v.VAL_VENDA - v.VAL_CUSTO - v.VAL_IMPOSTOS) / v.QTD_TOTAL
          ELSE 0 END AS LB_UNIT,
        CASE WHEN v.QTD_TOTAL * NVL(p.${colValPeso}, 1) > 0
          THEN (v.VAL_VENDA - v.VAL_CUSTO - v.VAL_IMPOSTOS) / (v.QTD_TOTAL * NVL(p.${colValPeso}, 1))
          ELSE 0 END AS LB_KG_LT,
        NVL(pl.${colEstoqueAtual}, 0) AS QTD_EST_ATUAL,
        NVL(pl.${colPesoFat}, ${filters.pesoFat}) AS PESO_FAT,
        NVL(pl.${colPesoVol}, ${filters.pesoVol}) AS PESO_VOL,
        NVL(pl.${colPesoCont}, ${filters.pesoCont}) AS PESO_CONT,
        TO_CHAR(p.${colDtaCadastro}, 'DD/MM/YYYY') AS DTA_CADASTRO,
        TO_CHAR(v.DTA_ULTIMA_VENDA, 'DD/MM/YYYY') AS DTA_ULTIMA_VENDA,
        NVL(pl.${colForaLinha}, 'N') AS FORA_LINHA,
        NVL(pl.${colInativo}, 'N') AS FORA_MIX,
        NVL(pl.${colMargem}, 0) AS MARGEM_META,
        ${pesquisaMediaSelect},
        ${pesquisaConcorrenteSelect}
      FROM vendas v
      JOIN ${tabProduto} p ON v.COD_PRODUTO = p.${colCodProduto}
      JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${colCodProdutoLoja} AND pl.${colCodLojaLoja} = :codLoja
      LEFT JOIN ticket_produto tk ON v.COD_PRODUTO = tk.COD_PRODUTO
      LEFT JOIN ${tabSegmento} seg ON p.${colCodSegmentoProd} = seg.${colCodSegmento}
      ORDER BY v.VAL_VENDA DESC
    `;

    console.log(`[Ponderação] Buscando dados: Loja=${filters.codLoja}, Seção=${filters.codSecao}, Grupo=${filters.codGrupo || 'todos'}, Período=${filters.dataInicio} a ${filters.dataFim}`);

    const rawRows = await OracleService.query<any>(sql, params);
    console.log(`[Ponderação] ${rawRows.length} produtos encontrados`);

    if (rawRows.length === 0) {
      return { rows: [], totais: { qtdTotal: 0, qtdKgLt: 0, qtdCupons: 0, valVenda: 0, valPromo: 0, valCusto: 0, margem: 0, impostos: 0, contribuicao: 0, ponderacao: 0 } };
    }

    // Calcular totais
    const totalVenda = rawRows.reduce((s, r) => s + (r.VAL_VENDA || 0), 0);
    const totalQtd = rawRows.reduce((s, r) => s + (r.QTD_TOTAL || 0), 0);
    const totalContrib = rawRows.reduce((s, r) => s + (r.CONTRIBUICAO || 0), 0);
    const totalCusto = rawRows.reduce((s, r) => s + (r.VAL_CUSTO || 0), 0);
    const totalImpostos = rawRows.reduce((s, r) => s + (r.VAL_IMPOSTOS || 0), 0);
    const totalQtdKgLt = rawRows.reduce((s, r) => s + (r.QTD_KG_LT || 0), 0);
    const totalQtdCupons = rawRows.reduce((s, r) => s + (r.QTD_CUPONS || 0), 0);
    const totalPromo = rawRows.reduce((s, r) => s + (r.VAL_PROMO || 0), 0);

    // Calcular participação e ponderação para cada produto
    const enrichedRows = rawRows.map((r: any) => {
      const partFat = totalVenda > 0 ? (r.VAL_VENDA / totalVenda) * 100 : 0;
      const partVol = totalQtd > 0 ? (r.QTD_TOTAL / totalQtd) * 100 : 0;
      const partCont = totalContrib > 0 ? (r.CONTRIBUICAO / totalContrib) * 100 : 0;

      // Usar pesos do produto (TAB_PRODUTO_LOJA) ou pesos do filtro
      const pesoFat = r.PESO_FAT || filters.pesoFat;
      const pesoVol = r.PESO_VOL || filters.pesoVol;
      const pesoCont = r.PESO_CONT || filters.pesoCont;

      const ponderacao = (partFat * pesoFat + partVol * pesoVol + partCont * pesoCont) / 100;

      return {
        ...r,
        PART_FAT: partFat,
        PART_VOL: partVol,
        PART_CONT: partCont,
        PONDERACAO: ponderacao,
        MARGEM_PCT: r.MARGEM_COMERCIAL || 0,
      };
    });

    // Ordenar por ponderação DESC
    enrichedRows.sort((a: any, b: any) => b.PONDERACAO - a.PONDERACAO);

    // Calcular acumulado e cor
    let acumulado = 0;
    const totalPonderacao = enrichedRows.reduce((s: number, r: any) => s + r.PONDERACAO, 0);

    const finalRows: PonderacaoRow[] = enrichedRows.map((r: any) => {
      const ponderacaoNorm = totalPonderacao > 0 ? (r.PONDERACAO / totalPonderacao) * 100 : 0;
      acumulado += ponderacaoNorm;

      // Determinar papel: D (Destaque) se acumulado <= 50%, R (Regular) se <= 80%, C (Complementar) se > 80%
      let papel = 'C';
      if (acumulado <= 50) papel = 'D';
      else if (acumulado <= 80) papel = 'R';

      return {
        COD_PRODUTO: r.COD_PRODUTO,
        COD_BARRAS: r.COD_BARRAS || '',
        DESCRICAO: r.DESCRICAO || '',
        SEGMENTO: r.SEGMENTO || '',
        GRAMAGEM: r.GRAMAGEM || 1,
        QTD_TOTAL: r.QTD_TOTAL || 0,
        QTD_KG_LT: r.QTD_KG_LT || 0,
        QTD_CUPONS: r.QTD_CUPONS || 0,
        VAL_VENDA: r.VAL_VENDA || 0,
        VAL_PROMO: r.VAL_PROMO || 0,
        VD_MEDIA: r.VD_MEDIA || 0,
        VD_KG_LT: r.VD_KG_LT || 0,
        PAPEL: papel,
        QTD_EST_ATUAL: r.QTD_EST_ATUAL || 0,
        PRECO_VENDA: r.PRECO_VENDA || 0,
        VAL_CUSTO: r.VAL_CUSTO || 0,
        CST_MEDIO: r.CST_MEDIO || 0,
        CST_KG_LT: r.CST_KG_LT || 0,
        MARGEM_COMERCIAL: r.MARGEM_COMERCIAL || 0,
        MARGEM_PCT: r.MARGEM_PCT || 0,
        IMPOSTOS: r.VAL_IMPOSTOS || 0,
        CONTRIBUICAO: r.CONTRIBUICAO || 0,
        LB_UNIT: r.LB_UNIT || 0,
        LB_KG_LT: r.LB_KG_LT || 0,
        PART_FAT: r.PART_FAT || 0,
        PART_VOL: r.PART_VOL || 0,
        PART_CONT: r.PART_CONT || 0,
        PESO_FAT: r.PESO_FAT || filters.pesoFat,
        PESO_VOL: r.PESO_VOL || filters.pesoVol,
        PESO_CONT: r.PESO_CONT || filters.pesoCont,
        TICKET_MEDIO: r.TICKET_MEDIO || 0,
        CURVA: r.CURVA || '',
        DTA_CADASTRO: r.DTA_CADASTRO || '',
        DTA_ULTIMA_VENDA: r.DTA_ULTIMA_VENDA || '',
        FORA_LINHA: r.FORA_LINHA || 'N',
        FORA_MIX: r.FORA_MIX || 'N',
        MARGEM_META: r.MARGEM_META || 0,
        CONC_BARATO: r.VAL_PESQUISA_MEDIA || 0,
        CONC_NOME: r.DES_PESQUISA_CONCORRENTE || '',
        PONDERACAO: ponderacaoNorm,
        ACUMULADO: acumulado,
        COR: acumulado <= filters.diagnostico ? 'verde' : 'vermelho',
      };
    });

    const margemGeral = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda * 100) : 0;

    return {
      rows: finalRows,
      totais: {
        qtdTotal: totalQtd,
        qtdKgLt: totalQtdKgLt,
        qtdCupons: totalQtdCupons,
        valVenda: totalVenda,
        valPromo: totalPromo,
        valCusto: totalCusto,
        margem: margemGeral,
        impostos: totalImpostos,
        contribuicao: totalContrib,
        ponderacao: 100,
      }
    };
  }

  /**
   * Busca segmentos filtrados por seção/grupo/subgrupo
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

  /**
   * Sugere pesos (Fat/Vol/Cont) por subgrupo com base na análise dos dados de vendas.
   * Lógica: calcula o coeficiente de variação (CV = stddev/avg) de cada métrica entre produtos.
   * A métrica com maior CV (mais diferenciação) recebe mais peso.
   * Também considera: ticket médio alto → mais peso Fat, alta margem → mais peso Cont.
   */
  static async getSugestaoPesos(codLoja: number, dataInicio: string, dataFim: string): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;

    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colDtaVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colQtdVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colValTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');

    // Resolver coluna segmento do produto
    let colCodSegmentoProd = 'COD_SEGMENTO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_segmento');
      if (mapped) colCodSegmentoProd = mapped;
    } catch (e) { /* usa default */ }

    // Query: agregar vendas por produto, depois calcular stats por subgrupo+segmento
    const sql = `
      WITH vendas_produto AS (
        SELECT
          p.${colCodSecaoProd} AS COD_SECAO,
          p.${colCodGrupoProd} AS COD_GRUPO,
          p.${colCodSubgrupoProd} AS COD_SUBGRUPO,
          NVL(p.${colCodSegmentoProd}, 0) AS COD_SEGMENTO,
          pv.${colCodProdutoPdv} AS COD_PRODUTO,
          SUM(pv.${colValTotal}) AS VAL_VENDA,
          SUM(pv.${colQtdVenda}) AS QTD_TOTAL,
          SUM(pv.${colValTotal}) - SUM(NVL(pv.${colValCustoRep}, 0) * pv.${colQtdVenda}) AS CONTRIBUICAO,
          CASE WHEN SUM(pv.${colValTotal}) > 0
            THEN (SUM(pv.${colValTotal}) - SUM(NVL(pv.${colValCustoRep}, 0) * pv.${colQtdVenda})) / SUM(pv.${colValTotal}) * 100
            ELSE 0 END AS MARGEM_PCT
        FROM ${tabProdutoPdv} pv
        JOIN ${tabProduto} p ON pv.${colCodProdutoPdv} = p.${colCodProduto}
        WHERE pv.${colCodLojaPdv} = :codLoja
          AND pv.${colDtaVenda} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        GROUP BY p.${colCodSecaoProd}, p.${colCodGrupoProd}, p.${colCodSubgrupoProd}, NVL(p.${colCodSegmentoProd}, 0), pv.${colCodProdutoPdv}
        HAVING SUM(pv.${colValTotal}) > 0
      )
      SELECT
        vp.COD_SECAO,
        vp.COD_GRUPO,
        vp.COD_SUBGRUPO,
        vp.COD_SEGMENTO,
        COUNT(*) AS QTD_PRODUTOS,
        SUM(vp.VAL_VENDA) AS TOTAL_FAT,
        SUM(vp.QTD_TOTAL) AS TOTAL_VOL,
        SUM(vp.CONTRIBUICAO) AS TOTAL_CONT,
        AVG(vp.VAL_VENDA) AS AVG_FAT,
        AVG(vp.QTD_TOTAL) AS AVG_VOL,
        AVG(vp.CONTRIBUICAO) AS AVG_CONT,
        STDDEV(vp.VAL_VENDA) AS STD_FAT,
        STDDEV(vp.QTD_TOTAL) AS STD_VOL,
        STDDEV(vp.CONTRIBUICAO) AS STD_CONT,
        AVG(vp.MARGEM_PCT) AS AVG_MARGEM_PCT,
        CASE WHEN SUM(vp.QTD_TOTAL) > 0 THEN SUM(vp.VAL_VENDA) / SUM(vp.QTD_TOTAL) ELSE 0 END AS TICKET_MEDIO
      FROM vendas_produto vp
      GROUP BY vp.COD_SECAO, vp.COD_GRUPO, vp.COD_SUBGRUPO, vp.COD_SEGMENTO
      HAVING COUNT(*) >= 1
      ORDER BY vp.COD_SECAO, vp.COD_GRUPO, vp.COD_SUBGRUPO, vp.COD_SEGMENTO
    `;

    const rows = await OracleService.query<any>(sql, { codLoja, dataInicio, dataFim });

    // Calcular sugestão de pesos para cada subgrupo
    return rows.map(r => {
      const avgFat = r.AVG_FAT || 0;
      const avgVol = r.AVG_VOL || 0;
      const avgCont = r.AVG_CONT || 0;
      const stdFat = r.STD_FAT || 0;
      const stdVol = r.STD_VOL || 0;
      const stdCont = r.STD_CONT || 0;

      // Coeficiente de variação (quanto maior, mais a métrica diferencia os produtos)
      const cvFat = avgFat > 0 ? stdFat / avgFat : 0;
      const cvVol = avgVol > 0 ? stdVol / avgVol : 0;
      const cvCont = avgCont > 0 ? Math.abs(stdCont / avgCont) : 0;

      // Normalizar CVs para somar 100%
      const totalCV = cvFat + cvVol + cvCont;
      let pesoFat: number, pesoVol: number, pesoCont: number;

      if (totalCV > 0) {
        pesoFat = Math.round((cvFat / totalCV) * 100);
        pesoVol = Math.round((cvVol / totalCV) * 100);
        pesoCont = 100 - pesoFat - pesoVol; // garante soma = 100
      } else {
        pesoFat = 35; pesoVol = 35; pesoCont = 30;
      }

      // Ajustar mínimo de 10% para cada peso (evitar 0%)
      if (pesoFat < 10) { const diff = 10 - pesoFat; pesoFat = 10; pesoVol -= Math.ceil(diff / 2); pesoCont -= Math.floor(diff / 2); }
      if (pesoVol < 10) { const diff = 10 - pesoVol; pesoVol = 10; pesoFat -= Math.ceil(diff / 2); pesoCont -= Math.floor(diff / 2); }
      if (pesoCont < 10) { const diff = 10 - pesoCont; pesoCont = 10; pesoFat -= Math.ceil(diff / 2); pesoVol -= Math.floor(diff / 2); }

      // Arredondar para múltiplos de 5
      pesoFat = Math.round(pesoFat / 5) * 5;
      pesoVol = Math.round(pesoVol / 5) * 5;
      pesoCont = 100 - pesoFat - pesoVol;

      // Determinar perfil dominante
      let perfil = 'EQUILIBRADO';
      if (pesoFat >= 45) perfil = 'FATURAMENTO';
      else if (pesoVol >= 45) perfil = 'VOLUME';
      else if (pesoCont >= 45) perfil = 'MARGEM';

      return {
        COD_SECAO: r.COD_SECAO,
        COD_GRUPO: r.COD_GRUPO,
        COD_SUBGRUPO: r.COD_SUBGRUPO,
        COD_SEGMENTO: r.COD_SEGMENTO || 0,
        QTD_PRODUTOS: r.QTD_PRODUTOS,
        TOTAL_FAT: r.TOTAL_FAT,
        TOTAL_VOL: r.TOTAL_VOL,
        AVG_MARGEM_PCT: r.AVG_MARGEM_PCT,
        TICKET_MEDIO: r.TICKET_MEDIO,
        PESO_FAT: pesoFat,
        PESO_VOL: pesoVol,
        PESO_CONT: pesoCont,
        PERFIL: perfil,
      };
    });
  }

  /**
   * Busca hierarquia completa Seção > Grupo > Subgrupo
   */
  static async getHierarquia(): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;

    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubgrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');

    // Resolver flag_inativo da seção
    let colFlagInativoSecao = 'FLG_INATIVO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_SECAO', 'flag_inativo');
      if (mapped) colFlagInativoSecao = mapped;
    } catch (e) { /* usa default */ }

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

    // Hierarquia base: Seção > Grupo > Subgrupo
    const sqlBase = `
      SELECT
        s.${colCodSecao} AS COD_SECAO,
        s.${colDesSecao} AS DES_SECAO,
        g.${colCodGrupo} AS COD_GRUPO,
        g.${colDesGrupo} AS DES_GRUPO,
        sg.${colCodSubGrupo} AS COD_SUBGRUPO,
        sg.${colDesSubGrupo} AS DES_SUBGRUPO
      FROM ${tabSubgrupo} sg
      JOIN ${tabGrupo} g ON sg.${colCodSecao} = g.${colCodSecao} AND sg.${colCodGrupo} = g.${colCodGrupo}
      JOIN ${tabSecao} s ON sg.${colCodSecao} = s.${colCodSecao}
      WHERE (s.${colFlagInativoSecao} IS NULL OR s.${colFlagInativoSecao} = 'N')
      ORDER BY s.${colDesSecao}, g.${colDesGrupo}, sg.${colDesSubGrupo}
    `;

    // Segmentos por subgrupo (quais segmentos existem em cada seção/grupo/subgrupo)
    const sqlSegmentos = `
      SELECT DISTINCT
        p.${colCodSecaoProd} AS COD_SECAO,
        p.${colCodGrupoProd} AS COD_GRUPO,
        p.${colCodSubgrupoProd} AS COD_SUBGRUPO,
        seg.${colCodSegmento} AS COD_SEGMENTO,
        seg.${colDesSegmento} AS DES_SEGMENTO
      FROM ${tabProduto} p
      JOIN ${tabSegmento} seg ON p.${colCodSegmentoProd} = seg.${colCodSegmento}
      WHERE p.${colCodSegmentoProd} IS NOT NULL
      ORDER BY p.${colCodSecaoProd}, p.${colCodGrupoProd}, p.${colCodSubgrupoProd}, seg.${colDesSegmento}
    `;

    const [hierarquia, segmentos] = await Promise.all([
      OracleService.query(sqlBase),
      OracleService.query(sqlSegmentos),
    ]);

    return { hierarquia, segmentos } as any;
  }

  /**
   * Busca pesos padrão configurados na loja
   */
  static async getPesosLoja(codLoja: number): Promise<any> {
    const schema = await MappingService.getSchema();

    // Resolver TAB_PARAMETRO_LOJA dinamicamente
    let tabParametroLoja = `${schema}.TAB_PARAMETRO_LOJA`;
    try {
      tabParametroLoja = `${schema}.${await MappingService.getRealTableName('TAB_PARAMETRO_LOJA')}`;
    } catch (e) { /* usa default */ }

    let colCodLojaParam = 'COD_LOJA';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PARAMETRO_LOJA', 'codigo_loja');
      if (mapped) colCodLojaParam = mapped;
    } catch (e) { /* usa default */ }

    let colPesoVendas = 'PER_PESO_VENDAS';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PARAMETRO_LOJA', 'peso_vendas');
      if (mapped) colPesoVendas = mapped;
    } catch (e) { /* usa default */ }

    let colPesoVendasQtde = 'PER_PESO_VENDAS_QTDE';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PARAMETRO_LOJA', 'peso_vendas_qtde');
      if (mapped) colPesoVendasQtde = mapped;
    } catch (e) { /* usa default */ }

    let colPesoPenetCupons = 'PER_PESO_PENETRACAO_CUPONS';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PARAMETRO_LOJA', 'peso_penetracao_cupons');
      if (mapped) colPesoPenetCupons = mapped;
    } catch (e) { /* usa default */ }

    let colPesoPenetSubcateg = 'PER_PESO_PENETRACAO_SUBCATEG';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PARAMETRO_LOJA', 'peso_penetracao_subcateg');
      if (mapped) colPesoPenetSubcateg = mapped;
    } catch (e) { /* usa default */ }

    const sql = `
      SELECT
        ${colPesoVendas} AS PER_PESO_VENDAS,
        ${colPesoVendasQtde} AS PER_PESO_VENDAS_QTDE,
        ${colPesoPenetCupons} AS PER_PESO_PENETRACAO_CUPONS,
        ${colPesoPenetSubcateg} AS PER_PESO_PENETRACAO_SUBCATEG
      FROM ${tabParametroLoja}
      WHERE ${colCodLojaParam} = :codLoja
    `;
    const rows = await OracleService.query<any>(sql, { codLoja });
    return rows[0] || { PER_PESO_VENDAS: 25, PER_PESO_VENDAS_QTDE: 25, PER_PESO_PENETRACAO_CUPONS: 30, PER_PESO_PENETRACAO_SUBCATEG: 20 };
  }
}
