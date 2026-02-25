/**
 * Ofertas Service
 * Consulta programacoes/ofertas ativas do Oracle (TAB_PROGRAMACAO + TAB_PRODUTO_PROG)
 * com dados enriquecidos de produto, estoque, preco e margem.
 *
 * TODAS as tabelas e colunas são resolvidas via MappingService (sem hardcode).
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export interface Programacao {
  COD_PROG: number;
  DES_PROGRAMACAO: string;
  DTA_INICIAL: string;
  DTA_FINAL: string;
  HOR_INICIO: number;
  HOR_FINAL: number;
  TIPO_PROGRAMACAO: string;
  COD_LOJA: number;
  TOTAL_PRODUTOS: number;
}

export interface ProdutoOferta {
  COD_PRODUTO: string;
  DESCRICAO: string;
  COD_BARRAS: string;
  CUSTO: number;
  PRECO_NORMAL: number;
  PRECO_OFERTA: number;
  MARGEM_NORMAL: number;
  MARGEM_OFERTA: number;
  ESTOQUE: number;
  VD_MEDIA: number;
  VD_OFERTA: number;
  DIAS_COBERTURA: number;
  CURVA: string;
  RELEVANCIA: string;
  SECAO: string;
  COD_SECAO: number;
  FORNECEDOR: string;
  COD_FORNECEDOR: number;
}

/**
 * Resolve TODAS as tabelas e colunas via MappingService.
 * Chamado uma vez por request; retorna objeto plano com todos os nomes resolvidos.
 */
async function resolveMapping() {
  const schema = await MappingService.getSchema();

  // ── Tabelas ──
  const tabProgramacao    = `${schema}.${await MappingService.getRealTableName('TAB_PROGRAMACAO')}`;
  const tabProdutoProg    = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PROG')}`;
  const tabProduto        = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
  const tabProdutoLoja    = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
  const tabProdutoPdv     = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
  const tabSecao          = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
  const tabFornecedor     = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

  // ── Colunas TAB_PROGRAMACAO ──
  const pgCodProg          = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'cod_prog');
  const pgDesProgramacao   = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'des_programacao');
  const pgDtaInicial       = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'dta_inicial');
  const pgDtaFinal         = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'dta_final');
  const pgHorInicio        = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'hor_inicio');
  const pgHorFinal         = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'hor_final');
  const pgTipoProgramacao  = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'tipo_programacao');
  const pgCodLoja          = await MappingService.getColumnFromTable('TAB_PROGRAMACAO', 'cod_loja');

  // ── Colunas TAB_PRODUTO_PROG ──
  const ppCodProg    = await MappingService.getColumnFromTable('TAB_PRODUTO_PROG', 'cod_prog');
  const ppCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PROG', 'cod_produto');
  const ppValProg    = await MappingService.getColumnFromTable('TAB_PRODUTO_PROG', 'val_prog');

  // ── Colunas TAB_PRODUTO ──
  const pCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
  const pDescricao  = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
  const pCodSecao   = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');

  // ── Colunas TAB_PRODUTO_LOJA ──
  const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
  const plCodLoja    = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
  const plValVenda   = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
  const plValCusto   = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
  const plEstoque    = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
  const plCurva      = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

  // ── Colunas TAB_PRODUTO_PDV ──
  const pvValTotal     = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
  const pvValCustoRep  = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
  const pvQtdTotal     = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
  const pvFlgOferta    = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');
  const pvCodProduto   = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
  const pvDtaSaida     = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
  const pvCodLoja      = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
  let pvNumCupom = 'NUM_CUPOM';
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom'); if (v) pvNumCupom = v; } catch {}

  // ── Colunas TAB_SECAO ──
  const sCodSecao  = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
  const sDesSecao  = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

  // ── Colunas TAB_FORNECEDOR (nomes Oracle abreviados - fallback não bate) ──
  let fCodFornecedor = 'COD_FORNECEDOR';
  let fDesFornecedor = 'DES_FORNECEDOR';
  try { const v = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor'); if (v && v !== 'CODIGO_FORNECEDOR') fCodFornecedor = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'descricao_fornecedor'); if (v && v !== 'DESCRICAO_FORNECEDOR') fDesFornecedor = v; } catch {}

  // ── Colunas opcionais (com fallback) ──
  let pCodFornecedor = 'COD_FORNECEDOR';
  let plVdMedia = 'VD_MEDIA';
  let pCodBarras = 'COD_BARRA_PRINCIPAL';
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_fornecedor'); if (v && v !== 'CODIGO_FORNECEDOR') pCodFornecedor = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media'); if (v && v !== 'VENDA_MEDIA') plVdMedia = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras'); if (v && v !== 'CODIGO_BARRAS') pCodBarras = v; } catch {}

  // COD_LOJA em TAB_PRODUTO_PROG (campo opcional - pode nao existir no mapping)
  let ppCodLoja = 'COD_LOJA';
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_PROG', 'cod_loja'); if (v) ppCodLoja = v; } catch {}

  // ── Tabelas NF (para compra-venda excedido) ──
  let tabNf = '';
  let tabNfItem = '';
  try { tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`; } catch {}
  try { tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`; } catch {}

  // ── Colunas TAB_NF (padrão: resolver de TAB_NF, exceto COD_LOJA que vem de TAB_LOJA) ──
  let nfNumNf = 'NUM_NF';
  let nfSerieNf = 'NUM_SERIE_NF';
  let nfDtaEntrada = 'DTA_ENTRADA';
  let nfCodParceiro = 'COD_PARCEIRO';
  let nfTipoOperacao = 'TIPO_OPERACAO';
  let nfCodLoja = 'COD_LOJA';
  try { const v = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf'); if (v) nfNumNf = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf'); if (v) nfSerieNf = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada'); if (v) nfDtaEntrada = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro'); if (v) nfCodParceiro = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao'); if (v) nfTipoOperacao = v; } catch {}
  // COD_LOJA: resolver de TAB_LOJA (mesmo padrão do compra-venda.service)
  try { const v = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja'); if (v) nfCodLoja = v; } catch {}

  // ── Colunas TAB_NF_ITEM ──
  let niNumNf = 'NUM_NF';
  let niSerieNf = 'NUM_SERIE_NF';
  let niCodParceiro = 'COD_PARCEIRO';
  let niCodItem = 'COD_ITEM';
  let niValTotal = 'VAL_TOTAL';
  try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf'); if (v) niNumNf = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf'); if (v) niSerieNf = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro'); if (v) niCodParceiro = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item'); if (v) niCodItem = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total'); if (v) niValTotal = v; } catch {}
  let niCfop = 'CFOP';
  try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'cfop'); if (v) niCfop = v; } catch {}

  // ── Coluna DIAS_COBERTURA em TAB_PRODUTO_LOJA ──
  let plDiasCobertura = 'QTD_COBERTURA';
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura'); if (v) plDiasCobertura = v; } catch {}

  // ── Colunas TIPO_ESPECIE e TIPO_EVENTO em TAB_PRODUTO ──
  let pTipoEspecie = 'TIPO_ESPECIE';
  let pTipoEvento = 'TIPO_EVENTO';
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_especie'); if (v) pTipoEspecie = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_evento'); if (v) pTipoEvento = v; } catch {}

  // ── Coluna TIPO_RELEVANCIA em TAB_PRODUTO_LOJA ──
  let plTipoRelevancia = 'TIPO_RELEVANCIA';
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'tipo_relevancia'); if (v) plTipoRelevancia = v; } catch {}

  // ── Colunas Concorrente em TAB_PRODUTO_LOJA ──
  let plPesquisaMedia = 'VAL_PESQUISA_MEDIA';
  let plPesquisaConcorrente = 'DES_PESQUISA_CONCORRENTE';
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media'); if (v) plPesquisaMedia = v; } catch {}
  try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_concorrente'); if (v) plPesquisaConcorrente = v; } catch {}

  return {
    schema,
    // Tabelas
    tabProgramacao, tabProdutoProg, tabProduto, tabProdutoLoja, tabProdutoPdv, tabSecao, tabFornecedor,
    tabNf, tabNfItem,
    // TAB_PROGRAMACAO cols
    pgCodProg, pgDesProgramacao, pgDtaInicial, pgDtaFinal, pgHorInicio, pgHorFinal, pgTipoProgramacao, pgCodLoja,
    // TAB_PRODUTO_PROG cols
    ppCodProg, ppCodProduto, ppValProg, ppCodLoja,
    // TAB_PRODUTO cols
    pCodProduto, pDescricao, pCodSecao, pCodFornecedor, pCodBarras,
    // TAB_PRODUTO_LOJA cols
    plCodProduto, plCodLoja, plValVenda, plValCusto, plEstoque, plCurva, plVdMedia, plDiasCobertura,
    // TAB_PRODUTO_PDV cols
    pvValTotal, pvValCustoRep, pvQtdTotal, pvFlgOferta, pvCodProduto, pvDtaSaida, pvCodLoja, pvNumCupom,
    // TAB_SECAO cols
    sCodSecao, sDesSecao,
    // TAB_FORNECEDOR cols
    fCodFornecedor, fDesFornecedor,
    // TAB_NF cols
    nfNumNf, nfSerieNf, nfDtaEntrada, nfCodParceiro, nfTipoOperacao, nfCodLoja,
    // TAB_NF_ITEM cols
    niNumNf, niSerieNf, niCodParceiro, niCodItem, niValTotal,
    // TAB_PRODUTO extra cols
    pTipoEspecie, pTipoEvento,
    // Concorrente cols
    plPesquisaMedia, plPesquisaConcorrente,
    // Relevancia col
    plTipoRelevancia,
    // NF_ITEM extra cols
    niCfop,
  };
}

export class OfertasService {

  /**
   * Lista programacoes (ativas ou todas)
   */
  static async getProgramacoes(codLoja: number, ativas: boolean = true): Promise<Programacao[]> {
    const m = await resolveMapping();

    let whereAtivas = '';
    if (ativas) {
      whereAtivas = `AND (TRUNC(pg.${m.pgDtaFinal}) + NVL(pg.${m.pgHorFinal}, 23)/24) >= SYSDATE
      AND (TRUNC(pg.${m.pgDtaInicial}) + NVL(pg.${m.pgHorInicio}, 0)/24) <= SYSDATE`;
    }

    const sql = `
      SELECT
        pg.${m.pgCodProg} as COD_PROG,
        pg.${m.pgDesProgramacao} as DES_PROGRAMACAO,
        TO_CHAR(pg.${m.pgDtaInicial}, 'DD/MM/YYYY') as DTA_INICIAL,
        TO_CHAR(pg.${m.pgDtaFinal}, 'DD/MM/YYYY') as DTA_FINAL,
        NVL(pg.${m.pgHorInicio}, 0) as HOR_INICIO,
        NVL(pg.${m.pgHorFinal}, 23) as HOR_FINAL,
        pg.${m.pgTipoProgramacao} as TIPO_PROGRAMACAO,
        NVL(pg.${m.pgCodLoja}, :codLoja) as COD_LOJA,
        (SELECT COUNT(*) FROM ${m.tabProdutoProg} pp WHERE pp.${m.ppCodProg} = pg.${m.pgCodProg} AND NVL(pp.${m.ppCodLoja}, :codLoja) = :codLoja) as TOTAL_PRODUTOS
      FROM ${m.tabProgramacao} pg
      WHERE NVL(pg.${m.pgCodLoja}, :codLoja) = :codLoja
      ${whereAtivas}
      ORDER BY pg.${m.pgDtaFinal} DESC, pg.${m.pgDesProgramacao}
    `;

    console.log('[Ofertas] getProgramacoes - codLoja:', codLoja, 'ativas:', ativas);
    console.log('[Ofertas] SQL:', sql);

    const result = await OracleService.query<any>(sql, { codLoja });
    console.log('[Ofertas] Resultado:', result.length, 'programacoes encontradas');
    if (result.length > 0) console.log('[Ofertas] Primeira:', JSON.stringify(result[0]));

    return result.map((row: any) => ({
      COD_PROG: Number(row.COD_PROG),
      DES_PROGRAMACAO: row.DES_PROGRAMACAO || '',
      DTA_INICIAL: row.DTA_INICIAL || '',
      DTA_FINAL: row.DTA_FINAL || '',
      HOR_INICIO: Number(row.HOR_INICIO) || 0,
      HOR_FINAL: Number(row.HOR_FINAL) || 23,
      TIPO_PROGRAMACAO: row.TIPO_PROGRAMACAO || '',
      COD_LOJA: Number(row.COD_LOJA),
      TOTAL_PRODUTOS: Number(row.TOTAL_PRODUTOS) || 0,
    }));
  }

  /**
   * Busca produtos de uma programacao com dados enriquecidos
   * Inclui vendas reais no periodo da oferta (TAB_PRODUTO_PDV)
   */
  static async getProdutos(codProg: number, codLoja: number, mesAtual: boolean = false): Promise<{
    produtos: ProdutoOferta[];
    resumo: {
      totalProdutos: number;
      estZerado: number;
      margemMediaOferta: number;
      margemMediaNormal: number;
      vendasOferta: number;
      pctVendasOferta: number;
      markdownOferta: number;
      difMargem: number;
    };
  }> {
    const m = await resolveMapping();

    // Verificar se coluna TIPO_RELEVANCIA existe na TAB_PRODUTO_LOJA
    let hasRelevanciaCol = true;
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${m.schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${m.plTipoRelevancia}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length === 0) hasRelevanciaCol = false;
    } catch (e) {
      hasRelevanciaCol = false;
    }

    // 1) Buscar datas e horarios da programacao para queries de vendas
    // codProg = 0 significa "todas as programacoes"
    const todasProgs = codProg === 0;
    let dtaInicial: any = null;
    let dtaFinal: any = null;
    let horInicio = 0;
    let horFinal = 23;

    if (todasProgs) {
      // Pegar range de datas de todas as programacoes (filtrado por mes atual se necessario)
      const filtroMes = mesAtual
        ? `AND ${m.pgDtaFinal} >= TRUNC(SYSDATE, 'MM') AND ${m.pgDtaInicial} <= LAST_DAY(SYSDATE)`
        : '';
      const progSql = `
        SELECT MIN(${m.pgDtaInicial}) as DTA_INICIAL, MAX(${m.pgDtaFinal}) as DTA_FINAL,
          MIN(NVL(${m.pgHorInicio}, 0)) as HOR_INICIO, MAX(NVL(${m.pgHorFinal}, 23)) as HOR_FINAL
        FROM ${m.tabProgramacao}
        WHERE NVL(${m.pgCodLoja}, :codLoja) = :codLoja
        ${filtroMes}
      `;
      const progRows = await OracleService.query<any>(progSql, { codLoja });
      dtaInicial = progRows[0]?.DTA_INICIAL || null;
      dtaFinal = progRows[0]?.DTA_FINAL || null;
      horInicio = Number(progRows[0]?.HOR_INICIO) || 0;
      horFinal = Number(progRows[0]?.HOR_FINAL) || 23;
    } else {
      const progSql = `
        SELECT ${m.pgDtaInicial} as DTA_INICIAL, ${m.pgDtaFinal} as DTA_FINAL,
          NVL(${m.pgHorInicio}, 0) as HOR_INICIO, NVL(${m.pgHorFinal}, 23) as HOR_FINAL
        FROM ${m.tabProgramacao}
        WHERE ${m.pgCodProg} = :codProg
      `;
      const progRows = await OracleService.query<any>(progSql, { codProg });
      dtaInicial = progRows[0]?.DTA_INICIAL || null;
      dtaFinal = progRows[0]?.DTA_FINAL || null;
      horInicio = Number(progRows[0]?.HOR_INICIO) || 0;
      horFinal = Number(progRows[0]?.HOR_FINAL) || 23;
    }

    // 2) Query principal de produtos
    // Se codProg=0 (todas), nao filtra por COD_PROG e usa GROUP BY para evitar duplicados
    const filtroProgProd = todasProgs ? '' : `AND pp.${m.ppCodProg} = :codProg`;
    // Se "todas" + mesAtual, filtrar programacoes do mes atual via JOIN
    const filtroMesProd = (todasProgs && mesAtual)
      ? `AND pp.${m.ppCodProg} IN (SELECT ${m.pgCodProg} FROM ${m.tabProgramacao} WHERE NVL(${m.pgCodLoja}, :codLoja) = :codLoja AND ${m.pgDtaFinal} >= TRUNC(SYSDATE, 'MM') AND ${m.pgDtaInicial} <= LAST_DAY(SYSDATE))`
      : '';
    const sql = `
      SELECT
        pp.${m.ppCodProduto} as COD_PRODUTO,
        p.${m.pDescricao} as DESCRICAO,
        p.${m.pCodBarras} as COD_BARRAS,
        NVL(pl.${m.plValCusto}, 0) as CUSTO,
        NVL(pl.${m.plValVenda}, 0) as PRECO_NORMAL,
        ${todasProgs ? `MIN(NVL(pp.${m.ppValProg}, 0))` : `NVL(pp.${m.ppValProg}, 0)`} as PRECO_OFERTA,
        (SELECT COUNT(*) FROM ${m.tabProdutoProg} pp2 WHERE pp2.${m.ppCodProduto} = pp.${m.ppCodProduto} AND NVL(pp2.${m.ppCodLoja}, :codLoja) = :codLoja) as QTD_OFERTAS,
        NVL(pl.${m.plEstoque}, 0) as ESTOQUE,
        NVL(pl.${m.plVdMedia}, 0) as VD_MEDIA,
        NVL(pl.${m.plCurva}, 'X') as CURVA,
        s.${m.sDesSecao} as SECAO,
        p.${m.pCodSecao} as COD_SECAO,
        f.${m.fDesFornecedor} as FORNECEDOR,
        p.${m.pCodFornecedor} as COD_FORNECEDOR,
        NVL(pl.${m.plPesquisaMedia}, 0) as CONC_BARATO,
        pl.${m.plPesquisaConcorrente} as CONC_NOME${hasRelevanciaCol ? `,
        NVL(pl.${m.plTipoRelevancia}, -1) as TIPO_RELEVANCIA` : ''}
      FROM ${m.tabProdutoProg} pp
      JOIN ${m.tabProduto} p ON pp.${m.ppCodProduto} = p.${m.pCodProduto}
      JOIN ${m.tabProdutoLoja} pl ON pp.${m.ppCodProduto} = pl.${m.plCodProduto}
        AND pl.${m.plCodLoja} = :codLoja
      LEFT JOIN ${m.tabSecao} s ON p.${m.pCodSecao} = s.${m.sCodSecao}
      LEFT JOIN ${m.tabFornecedor} f ON p.${m.pCodFornecedor} = f.${m.fCodFornecedor}
      WHERE NVL(pp.${m.ppCodLoja}, :codLoja) = :codLoja
        ${filtroProgProd}
        ${filtroMesProd}
      ${todasProgs ? `GROUP BY pp.${m.ppCodProduto}, p.${m.pDescricao}, p.${m.pCodBarras}, pl.${m.plValCusto}, pl.${m.plValVenda},
        pl.${m.plEstoque}, pl.${m.plVdMedia}, pl.${m.plCurva}, s.${m.sDesSecao}, p.${m.pCodSecao},
        f.${m.fDesFornecedor}, p.${m.pCodFornecedor}, pl.${m.plPesquisaMedia}, pl.${m.plPesquisaConcorrente}${hasRelevanciaCol ? `, pl.${m.plTipoRelevancia}` : ''}` : ''}
      ORDER BY s.${m.sDesSecao}, p.${m.pDescricao}
    `;

    const queryParams: any = { codLoja };
    if (!todasProgs) queryParams.codProg = codProg;
    const rows = await OracleService.query<any>(sql, queryParams);

    // 3) Buscar vendas reais no periodo da oferta (mesmo calculo da Gestao Inteligente)
    // Vendas agregadas: total e oferta (para o card)
    // Vendas por produto: qtd vendida / dias (para coluna Cresc. Oferta)
    let vendasOfertaTotal = 0;
    let vendasTotal = 0;
    let custoOfertaTotal = 0;
    let vendasPorProduto: Record<string, number> = {};
    let ticketMedioPorProduto: Record<string, number> = {};
    let diasOferta = 1;

    if (dtaInicial && dtaFinal) {
      // Calcular dias do periodo (considerando horarios)
      const hoje = new Date();
      const dtaIni = new Date(dtaInicial);
      dtaIni.setHours(horInicio, 0, 0, 0);
      const dtaFim = new Date(dtaFinal);
      dtaFim.setHours(horFinal, 0, 0, 0);
      const fimReal = dtaFim > hoje ? hoje : dtaFim;
      const diffMs = fimReal.getTime() - dtaIni.getTime();
      // Se oferta ainda nao comecou, diasOferta = 0 (nao busca vendas)
      diasOferta = diffMs > 0 ? Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;

      if (diasOferta > 0) {
      // Query vendas agregadas usando horario exato da programacao
      const vendasAgregSql = `
        SELECT
          NVL(SUM(pv.${m.pvValTotal}), 0) as VENDAS_TOTAL,
          NVL(SUM(CASE WHEN pv.${m.pvFlgOferta} = 'S' THEN pv.${m.pvValTotal} ELSE 0 END), 0) as VENDAS_OFERTA,
          NVL(SUM(CASE WHEN pv.${m.pvFlgOferta} = 'S' THEN pv.${m.pvValCustoRep} * pv.${m.pvQtdTotal} ELSE 0 END), 0) as CUSTO_OFERTA
        FROM ${m.tabProdutoPdv} pv
        WHERE pv.${m.pvDtaSaida} BETWEEN (TRUNC(:dtaIni) + :horIni/24) AND LEAST(TRUNC(:dtaFim) + :horFim/24, SYSDATE)
          AND pv.${m.pvCodLoja} = :codLoja
      `;
      const vendasAgregRows = await OracleService.query<any>(vendasAgregSql, {
        dtaIni: dtaInicial,
        dtaFim: dtaFinal,
        horIni: horInicio,
        horFim: horFinal,
        codLoja
      });
      vendasTotal = parseFloat(vendasAgregRows[0]?.VENDAS_TOTAL) || 0;
      vendasOfertaTotal = parseFloat(vendasAgregRows[0]?.VENDAS_OFERTA) || 0;
      custoOfertaTotal = parseFloat(vendasAgregRows[0]?.CUSTO_OFERTA) || 0;

      // Query vendas por produto no periodo (para coluna crescimento)
      const codProdutos = rows.map((r: any) => String(r.COD_PRODUTO));
      if (codProdutos.length > 0) {
        // Buscar em lotes de 500 (limite Oracle IN)
        for (let i = 0; i < codProdutos.length; i += 500) {
          const lote = codProdutos.slice(i, i + 500);
          const placeholders = lote.map((_: string, idx: number) => `:p${i + idx}`).join(',');
          const vendasProdSql = `
            SELECT pv.${m.pvCodProduto} as COD_PRODUTO,
              NVL(SUM(pv.${m.pvQtdTotal}), 0) as QTD_VENDIDA
            FROM ${m.tabProdutoPdv} pv
            WHERE pv.${m.pvDtaSaida} BETWEEN (TRUNC(:dtaIni) + :horIni/24) AND LEAST(TRUNC(:dtaFim) + :horFim/24, SYSDATE)
              AND pv.${m.pvCodLoja} = :codLoja
              AND pv.${m.pvCodProduto} IN (${placeholders})
            GROUP BY pv.${m.pvCodProduto}
          `;
          const params: any = { dtaIni: dtaInicial, dtaFim: dtaFinal, horIni: horInicio, horFim: horFinal, codLoja };
          lote.forEach((cod: string, idx: number) => { params[`p${i + idx}`] = cod; });
          const vendasProdRows = await OracleService.query<any>(vendasProdSql, params);
          vendasProdRows.forEach((r: any) => {
            vendasPorProduto[String(r.COD_PRODUTO)] = parseFloat(r.QTD_VENDIDA) || 0;
          });

          // Ticket Medio: media do valor total dos cupons onde o produto aparece
          const ticketSql = `
            WITH cupons_prod AS (
              SELECT DISTINCT pv.${m.pvCodProduto} AS COD_PRODUTO, pv.${m.pvNumCupom} AS NUM_CUPOM
              FROM ${m.tabProdutoPdv} pv
              WHERE pv.${m.pvDtaSaida} BETWEEN (TRUNC(:dtaIni) + :horIni/24) AND LEAST(TRUNC(:dtaFim) + :horFim/24, SYSDATE)
                AND pv.${m.pvCodLoja} = :codLoja
                AND pv.${m.pvCodProduto} IN (${placeholders})
            ),
            cupom_totais AS (
              SELECT cp.NUM_CUPOM, SUM(pv2.${m.pvValTotal}) AS TOTAL_CUPOM
              FROM (SELECT DISTINCT NUM_CUPOM FROM cupons_prod) cp
              JOIN ${m.tabProdutoPdv} pv2 ON cp.NUM_CUPOM = pv2.${m.pvNumCupom}
                AND pv2.${m.pvCodLoja} = :codLoja
                AND pv2.${m.pvDtaSaida} BETWEEN (TRUNC(:dtaIni) + :horIni/24) AND LEAST(TRUNC(:dtaFim) + :horFim/24, SYSDATE)
              GROUP BY cp.NUM_CUPOM
            )
            SELECT cp.COD_PRODUTO, AVG(ct.TOTAL_CUPOM) AS TICKET_MEDIO
            FROM cupons_prod cp
            JOIN cupom_totais ct ON cp.NUM_CUPOM = ct.NUM_CUPOM
            GROUP BY cp.COD_PRODUTO
          `;
          const ticketParams: any = { dtaIni: dtaInicial, dtaFim: dtaFinal, horIni: horInicio, horFim: horFinal, codLoja };
          lote.forEach((cod: string, idx: number) => { ticketParams[`p${i + idx}`] = cod; });
          try {
            const ticketRows = await OracleService.query<any>(ticketSql, ticketParams);
            ticketRows.forEach((r: any) => {
              ticketMedioPorProduto[String(r.COD_PRODUTO)] = parseFloat(r.TICKET_MEDIO) || 0;
            });
          } catch (err: any) {
            console.warn('[Ofertas] Ticket medio query falhou (ignorando):', err.message);
          }
        }
      }
      } // fim if diasOferta > 0
    }

    const produtos: ProdutoOferta[] = rows.map((row: any) => {
      const custo = parseFloat(row.CUSTO) || 0;
      const precoNormal = parseFloat(row.PRECO_NORMAL) || 0;
      const precoOferta = parseFloat(row.PRECO_OFERTA) || 0;
      const estoque = parseFloat(row.ESTOQUE) || 0;
      const vdMedia = parseFloat(row.VD_MEDIA) || 0;

      const margemNormal = precoNormal > 0 ? ((precoNormal - custo) / precoNormal) * 100 : 0;
      const margemOferta = precoOferta > 0 ? ((precoOferta - custo) / precoOferta) * 100 : 0;
      const diasCobertura = vdMedia > 0 ? estoque / vdMedia : 0;

      // Venda media diaria real no periodo da oferta
      const qtdVendidaOferta = vendasPorProduto[String(row.COD_PRODUTO)] || 0;
      const vdOferta = qtdVendidaOferta / diasOferta;

      // Relevancia: 0=N, 1=SP, 2=R
      const tipoRelev = row.TIPO_RELEVANCIA != null ? Number(row.TIPO_RELEVANCIA) : -1;
      let relevancia = '-';
      if (tipoRelev === 0) relevancia = 'N';
      else if (tipoRelev === 1) relevancia = 'SP';
      else if (tipoRelev === 2) relevancia = 'R';

      return {
        COD_PRODUTO: String(row.COD_PRODUTO),
        DESCRICAO: row.DESCRICAO || '',
        COD_BARRAS: row.COD_BARRAS || '',
        CUSTO: custo,
        PRECO_NORMAL: precoNormal,
        PRECO_OFERTA: precoOferta,
        MARGEM_NORMAL: Math.round(margemNormal * 10) / 10,
        MARGEM_OFERTA: Math.round(margemOferta * 10) / 10,
        ESTOQUE: estoque,
        VD_MEDIA: Math.round(vdMedia * 100) / 100,
        VD_OFERTA: Math.round(vdOferta * 100) / 100,
        DIAS_COBERTURA: Math.round(diasCobertura * 10) / 10,
        CURVA: row.CURVA || 'X',
        RELEVANCIA: relevancia,
        SECAO: row.SECAO || '',
        COD_SECAO: Number(row.COD_SECAO) || 0,
        FORNECEDOR: row.FORNECEDOR || '',
        COD_FORNECEDOR: Number(row.COD_FORNECEDOR) || 0,
        QTD_OFERTAS: Number(row.QTD_OFERTAS) || 0,
        TICKET_MEDIO: Math.round((ticketMedioPorProduto[String(row.COD_PRODUTO)] || 0) * 100) / 100,
        CONC_BARATO: Math.round((parseFloat(row.CONC_BARATO) || 0) * 100) / 100,
        CONC_NOME: row.CONC_NOME || '',
      };
    });

    // Calcular resumo
    const totalProdutos = produtos.length;
    const estZerado = produtos.filter(p => p.ESTOQUE <= 0).length;
    const margemMediaOferta = totalProdutos > 0
      ? Math.round((produtos.reduce((s, p) => s + p.MARGEM_OFERTA, 0) / totalProdutos) * 10) / 10
      : 0;
    const margemMediaNormal = totalProdutos > 0
      ? Math.round((produtos.reduce((s, p) => s + p.MARGEM_NORMAL, 0) / totalProdutos) * 10) / 10
      : 0;
    const pctVendasOferta = vendasTotal > 0 ? Math.round((vendasOfertaTotal / vendasTotal) * 10000) / 100 : 0;
    const markdownOferta = vendasOfertaTotal > 0 ? Math.round(((vendasOfertaTotal - custoOfertaTotal) / vendasOfertaTotal) * 10000) / 100 : 0;
    const difMargem = Math.round((margemMediaNormal - margemMediaOferta) * 10) / 10;

    return {
      produtos,
      resumo: {
        totalProdutos,
        estZerado,
        margemMediaOferta,
        margemMediaNormal,
        vendasOferta: Math.round(vendasOfertaTotal * 100) / 100,
        pctVendasOferta,
        markdownOferta,
        difMargem,
      },
    };
  }

  /**
   * Historico de ofertas de um produto especifico
   * Retorna todas as programacoes em que o produto participou, com dados de performance
   */
  static async getHistoricoProduto(codProduto: string, codLoja: number): Promise<any[]> {
    const m = await resolveMapping();

    // Buscar todas as programacoes em que o produto participou
    const sql = `
      SELECT
        pg.${m.pgCodProg} as COD_PROG,
        pg.${m.pgDesProgramacao} as DES_PROGRAMACAO,
        TO_CHAR(pg.${m.pgDtaInicial}, 'DD/MM/YYYY') as DTA_INICIAL,
        TO_CHAR(pg.${m.pgDtaFinal}, 'DD/MM/YYYY') as DTA_FINAL,
        pg.${m.pgDtaInicial} as DTA_INI_RAW,
        pg.${m.pgDtaFinal} as DTA_FIM_RAW,
        NVL(pg.${m.pgHorInicio}, 0) as HOR_INICIO,
        NVL(pg.${m.pgHorFinal}, 23) as HOR_FINAL,
        NVL(pp.${m.ppValProg}, 0) as PRECO_OFERTA,
        NVL(pl.${m.plValVenda}, 0) as PRECO_NORMAL,
        NVL(pl.${m.plValCusto}, 0) as CUSTO,
        NVL(pl.${m.plVdMedia}, 0) as VD_MEDIA
      FROM ${m.tabProdutoProg} pp
      JOIN ${m.tabProgramacao} pg ON pp.${m.ppCodProg} = pg.${m.pgCodProg}
      JOIN ${m.tabProdutoLoja} pl ON pp.${m.ppCodProduto} = pl.${m.plCodProduto}
        AND pl.${m.plCodLoja} = :codLoja
      WHERE pp.${m.ppCodProduto} = :codProduto
        AND NVL(pp.${m.ppCodLoja}, :codLoja) = :codLoja
      ORDER BY pg.${m.pgDtaInicial} DESC
    `;

    const rows = await OracleService.query<any>(sql, { codProduto, codLoja });

    // Para cada programacao, buscar vendas reais no periodo
    const resultado = [];
    for (const row of rows) {
      const custo = parseFloat(row.CUSTO) || 0;
      const precoNormal = parseFloat(row.PRECO_NORMAL) || 0;
      const precoOferta = parseFloat(row.PRECO_OFERTA) || 0;
      const vdMedia = parseFloat(row.VD_MEDIA) || 0;
      const margemOferta = precoOferta > 0 ? ((precoOferta - custo) / precoOferta) * 100 : 0;

      // Calcular dias do periodo
      const dtaIni = row.DTA_INI_RAW ? new Date(row.DTA_INI_RAW) : null;
      const dtaFim = row.DTA_FIM_RAW ? new Date(row.DTA_FIM_RAW) : null;
      let vdOferta = 0;
      let crescOferta = 0;

      if (dtaIni && dtaFim) {
        const hoje = new Date();
        const fimReal = dtaFim > hoje ? hoje : dtaFim;
        const diffMs = fimReal.getTime() - dtaIni.getTime();
        const diasOferta = diffMs > 0 ? Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24))) : 0;

        if (diasOferta > 0) {
          const vendasSql = `
            SELECT NVL(SUM(pv.${m.pvQtdTotal}), 0) as QTD_VENDIDA
            FROM ${m.tabProdutoPdv} pv
            WHERE pv.${m.pvCodProduto} = :codProduto
              AND pv.${m.pvCodLoja} = :codLoja
              AND pv.${m.pvDtaSaida} BETWEEN (TRUNC(:dtaIni) + :horIni/24) AND LEAST(TRUNC(:dtaFim) + :horFim/24, SYSDATE)
          `;
          const vRows = await OracleService.query<any>(vendasSql, {
            codProduto,
            codLoja,
            dtaIni: row.DTA_INI_RAW,
            dtaFim: row.DTA_FIM_RAW,
            horIni: Number(row.HOR_INICIO) || 0,
            horFim: Number(row.HOR_FINAL) || 23,
          });
          const qtdVendida = parseFloat(vRows[0]?.QTD_VENDIDA) || 0;
          vdOferta = qtdVendida / diasOferta;
          crescOferta = vdMedia > 0 ? ((vdOferta - vdMedia) / vdMedia) * 100 : 0;
        }
      }

      resultado.push({
        COD_PROG: Number(row.COD_PROG),
        DES_PROGRAMACAO: row.DES_PROGRAMACAO || '',
        DTA_INICIAL: row.DTA_INICIAL,
        DTA_FINAL: row.DTA_FINAL,
        PRECO_NORMAL: Math.round(precoNormal * 100) / 100,
        PRECO_OFERTA: Math.round(precoOferta * 100) / 100,
        MARGEM_OFERTA: Math.round(margemOferta * 10) / 10,
        VD_MEDIA: Math.round(vdMedia * 100) / 100,
        VD_OFERTA: Math.round(vdOferta * 100) / 100,
        CRESC_OFERTA: Math.round(crescOferta * 10) / 10,
      });
    }

    return resultado;
  }

  /**
   * Todos Produtos - lista completa de produtos ativos na loja (Revenda + Producao)
   */
  static async getTodosProdutos(codLoja: number): Promise<any> {
    const m = await resolveMapping();

    // Campo inativo em TAB_PRODUTO_LOJA (mesmo filtro usado em products.controller.ts)
    let colInativo = 'FLG_INATIVO';
    try {
      const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
      if (v) colInativo = v;
    } catch {}

    const sql = `
      SELECT
        p.${m.pCodProduto} as COD_PRODUTO,
        p.${m.pDescricao} as DESCRICAO,
        p.${m.pCodBarras || m.pCodProduto} as EAN,
        sec.${m.sDesSecao} as SECAO,
        sec.${m.sCodSecao} as COD_SECAO,
        pl.${m.plCurva} as CURVA,
        pl.${m.plValVenda} as PRECO,
        pl.${m.plValCusto} as CUSTO,
        pl.${m.plEstoque} as ESTOQUE,
        NVL(p.${m.pTipoEspecie}, 0) as TIPO_ESPECIE,
        NVL(p.${m.pTipoEvento}, 0) as TIPO_EVENTO
      FROM ${m.tabProduto} p
      INNER JOIN ${m.tabProdutoLoja} pl
        ON p.${m.pCodProduto} = pl.${m.plCodProduto}
        AND pl.${m.plCodLoja} = :codLoja
      LEFT JOIN ${m.tabSecao} sec ON p.${m.pCodSecao} = sec.${m.sCodSecao}
      WHERE NVL(pl.${colInativo}, 'N') = 'N'
        AND NVL(pl.${m.plEstoque}, 0) > 0
      ORDER BY sec.${m.sDesSecao} NULLS LAST, p.${m.pDescricao}
    `;

    const rows = await OracleService.query<any>(sql, { codLoja });

    const produtos = rows.map(r => ({
      COD_PRODUTO: r.COD_PRODUTO,
      DESCRICAO: r.DESCRICAO,
      EAN: r.EAN,
      COD_BARRAS: r.EAN,
      SECAO: r.SECAO || 'SEM SECAO',
      COD_SECAO: r.COD_SECAO,
      CURVA: r.CURVA || 'X',
      PRECO: Math.round((parseFloat(r.PRECO) || 0) * 100) / 100,
      CUSTO: Math.round((parseFloat(r.CUSTO) || 0) * 100) / 100,
      ESTOQUE: Math.round(parseFloat(r.ESTOQUE) || 0),
      TIPO_ESPECIE: Number(r.TIPO_ESPECIE),
      TIPO_EVENTO: Number(r.TIPO_EVENTO),
      // Revenda = especie 0 + evento 0 (Mercadoria Direta); Producao = tudo mais (insumos, composição, etc.)
      TIPO_LABEL: (Number(r.TIPO_ESPECIE) === 0 && Number(r.TIPO_EVENTO) === 0) ? 'Revenda' : 'Producao',
    }));

    const totalRevenda = produtos.filter(p => p.TIPO_LABEL === 'Revenda').length;
    const totalProducao = produtos.filter(p => p.TIPO_LABEL === 'Producao').length;

    return { total: produtos.length, totalRevenda, totalProducao, produtos };
  }

  /**
   * Crescimentos de oferta - calcula crescimento de venda de N produtos em um periodo
   * comparando venda real no periodo vs VD_MEDIA historica
   */
  static async getCrescimentosOferta(codLoja: number, produtos: Array<{
    codProduto: string;
    dtaInicio: string; // DD/MM/YYYY
    dtaFim: string;    // DD/MM/YYYY
    vdMedia: number;
  }>): Promise<Record<string, { vdOferta: number; crescimentoPct: number }>> {
    const m = await resolveMapping();
    const resultado: Record<string, { vdOferta: number; crescimentoPct: number; vdHist: number }> = {};

    if (!produtos || produtos.length === 0) return resultado;

    // Processar em lotes de 20 em paralelo
    const LOTE = 20;
    for (let i = 0; i < produtos.length; i += LOTE) {
      const lote = produtos.slice(i, i + LOTE);
      await Promise.all(lote.map(async ({ codProduto, dtaInicio, dtaFim, vdMedia }) => {
        try {
          // Calcular dias do período
          const [d1, mo1, y1] = dtaInicio.split('/').map(Number);
          const [d2, mo2, y2] = dtaFim.split('/').map(Number);
          const ini = new Date(y1, mo1 - 1, d1);
          const fim = new Date(y2, mo2 - 1, d2);
          const dias = Math.max(1, Math.ceil((fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1);

          const sql = `
            SELECT
              NVL(SUM(pv.${m.pvQtdTotal}), 0) as QTD_VENDIDA,
              NVL(MAX(pl.${m.plVdMedia}), 0) as VD_MEDIA_HIST
            FROM ${m.tabProdutoPdv} pv
            LEFT JOIN ${m.tabProdutoLoja} pl
              ON pl.${m.plCodProduto} = pv.${m.pvCodProduto}
              AND pl.${m.plCodLoja} = pv.${m.pvCodLoja}
            WHERE pv.${m.pvCodProduto} = :codProduto
              AND pv.${m.pvCodLoja} = :codLoja
              AND pv.${m.pvDtaSaida} BETWEEN TO_DATE(:dtaInicio, 'DD/MM/YYYY') AND TO_DATE(:dtaFim, 'DD/MM/YYYY') + 0.99999
          `;
          const rows = await OracleService.query<any>(sql, { codProduto, codLoja, dtaInicio, dtaFim });
          const qtd = parseFloat(rows[0]?.QTD_VENDIDA) || 0;
          const vdHist = parseFloat(rows[0]?.VD_MEDIA_HIST) || vdMedia || 0;
          const vdOferta = Math.round((qtd / dias) * 100) / 100;
          const crescimentoPct = vdHist > 0
            ? Math.round(((vdOferta - vdHist) / vdHist) * 10000) / 100
            : 0;
          resultado[codProduto] = { vdOferta, crescimentoPct, vdHist };
        } catch (err: any) {
          console.error(`[Ofertas] Erro getCrescimentosOferta cod=${codProduto}:`, err?.message);
          resultado[codProduto] = { vdOferta: 0, crescimentoPct: 0, vdHist: 0 };
        }
      }));
    }
    return resultado;
  }

  /**
   * Carrinho junto - top 10 produtos mais comprados no mesmo cupom que o produto informado
   * no periodo da oferta (basket analysis)
   */
  static async getCarrinhosJuntos(codLoja: number, codProduto: string, dtaInicio: string, dtaFim: string): Promise<any[]> {
    const m = await resolveMapping();

    const sql = `
      SELECT * FROM (
        SELECT
          pv2.${m.pvCodProduto} as COD_PRODUTO,
          p.${m.pDescricao} as DESCRICAO,
          p.${m.pCodBarras} as COD_BARRAS,
          s.${m.sDesSecao} as SECAO,
          COUNT(DISTINCT pv1.${m.pvNumCupom}) as FREQ_JUNTO,
          NVL(tot.QTD_TOTAL_REAL, 0) as QTD_TOTAL_PERIODO,
          NVL(MAX(pl.${m.plVdMedia}), 0) as VD_MEDIA_HISTORICA,
          NVL(MAX(pl.${m.plValVenda}), 0) as PRECO_VENDA,
          NVL(MAX(pl.${m.plValCusto}), 0) as CUSTO_UNIT
        FROM ${m.tabProdutoPdv} pv1
        INNER JOIN ${m.tabProdutoPdv} pv2
          ON pv1.${m.pvNumCupom} = pv2.${m.pvNumCupom}
          AND pv1.${m.pvCodLoja} = pv2.${m.pvCodLoja}
          AND pv1.${m.pvCodProduto} != pv2.${m.pvCodProduto}
        INNER JOIN ${m.tabProduto} p ON pv2.${m.pvCodProduto} = p.${m.pCodProduto}
        LEFT JOIN ${m.tabProdutoLoja} pl
          ON pv2.${m.pvCodProduto} = pl.${m.plCodProduto}
          AND pl.${m.plCodLoja} = :codLoja
        LEFT JOIN ${m.tabSecao} s ON p.${m.pCodSecao} = s.${m.sCodSecao}
        LEFT JOIN (
          SELECT ${m.pvCodProduto} as COD_PROD_TOT,
                 NVL(SUM(${m.pvQtdTotal}), 0) as QTD_TOTAL_REAL
          FROM ${m.tabProdutoPdv}
          WHERE ${m.pvCodLoja} = :codLoja
            AND ${m.pvDtaSaida} BETWEEN TO_DATE(:dtaInicio, 'DD/MM/YYYY') AND TO_DATE(:dtaFim, 'DD/MM/YYYY') + 0.99999
          GROUP BY ${m.pvCodProduto}
        ) tot ON tot.COD_PROD_TOT = pv2.${m.pvCodProduto}
        WHERE pv1.${m.pvCodProduto} = :codProduto
          AND pv1.${m.pvDtaSaida} BETWEEN TO_DATE(:dtaInicio, 'DD/MM/YYYY') AND TO_DATE(:dtaFim, 'DD/MM/YYYY') + 0.99999
          AND pv1.${m.pvCodLoja} = :codLoja
        GROUP BY pv2.${m.pvCodProduto}, p.${m.pDescricao}, p.${m.pCodBarras}, s.${m.sDesSecao}, tot.QTD_TOTAL_REAL
        ORDER BY FREQ_JUNTO DESC
      ) WHERE ROWNUM <= 10
    `;

    const rows = await OracleService.query<any>(sql, { codProduto, codLoja, dtaInicio, dtaFim });

    // Calcular dias do período para vdOferta
    const [d1, mo1, y1] = dtaInicio.split('/').map(Number);
    const [d2, mo2, y2] = dtaFim.split('/').map(Number);
    const ini = new Date(y1, mo1 - 1, d1);
    const fim = new Date(y2, mo2 - 1, d2);
    const dias = Math.max(1, Math.ceil((fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    return rows.map((row: any) => {
      const vdMedia = parseFloat(row.VD_MEDIA_HISTORICA) || 0;
      const qtdTotal = parseFloat(row.QTD_TOTAL_PERIODO) || 0;
      const vdOferta = Math.round((qtdTotal / dias) * 100) / 100;
      const crescimentoPct = vdMedia > 0
        ? Math.round(((vdOferta - vdMedia) / vdMedia) * 10000) / 100
        : 0;
      const precoVenda = Math.round((parseFloat(row.PRECO_VENDA) || 0) * 100) / 100;
      const custoUnit = Math.round((parseFloat(row.CUSTO_UNIT) || 0) * 100) / 100;
      const margem = precoVenda > 0 && custoUnit > 0
        ? Math.round(((precoVenda - custoUnit) / precoVenda) * 1000) / 10
        : null;
      return {
        codProduto: String(row.COD_PRODUTO),
        descricao: row.DESCRICAO || '',
        codBarras: row.COD_BARRAS || '',
        secao: row.SECAO || '',
        freqJunto: Number(row.FREQ_JUNTO) || 0,
        vdMediaHistorica: Math.round(vdMedia * 100) / 100,
        vdOferta,
        crescimentoPct,
        precoVenda,
        margem,
      };
    });
  }

  /**
   * Compra e Venda Excedido - produtos "estourados" (compra > custo de venda) no ano corrente.
   * Retorna apenas produtos com DIFERENCA_RS < 0.
   */
  static async getCompraVendaExcedido(codLoja: number, tipoEspecie: number | null = 0, tipoEvento: number | null = 0): Promise<any[]> {
    const m = await resolveMapping();

    if (!m.tabNf || !m.tabNfItem) {
      console.warn('[Ofertas] TAB_NF ou TAB_NF_ITEM nao mapeadas');
      return [];
    }

    // Periodo: 01/01 do ano corrente ate hoje
    const anoAtual = new Date().getFullYear();
    const dataInicio = `01/01/${anoAtual}`;
    const dataFim = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    console.log('[Ofertas] getCompraVendaExcedido - codLoja:', codLoja, 'periodo:', dataInicio, '-', dataFim, 'tipoEspecie:', tipoEspecie, 'tipoEvento:', tipoEvento);

    // Verificar se coluna TIPO_RELEVANCIA existe
    let hasRelevanciaCol = true;
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${m.schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = '${m.plTipoRelevancia}'`;
      const checkRes = await OracleService.query<any>(checkSql);
      if (checkRes.length === 0) hasRelevanciaCol = false;
    } catch (e) {
      hasRelevanciaCol = false;
    }

    // Filtros de tipo especie e tipo evento
    const filtroEspecie = tipoEspecie !== null ? `AND NVL(p.${m.pTipoEspecie}, 0) = :tipoEspecie` : '';
    const filtroEvento = tipoEvento !== null ? `AND NVL(p.${m.pTipoEvento}, 0) = :tipoEvento` : '';

    const sql = `
      SELECT
        p.${m.pCodProduto} as COD_PRODUTO,
        p.${m.pDescricao} as DESCRICAO,
        p.${m.pCodBarras} as COD_BARRAS,
        s.${m.sDesSecao} as SECAO,
        p.${m.pCodSecao} as COD_SECAO,
        NVL(pl.${m.plEstoque}, 0) as ESTOQUE_ATUAL,
        NVL(pl.${m.plDiasCobertura}, 0) as DIAS_COBERTURA,
        NVL(pl.${m.plCurva}, 'X') as CURVA,
        NVL(pl.${m.plValVenda}, 0) as PRECO_VENDA,
        NVL(pl.${m.plValCusto}, 0) as CUSTO_UNITARIO,
        NVL(c.VALOR_COMPRAS, 0) as COMPRAS,
        NVL(v.CUSTO_VENDA, 0) as CUSTO_VENDA,
        NVL(v.VALOR_VENDAS, 0) as VENDAS,
        NVL(v.CUSTO_VENDA, 0) - NVL(c.VALOR_COMPRAS, 0) as DIFERENCA_RS,
        NVL(pl.${m.plVdMedia}, 0) as VD_MEDIA,
        (SELECT COUNT(*) FROM ${m.tabProdutoProg} pp2 WHERE pp2.${m.ppCodProduto} = p.${m.pCodProduto} AND NVL(pp2.${m.ppCodLoja}, :codLoja) = :codLoja) as QTD_OFERTAS,
        NVL(pl.${m.plPesquisaMedia}, 0) as CONC_BARATO,
        pl.${m.plPesquisaConcorrente} as CONC_NOME${hasRelevanciaCol ? `,
        NVL(pl.${m.plTipoRelevancia}, -1) as TIPO_RELEVANCIA` : ''}
      FROM ${m.tabProduto} p
      JOIN (
        SELECT
          ni.${m.niCodItem} as COD_PRODUTO,
          SUM(ni.${m.niValTotal}) as VALOR_COMPRAS
        FROM ${m.tabNf} nf
        JOIN ${m.tabNfItem} ni ON nf.${m.nfNumNf} = ni.${m.niNumNf}
          AND nf.${m.nfSerieNf} = ni.${m.niSerieNf}
          AND nf.${m.nfCodParceiro} = ni.${m.niCodParceiro}
        WHERE nf.${m.nfDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${m.nfTipoOperacao} = 0
          AND nf.${m.nfCodLoja} = :codLoja
          AND TRIM(ni.${m.niCfop}) IN ('1101','1102','2101','2102','1401','1403','1407','2403')
        GROUP BY ni.${m.niCodItem}
      ) c ON p.${m.pCodProduto} = c.COD_PRODUTO
      LEFT JOIN (
        SELECT
          pv.${m.pvCodProduto} as COD_PRODUTO,
          SUM(pv.${m.pvValCustoRep} * pv.${m.pvQtdTotal}) as CUSTO_VENDA,
          SUM(pv.${m.pvValTotal}) as VALOR_VENDAS
        FROM ${m.tabProdutoPdv} pv
        WHERE pv.${m.pvDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND pv.${m.pvCodLoja} = :codLoja
        GROUP BY pv.${m.pvCodProduto}
      ) v ON p.${m.pCodProduto} = v.COD_PRODUTO
      LEFT JOIN ${m.tabSecao} s ON p.${m.pCodSecao} = s.${m.sCodSecao}
      LEFT JOIN ${m.tabProdutoLoja} pl ON p.${m.pCodProduto} = pl.${m.plCodProduto}
        AND pl.${m.plCodLoja} = :codLoja
      WHERE (NVL(v.CUSTO_VENDA, 0) - NVL(c.VALOR_COMPRAS, 0)) < 0
      ${filtroEspecie}
      ${filtroEvento}
      ORDER BY s.${m.sDesSecao}, (NVL(v.CUSTO_VENDA, 0) - NVL(c.VALOR_COMPRAS, 0)) ASC
    `;

    const params: any = { dataInicio, dataFim, codLoja };
    if (tipoEspecie !== null) params.tipoEspecie = tipoEspecie;
    if (tipoEvento !== null) params.tipoEvento = tipoEvento;
    const rows = await OracleService.query<any>(sql, params);

    console.log('[Ofertas] Compra-venda excedido:', rows.length, 'produtos estourados');

    return rows.map((row: any) => {
      const precoVenda = parseFloat(row.PRECO_VENDA) || 0;
      const custoUnit = parseFloat(row.CUSTO_UNITARIO) || 0;
      const compras = parseFloat(row.COMPRAS) || 0;
      const custoVenda = parseFloat(row.CUSTO_VENDA) || 0;
      const vendas = parseFloat(row.VENDAS) || 0;
      const difRS = parseFloat(row.DIFERENCA_RS) || 0;

      // META_PCT = CUSTO_VENDA / VENDAS * 100; PCT = COMPRAS / VENDAS * 100; DIF = META - PCT
      const metaPct = vendas > 0 ? (custoVenda / vendas) * 100 : 0;
      const pct = vendas > 0 ? (compras / vendas) * 100 : 0;
      const difPct = Math.round((metaPct - pct) * 100) / 100;

      // Margem = (PrecoVenda - Custo) / PrecoVenda * 100
      const margem = precoVenda > 0 ? Math.round(((precoVenda - custoUnit) / precoVenda) * 10000) / 100 : 0;

      // Relevancia: 0=N, 1=SP, 2=R
      const tipoRelev = row.TIPO_RELEVANCIA != null ? Number(row.TIPO_RELEVANCIA) : -1;
      let relevancia = '-';
      if (tipoRelev === 0) relevancia = 'N';
      else if (tipoRelev === 1) relevancia = 'SP';
      else if (tipoRelev === 2) relevancia = 'R';

      return {
        COD_PRODUTO: String(row.COD_PRODUTO),
        DESCRICAO: row.DESCRICAO || '',
        COD_BARRAS: row.COD_BARRAS || '',
        SECAO: row.SECAO || 'SEM SECAO',
        COD_SECAO: Number(row.COD_SECAO) || 0,
        ESTOQUE_ATUAL: parseFloat(row.ESTOQUE_ATUAL) || 0,
        DIAS_COBERTURA: Math.round((parseFloat(row.DIAS_COBERTURA) || 0) * 10) / 10,
        CURVA: row.CURVA || 'X',
        PRECO_VENDA: Math.round(precoVenda * 100) / 100,
        CUSTO: Math.round(custoUnit * 100) / 100,
        MARGEM: margem,
        DIF_ANUAL_RS: Math.round(difRS * 100) / 100,
        DIF_ANUAL_PCT: difPct,
        COMPRAS: Math.round(compras * 100) / 100,
        CUSTO_VENDA: Math.round(custoVenda * 100) / 100,
        VENDAS: Math.round(vendas * 100) / 100,
        RELEVANCIA: relevancia,
        QTD_OFERTAS: Number(row.QTD_OFERTAS) || 0,
        VD_MEDIA: Math.round((parseFloat(row.VD_MEDIA) || 0) * 100) / 100,
        CONC_BARATO: Math.round((parseFloat(row.CONC_BARATO) || 0) * 100) / 100,
        CONC_NOME: row.CONC_NOME || '',
      };
    });
  }
}
