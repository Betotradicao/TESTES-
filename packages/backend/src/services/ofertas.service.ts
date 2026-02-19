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

  return {
    schema,
    // Tabelas
    tabProgramacao, tabProdutoProg, tabProduto, tabProdutoLoja, tabProdutoPdv, tabSecao, tabFornecedor,
    // TAB_PROGRAMACAO cols
    pgCodProg, pgDesProgramacao, pgDtaInicial, pgDtaFinal, pgHorInicio, pgHorFinal, pgTipoProgramacao, pgCodLoja,
    // TAB_PRODUTO_PROG cols
    ppCodProg, ppCodProduto, ppValProg, ppCodLoja,
    // TAB_PRODUTO cols
    pCodProduto, pDescricao, pCodSecao, pCodFornecedor, pCodBarras,
    // TAB_PRODUTO_LOJA cols
    plCodProduto, plCodLoja, plValVenda, plValCusto, plEstoque, plCurva, plVdMedia,
    // TAB_PRODUTO_PDV cols
    pvValTotal, pvValCustoRep, pvQtdTotal, pvFlgOferta, pvCodProduto, pvDtaSaida, pvCodLoja,
    // TAB_SECAO cols
    sCodSecao, sDesSecao,
    // TAB_FORNECEDOR cols
    fCodFornecedor, fDesFornecedor,
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
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${m.schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = 'TIPO_RELEVANCIA'`;
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
        NVL(pl.${m.plEstoque}, 0) as ESTOQUE,
        NVL(pl.${m.plVdMedia}, 0) as VD_MEDIA,
        NVL(pl.${m.plCurva}, 'X') as CURVA,
        s.${m.sDesSecao} as SECAO,
        p.${m.pCodSecao} as COD_SECAO,
        f.${m.fDesFornecedor} as FORNECEDOR,
        p.${m.pCodFornecedor} as COD_FORNECEDOR${hasRelevanciaCol ? `,
        NVL(pl.TIPO_RELEVANCIA, -1) as TIPO_RELEVANCIA` : ''}
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
        f.${m.fDesFornecedor}, p.${m.pCodFornecedor}${hasRelevanciaCol ? `, pl.TIPO_RELEVANCIA` : ''}` : ''}
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
      const tipoRelev = row.TIPO_RELEVANCIA;
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
}
