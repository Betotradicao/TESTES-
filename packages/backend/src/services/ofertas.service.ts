/**
 * Ofertas Service
 * Consulta programacoes/ofertas ativas do Oracle (TAB_PROGRAMACAO + TAB_PRODUTO_PROG)
 * com dados enriquecidos de produto, estoque, preco e margem.
 *
 * TAB_PROGRAMACAO e TAB_PRODUTO_PROG: colunas diretas (nao estao no MappingService)
 * TAB_PRODUTO e TAB_PRODUTO_LOJA: resolvidos via MappingService
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

export class OfertasService {

  /**
   * Lista programacoes (ativas ou todas)
   */
  static async getProgramacoes(codLoja: number, ativas: boolean = true): Promise<Programacao[]> {
    const schema = await MappingService.getSchema();

    let whereAtivas = '';
    if (ativas) {
      // Considerar horario: oferta ativa se SYSDATE esta entre DTA_INICIAL+HOR_INICIO e DTA_FINAL+HOR_FINAL
      whereAtivas = `AND (TRUNC(pg.DTA_FINAL) + NVL(pg.HOR_FINAL, 23)/24) >= SYSDATE
      AND (TRUNC(pg.DTA_INICIAL) + NVL(pg.HOR_INICIO, 0)/24) <= SYSDATE`;
    }

    const sql = `
      SELECT
        pg.COD_PROG,
        pg.DES_PROGRAMACAO,
        TO_CHAR(pg.DTA_INICIAL, 'DD/MM/YYYY') as DTA_INICIAL,
        TO_CHAR(pg.DTA_FINAL, 'DD/MM/YYYY') as DTA_FINAL,
        NVL(pg.HOR_INICIO, 0) as HOR_INICIO,
        NVL(pg.HOR_FINAL, 23) as HOR_FINAL,
        pg.TIPO_PROGRAMACAO,
        NVL(pg.COD_LOJA, :codLoja) as COD_LOJA,
        (SELECT COUNT(*) FROM ${schema}.TAB_PRODUTO_PROG pp WHERE pp.COD_PROG = pg.COD_PROG AND NVL(pp.COD_LOJA, :codLoja) = :codLoja) as TOTAL_PRODUTOS
      FROM ${schema}.TAB_PROGRAMACAO pg
      WHERE NVL(pg.COD_LOJA, :codLoja) = :codLoja
      ${whereAtivas}
      ORDER BY pg.DTA_FINAL DESC, pg.DES_PROGRAMACAO
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
    const schema = await MappingService.getSchema();

    // Resolver colunas via MappingService para TAB_PRODUTO e TAB_PRODUTO_LOJA
    const colCodProdutoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoP = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');

    const colCodProdutoPL = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaPL = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');

    // Resolver nomes reais das tabelas
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;

    // Resolver colunas da TAB_PRODUTO_LOJA (mesmos nomes logicos do competitividade.service)
    const colValVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const colValCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
    const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

    // Resolver colunas da TAB_PRODUTO_PDV (mesma logica da gestao-inteligente.service)
    const colValTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colQtdTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colFlgOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');
    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');

    // Colunas opcionais com fallback
    let colCodFornecedor = 'COD_FORNECEDOR';
    let colVdMedia = 'VD_MEDIA';
    let colCodBarras = 'COD_BARRA_PRINCIPAL';
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_fornecedor'); if (v) colCodFornecedor = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media'); if (v) colVdMedia = v; } catch {}
    try { const v = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras'); if (v) colCodBarras = v; } catch {}

    // Resolver colunas da secao e fornecedor
    const colCodSecaoS = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    // TAB_FORNECEDOR: usar colunas diretas (COD_FORNECEDOR e DES_FORNECEDOR)
    const colCodFornecedorF = 'COD_FORNECEDOR';
    const colDesFornecedor = 'DES_FORNECEDOR';

    // Verificar se coluna TIPO_RELEVANCIA existe na TAB_PRODUTO_LOJA
    let hasRelevanciaCol = true;
    try {
      const tblName = (await MappingService.getRealTableName('TAB_PRODUTO_LOJA')).replace(/"/g, '');
      const checkSql = `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = '${schema.replace(/"/g, '')}' AND TABLE_NAME = '${tblName}' AND COLUMN_NAME = 'TIPO_RELEVANCIA'`;
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
        ? `AND DTA_FINAL >= TRUNC(SYSDATE, 'MM') AND DTA_INICIAL <= LAST_DAY(SYSDATE)`
        : '';
      const progSql = `
        SELECT MIN(DTA_INICIAL) as DTA_INICIAL, MAX(DTA_FINAL) as DTA_FINAL,
          MIN(NVL(HOR_INICIO, 0)) as HOR_INICIO, MAX(NVL(HOR_FINAL, 23)) as HOR_FINAL
        FROM ${schema}.TAB_PROGRAMACAO
        WHERE NVL(COD_LOJA, :codLoja) = :codLoja
        ${filtroMes}
      `;
      const progRows = await OracleService.query<any>(progSql, { codLoja });
      dtaInicial = progRows[0]?.DTA_INICIAL || null;
      dtaFinal = progRows[0]?.DTA_FINAL || null;
      horInicio = Number(progRows[0]?.HOR_INICIO) || 0;
      horFinal = Number(progRows[0]?.HOR_FINAL) || 23;
    } else {
      const progSql = `
        SELECT DTA_INICIAL, DTA_FINAL, NVL(HOR_INICIO, 0) as HOR_INICIO, NVL(HOR_FINAL, 23) as HOR_FINAL
        FROM ${schema}.TAB_PROGRAMACAO
        WHERE COD_PROG = :codProg
      `;
      const progRows = await OracleService.query<any>(progSql, { codProg });
      dtaInicial = progRows[0]?.DTA_INICIAL || null;
      dtaFinal = progRows[0]?.DTA_FINAL || null;
      horInicio = Number(progRows[0]?.HOR_INICIO) || 0;
      horFinal = Number(progRows[0]?.HOR_FINAL) || 23;
    }

    // 2) Query principal de produtos
    // Se codProg=0 (todas), nao filtra por COD_PROG e usa GROUP BY para evitar duplicados
    const filtroProgProd = todasProgs ? '' : 'AND pp.COD_PROG = :codProg';
    // Se "todas" + mesAtual, filtrar programacoes do mes atual via JOIN
    const filtroMesProd = (todasProgs && mesAtual)
      ? `AND pp.COD_PROG IN (SELECT COD_PROG FROM ${schema}.TAB_PROGRAMACAO WHERE NVL(COD_LOJA, :codLoja) = :codLoja AND DTA_FINAL >= TRUNC(SYSDATE, 'MM') AND DTA_INICIAL <= LAST_DAY(SYSDATE))`
      : '';
    const sql = `
      SELECT
        pp.COD_PRODUTO,
        p.${colDesProduto} as DESCRICAO,
        p.${colCodBarras} as COD_BARRAS,
        NVL(pl.${colValCusto}, 0) as CUSTO,
        NVL(pl.${colValVenda}, 0) as PRECO_NORMAL,
        ${todasProgs ? `MIN(NVL(pp.VAL_PROG, 0))` : `NVL(pp.VAL_PROG, 0)`} as PRECO_OFERTA,
        NVL(pl.${colEstoque}, 0) as ESTOQUE,
        NVL(pl.${colVdMedia}, 0) as VD_MEDIA,
        NVL(pl.${colCurva}, 'X') as CURVA,
        s.${colDesSecao} as SECAO,
        p.${colCodSecaoP} as COD_SECAO,
        f.${colDesFornecedor} as FORNECEDOR,
        p.${colCodFornecedor} as COD_FORNECEDOR${hasRelevanciaCol ? `,
        NVL(pl.TIPO_RELEVANCIA, -1) as TIPO_RELEVANCIA` : ''}
      FROM ${schema}.TAB_PRODUTO_PROG pp
      JOIN ${tabProduto} p ON pp.COD_PRODUTO = p.${colCodProdutoP}
      JOIN ${tabProdutoLoja} pl ON pp.COD_PRODUTO = pl.${colCodProdutoPL}
        AND pl.${colCodLojaPL} = :codLoja
      LEFT JOIN ${tabSecao} s ON p.${colCodSecaoP} = s.${colCodSecaoS}
      LEFT JOIN ${tabFornecedor} f ON p.${colCodFornecedor} = f.${colCodFornecedorF}
      WHERE NVL(pp.COD_LOJA, :codLoja) = :codLoja
        ${filtroProgProd}
        ${filtroMesProd}
      ${todasProgs ? `GROUP BY pp.COD_PRODUTO, p.${colDesProduto}, p.${colCodBarras}, pl.${colValCusto}, pl.${colValVenda},
        pl.${colEstoque}, pl.${colVdMedia}, pl.${colCurva}, s.${colDesSecao}, p.${colCodSecaoP},
        f.${colDesFornecedor}, p.${colCodFornecedor}${hasRelevanciaCol ? `, pl.TIPO_RELEVANCIA` : ''}` : ''}
      ORDER BY s.${colDesSecao}, p.${colDesProduto}
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
      // TRUNC(dtaIni) + horInicio/24 = datetime exato de inicio
      // TRUNC(dtaFim) + horFinal/24 = datetime exato de fim
      const vendasAgregSql = `
        SELECT
          NVL(SUM(pv.${colValTotalProduto}), 0) as VENDAS_TOTAL,
          NVL(SUM(CASE WHEN pv.${colFlgOferta} = 'S' THEN pv.${colValTotalProduto} ELSE 0 END), 0) as VENDAS_OFERTA,
          NVL(SUM(CASE WHEN pv.${colFlgOferta} = 'S' THEN pv.${colValCustoRep} * pv.${colQtdTotalProduto} ELSE 0 END), 0) as CUSTO_OFERTA
        FROM ${tabProdutoPdv} pv
        WHERE pv.${colDtaSaida} BETWEEN (TRUNC(:dtaIni) + :horIni/24) AND LEAST(TRUNC(:dtaFim) + :horFim/24, SYSDATE)
          AND pv.${colCodLojaPdv} = :codLoja
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
            SELECT pv.${colCodProdutoPdv} as COD_PRODUTO,
              NVL(SUM(pv.${colQtdTotalProduto}), 0) as QTD_VENDIDA
            FROM ${tabProdutoPdv} pv
            WHERE pv.${colDtaSaida} BETWEEN (TRUNC(:dtaIni) + :horIni/24) AND LEAST(TRUNC(:dtaFim) + :horFim/24, SYSDATE)
              AND pv.${colCodLojaPdv} = :codLoja
              AND pv.${colCodProdutoPdv} IN (${placeholders})
            GROUP BY pv.${colCodProdutoPdv}
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
