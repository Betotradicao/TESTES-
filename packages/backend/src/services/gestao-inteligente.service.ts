/**
 * Gestao Inteligente Service
 * Serviço para buscar indicadores consolidados de vendas
 * Fonte: Banco Oracle Intersolid
 * Cache: 5 minutos com opção de limpar manualmente
 */

import { OracleService } from './oracle.service';
import { CacheService } from './cache.service';
import { AppDataSource } from '../config/database';
import { Company } from '../entities/Company';
import { Holiday } from '../entities/Holiday';
import { MappingService } from './mapping.service';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
import { PostgresErpService } from './postgres-erp.service';

const CACHE_KEY = 'gestao-inteligente-indicadores';
const CACHE_TTL_MINUTES = 5; // 5 minutos de cache

// Interface para comparativos (Mês Passado, Ano Passado, Média Linear)
export interface IndicadorComparativo {
  atual: number;
  mesPassado: number;
  anoPassado: number;
  mediaLinear: number;
}

export interface IndicadoresGestao {
  vendas: IndicadorComparativo;
  lucro: IndicadorComparativo;
  lucroLiquido: IndicadorComparativo;
  custoVendas: IndicadorComparativo;
  compras: IndicadorComparativo;
  impostos: IndicadorComparativo;
  markdown: IndicadorComparativo;
  margemLimpa: IndicadorComparativo;
  ticketMedio: IndicadorComparativo;
  pctCompraVenda: IndicadorComparativo;
  qtdCupons: IndicadorComparativo;
  qtdItens: IndicadorComparativo;
  qtdSkus: IndicadorComparativo;
  pctVendasOferta: IndicadorComparativo;
  vendasOferta: IndicadorComparativo;
  markdownOferta: IndicadorComparativo;
}

export interface IndicadoresFilters {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  codLoja?: number;
  tiposSaida?: string; // ex: "0,1,2,3,4" (comma-separated TIPO_SAIDA values)
}

export class GestaoInteligenteService {
  /**
   * Converte data do formato YYYY-MM-DD para DD/MM/YYYY (Oracle)
   */
  private static formatDateToOracle(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  /**
   * Calcula datas do mesmo período no mês passado
   * Usa parsing manual para evitar problemas de timezone
   */
  private static calcularMesPassado(dataInicio: string, dataFim: string): { inicio: string; fim: string } {
    // Parse manual: YYYY-MM-DD
    const [anoIni, mesIni, diaIni] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);

    // Calcular mês anterior
    let mesIniNovo = mesIni - 1;
    let anoIniNovo = anoIni;
    if (mesIniNovo < 1) {
      mesIniNovo = 12;
      anoIniNovo--;
    }

    let mesFimNovo = mesFim - 1;
    let anoFimNovo = anoFim;
    if (mesFimNovo < 1) {
      mesFimNovo = 12;
      anoFimNovo--;
    }

    // Ajustar dia para não ultrapassar o último dia do mês destino
    const ultimoDiaIni = new Date(anoIniNovo, mesIniNovo, 0).getDate();
    const ultimoDiaFim = new Date(anoFimNovo, mesFimNovo, 0).getDate();
    const diaIniAjustado = Math.min(diaIni, ultimoDiaIni);
    const diaFimAjustado = Math.min(diaFim, ultimoDiaFim);

    const formatDate = (dia: number, mes: number, ano: number) => {
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    };

    return {
      inicio: formatDate(diaIniAjustado, mesIniNovo, anoIniNovo),
      fim: formatDate(diaFimAjustado, mesFimNovo, anoFimNovo)
    };
  }

  /**
   * Calcula datas do mesmo período no ano passado
   * Usa parsing manual para evitar problemas de timezone
   */
  private static calcularAnoPassado(dataInicio: string, dataFim: string): { inicio: string; fim: string } {
    // Parse manual: YYYY-MM-DD
    const [anoIni, mesIni, diaIni] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);

    // Ajustar dia para não ultrapassar o último dia do mês no ano anterior (ex: 29/02 em ano não-bissexto)
    const ultimoDiaIni = new Date(anoIni - 1, mesIni, 0).getDate();
    const ultimoDiaFim = new Date(anoFim - 1, mesFim, 0).getDate();
    const diaIniAjustado = Math.min(diaIni, ultimoDiaIni);
    const diaFimAjustado = Math.min(diaFim, ultimoDiaFim);

    const formatDate = (dia: number, mes: number, ano: number) => {
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    };

    return {
      inicio: formatDate(diaIniAjustado, mesIni, anoIni - 1),
      fim: formatDate(diaFimAjustado, mesFim, anoFim - 1)
    };
  }

  /** Detecta tipo do banco ativo (oracle/postgresql) */
  private static async detectActiveDbType(): Promise<'oracle' | 'postgresql' | 'other'> {
    try {
      if (!AppDataSource.isInitialized) return 'oracle';
      const repo = AppDataSource.getRepository(DatabaseConnection);
      let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
      if (!conn) conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
      if (!conn) conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
      if (!conn) return 'oracle';
      if (conn.type === DatabaseType.POSTGRESQL) return 'postgresql';
      if (conn.type === DatabaseType.ORACLE) return 'oracle';
      return 'other';
    } catch { return 'oracle'; }
  }

  /** Busca indicadores via PostgreSQL ERP (Nunes/RP INFO) - vdonlineprod */
  /**
   * RP INFO: vdonlineprod so tem ~13 dias. Pra periodos anteriores, usa vdadet{MM}{YY}.
   * Este helper monta UNION ALL normalizando ambas as fontes.
   * vdadet nao se sobrepoe com vdonlineprod (filtro datamvto < MIN(vopr_datamvto)).
   */
  private static buildVendasUnionSql(dtIni: string, dtFim: string): string {
    const partes: string[] = [];
    // vdonlineprod (tempo real)
    partes.push(`
      SELECT v.vopr_datamvto AS data, v.vopr_unid_codigo AS loja, v.vopr_prod_codigo AS prod_codigo, v.vopr_qtde AS qtde,
        (v.vopr_valor - COALESCE(v.vopr_desconto,0) + COALESCE(v.vopr_acrescimo,0)) AS valor_total,
        (v.vopr_custoentrada * v.vopr_qtde + COALESCE(v.vopr_icmsvalor,0)) AS custo_total,
        (COALESCE(v.vopr_icmsvalor,0)+COALESCE(v.vopr_pisvalor,0)+COALESCE(v.vopr_cofinsvalor,0)+COALESCE(v.vopr_fcpvalor,0)) AS imposto_total,
        v.vopr_cupom AS cupom, v.vopr_pdvs_codigo AS pdv,
        CASE WHEN COALESCE(v.vopr_agof_codigo,0) > 0 THEN 1 ELSE 0 END AS oferta_flag
      FROM public.vdonlineprod v
      WHERE v.vopr_datamvto BETWEEN $1::date AND $2::date AND v.vopr_tiporeg = 'IT' AND COALESCE(v.vopr_cancmotivo,'') = ''
    `);
    // vdadet por mes (historico)
    const [yI, mI] = dtIni.split('-').map(Number);
    const [yF, mF] = dtFim.split('-').map(Number);
    let cy = yI, cm = mI;
    while (cy < yF || (cy === yF && cm <= mF)) {
      const t = `vdadet${String(cm).padStart(2,'0')}${String(cy).slice(-2)}`;
      partes.push(`
        SELECT d.vdet_datamvto AS data, d.vdet_unid_codigo AS loja, d.vdet_prod_codigo AS prod_codigo, d.vdet_qtde AS qtde,
          (d.vdet_valor - COALESCE(d.vdet_valordesc,0) + COALESCE(d.vdet_valoracfin,0)) AS valor_total,
          (d.vdet_custounit * d.vdet_qtde + COALESCE(d.vdet_valoricms,0) + COALESCE(d.vdet_valorfcp,0)) AS custo_total,
          (COALESCE(d.vdet_valoricms,0)+COALESCE(d.vdet_valorfcp,0)) AS imposto_total,
          d.vdet_cupom AS cupom, d.vdet_pdv AS pdv,
          CASE WHEN d.vdet_oferta = 'S' THEN 1 ELSE 0 END AS oferta_flag
        FROM public.${t} d
        WHERE d.vdet_datamvto BETWEEN $1::date AND $2::date
          AND d.vdet_datamvto < COALESCE((SELECT MIN(vopr_datamvto) FROM public.vdonlineprod WHERE vopr_unid_codigo = d.vdet_unid_codigo),'9999-12-31'::date)
      `);
      cm++; if (cm > 12) { cm = 1; cy++; }
    }
    return `(${partes.join(' UNION ALL ')}) pv`;
  }

  private static async buscarIndicadoresPeriodoPostgresErp(
    dataInicio: string, dataFim: string, codLoja?: number, _tiposSaida?: string
  ): Promise<{ vendas: number; custoVendas: number; impostos: number; impostoCredito: number; qtdItens: number; qtdCupons: number; compras: number; vendasOferta: number; custoOferta: number; qtdSkus: number; }> {
    const toIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
    const dtIni = toIso(dataInicio);
    const dtFim = toIso(dataFim);
    const schema = await MappingService.getSchema();

    // UNION vdonlineprod + vdadet (historico) pra cobrir mes passado/ano passado
    const vendasUnion = this.buildVendasUnionSql(dtIni, dtFim);
    let vendasSql = `
      SELECT
        COALESCE(SUM(valor_total), 0)::float AS vendas,
        COALESCE(SUM(custo_total), 0)::float AS custo_vendas,
        COALESCE(SUM(imposto_total), 0)::float AS impostos,
        0::float AS imposto_credito,
        COALESCE(SUM(qtde), 0)::float AS qtd_itens,
        COALESCE(SUM(CASE WHEN oferta_flag = 1 THEN valor_total ELSE 0 END), 0)::float AS vendas_oferta,
        COALESCE(SUM(CASE WHEN oferta_flag = 1 THEN custo_total ELSE 0 END), 0)::float AS custo_oferta,
        COUNT(DISTINCT prod_codigo)::int AS qtd_skus
      FROM ${vendasUnion} WHERE 1=1
    `;
    const vendasParams: any[] = [dtIni, dtFim];
    if (codLoja) { vendasSql += ` AND loja::int = $${vendasParams.length+1}::int`; vendasParams.push(codLoja); }

    // Cupons do UNION
    let cuponsSql = `SELECT COUNT(DISTINCT (cupom || '-' || pdv || '-' || loja))::int AS qtd_cupons FROM ${vendasUnion} WHERE 1=1`;
    const cuponsParams: any[] = [dtIni, dtFim];
    if (codLoja) { cuponsSql += ` AND loja::int = $${cuponsParams.length+1}::int`; cuponsParams.push(codLoja); }

    let comprasSql = `SELECT COALESCE(SUM(pcpc_valor), 0)::float AS compras FROM ${schema}.pedcomprac WHERE pcpc_status = 'B' AND pcpc_datamvto BETWEEN $1::date AND $2::date`;
    const comprasParams: any[] = [dtIni, dtFim];
    if (codLoja) { comprasSql += ` AND pcpc_unid_dest::int = $${comprasParams.length+1}::int`; comprasParams.push(codLoja); }

    // Venda Flex (Venda Direta) via movprodd - dcto_tipo EVD
    // movprodd e particionado por mes: movprodd{MMYY}
    const flexParts: string[] = [];
    let cy2 = parseInt(dtIni.split('-')[0]), cm2 = parseInt(dtIni.split('-')[1]);
    const yF2 = parseInt(dtFim.split('-')[0]), mF2 = parseInt(dtFim.split('-')[1]);
    while (cy2 < yF2 || (cy2 === yF2 && cm2 <= mF2)) {
      flexParts.push(`SELECT mprd_valor, mprd_ctcompra, COALESCE(mprd_icmsvalor,0) + COALESCE(mprd_valorpis,0) + COALESCE(mprd_valorcofins,0) AS imp FROM public.movprodd${String(cm2).padStart(2,'0')}${String(cy2).slice(-2)} WHERE mprd_datamvto BETWEEN $1::date AND $2::date AND mprd_dcto_tipo = 'EVD'`);
      cm2++; if (cm2 > 12) { cm2 = 1; cy2++; }
    }
    let flexSql = `SELECT COALESCE(SUM(mprd_valor),0)::float AS venda_flex, COALESCE(SUM(mprd_ctcompra + imp),0)::float AS custo_flex FROM (${flexParts.join(' UNION ALL ')}) fx WHERE 1=1`;
    const flexParams: any[] = [dtIni, dtFim];
    if (codLoja) { flexSql = `SELECT COALESCE(SUM(mprd_valor),0)::float AS venda_flex, COALESCE(SUM(mprd_ctcompra + imp),0)::float AS custo_flex FROM (${flexParts.map(p => p + ` AND mprd_unid_codigo = $3`).join(' UNION ALL ')}) fx WHERE 1=1`; flexParams.push(codLoja); }

    const [vR, cR, coR, fR] = await Promise.all([
      PostgresErpService.query<any>(vendasSql, vendasParams),
      PostgresErpService.query<any>(cuponsSql, cuponsParams),
      PostgresErpService.query<any>(comprasSql, comprasParams),
      PostgresErpService.query<any>(flexSql, flexParams).catch((e) => { console.error('❌ [GI] Flex query error:', e.message); return [{ venda_flex: 0, custo_flex: 0 }]; })
    ]);

    const vendasPdv = Number(vR[0]?.vendas) || 0;
    const vendaFlex = Number(fR[0]?.venda_flex) || 0;
    const custoPdv = Number(vR[0]?.custo_vendas) || 0;
    const custoFlex = Number(fR[0]?.custo_flex) || 0;

    console.log(`📊 [GI PG] Vendas PDV=${vendasPdv.toFixed(2)} Flex=${vendaFlex.toFixed(2)} Total=${(vendasPdv+vendaFlex).toFixed(2)} | Custo PDV=${custoPdv.toFixed(2)} Flex=${custoFlex.toFixed(2)}`);

    // PG: custo_total ja inclui impostos (custoentrada + icms)
    // Venda total = PDV + Flex (Venda Direta)
    // Retornar impostos=0 para nao duplicar no calculo de lucro liquido
    return {
      vendas: vendasPdv + vendaFlex, custoVendas: custoPdv + custoFlex,
      impostos: 0, impostoCredito: 0,
      qtdItens: Number(vR[0]?.qtd_itens) || 0, qtdCupons: Number(cR[0]?.qtd_cupons) || 0,
      compras: Number(coR[0]?.compras) || 0, vendasOferta: Number(vR[0]?.vendas_oferta) || 0,
      custoOferta: Number(vR[0]?.custo_oferta) || 0, qtdSkus: Number(vR[0]?.qtd_skus) || 0
    };
  }

  /**
   * Busca indicadores de um período específico - BIFURCA Oracle/PG
   */
  private static async buscarIndicadoresPeriodo(
    dataInicio: string,
    dataFim: string,
    codLoja?: number,
    tiposSaida?: string
  ): Promise<{
    vendas: number;
    custoVendas: number;
    impostos: number;
    impostoCredito: number;
    qtdItens: number;
    qtdCupons: number;
    compras: number;
    vendasOferta: number;
    custoOferta: number;
    qtdSkus: number;
  }> {
    // Bifurca: PostgreSQL ERP (Nunes) ou Oracle (Tradicao/SuperVital)
    const dbType = await this.detectActiveDbType();
    if (dbType === 'postgresql') {
      return this.buscarIndicadoresPeriodoPostgresErp(dataInicio, dataFim, codLoja, tiposSaida);
    }

    // Caminho Oracle (codigo original)
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;

    // Resolver colunas via MappingService
    const colValTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colQtdTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colFlgOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');
    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colNumCupomCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'numero_cupom');
    const colDtaVendaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'data_venda');
    const colCodTipoCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_tipo');
    const colCodLojaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_loja');
    // Colunas NF/NF_ITEM (mesma fonte que Compra e Venda)
    const colNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const colSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const colDtaEntradaNf = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const colCodParceiroNf = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const colTipoOperacaoNf = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const colCodLojaNf = await MappingService.getColumnFromTable('TAB_NF', 'codigo_loja');
    const colNumNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const colSerieNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const colCodParceiroItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const colValTotalItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');
    let colCfopNi = 'CFOP';
    try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'cfop'); if (v) colCfopNi = v; } catch {}
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');
    // CFOPs de compra para comercialização (mesmo filtro padrão da tela Compra e Venda)
    const cfopCompras = "('1101','1102','2101','2102','1401','1403','2403')";

    let vendasQuery = `
      SELECT
        NVL(SUM(pv.${colValTotalProduto}), 0) as VENDAS,
        NVL(SUM(pv.${colValCustoRep} * pv.${colQtdTotalProduto}), 0) as CUSTO_VENDAS,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(pv.${colQtdTotalProduto}), 0) as QTD_ITENS,
        NVL(SUM(CASE WHEN pv.${colFlgOferta} = 'S' THEN pv.${colValTotalProduto} ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(CASE WHEN pv.${colFlgOferta} = 'S' THEN pv.${colValCustoRep} * pv.${colQtdTotalProduto} ELSE 0 END), 0) as CUSTO_OFERTA,
        COUNT(DISTINCT pv.${colCodProdutoPdv}) as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      WHERE pv.${colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;
    const vendasParams: any = { dataInicio, dataFim };
    if (codLoja) {
      vendasQuery += ` AND pv.${colCodLojaPdv} = :codLoja`;
      vendasParams.codLoja = codLoja;
    }

    // Filtro por tipo de saída (PDV, Combustível, Transferência, etc)
    const colTipoSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'tipo_saida');
    if (tiposSaida && tiposSaida.length > 0) {
      const tipos = tiposSaida.split(',').map((t: string) => parseInt(t.trim())).filter((t: number) => !isNaN(t));
      if (tipos.length > 0) {
        vendasQuery += ` AND pv.${colTipoSaida} IN (${tipos.join(',')})`;
      }
    }

    let cuponsQuery = `
      SELECT COUNT(DISTINCT cf.${colNumCupomCf}) as QTD_CUPONS
      FROM ${tabCupomFinalizadora} cf
      WHERE cf.${colDtaVendaCf} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.${colCodTipoCf} = 1110
    `;
    const cuponsParams: any = { dataInicio, dataFim };
    if (codLoja) {
      cuponsQuery += ` AND cf.${colCodLojaCf} = :codLoja`;
      cuponsParams.codLoja = codLoja;
    }

    let comprasQuery = `
      SELECT NVL(SUM(ni.${colValTotalItem}), 0) as COMPRAS
      FROM ${tabNf} n
      JOIN ${tabNfItem} ni ON n.${colNumNf} = ni.${colNumNfItem}
        AND n.${colSerieNf} = ni.${colSerieNfItem}
        AND n.${colCodParceiroNf} = ni.${colCodParceiroItem}
      WHERE n.${colDtaEntradaNf} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND n.${colTipoOperacaoNf} = 0
        AND TRIM(ni.${colCfopNi}) IN ${cfopCompras}
    `;
    const comprasParams: any = { dataInicio, dataFim };
    if (codLoja) {
      comprasQuery += ` AND n.${colCodLojaNf} = :codLoja`;
      comprasParams.codLoja = codLoja;
    }

    const [vendasResult, cuponsResult, comprasResult] = await Promise.all([
      OracleService.query<any>(vendasQuery, vendasParams),
      OracleService.query<any>(cuponsQuery, cuponsParams),
      OracleService.query<any>(comprasQuery, comprasParams)
    ]);

    return {
      vendas: vendasResult[0]?.VENDAS || 0,
      custoVendas: vendasResult[0]?.CUSTO_VENDAS || 0,
      impostos: vendasResult[0]?.IMPOSTOS || 0,
      impostoCredito: vendasResult[0]?.IMPOSTO_CREDITO || 0,
      qtdItens: vendasResult[0]?.QTD_ITENS || 0,
      qtdCupons: cuponsResult[0]?.QTD_CUPONS || 0,
      compras: comprasResult[0]?.COMPRAS || 0,
      vendasOferta: vendasResult[0]?.VENDAS_OFERTA || 0,
      custoOferta: vendasResult[0]?.CUSTO_OFERTA || 0,
      qtdSkus: vendasResult[0]?.QTD_SKUS || 0
    };
  }

  /**
   * Calcula todos os indicadores derivados a partir dos dados brutos
   */
  private static calcularIndicadores(dados: {
    vendas: number;
    custoVendas: number;
    impostos: number;
    impostoCredito?: number;
    qtdItens: number;
    qtdCupons: number;
    compras: number;
    vendasOferta: number;
    custoOferta: number;
    qtdSkus?: number;
  }) {
    const { vendas, custoVendas, impostos, impostoCredito = 0, qtdItens, qtdCupons, compras, vendasOferta, custoOferta, qtdSkus = 0 } = dados;

    const lucro = vendas - custoVendas;
    // Lucro Liquido = vendas - custo - impostos (apos imposto efetivo)
    const lucroLiquido = vendas - custoVendas - impostos + impostoCredito;
    const markdown = vendas > 0 ? ((vendas - custoVendas) / vendas) * 100 : 0;
    // MG LUCRO = ((VENDAS - CUSTO - IMPOSTO_DEBITO + IMPOSTO_CREDITO) / VENDAS) * 100
    // Mesma fórmula usada na tela de Compra e Venda Análise
    const margemLimpa = vendas > 0 ? ((vendas - custoVendas - impostos + impostoCredito) / vendas) * 100 : 0;
    const ticketMedio = qtdCupons > 0 ? vendas / qtdCupons : 0;
    const pctCompraVenda = vendas > 0 ? (compras / vendas) * 100 : 0;
    const pctVendasOferta = vendas > 0 ? (vendasOferta / vendas) * 100 : 0;
    const markdownOferta = vendasOferta > 0 ? ((vendasOferta - custoOferta) / vendasOferta) * 100 : 0;

    return {
      vendas,
      lucro: parseFloat(lucro.toFixed(2)),
      lucroLiquido: parseFloat(lucroLiquido.toFixed(2)),
      custoVendas,
      compras,
      impostos: parseFloat((impostos - impostoCredito).toFixed(2)),
      markdown: parseFloat(markdown.toFixed(2)),
      margemLimpa: parseFloat(margemLimpa.toFixed(2)),
      ticketMedio: parseFloat(ticketMedio.toFixed(2)),
      pctCompraVenda: parseFloat(pctCompraVenda.toFixed(2)),
      qtdCupons,
      qtdItens: parseFloat(qtdItens.toFixed(2)),
      qtdSkus,
      pctVendasOferta: parseFloat(pctVendasOferta.toFixed(2)),
      vendasOferta: parseFloat(vendasOferta.toFixed(2)),
      markdownOferta: parseFloat(markdownOferta.toFixed(2))
    };
  }

  /**
   * Calcula Média Linear baseada nas médias por dia da semana do ano anterior.
   * Lógica: pega a média de vendas/custo/etc por dia da semana do ano anterior inteiro,
   * conta quantos dias de cada tipo existem no período atual, e multiplica.
   * Feriados cadastrados na tela de configurações são tratados separadamente.
   */
  private static async calcularMediaLinear(
    dataInicio: string, // YYYY-MM-DD
    dataFim: string,    // YYYY-MM-DD
    codLoja?: number,
    tiposSaida?: string
  ): Promise<{
    vendas: number;
    custoVendas: number;
    impostos: number;
    impostoCredito: number;
    qtdItens: number;
    qtdCupons: number;
    compras: number;
    vendasOferta: number;
    custoOferta: number;
    qtdSkus: number;
  }> {
    // PG: Nunes nao tem historico completo do ano anterior - retorna zeros
    const dbType = await this.detectActiveDbType();
    if (dbType === 'postgresql') {
      return { vendas: 0, custoVendas: 0, impostos: 0, impostoCredito: 0, qtdItens: 0, qtdCupons: 0, compras: 0, vendasOferta: 0, custoOferta: 0, qtdSkus: 0 };
    }

    const [anoIni, mesIni, diaIni] = dataInicio.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFim.split('-').map(Number);
    const anoAnterior = anoIni - 1;

    console.log(`📐 [MEDIA LINEAR] Calculando para período ${dataInicio} a ${dataFim}, base: ${anoAnterior}`);

    // 1. Carregar feriados cadastrados na tela de Configurações
    const diasDaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    let holidayDates = new Set<string>(); // MM-DD format
    try {
      if (AppDataSource.isInitialized) {
        const holidayRepository = AppDataSource.getRepository(Holiday);
        let holidays: Holiday[];
        if (codLoja) {
          const { IsNull } = await import('typeorm');
          holidays = await holidayRepository.find({
            where: [
              { active: true, type: 'national' },
              { active: true, cod_loja: IsNull() },
              { active: true, cod_loja: codLoja }
            ]
          });
        } else {
          holidays = await holidayRepository.find({ where: { active: true } });
        }
        holidays.forEach(h => holidayDates.add(h.date));
      }
    } catch (err) {
      console.warn('⚠️ [MEDIA LINEAR] Não foi possível carregar feriados:', err);
    }

    // 2. Contar dias do calendário do ano anterior por dia da semana
    const dayTypeCalendarDays: Record<string, number> = {};
    for (const dia of [...diasDaSemana, 'Feriado']) {
      dayTypeCalendarDays[dia] = 0;
    }
    const daysInYear = ((anoAnterior % 4 === 0 && anoAnterior % 100 !== 0) || anoAnterior % 400 === 0) ? 366 : 365;
    for (let d = 0; d < daysInYear; d++) {
      const date = new Date(anoAnterior, 0, 1 + d);
      const m = date.getMonth() + 1;
      const day = date.getDate();
      const mmdd = `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();
      if (holidayDates.has(mmdd)) {
        dayTypeCalendarDays['Feriado']++;
      } else {
        dayTypeCalendarDays[diasDaSemana[dayOfWeek]]++;
      }
    }

    // 3. Queries Oracle: dados diários do ano anterior inteiro
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;

    const colValTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colQtdTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colFlgOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');
    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colNumCupomCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'numero_cupom');
    const colDtaVendaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'data_venda');
    const colCodTipoCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_tipo');
    const colCodLojaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_loja');
    // Colunas NF/NF_ITEM (mesma fonte que Compra e Venda)
    const colNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const colSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const colDtaEntradaNf = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const colCodParceiroNf = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const colTipoOperacaoNf = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const colCodLojaNf = await MappingService.getColumnFromTable('TAB_NF', 'codigo_loja');
    const colNumNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const colSerieNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const colCodParceiroItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const colValTotalItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');
    let colCfopNi = 'CFOP';
    try { const v = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'cfop'); if (v) colCfopNi = v; } catch {}
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');
    const cfopCompras = "('1101','1102','2101','2102','1401','1403','2403')";

    const dataInicioAnoAnt = `01/01/${anoAnterior}`;
    const dataFimAnoAnt = `31/12/${anoAnterior}`;

    // Query vendas diárias (ano anterior inteiro)
    let vendasSql = `
      SELECT
        TRUNC(pv.${colDtaSaida}) as DIA,
        NVL(SUM(pv.${colValTotalProduto}), 0) as VENDAS,
        NVL(SUM(pv.${colValCustoRep} * pv.${colQtdTotalProduto}), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(pv.${colQtdTotalProduto}), 0) as QTD_ITENS,
        NVL(SUM(CASE WHEN pv.${colFlgOferta} = 'S' THEN pv.${colValTotalProduto} ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(CASE WHEN pv.${colFlgOferta} = 'S' THEN pv.${colValCustoRep} * pv.${colQtdTotalProduto} ELSE 0 END), 0) as CUSTO_OFERTA,
        COUNT(DISTINCT pv.${colCodProdutoPdv}) as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      WHERE pv.${colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;
    const vendasParams: any = { dataInicio: dataInicioAnoAnt, dataFim: dataFimAnoAnt };
    if (codLoja) {
      vendasSql += ` AND pv.${colCodLojaPdv} = :codLoja`;
      vendasParams.codLoja = codLoja;
    }
    // Filtro tipo saída na média linear
    const colTipoSaidaML = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'tipo_saida');
    if (tiposSaida && tiposSaida.length > 0) {
      const tipos = tiposSaida.split(',').map((t: string) => parseInt(t.trim())).filter((t: number) => !isNaN(t));
      if (tipos.length > 0) {
        vendasSql += ` AND pv.${colTipoSaidaML} IN (${tipos.join(',')})`;
      }
    }
    vendasSql += ` GROUP BY TRUNC(pv.${colDtaSaida})`;

    // Query cupons diários (ano anterior inteiro)
    let cuponsSql = `
      SELECT TRUNC(cf.${colDtaVendaCf}) as DIA, COUNT(DISTINCT cf.${colNumCupomCf}) as QTD_CUPONS
      FROM ${tabCupomFinalizadora} cf
      WHERE cf.${colDtaVendaCf} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.${colCodTipoCf} = 1110
    `;
    const cuponsParams: any = { dataInicio: dataInicioAnoAnt, dataFim: dataFimAnoAnt };
    if (codLoja) {
      cuponsSql += ` AND cf.${colCodLojaCf} = :codLoja`;
      cuponsParams.codLoja = codLoja;
    }
    cuponsSql += ` GROUP BY TRUNC(cf.${colDtaVendaCf})`;

    // Query compras diárias (ano anterior inteiro) - mesma fonte que Compra e Venda
    let comprasSql = `
      SELECT TRUNC(n.${colDtaEntradaNf}) as DIA,
        NVL(SUM(ni.${colValTotalItem}), 0) as COMPRAS
      FROM ${tabNf} n
      JOIN ${tabNfItem} ni ON n.${colNumNf} = ni.${colNumNfItem}
        AND n.${colSerieNf} = ni.${colSerieNfItem}
        AND n.${colCodParceiroNf} = ni.${colCodParceiroItem}
      WHERE n.${colDtaEntradaNf} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND n.${colTipoOperacaoNf} = 0
        AND TRIM(ni.${colCfopNi}) IN ${cfopCompras}
    `;
    const comprasParams: any = { dataInicio: dataInicioAnoAnt, dataFim: dataFimAnoAnt };
    if (codLoja) {
      comprasSql += ` AND n.${colCodLojaNf} = :codLoja`;
      comprasParams.codLoja = codLoja;
    }
    comprasSql += ` GROUP BY TRUNC(n.${colDtaEntradaNf})`;

    // Query SKUs distintos do período equivalente no ano anterior (COUNT DISTINCT não é aditivo dia a dia)
    const dataInicioEquiv = `${String(diaIni).padStart(2, '0')}/${String(mesIni).padStart(2, '0')}/${anoAnterior}`;
    const dataFimEquiv = `${String(diaFim).padStart(2, '0')}/${String(mesFim).padStart(2, '0')}/${anoAnterior}`;
    let skusPeriodoSql = `
      SELECT COUNT(DISTINCT pv.${colCodProdutoPdv}) as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      WHERE pv.${colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;
    const skusPeriodoParams: any = { dataInicio: dataInicioEquiv, dataFim: dataFimEquiv };
    if (codLoja) {
      skusPeriodoSql += ` AND pv.${colCodLojaPdv} = :codLoja`;
      skusPeriodoParams.codLoja = codLoja;
    }

    // Executar as 4 queries em paralelo
    const [vendasResult, cuponsResult, comprasResult, skusPeriodoResult] = await Promise.all([
      OracleService.query<any>(vendasSql, vendasParams),
      OracleService.query<any>(cuponsSql, cuponsParams),
      OracleService.query<any>(comprasSql, comprasParams),
      OracleService.query<any>(skusPeriodoSql, skusPeriodoParams)
    ]);

    const skusPeriodoAnoAnterior = skusPeriodoResult[0]?.QTD_SKUS || 0;

    console.log(`   📊 [MEDIA LINEAR] ${vendasResult.length} dias vendas, ${cuponsResult.length} dias cupons, ${comprasResult.length} dias compras do ano ${anoAnterior}`);

    // 4. Somar dados por dia da semana (ano anterior)
    const dayTypeTotals: Record<string, { vendas: number; custo: number; impostos: number; impostoCredito: number; itens: number; cupons: number; compras: number; vendasOferta: number; custoOferta: number; skus: number }> = {};
    for (const dia of [...diasDaSemana, 'Feriado']) {
      dayTypeTotals[dia] = { vendas: 0, custo: 0, impostos: 0, impostoCredito: 0, itens: 0, cupons: 0, compras: 0, vendasOferta: 0, custoOferta: 0, skus: 0 };
    }

    // Processar vendas
    for (const row of vendasResult) {
      const date = new Date(row.DIA);
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayType = holidayDates.has(mmdd) ? 'Feriado' : diasDaSemana[date.getDay()];
      dayTypeTotals[dayType].vendas += row.VENDAS || 0;
      dayTypeTotals[dayType].custo += row.CUSTO || 0;
      dayTypeTotals[dayType].impostos += row.IMPOSTOS || 0;
      dayTypeTotals[dayType].impostoCredito += row.IMPOSTO_CREDITO || 0;
      dayTypeTotals[dayType].itens += row.QTD_ITENS || 0;
      dayTypeTotals[dayType].vendasOferta += row.VENDAS_OFERTA || 0;
      dayTypeTotals[dayType].custoOferta += row.CUSTO_OFERTA || 0;
      dayTypeTotals[dayType].skus += row.QTD_SKUS || 0;
    }

    // Processar cupons
    for (const row of cuponsResult) {
      const date = new Date(row.DIA);
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayType = holidayDates.has(mmdd) ? 'Feriado' : diasDaSemana[date.getDay()];
      dayTypeTotals[dayType].cupons += row.QTD_CUPONS || 0;
    }

    // Processar compras
    for (const row of comprasResult) {
      const date = new Date(row.DIA);
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayType = holidayDates.has(mmdd) ? 'Feriado' : diasDaSemana[date.getDay()];
      dayTypeTotals[dayType].compras += row.COMPRAS || 0;
    }

    // 5. Calcular médias por dia da semana = total / dias do calendário
    const dayTypeAvg: Record<string, any> = {};
    for (const [dayType, totals] of Object.entries(dayTypeTotals)) {
      const n = dayTypeCalendarDays[dayType] || 1;
      dayTypeAvg[dayType] = {
        vendas: totals.vendas / n,
        custo: totals.custo / n,
        impostos: totals.impostos / n,
        impostoCredito: totals.impostoCredito / n,
        itens: totals.itens / n,
        cupons: totals.cupons / n,
        compras: totals.compras / n,
        vendasOferta: totals.vendasOferta / n,
        custoOferta: totals.custoOferta / n,
        skus: totals.skus / n
      };
    }

    // 6. Contar dias do período ATUAL por dia da semana
    const currentDayCounts: Record<string, number> = {};
    for (const dia of [...diasDaSemana, 'Feriado']) {
      currentDayCounts[dia] = 0;
    }
    const startDate = new Date(anoIni, mesIni - 1, diaIni);
    const endDate = new Date(anoFim, mesFim - 1, diaFim);
    for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      const m = dt.getMonth() + 1;
      const d = dt.getDate();
      const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayType = holidayDates.has(mmdd) ? 'Feriado' : diasDaSemana[dt.getDay()];
      currentDayCounts[dayType]++;
    }

    // 7. Multiplicar: contagem do período atual × média do ano anterior
    let totalVendas = 0, totalCusto = 0, totalImpostos = 0, totalImpostoCredito = 0, totalItens = 0;
    let totalCupons = 0, totalCompras = 0, totalVendasOferta = 0, totalCustoOferta = 0;
    let totalSkusPonderado = 0;
    let totalDiasPeriodo = 0;

    for (const [dayType, count] of Object.entries(currentDayCounts)) {
      const avg = dayTypeAvg[dayType];
      if (avg && count > 0) {
        totalVendas += count * avg.vendas;
        totalCusto += count * avg.custo;
        totalImpostos += count * avg.impostos;
        totalImpostoCredito += count * avg.impostoCredito;
        totalItens += count * avg.itens;
        totalCupons += count * avg.cupons;
        totalCompras += count * avg.compras;
        totalVendasOferta += count * avg.vendasOferta;
        totalCustoOferta += count * avg.custoOferta;
        // SKUs: média ponderada por dia da semana (DISTINCT não pode ser somado dia a dia)
        totalSkusPonderado += count * avg.skus;
        totalDiasPeriodo += count;
      }
    }

    // SKUs: usar COUNT DISTINCT do período equivalente no ano anterior
    // (COUNT DISTINCT não é aditivo dia a dia, então a média ponderada diária não serve)
    console.log(`   ✅ [MEDIA LINEAR] Vendas previstas: R$ ${totalVendas.toFixed(2)}, SKUs período equiv ano ant: ${skusPeriodoAnoAnterior} (${totalDiasPeriodo} dias) (${Object.entries(currentDayCounts).filter(([,c]) => c > 0).map(([k,v]) => `${k}:${v}`).join(', ')})`);

    return {
      vendas: totalVendas,
      custoVendas: totalCusto,
      impostos: totalImpostos,
      impostoCredito: totalImpostoCredito,
      qtdItens: totalItens,
      qtdCupons: Math.round(totalCupons),
      compras: totalCompras,
      vendasOferta: totalVendasOferta,
      custoOferta: totalCustoOferta,
      qtdSkus: skusPeriodoAnoAnterior
    };
  }

  /**
   * Busca indicadores consolidados de vendas com comparativos (cache de 5 minutos)
   */
  static async getIndicadores(filters: IndicadoresFilters): Promise<IndicadoresGestao> {
    const cacheKey = `${CACHE_KEY}-${filters.dataInicio}-${filters.dataFim}-${filters.codLoja || 'all'}-${filters.tiposSaida || 'all'}`;

    return CacheService.executeWithCache(
      cacheKey,
      async () => {
        const dataInicio = this.formatDateToOracle(filters.dataInicio);
        const dataFim = this.formatDateToOracle(filters.dataFim);

        // Calcular períodos comparativos
        const mesPassado = this.calcularMesPassado(filters.dataInicio, filters.dataFim);
        const anoPassado = this.calcularAnoPassado(filters.dataInicio, filters.dataFim);

        console.log('📊 [GESTAO INTELIGENTE] Buscando indicadores com comparativos...');
        console.log(`   Atual: ${dataInicio} a ${dataFim}`);
        console.log(`   Mês Passado: ${mesPassado.inicio} a ${mesPassado.fim}`);
        console.log(`   Ano Passado: ${anoPassado.inicio} a ${anoPassado.fim}`);
        if (filters.tiposSaida) console.log(`   Tipos Saída: ${filters.tiposSaida}`);

        // Buscar dados de todos os períodos em paralelo (incluindo média linear)
        const [dadosAtual, dadosMesPassado, dadosAnoPassado, dadosMediaLinear] = await Promise.all([
          this.buscarIndicadoresPeriodo(dataInicio, dataFim, filters.codLoja, filters.tiposSaida),
          this.buscarIndicadoresPeriodo(mesPassado.inicio, mesPassado.fim, filters.codLoja, filters.tiposSaida),
          this.buscarIndicadoresPeriodo(anoPassado.inicio, anoPassado.fim, filters.codLoja, filters.tiposSaida),
          this.calcularMediaLinear(filters.dataInicio, filters.dataFim, filters.codLoja, filters.tiposSaida)
        ]);

        // Calcular indicadores de cada período
        const indicadoresAtual = this.calcularIndicadores(dadosAtual);
        const indicadoresMesPassado = this.calcularIndicadores(dadosMesPassado);
        const indicadoresAnoPassado = this.calcularIndicadores(dadosAnoPassado);
        const indicadoresMediaLinear = this.calcularIndicadores(dadosMediaLinear);

        console.log('✅ [GESTAO INTELIGENTE] Indicadores com comparativos calculados');

        // Montar resposta com comparativos
        const criarComparativo = (campo: string): IndicadorComparativo => ({
          atual: (indicadoresAtual as any)[campo],
          mesPassado: (indicadoresMesPassado as any)[campo],
          anoPassado: (indicadoresAnoPassado as any)[campo],
          mediaLinear: (indicadoresMediaLinear as any)[campo]
        });

        return {
          vendas: criarComparativo('vendas'),
          lucro: criarComparativo('lucro'),
          lucroLiquido: criarComparativo('lucroLiquido'),
          custoVendas: criarComparativo('custoVendas'),
          compras: criarComparativo('compras'),
          impostos: criarComparativo('impostos'),
          markdown: criarComparativo('markdown'),
          margemLimpa: criarComparativo('margemLimpa'),
          ticketMedio: criarComparativo('ticketMedio'),
          pctCompraVenda: criarComparativo('pctCompraVenda'),
          qtdCupons: criarComparativo('qtdCupons'),
          qtdItens: criarComparativo('qtdItens'),
          qtdSkus: criarComparativo('qtdSkus'),
          pctVendasOferta: criarComparativo('pctVendasOferta'),
          vendasOferta: criarComparativo('vendasOferta'),
          markdownOferta: criarComparativo('markdownOferta')
        };
      },
      CACHE_TTL_MINUTES
    );
  }

  /**
   * Limpa o cache de indicadores
   */
  static async clearCache(): Promise<void> {
    // Limpar todos os caches que começam com o prefixo
    await CacheService.clearCache();
    console.log('🗑️ [GESTAO INTELIGENTE] Cache limpo manualmente');
  }

  /**
   * Busca vendas por setor
   */
  static async getVendasPorSetor(filters: IndicadoresFilters): Promise<any[]> {
    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);

    // Reusa helper bifurcado (Oracle ou PostgreSQL ERP)
    console.log('📊 [GESTAO INTELIGENTE] Buscando vendas por setor...');
    const result = await this.buscarVendasPorSetorPeriodo(dataInicio, dataFim, filters.codLoja);

    // Calcular total de vendas para % representatividade
    const totalVendas = result.reduce((acc: number, row: any) => acc + (row.VENDA || 0), 0);

    // Calcular métricas para cada setor
    const resultadoComMargem = result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const impostos = row.IMPOSTOS || 0;
      const impostoCredito = row.IMPOSTO_CREDITO || 0;
      const lucro = venda - custo;
      const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
      const margemLiquida = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const margemLimpa = venda > 0 ? ((venda - custo - impostos + impostoCredito) / venda) * 100 : 0;
      const percentualSetor = totalVendas > 0 ? (venda / totalVendas) * 100 : 0;
      const qtdCupons = row.QTD_CUPONS || 0;
      const ticketMedio = qtdCupons > 0 ? venda / qtdCupons : 0;
      const vendasOferta = row.VENDAS_OFERTA || 0;
      const pctOferta = venda > 0 ? (vendasOferta / venda) * 100 : 0;

      const impostoLiquido = impostos - impostoCredito;
      return {
        codSecao: row.COD_SECAO,
        setor: row.SETOR,
        venda: parseFloat(venda.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)),
        impostos: parseFloat(impostoLiquido.toFixed(2)),
        impostoCredito: parseFloat(impostoCredito.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markup: parseFloat(markup.toFixed(2)),
        margemLiquida: parseFloat(margemLiquida.toFixed(2)),
        margemLimpa: parseFloat(margemLimpa.toFixed(2)),
        margem: parseFloat(margemLiquida.toFixed(2)),
        percentualSetor: parseFloat(percentualSetor.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        vendasOferta: parseFloat(vendasOferta.toFixed(2)),
        pctOferta: parseFloat(pctOferta.toFixed(2)),
        qtdCupons,
        qtd: parseFloat((row.QTD || 0).toFixed(2)),
        qtdSkus: row.QTD_SKUS || 0
      };
    });

    console.log(`✅ [GESTAO INTELIGENTE] ${resultadoComMargem.length} setores encontrados`);
    return resultadoComMargem;
  }

  /**
   * Busca grupos de uma seção (nível 2 da hierarquia)
   */
  static async getGruposPorSecao(filters: IndicadoresFilters & { codSecao: number }): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);

    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    // Buscar grupos que pertencem diretamente à seção (via TAB_GRUPO.COD_SECAO)
    // E que tiveram vendas no período
    let sql = `
      SELECT
        g.COD_GRUPO,
        g.DES_GRUPO as GRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabGrupo} g ON g.COD_GRUPO = p.COD_GRUPO AND g.COD_SECAO = :codSecao
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.COD_SECAO = :codSecao
    `;

    const params: any = { dataInicio, dataFim, codSecao: filters.codSecao };

    if (filters.codLoja) {
      sql += ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = filters.codLoja;
    }

    sql += `
      GROUP BY g.COD_GRUPO, g.DES_GRUPO
      ORDER BY VENDA DESC
    `;

    console.log('📊 [GESTAO INTELIGENTE] Buscando grupos da seção:', filters.codSecao);
    const result = await OracleService.query<any>(sql, params);

    // Calcular total para % representatividade
    const totalVendas = result.reduce((acc: number, row: any) => acc + (row.VENDA || 0), 0);

    return result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const impostos = row.IMPOSTOS || 0;
      const impostoCredito = row.IMPOSTO_CREDITO || 0;
      const lucro = venda - custo;
      const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
      const margemLiquida = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const margemLimpa = venda > 0 ? ((venda - custo - impostos + impostoCredito) / venda) * 100 : 0;
      const percentualSetor = totalVendas > 0 ? (venda / totalVendas) * 100 : 0;

      const qtdCupons = row.QTD_CUPONS || 0;
      const ticketMedio = qtdCupons > 0 ? venda / qtdCupons : 0;
      const vendasOferta = row.VENDAS_OFERTA || 0;
      const pctOferta = venda > 0 ? (vendasOferta / venda) * 100 : 0;

      const impostoLiquido = impostos - impostoCredito;
      return {
        codGrupo: row.COD_GRUPO,
        grupo: row.GRUPO,
        venda: parseFloat(venda.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)),
        impostos: parseFloat(impostoLiquido.toFixed(2)),
        impostoCredito: parseFloat(impostoCredito.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markup: parseFloat(markup.toFixed(2)),
        margemLiquida: parseFloat(margemLiquida.toFixed(2)),
        margemLimpa: parseFloat(margemLimpa.toFixed(2)),
        margem: parseFloat(margemLiquida.toFixed(2)),
        percentualSetor: parseFloat(percentualSetor.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        vendasOferta: parseFloat(vendasOferta.toFixed(2)),
        pctOferta: parseFloat(pctOferta.toFixed(2)),
        qtdCupons,
        qtd: parseFloat((row.QTD || 0).toFixed(2)),
        qtdSkus: row.QTD_SKUS || 0
      };
    });
  }

  /**
   * Busca subgrupos de um grupo (nível 3 da hierarquia)
   */
  static async getSubgruposPorGrupo(filters: IndicadoresFilters & { codGrupo: number; codSecao?: number }): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);

    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    // Buscar subgrupos através dos produtos que pertencem ao grupo
    // IMPORTANTE: Colunas são COD_SUB_GRUPO e DES_SUB_GRUPO (com underscore)
    // TAB_SUBGRUPO tem chave composta: COD_SECAO, COD_GRUPO, COD_SUB_GRUPO
    let sql = `
      SELECT
        p.COD_SUB_GRUPO,
        sg.DES_SUB_GRUPO as SUBGRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabSubgrupo} sg ON sg.COD_SECAO = p.COD_SECAO
        AND sg.COD_GRUPO = p.COD_GRUPO
        AND sg.COD_SUB_GRUPO = p.COD_SUB_GRUPO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.COD_GRUPO = :codGrupo
    `;

    const params: any = { dataInicio, dataFim, codGrupo: filters.codGrupo };

    // Filtrar também por seção para garantir hierarquia correta
    if (filters.codSecao) {
      sql += ` AND p.COD_SECAO = :codSecao`;
      params.codSecao = filters.codSecao;
    }

    if (filters.codLoja) {
      sql += ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = filters.codLoja;
    }

    sql += `
      GROUP BY p.COD_SUB_GRUPO, sg.DES_SUB_GRUPO
      ORDER BY VENDA DESC
    `;

    console.log('📊 [GESTAO INTELIGENTE] Buscando subgrupos do grupo:', filters.codGrupo, 'seção:', filters.codSecao);
    const result = await OracleService.query<any>(sql, params);

    // Calcular total para % representatividade
    const totalVendas = result.reduce((acc: number, row: any) => acc + (row.VENDA || 0), 0);

    return result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const impostos = row.IMPOSTOS || 0;
      const impostoCredito = row.IMPOSTO_CREDITO || 0;
      const lucro = venda - custo;
      const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
      const margemLiquida = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const margemLimpa = venda > 0 ? ((venda - custo - impostos + impostoCredito) / venda) * 100 : 0;
      const percentualSetor = totalVendas > 0 ? (venda / totalVendas) * 100 : 0;

      const qtdCupons = row.QTD_CUPONS || 0;
      const ticketMedio = qtdCupons > 0 ? venda / qtdCupons : 0;
      const vendasOferta = row.VENDAS_OFERTA || 0;
      const pctOferta = venda > 0 ? (vendasOferta / venda) * 100 : 0;

      const impostoLiquido = impostos - impostoCredito;
      return {
        codSubgrupo: row.COD_SUB_GRUPO,
        subgrupo: row.SUBGRUPO,
        venda: parseFloat(venda.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)),
        impostos: parseFloat(impostoLiquido.toFixed(2)),
        impostoCredito: parseFloat(impostoCredito.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markup: parseFloat(markup.toFixed(2)),
        margemLiquida: parseFloat(margemLiquida.toFixed(2)),
        margemLimpa: parseFloat(margemLimpa.toFixed(2)),
        margem: parseFloat(margemLiquida.toFixed(2)),
        percentualSetor: parseFloat(percentualSetor.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        vendasOferta: parseFloat(vendasOferta.toFixed(2)),
        pctOferta: parseFloat(pctOferta.toFixed(2)),
        qtdCupons,
        qtd: parseFloat((row.QTD || 0).toFixed(2)),
        qtdSkus: row.QTD_SKUS || 0
      };
    });
  }

  /**
   * Busca itens de um subgrupo (nível 4 da hierarquia)
   */
  static async getItensPorSubgrupo(filters: IndicadoresFilters & { codSubgrupo: number; codGrupo?: number; codSecao?: number }): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);

    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    // Buscar produtos que pertencem ao subgrupo, grupo e seção corretos
    // IMPORTANTE: Coluna é COD_SUB_GRUPO (com underscore)
    let sql = `
      SELECT
        p.COD_PRODUTO,
        p.DES_PRODUTO as PRODUTO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
        AND p.COD_SUB_GRUPO = :codSubgrupo
    `;

    const params: any = { dataInicio, dataFim, codSubgrupo: filters.codSubgrupo };

    // Filtrar também por grupo e seção para garantir hierarquia correta
    if (filters.codGrupo) {
      sql += ` AND p.COD_GRUPO = :codGrupo`;
      params.codGrupo = filters.codGrupo;
    }

    if (filters.codSecao) {
      sql += ` AND p.COD_SECAO = :codSecao`;
      params.codSecao = filters.codSecao;
    }

    sql += `
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;

    if (filters.codLoja) {
      sql += ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = filters.codLoja;
    }

    sql += `
      GROUP BY p.COD_PRODUTO, p.DES_PRODUTO
      ORDER BY VENDA DESC
    `;

    console.log('📊 [GESTAO INTELIGENTE] Buscando itens do subgrupo:', filters.codSubgrupo, 'grupo:', filters.codGrupo, 'seção:', filters.codSecao);
    const result = await OracleService.query<any>(sql, params);

    // Calcular total para % representatividade
    const totalVendas = result.reduce((acc: number, row: any) => acc + (row.VENDA || 0), 0);

    return result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const impostos = row.IMPOSTOS || 0;
      const impostoCredito = row.IMPOSTO_CREDITO || 0;
      const lucro = venda - custo;
      const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
      const margemLiquida = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const margemLimpa = venda > 0 ? ((venda - custo - impostos + impostoCredito) / venda) * 100 : 0;
      const percentualSetor = totalVendas > 0 ? (venda / totalVendas) * 100 : 0;

      const qtdCupons = row.QTD_CUPONS || 0;
      const ticketMedio = qtdCupons > 0 ? venda / qtdCupons : 0;
      const vendasOferta = row.VENDAS_OFERTA || 0;
      const pctOferta = venda > 0 ? (vendasOferta / venda) * 100 : 0;

      const impostoLiquido = impostos - impostoCredito;
      return {
        codProduto: row.COD_PRODUTO,
        produto: row.PRODUTO,
        venda: parseFloat(venda.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)),
        impostos: parseFloat(impostoLiquido.toFixed(2)),
        impostoCredito: parseFloat(impostoCredito.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markup: parseFloat(markup.toFixed(2)),
        margemLiquida: parseFloat(margemLiquida.toFixed(2)),
        margemLimpa: parseFloat(margemLimpa.toFixed(2)),
        margem: parseFloat(margemLiquida.toFixed(2)),
        percentualSetor: parseFloat(percentualSetor.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        vendasOferta: parseFloat(vendasOferta.toFixed(2)),
        pctOferta: parseFloat(pctOferta.toFixed(2)),
        qtdCupons,
        qtd: parseFloat((row.QTD || 0).toFixed(2))
      };
    });
  }

  /** Versao PG do buscarVendasPorSetorPeriodo - usa UNION vdonlineprod + vdadet */
  private static async buscarVendasPorSetorPeriodoPostgresErp(
    dataInicio: string, dataFim: string, codLoja?: number
  ): Promise<any[]> {
    const toIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
    const dtIni = toIso(dataInicio);
    const dtFim = toIso(dataFim);
    const schema = await MappingService.getSchema();
    const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
    const tabSecao = await MappingService.getRealTableName('TAB_SECAO');

    // UNION vdonlineprod + vdadet (historico)
    const vendasUnion = this.buildVendasUnionSql(dtIni, dtFim);
    let sql = `
      SELECT
        s.${colCodSecao}::int AS "COD_SECAO",
        s.${colDesSecao} AS "SETOR",
        COALESCE(SUM(pv.valor_total), 0)::float AS "VENDA",
        COALESCE(SUM(pv.custo_total), 0)::float AS "CUSTO",
        COALESCE(SUM(pv.imposto_total), 0)::float AS "IMPOSTOS",
        0::float AS "IMPOSTO_CREDITO",
        COALESCE(SUM(CASE WHEN pv.oferta_flag = 1 THEN pv.valor_total ELSE 0 END), 0)::float AS "VENDAS_OFERTA",
        COALESCE(SUM(pv.qtde), 0)::float AS "QTD",
        COUNT(DISTINCT pv.cupom || '-' || pv.pdv || '-' || pv.loja)::int AS "QTD_CUPONS",
        COUNT(DISTINCT pv.prod_codigo)::int AS "QTD_SKUS"
      FROM ${vendasUnion}
      JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = pv.prod_codigo
      JOIN ${schema}.${tabSecao} s ON s.${colCodSecao} = p.${colCodSecaoProd}
      WHERE 1=1
    `;
    const params: any[] = [dtIni, dtFim];
    if (codLoja) { sql += ` AND pv.loja::int = $${params.length+1}::int`; params.push(codLoja); }
    sql += ` GROUP BY s.${colCodSecao}, s.${colDesSecao} ORDER BY "VENDA" DESC`;
    return PostgresErpService.query<any>(sql, params);
  }

  /**
   * Busca vendas por setor de um período específico (auxiliar para analíticas)
   */
  private static async buscarVendasPorSetorPeriodo(
    dataInicio: string, // DD/MM/YYYY
    dataFim: string,    // DD/MM/YYYY
    codLoja?: number
  ): Promise<any[]> {
    const dbType = await this.detectActiveDbType();
    if (dbType === 'postgresql') {
      return this.buscarVendasPorSetorPeriodoPostgresErp(dataInicio, dataFim, codLoja);
    }
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    let sql = `
      SELECT
        s.COD_SECAO,
        s.DES_SECAO as SETOR,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabSecao} s ON s.COD_SECAO = p.COD_SECAO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;

    const params: any = { dataInicio, dataFim };
    if (codLoja) {
      sql += ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    sql += ` GROUP BY s.COD_SECAO, s.DES_SECAO ORDER BY VENDA DESC`;

    return OracleService.query<any>(sql, params);
  }

  /**
   * Vendas Analíticas por Setor: vendas atuais, mês passado, ano passado, média linear
   */
  static async getVendasAnaliticasPorSetor(filters: IndicadoresFilters): Promise<any[]> {
    // Bifurcacao acontece dentro do helper buscarVendasPorSetorPeriodo
    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);
    const mesPassado = this.calcularMesPassado(filters.dataInicio, filters.dataFim);
    const anoPassado = this.calcularAnoPassado(filters.dataInicio, filters.dataFim);

    // Período para média linear: ano anterior inteiro
    const [anoIni] = filters.dataInicio.split('-').map(Number);
    const anoAnt = anoIni - 1;
    const mlInicio = `01/01/${anoAnt}`;
    const mlFim = `31/12/${anoAnt}`;

    // Calcular dias do período atual para proporcionalizar média linear
    const d1 = new Date(filters.dataInicio);
    const d2 = new Date(filters.dataFim);
    const diasPeriodoAtual = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    const diasAnoAnt = ((anoAnt % 4 === 0 && anoAnt % 100 !== 0) || anoAnt % 400 === 0) ? 366 : 365;

    console.log('📊 [VENDAS ANALÍTICAS] Buscando 4 períodos (2+2 para não sobrecarregar Oracle)...');
    const dbType = await this.detectActiveDbType();
    const skipML = dbType === 'postgresql'; // Nunes nao tem historico completo pra media linear

    const [atual, mesPas] = await Promise.all([
      this.buscarVendasPorSetorPeriodo(dataInicio, dataFim, filters.codLoja),
      this.buscarVendasPorSetorPeriodo(mesPassado.inicio, mesPassado.fim, filters.codLoja)
    ]);
    const [anoPas, anoInteiro] = await Promise.all([
      this.buscarVendasPorSetorPeriodo(anoPassado.inicio, anoPassado.fim, filters.codLoja),
      skipML ? Promise.resolve([] as any[]) : this.buscarVendasPorSetorPeriodo(mlInicio, mlFim, filters.codLoja)
    ]);

    // Criar mapas por COD_SECAO com todos os campos
    const defaultRow = { venda: 0, custo: 0, impostos: 0, impostoCredito: 0, vendasOferta: 0, qtd: 0, qtdCupons: 0, qtdSkus: 0 };
    const criarMapa = (dados: any[]) => {
      const mapa: Record<number, typeof defaultRow> = {};
      dados.forEach((r: any) => {
        mapa[r.COD_SECAO] = {
          venda: r.VENDA || 0, custo: r.CUSTO || 0, impostos: r.IMPOSTOS || 0,
          impostoCredito: r.IMPOSTO_CREDITO || 0,
          vendasOferta: r.VENDAS_OFERTA || 0, qtd: r.QTD || 0,
          qtdCupons: r.QTD_CUPONS || 0, qtdSkus: r.QTD_SKUS || 0
        };
      });
      return mapa;
    };

    const mapMesPas = criarMapa(mesPas);
    const mapAnoPas = criarMapa(anoPas);
    const mapAnoInteiro = criarMapa(anoInteiro);

    // Função para calcular todos os indicadores de um período
    const calcPeriodo = (d: typeof defaultRow) => {
      const { venda, custo, impostos, impostoCredito, vendasOferta, qtd, qtdCupons, qtdSkus } = d;
      const lucro = venda - custo;
      const markdown = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const margemLimpa = venda > 0 ? ((venda - custo - impostos + impostoCredito) / venda) * 100 : 0;
      const ticketMedio = qtdCupons > 0 ? venda / qtdCupons : 0;
      const pctOferta = venda > 0 ? (vendasOferta / venda) * 100 : 0;
      const impostoLiquido = impostos - impostoCredito;
      return {
        venda: parseFloat(venda.toFixed(2)), lucro: parseFloat(lucro.toFixed(2)),
        markdown: parseFloat(markdown.toFixed(2)), margemLimpa: parseFloat(margemLimpa.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)), impostos: parseFloat(impostoLiquido.toFixed(2)),
        vendasOferta: parseFloat(vendasOferta.toFixed(2)),
        pctOferta: parseFloat(pctOferta.toFixed(2)), ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        qtdCupons: Math.round(qtdCupons), qtdItens: Math.round(qtd), qtdSkus: Math.round(qtdSkus)
      };
    };

    // Criar mapa do período atual
    const mapAtual = criarMapa(atual);
    const mapNomesAtual: Record<number, string> = {};
    atual.forEach((r: any) => { mapNomesAtual[r.COD_SECAO] = r.SETOR; });

    // Merge todos os códigos de todos os períodos
    const todosNomes: Record<number, string> = {};
    [atual, mesPas, anoPas, anoInteiro].forEach((dados: any[]) => {
      dados.forEach((r: any) => {
        if (r.COD_SECAO && r.SETOR && !todosNomes[r.COD_SECAO]) todosNomes[r.COD_SECAO] = r.SETOR;
      });
    });
    Object.keys(mapNomesAtual).forEach(k => { todosNomes[Number(k)] = mapNomesAtual[Number(k)]; });
    const todosCodigos = Object.keys(todosNomes).map(Number).filter(cod => todosNomes[cod]);

    // Montar resultado com TODOS os setores de todos os períodos
    const resultado = todosCodigos.map((cod: number) => {
      const atualRow = mapAtual[cod] || defaultRow;
      const atualData = calcPeriodo(atualRow);

      const mp = mapMesPas[cod] || defaultRow;
      const mesPasData = calcPeriodo(mp);

      const ap = mapAnoPas[cod] || defaultRow;
      const anoPasData = calcPeriodo(ap);

      const ai = mapAnoInteiro[cod] || defaultRow;
      const fator = diasAnoAnt > 0 ? diasPeriodoAtual / diasAnoAnt : 0;
      const mlData = calcPeriodo({
        venda: ai.venda * fator, custo: ai.custo * fator, impostos: ai.impostos * fator,
        impostoCredito: ai.impostoCredito * fator,
        vendasOferta: ai.vendasOferta * fator, qtd: ai.qtd * fator,
        qtdCupons: ai.qtdCupons * fator, qtdSkus: ai.qtdSkus * fator
      });

      return {
        codSecao: cod, setor: todosNomes[cod],
        vendaAtual: atualData.venda, vendaMesPassado: mesPasData.venda,
        vendaAnoPassado: anoPasData.venda, mediaLinear: mlData.venda,
        lucroAtual: atualData.lucro, lucroMesPassado: mesPasData.lucro,
        lucroAnoPassado: anoPasData.lucro, lucroMediaLinear: mlData.lucro,
        markdownAtual: atualData.markdown, markdownMesPassado: mesPasData.markdown,
        markdownAnoPassado: anoPasData.markdown, markdownMediaLinear: mlData.markdown,
        margemLimpaAtual: atualData.margemLimpa, margemLimpaMesPassado: mesPasData.margemLimpa,
        margemLimpaAnoPassado: anoPasData.margemLimpa, margemLimpaMediaLinear: mlData.margemLimpa,
        custoAtual: atualData.custo, custoMesPassado: mesPasData.custo,
        custoAnoPassado: anoPasData.custo, custoMediaLinear: mlData.custo,
        impostosAtual: atualData.impostos, impostosMesPassado: mesPasData.impostos,
        impostosAnoPassado: anoPasData.impostos, impostosMediaLinear: mlData.impostos,
        vendasOfertaAtual: atualData.vendasOferta, vendasOfertaMesPassado: mesPasData.vendasOferta,
        vendasOfertaAnoPassado: anoPasData.vendasOferta, vendasOfertaMediaLinear: mlData.vendasOferta,
        pctOfertaAtual: atualData.pctOferta, pctOfertaMesPassado: mesPasData.pctOferta,
        pctOfertaAnoPassado: anoPasData.pctOferta, pctOfertaMediaLinear: mlData.pctOferta,
        ticketMedioAtual: atualData.ticketMedio, ticketMedioMesPassado: mesPasData.ticketMedio,
        ticketMedioAnoPassado: anoPasData.ticketMedio, ticketMedioMediaLinear: mlData.ticketMedio,
        cuponsAtual: atualData.qtdCupons, cuponsMesPassado: mesPasData.qtdCupons,
        cuponsAnoPassado: anoPasData.qtdCupons, cuponsMediaLinear: mlData.qtdCupons,
        qtdItensAtual: atualData.qtdItens, qtdItensMesPassado: mesPasData.qtdItens,
        qtdItensAnoPassado: anoPasData.qtdItens, qtdItensMediaLinear: mlData.qtdItens,
        skusAtual: atualData.qtdSkus, skusMesPassado: mesPasData.qtdSkus,
        skusAnoPassado: anoPasData.qtdSkus, skusMediaLinear: mlData.qtdSkus
      };
    });

    // Calcular % Representatividade por período
    const totalAtual = resultado.reduce((a: number, r: any) => a + (r.vendaAtual || 0), 0);
    const totalMP = resultado.reduce((a: number, r: any) => a + (r.vendaMesPassado || 0), 0);
    const totalAP = resultado.reduce((a: number, r: any) => a + (r.vendaAnoPassado || 0), 0);
    const totalML = resultado.reduce((a: number, r: any) => a + (r.mediaLinear || 0), 0);
    resultado.forEach((r: any) => {
      r.reprAtual = totalAtual > 0 ? parseFloat(((r.vendaAtual / totalAtual) * 100).toFixed(2)) : 0;
      r.reprMesPassado = totalMP > 0 ? parseFloat(((r.vendaMesPassado / totalMP) * 100).toFixed(2)) : 0;
      r.reprAnoPassado = totalAP > 0 ? parseFloat(((r.vendaAnoPassado / totalAP) * 100).toFixed(2)) : 0;
      r.reprMediaLinear = totalML > 0 ? parseFloat(((r.mediaLinear / totalML) * 100).toFixed(2)) : 0;
    });

    // Ordenar por venda atual (maior para menor)
    resultado.sort((a: any, b: any) => (b.vendaAtual || 0) - (a.vendaAtual || 0));

    console.log(`✅ [VENDAS ANALÍTICAS] ${resultado.length} setores com comparativos`);
    return resultado;
  }

  // ============================================================
  // ANALÍTICOS EM CASCATA (Grupo, Subgrupo, Item)
  // ============================================================

  /**
   * Método genérico para construir dados analíticos com 4 períodos comparativos.
   * Reutilizado por grupo, subgrupo e item.
   */
  private static async buildAnaliticos(
    filters: IndicadoresFilters,
    queryFn: (dataInicio: string, dataFim: string) => Promise<any[]>,
    codeField: string,
    nameField: string,
    outCodeKey: string,
    outNameKey: string
  ): Promise<any[]> {
    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);
    const mesPassado = this.calcularMesPassado(filters.dataInicio, filters.dataFim);
    const anoPassado = this.calcularAnoPassado(filters.dataInicio, filters.dataFim);

    const [anoIni] = filters.dataInicio.split('-').map(Number);
    const anoAnt = anoIni - 1;
    const mlInicio = `01/01/${anoAnt}`;
    const mlFim = `31/12/${anoAnt}`;

    const d1 = new Date(filters.dataInicio);
    const d2 = new Date(filters.dataFim);
    const diasPeriodoAtual = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    const diasAnoAnt = ((anoAnt % 4 === 0 && anoAnt % 100 !== 0) || anoAnt % 400 === 0) ? 366 : 365;

    const dbType = await this.detectActiveDbType();
    const skipML = dbType === 'postgresql';

    const [atual, mesPas] = await Promise.all([
      queryFn(dataInicio, dataFim),
      queryFn(mesPassado.inicio, mesPassado.fim)
    ]);
    const [anoPas, anoInteiro] = await Promise.all([
      queryFn(anoPassado.inicio, anoPassado.fim),
      skipML ? Promise.resolve([] as any[]) : queryFn(mlInicio, mlFim)
    ]);

    const defaultRow = { venda: 0, custo: 0, impostos: 0, impostoCredito: 0, vendasOferta: 0, qtd: 0, qtdCupons: 0, qtdSkus: 0 };

    const criarMapa = (dados: any[]) => {
      const mapa: Record<string, typeof defaultRow> = {};
      dados.forEach((r: any) => {
        const key = String(r[codeField]);
        mapa[key] = {
          venda: r.VENDA || 0, custo: r.CUSTO || 0, impostos: r.IMPOSTOS || 0,
          impostoCredito: r.IMPOSTO_CREDITO || 0,
          vendasOferta: r.VENDAS_OFERTA || 0, qtd: r.QTD || 0,
          qtdCupons: r.QTD_CUPONS || 0, qtdSkus: r.QTD_SKUS || 0
        };
      });
      return mapa;
    };

    const mapMesPas = criarMapa(mesPas);
    const mapAnoPas = criarMapa(anoPas);
    const mapAnoInteiro = criarMapa(anoInteiro);

    const calcPeriodo = (d: typeof defaultRow) => {
      const { venda, custo, impostos, impostoCredito, vendasOferta, qtd, qtdCupons, qtdSkus } = d;
      const lucro = venda - custo;
      const markdown = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const margemLimpa = venda > 0 ? ((venda - custo - impostos + impostoCredito) / venda) * 100 : 0;
      const ticketMedio = qtdCupons > 0 ? venda / qtdCupons : 0;
      const pctOferta = venda > 0 ? (vendasOferta / venda) * 100 : 0;
      const impostoLiquido = impostos - impostoCredito;
      return {
        venda: parseFloat(venda.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markdown: parseFloat(markdown.toFixed(2)),
        margemLimpa: parseFloat(margemLimpa.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)), impostos: parseFloat(impostoLiquido.toFixed(2)),
        vendasOferta: parseFloat(vendasOferta.toFixed(2)),
        pctOferta: parseFloat(pctOferta.toFixed(2)), ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        qtdCupons: Math.round(qtdCupons), qtdItens: Math.round(qtd), qtdSkus: Math.round(qtdSkus)
      };
    };

    // Criar mapa do período atual
    const mapAtual = criarMapa(atual);
    const mapNomesAtual: Record<string, string> = {};
    atual.forEach((r: any) => { mapNomesAtual[String(r[codeField])] = r[nameField]; });

    // Merge todos os códigos de todos os períodos
    const todosNomes: Record<string, string> = {};
    [atual, mesPas, anoPas, anoInteiro].forEach((dados: any[]) => {
      dados.forEach((r: any) => {
        const cod = r[codeField];
        const nome = r[nameField];
        if (cod && nome && !todosNomes[String(cod)]) todosNomes[String(cod)] = nome;
      });
    });
    Object.keys(mapNomesAtual).forEach(k => { todosNomes[k] = mapNomesAtual[k]; });
    const todosCodigos = Object.keys(todosNomes).filter(cod => todosNomes[cod]);
    console.log(`  🔗 [MERGE] todosNomes tem ${Object.keys(todosNomes).length} entries, todosCodigos tem ${todosCodigos.length}, sample keys:`, Object.keys(todosNomes).slice(0, 5));

    // Montar resultado com TODOS os itens de todos os períodos
    const result = todosCodigos.map((codStr: string) => {
      const cod = Number(codStr) || codStr as any;
      const atualRow = mapAtual[codStr] || defaultRow;
      const atualData = calcPeriodo(atualRow);

      const mp = mapMesPas[codStr] || defaultRow;
      const mesPasData = calcPeriodo(mp);

      const ap = mapAnoPas[codStr] || defaultRow;
      const anoPasData = calcPeriodo(ap);

      const ai = mapAnoInteiro[codStr] || defaultRow;
      const fator = diasAnoAnt > 0 ? diasPeriodoAtual / diasAnoAnt : 0;
      const mlData = calcPeriodo({
        venda: ai.venda * fator, custo: ai.custo * fator, impostos: ai.impostos * fator,
        impostoCredito: ai.impostoCredito * fator,
        vendasOferta: ai.vendasOferta * fator, qtd: ai.qtd * fator,
        qtdCupons: ai.qtdCupons * fator, qtdSkus: ai.qtdSkus * fator
      });

      return {
        [outCodeKey]: cod,
        [outNameKey]: todosNomes[codStr],
        vendaAtual: atualData.venda, vendaMesPassado: mesPasData.venda,
        vendaAnoPassado: anoPasData.venda, mediaLinear: mlData.venda,
        lucroAtual: atualData.lucro, lucroMesPassado: mesPasData.lucro,
        lucroAnoPassado: anoPasData.lucro, lucroMediaLinear: mlData.lucro,
        markdownAtual: atualData.markdown, markdownMesPassado: mesPasData.markdown,
        markdownAnoPassado: anoPasData.markdown, markdownMediaLinear: mlData.markdown,
        margemLimpaAtual: atualData.margemLimpa, margemLimpaMesPassado: mesPasData.margemLimpa,
        margemLimpaAnoPassado: anoPasData.margemLimpa, margemLimpaMediaLinear: mlData.margemLimpa,
        custoAtual: atualData.custo, custoMesPassado: mesPasData.custo,
        custoAnoPassado: anoPasData.custo, custoMediaLinear: mlData.custo,
        impostosAtual: atualData.impostos, impostosMesPassado: mesPasData.impostos,
        impostosAnoPassado: anoPasData.impostos, impostosMediaLinear: mlData.impostos,
        vendasOfertaAtual: atualData.vendasOferta, vendasOfertaMesPassado: mesPasData.vendasOferta,
        vendasOfertaAnoPassado: anoPasData.vendasOferta, vendasOfertaMediaLinear: mlData.vendasOferta,
        pctOfertaAtual: atualData.pctOferta, pctOfertaMesPassado: mesPasData.pctOferta,
        pctOfertaAnoPassado: anoPasData.pctOferta, pctOfertaMediaLinear: mlData.pctOferta,
        ticketMedioAtual: atualData.ticketMedio, ticketMedioMesPassado: mesPasData.ticketMedio,
        ticketMedioAnoPassado: anoPasData.ticketMedio, ticketMedioMediaLinear: mlData.ticketMedio,
        cuponsAtual: atualData.qtdCupons, cuponsMesPassado: mesPasData.qtdCupons,
        cuponsAnoPassado: anoPasData.qtdCupons, cuponsMediaLinear: mlData.qtdCupons,
        qtdItensAtual: atualData.qtdItens, qtdItensMesPassado: mesPasData.qtdItens,
        qtdItensAnoPassado: anoPasData.qtdItens, qtdItensMediaLinear: mlData.qtdItens,
        skusAtual: atualData.qtdSkus, skusMesPassado: mesPasData.qtdSkus,
        skusAnoPassado: anoPasData.qtdSkus, skusMediaLinear: mlData.qtdSkus
      };
    });

    // Calcular % Representatividade por período
    const totalAtual = result.reduce((a: number, r: any) => a + (r.vendaAtual || 0), 0);
    const totalMPR = result.reduce((a: number, r: any) => a + (r.vendaMesPassado || 0), 0);
    const totalAPR = result.reduce((a: number, r: any) => a + (r.vendaAnoPassado || 0), 0);
    const totalMLR = result.reduce((a: number, r: any) => a + (r.mediaLinear || 0), 0);
    result.forEach((r: any) => {
      r.reprAtual = totalAtual > 0 ? parseFloat(((r.vendaAtual / totalAtual) * 100).toFixed(2)) : 0;
      r.reprMesPassado = totalMPR > 0 ? parseFloat(((r.vendaMesPassado / totalMPR) * 100).toFixed(2)) : 0;
      r.reprAnoPassado = totalAPR > 0 ? parseFloat(((r.vendaAnoPassado / totalAPR) * 100).toFixed(2)) : 0;
      r.reprMediaLinear = totalMLR > 0 ? parseFloat(((r.mediaLinear / totalMLR) * 100).toFixed(2)) : 0;
    });

    return result;
  }

  /** Helper: vendas por grupo num período (para analíticos) */
  private static async buscarVendasPorGrupoPeriodo(
    dataInicio: string, dataFim: string, codLoja?: number, codSecao?: number
  ): Promise<any[]> {
    const dbType = await this.detectActiveDbType();
    if (dbType === 'postgresql') {
      const toIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
      const dtIni = toIso(dataInicio); const dtFim = toIso(dataFim);
      const schema = await MappingService.getSchema();
      const vendasUnion = this.buildVendasUnionSql(dtIni, dtFim);
      const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
      const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
      const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
      const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
      const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO');
      let sql = `SELECT g.${colCodGrupo}::int AS "COD_GRUPO", g.${colDesGrupo} AS "GRUPO",
        COALESCE(SUM(pv.valor_total),0)::float AS "VENDA", COALESCE(SUM(pv.custo_total),0)::float AS "CUSTO",
        COALESCE(SUM(pv.imposto_total),0)::float AS "IMPOSTOS", 0::float AS "IMPOSTO_CREDITO",
        COALESCE(SUM(CASE WHEN pv.oferta_flag=1 THEN pv.valor_total ELSE 0 END),0)::float AS "VENDAS_OFERTA",
        COALESCE(SUM(pv.qtde),0)::float AS "QTD",
        COUNT(DISTINCT pv.cupom||'-'||pv.pdv||'-'||pv.loja)::int AS "QTD_CUPONS",
        COUNT(DISTINCT pv.prod_codigo)::int AS "QTD_SKUS"
      FROM ${vendasUnion}
      JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = pv.prod_codigo
      JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupo} = p.${colCodGrupoProd}
      WHERE 1=1 AND p.${colCodSecaoProd}::int = ${Number(codSecao)}`;
      const params: any[] = [dtIni, dtFim];
      if (codLoja) { sql += ` AND pv.loja::int = $${params.length+1}::int`; params.push(codLoja); }
      sql += ` GROUP BY g.${colCodGrupo}, g.${colDesGrupo} ORDER BY "VENDA" DESC`;
      return PostgresErpService.query<any>(sql, params);
    }

    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    let sql = `
      SELECT g.COD_GRUPO, g.DES_GRUPO as GRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabGrupo} g ON g.COD_GRUPO = p.COD_GRUPO AND g.COD_SECAO = p.COD_SECAO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.COD_SECAO = :codSecao`;
    const params: any = { dataInicio, dataFim, codSecao };
    if (codLoja) { sql += ` AND pv.COD_LOJA = :codLoja`; params.codLoja = codLoja; }
    sql += ` GROUP BY g.COD_GRUPO, g.DES_GRUPO ORDER BY VENDA DESC`;
    return OracleService.query<any>(sql, params);
  }

  /** Helper: vendas por subgrupo num período (para analíticos) */
  private static async buscarVendasPorSubgrupoPeriodo(
    dataInicio: string, dataFim: string, codLoja?: number, codSecao?: number, codGrupo?: number
  ): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    if (__dbType === "postgresql") {
      // RP INFO nao tem subgrupo — retorna PRODUTOS direto (achatamento)
      const toIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
      const dtIni = toIso(dataInicio); const dtFim = toIso(dataFim);
      const schema = await MappingService.getSchema();
      const vendasUnion = this.buildVendasUnionSql(dtIni, dtFim);
      const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colDesProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
      const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
      let sql = `SELECT pv.prod_codigo::int AS "COD_SUB_GRUPO", p.${colDesProd} AS "SUBGRUPO",
        COALESCE(SUM(pv.valor_total),0)::float AS "VENDA", COALESCE(SUM(pv.custo_total),0)::float AS "CUSTO",
        COALESCE(SUM(pv.imposto_total),0)::float AS "IMPOSTOS", 0::float AS "IMPOSTO_CREDITO",
        COALESCE(SUM(CASE WHEN pv.oferta_flag=1 THEN pv.valor_total ELSE 0 END),0)::float AS "VENDAS_OFERTA",
        COALESCE(SUM(pv.qtde),0)::float AS "QTD",
        COUNT(DISTINCT pv.cupom||'-'||pv.pdv||'-'||pv.loja)::int AS "QTD_CUPONS",
        COUNT(DISTINCT pv.prod_codigo)::int AS "QTD_SKUS"
      FROM ${vendasUnion}
      JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = pv.prod_codigo
      WHERE 1=1 AND p.${colCodSecaoProd}::int = ${Number(codSecao)} AND p.${colCodGrupoProd}::int = ${Number(codGrupo)}`;
      const params: any[] = [dtIni, dtFim];
      if (codLoja) { sql += ` AND pv.loja::int = $${params.length+1}::int`; params.push(codLoja); }
      sql += ` GROUP BY pv.prod_codigo, p.${colDesProd} ORDER BY "VENDA" DESC`;
      return PostgresErpService.query<any>(sql, params);
    }

    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    let sql = `
      SELECT p.COD_SUB_GRUPO, sg.DES_SUB_GRUPO as SUBGRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabSubgrupo} sg ON sg.COD_SECAO = p.COD_SECAO AND sg.COD_GRUPO = p.COD_GRUPO AND sg.COD_SUB_GRUPO = p.COD_SUB_GRUPO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.COD_GRUPO = :codGrupo AND p.COD_SECAO = :codSecao`;
    const params: any = { dataInicio, dataFim, codSecao, codGrupo };
    if (codLoja) { sql += ` AND pv.COD_LOJA = :codLoja`; params.codLoja = codLoja; }
    sql += ` GROUP BY p.COD_SUB_GRUPO, sg.DES_SUB_GRUPO ORDER BY VENDA DESC`;
    return OracleService.query<any>(sql, params);
  }

  /** Helper: vendas por segmento num período (para analíticos) */
  private static async buscarVendasPorSegmentoPeriodo(
    dataInicio: string, dataFim: string, codLoja?: number, codSecao?: number, codGrupo?: number, codSubgrupo?: number
  ): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    let tabSegmento = `${schema}.TAB_SEGMENTO`;
    try { tabSegmento = `${schema}.${await MappingService.getRealTableName('TAB_SEGMENTO')}`; } catch(e) {}
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    let sql = `
      SELECT p.COD_SEGMENTO, sg.DES_SEGMENTO as SEGMENTO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      LEFT JOIN ${tabSegmento} sg ON sg.COD_SEGMENTO = p.COD_SEGMENTO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.COD_SUB_GRUPO = :codSubgrupo AND p.COD_GRUPO = :codGrupo AND p.COD_SECAO = :codSecao`;
    const params: any = { dataInicio, dataFim, codSecao, codGrupo, codSubgrupo };
    if (codLoja) { sql += ` AND pv.COD_LOJA = :codLoja`; params.codLoja = codLoja; }
    sql += ` GROUP BY p.COD_SEGMENTO, sg.DES_SEGMENTO ORDER BY VENDA DESC`;
    return OracleService.query<any>(sql, params);
  }

  /** Helper: vendas por item num período (para analíticos) */
  private static async buscarVendasPorItemPeriodo(
    dataInicio: string, dataFim: string, codLoja?: number, codSecao?: number, codGrupo?: number, codSubgrupo?: number, codSegmento?: number
  ): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    let sql = `
      SELECT p.COD_PRODUTO, p.DES_PRODUTO as PRODUTO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        1 as QTD_SKUS
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
        AND p.COD_SUB_GRUPO = :codSubgrupo AND p.COD_GRUPO = :codGrupo AND p.COD_SECAO = :codSecao
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')`;
    const params: any = { dataInicio, dataFim, codSecao, codGrupo, codSubgrupo };
    if (codSegmento !== undefined) { sql += ` AND p.COD_SEGMENTO = :codSegmento`; params.codSegmento = codSegmento; }
    if (codLoja) { sql += ` AND pv.COD_LOJA = :codLoja`; params.codLoja = codLoja; }
    sql += ` GROUP BY p.COD_PRODUTO, p.DES_PRODUTO ORDER BY VENDA DESC`;
    return OracleService.query<any>(sql, params);
  }

  /** Grupos analíticos com comparativos (cascata nível 2) */
  static async getGruposAnaliticos(filters: IndicadoresFilters & { codSecao: number }): Promise<any[]> {
    // Bifurcacao PG acontece dentro do helper buscarVendasPorGrupoPeriodo
    console.log(`📊 [ANALÍTICOS] Buscando grupos analíticos da seção ${filters.codSecao}...`);
    const result = await this.buildAnaliticos(
      filters,
      (ini, fim) => this.buscarVendasPorGrupoPeriodo(ini, fim, filters.codLoja, filters.codSecao),
      'COD_GRUPO', 'GRUPO', 'codGrupo', 'grupo'
    );
    console.log(`✅ [ANALÍTICOS] ${result.length} grupos com comparativos`);
    return result;
  }

  /** Subgrupos analíticos com comparativos (cascata nível 3) */
  static async getSubgruposAnaliticos(filters: IndicadoresFilters & { codSecao: number; codGrupo: number }): Promise<any[]> {
    // Bifurcacao PG acontece dentro do helper buscarVendasPorSubgrupoPeriodo
    console.log(`📊 [ANALÍTICOS] Buscando subgrupos analíticos do grupo ${filters.codGrupo}...`);
    const result = await this.buildAnaliticos(
      filters,
      (ini, fim) => this.buscarVendasPorSubgrupoPeriodo(ini, fim, filters.codLoja, filters.codSecao, filters.codGrupo),
      'COD_SUB_GRUPO', 'SUBGRUPO', 'codSubgrupo', 'subgrupo'
    );
    console.log(`✅ [ANALÍTICOS] ${result.length} subgrupos com comparativos`);
    return result;
  }

  /** Segmentos analíticos com comparativos (cascata nível 4) */
  static async getSegmentosAnaliticos(filters: IndicadoresFilters & { codSecao: number; codGrupo: number; codSubgrupo: number }): Promise<any[]> {
    // PG: segmento retorna vazio (RP INFO nao tem), drill para no nivel subgrupo/produto
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    console.log(`📊 [ANALÍTICOS] Buscando segmentos analíticos do subgrupo ${filters.codSubgrupo}...`);
    const result = await this.buildAnaliticos(
      filters,
      (ini, fim) => this.buscarVendasPorSegmentoPeriodo(ini, fim, filters.codLoja, filters.codSecao, filters.codGrupo, filters.codSubgrupo),
      'COD_SEGMENTO', 'SEGMENTO', 'codSegmento', 'segmento'
    );
    console.log(`✅ [ANALÍTICOS] ${result.length} segmentos com comparativos`);
    return result;
  }

  /** Itens analíticos com comparativos (cascata nível 5) */
  static async getItensAnaliticos(filters: IndicadoresFilters & { codSecao: number; codGrupo: number; codSubgrupo: number; codSegmento?: number }): Promise<any[]> {
    // Bifurcacao PG acontece dentro do helper buscarVendasPorItemPeriodo
    console.log(`📊 [ANALÍTICOS] Buscando itens analíticos do subgrupo ${filters.codSubgrupo} segmento ${filters.codSegmento || 'todos'}...`);
    const result = await this.buildAnaliticos(
      filters,
      (ini, fim) => this.buscarVendasPorItemPeriodo(ini, fim, filters.codLoja, filters.codSecao, filters.codGrupo, filters.codSubgrupo, filters.codSegmento),
      'COD_PRODUTO', 'PRODUTO', 'codProduto', 'produto'
    );
    console.log(`📊 [ANALÍTICOS] buildAnaliticos retornou ${result.length} itens`);

    // Buscar estoque atual dos produtos
    const codProdutos = result.map((r: any) => r.codProduto).filter(Boolean);
    if (codProdutos.length > 0) {
      const schema = await MappingService.getSchema();
      try {
        const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
        const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
        const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
        const estoqueAtualCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
        let sqlEstoque = `SELECT ${plCodProdutoCol} as COD_PRODUTO, NVL(SUM(${estoqueAtualCol}), 0) as ESTOQUE_ATUAL
          FROM ${tabProdutoLoja} WHERE ${plCodProdutoCol} IN (${codProdutos.join(',')})`;
        const paramsEstoque: any = {};
        if (filters.codLoja) { sqlEstoque += ` AND ${plCodLojaCol} = :codLoja`; paramsEstoque.codLoja = filters.codLoja; }
        sqlEstoque += ` GROUP BY ${plCodProdutoCol}`;
        const estoques = await OracleService.query<any>(sqlEstoque, paramsEstoque);
        const mapaEstoque: Record<number, number> = {};
        estoques.forEach((e: any) => { mapaEstoque[e.COD_PRODUTO] = e.ESTOQUE_ATUAL || 0; });
        result.forEach((r: any) => { r.estoqueAtual = mapaEstoque[r.codProduto] || 0; });
      } catch (err) {
        console.error('Erro ao buscar estoque dos itens:', err);
      }

      // Buscar fornecedor dos produtos via TAB_PRODUTO_LOJA (cod_forn_ult_compra) + TAB_FORNECEDOR
      try {
        const tabProdutoLoja2 = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
        const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
        const plCodProdutoCol2 = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
        const plCodFornUltCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra');
        const fCodFornecedorCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
        const fRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
        const sqlFornecedor = `SELECT pl.${plCodProdutoCol2} as COD_PRODUTO, NVL(f.${fRazaoSocialCol}, 'Sem fornecedor') as FORNECEDOR
          FROM ${tabProdutoLoja2} pl
          LEFT JOIN ${tabFornecedor} f ON f.${fCodFornecedorCol} = pl.${plCodFornUltCompra}
          WHERE pl.${plCodProdutoCol2} IN (${codProdutos.join(',')})`;
        const fornecedores = await OracleService.query<any>(sqlFornecedor, {});
        const mapaFornecedor: Record<string, string> = {};
        fornecedores.forEach((f: any) => { mapaFornecedor[String(Number(f.COD_PRODUTO))] = f.FORNECEDOR || 'Sem fornecedor'; });
        result.forEach((r: any) => { r.fornecedor = mapaFornecedor[String(r.codProduto)] || 'Sem fornecedor'; });
        console.log(`📦 [ANALÍTICOS] Fornecedores: ${fornecedores.length} encontrados`);
      } catch (err) {
        console.error('Erro ao buscar fornecedor dos itens:', err);
        result.forEach((r: any) => { r.fornecedor = 'Sem fornecedor'; });
      }
    }

    console.log(`✅ [ANALÍTICOS] ${result.length} itens com comparativos`);
    return result;
  }

  /**
   * Busca lojas disponíveis (Oracle) com apelidos (PostgreSQL)
   */
  static async getLojas(): Promise<any[]> {
    // Detecta tipo do banco ativo (Oracle ou PostgreSQL)
    let dbType: 'oracle' | 'postgresql' | 'other' = 'oracle';
    try {
      if (AppDataSource.isInitialized) {
        const repo = AppDataSource.getRepository(DatabaseConnection);
        let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
        if (!conn) conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
        if (!conn) conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
        if (conn?.type === DatabaseType.POSTGRESQL) dbType = 'postgresql';
        else if (conn?.type === DatabaseType.ORACLE) dbType = 'oracle';
      }
    } catch { /* fallback pra oracle */ }

    // Caminho PostgreSQL ERP (Nunes / RP INFO)
    if (dbType === 'postgresql') {
      try {
        const schema = await MappingService.getSchema();
        const tabLoja = await MappingService.getRealTableName('TAB_LOJA');
        const codLojaCol = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja');
        const desLojaCol = await MappingService.getColumnFromTable('TAB_LOJA', 'descricao_loja');

        const sql = `
          SELECT ${codLojaCol} as cod_loja, ${desLojaCol} as des_loja
          FROM ${schema}.${tabLoja}
          ORDER BY ${codLojaCol}
        `;

        console.log('📍 [GESTAO INTELIGENTE] Buscando lojas do PostgreSQL ERP...');
        const rows = await PostgresErpService.query<any>(sql);
        console.log('📍 [GESTAO INTELIGENTE] Lojas PostgreSQL ERP encontradas:', rows?.length || 0);

        if (rows && rows.length > 0) {
          // Buscar apelidos das companies no banco local
          const apelidos: Map<number, string> = new Map();
          try {
            if (AppDataSource.isInitialized) {
              const companyRepository = AppDataSource.getRepository(Company);
              const companies = await companyRepository.find({
                where: { active: true },
                select: ['codLoja', 'apelido']
              });
              companies.forEach(c => {
                if (c.codLoja && c.apelido) apelidos.set(c.codLoja, c.apelido);
              });
            }
          } catch { /* ignore */ }

          return rows.map((loja: any) => ({
            COD_LOJA: Number(loja.cod_loja),
            DES_LOJA: loja.des_loja,
            APELIDO: apelidos.get(Number(loja.cod_loja)) || null
          }));
        }
      } catch (err) {
        console.error('❌ [GESTAO INTELIGENTE] Erro buscando lojas PostgreSQL ERP:', err);
      }
      // Se nao retornou nada, cai no fallback companies abaixo
    }

    // Primeiro tentar buscar do Oracle (ERP externo) - Tradicao/SuperVital
    if (dbType === 'oracle') try {
      const schema = await MappingService.getSchema();
      const tabLoja = `${schema}.${await MappingService.getRealTableName('TAB_LOJA')}`;

      const sql = `
        SELECT COD_LOJA, DES_LOJA
        FROM ${tabLoja}
        ORDER BY COD_LOJA
      `;

      console.log('📍 [GESTAO INTELIGENTE] Buscando lojas do Oracle...');
      const result = await OracleService.query(sql);
      console.log('📍 [GESTAO INTELIGENTE] Lojas Oracle encontradas:', result?.length || 0);

      if (result && result.length > 0) {
        // Buscar apelidos das companies no PostgreSQL
        let apelidos: Map<number, string> = new Map();
        try {
          if (AppDataSource.isInitialized) {
            const companyRepository = AppDataSource.getRepository(Company);
            const companies = await companyRepository.find({
              where: { active: true },
              select: ['codLoja', 'apelido']
            });
            companies.forEach(c => {
              if (c.codLoja && c.apelido) {
                apelidos.set(c.codLoja, c.apelido);
              }
            });
          }
        } catch (err) {
          console.warn('⚠️ [GESTAO INTELIGENTE] Não foi possível carregar apelidos:', err);
        }

        return result.map((loja: any) => ({
          ...loja,
          APELIDO: apelidos.get(loja.COD_LOJA) || null
        }));
      }
    } catch (error) {
      console.log('📍 [GESTAO INTELIGENTE] Oracle não disponível, usando lojas do PostgreSQL');
    }

    // Fallback: buscar lojas da tabela companies no PostgreSQL
    try {
      if (AppDataSource.isInitialized) {
        const companyRepository = AppDataSource.getRepository(Company);
        const companies = await companyRepository.find({
          where: { active: true },
          order: { codLoja: 'ASC' }
        });

        const lojas = companies
          .filter(c => c.codLoja)
          .map(c => ({
            COD_LOJA: c.codLoja,
            DES_LOJA: c.nomeFantasia || c.razaoSocial || `Loja ${c.codLoja}`,
            APELIDO: c.apelido || null
          }));

        console.log('📍 [GESTAO INTELIGENTE] Lojas PostgreSQL encontradas:', lojas.length);
        return lojas;
      }
    } catch (err) {
      console.error('❌ [GESTAO INTELIGENTE] Erro ao buscar lojas do PostgreSQL:', err);
    }

    return [];
  }

  /**
   * Busca vendas por ano (mês a mês)
   * Retorna dados consolidados por mês com: Venda, Lucro, Margem, Margem Líquida, Ticket Médio, Itens Vendidos, Vendas em Oferta
   * Também retorna dados consolidados do mesmo período do ano anterior para comparação
   */
  static async getVendasPorAno(ano: number, codLoja?: number): Promise<{
    meses: any[];
    anoAnterior: {
      venda: number;
      lucro: number;
      margem: number;
      margemLiquida: number;
      ticketMedio: number;
      cupons: number;
      skus: number;
      itensVendidos: number;
      vendasOferta: number;
      pctOferta: number;
    };
  }> {
    // buscarIndicadoresPeriodo ja bifurca Oracle/PG internamente
    const meses = [
      { num: 1, nome: 'JANEIRO' },
      { num: 2, nome: 'FEVEREIRO' },
      { num: 3, nome: 'MARÇO' },
      { num: 4, nome: 'ABRIL' },
      { num: 5, nome: 'MAIO' },
      { num: 6, nome: 'JUNHO' },
      { num: 7, nome: 'JULHO' },
      { num: 8, nome: 'AGOSTO' },
      { num: 9, nome: 'SETEMBRO' },
      { num: 10, nome: 'OUTUBRO' },
      { num: 11, nome: 'NOVEMBRO' },
      { num: 12, nome: 'DEZEMBRO' }
    ];

    console.log(`📊 [GESTAO INTELIGENTE] Buscando vendas por ano ${ano}...`);

    const mesAtual = new Date().getMonth() + 1; // 1-12
    const diaAtual = new Date().getDate();
    const anoAtual = new Date().getFullYear();

    // Limitar aos meses que já passaram ou ao mês atual
    const mesesParaBuscar = meses.filter(m => {
      if (ano < anoAtual) return true; // Ano passado, buscar todos
      if (ano === anoAtual) return m.num <= mesAtual; // Ano atual, até o mês atual
      return false; // Ano futuro, não buscar
    });

    const resultados: any[] = [];

    for (const mes of mesesParaBuscar) {
      // Calcular primeiro e último dia do mês
      const ultimoDia = new Date(ano, mes.num, 0).getDate();
      const dataInicio = `01/${String(mes.num).padStart(2, '0')}/${ano}`;
      const dataFim = `${ultimoDia}/${String(mes.num).padStart(2, '0')}/${ano}`;

      try {
        const dados = await this.buscarIndicadoresPeriodo(dataInicio, dataFim, codLoja);
        const indicadores = this.calcularIndicadores(dados);

        resultados.push({
          mes: mes.nome,
          mesNum: mes.num,
          venda: indicadores.vendas,
          custo: indicadores.custoVendas,
          lucro: indicadores.lucro,
          margem: indicadores.markdown,
          margemLiquida: indicadores.margemLimpa,
          impostos: indicadores.impostos,
          markdownOferta: indicadores.markdownOferta,
          ticketMedio: indicadores.ticketMedio,
          cupons: indicadores.qtdCupons,
          skus: indicadores.qtdSkus,
          itensVendidos: indicadores.qtdItens,
          vendasOferta: indicadores.vendasOferta,
          pctOferta: indicadores.pctVendasOferta
        });

        console.log(`   ✅ ${mes.nome}: Venda ${indicadores.vendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
      } catch (error) {
        console.error(`   ❌ Erro ao buscar ${mes.nome}:`, error);
        resultados.push({
          mes: mes.nome,
          mesNum: mes.num,
          venda: 0,
          custo: 0,
          lucro: 0,
          margem: 0,
          margemLiquida: 0,
          impostos: 0,
          markdownOferta: 0,
          ticketMedio: 0,
          cupons: 0,
          skus: 0,
          itensVendidos: 0,
          vendasOferta: 0,
          pctOferta: 0
        });
      }
    }

    // Buscar dados do mesmo período do ano anterior
    // O período vai do primeiro mês com dados até o último mês com dados
    const mesesComDados = resultados.filter(m => m.venda > 0);
    let anoAnteriorData = {
      venda: 0,
      custo: 0,
      lucro: 0,
      margem: 0,
      margemLiquida: 0,
      impostos: 0,
      markdownOferta: 0,
      ticketMedio: 0,
      cupons: 0,
      skus: 0,
      itensVendidos: 0,
      vendasOferta: 0,
      pctOferta: 0
    };

    if (mesesComDados.length > 0) {
      const primeiroMes = Math.min(...mesesComDados.map(m => m.mesNum));
      const ultimoMes = Math.max(...mesesComDados.map(m => m.mesNum));
      const anoAnterior = ano - 1;

      // Se estamos no ano atual, limitamos ao dia atual do mês atual
      // Se estamos vendo um ano passado, pegamos o período completo
      let dataFimAnoAnterior: string;
      if (ano === anoAtual) {
        // Para o ano atual, pegamos até o mesmo dia do ano anterior
        dataFimAnoAnterior = `${String(diaAtual).padStart(2, '0')}/${String(ultimoMes).padStart(2, '0')}/${anoAnterior}`;
      } else {
        // Para anos passados, pegamos o mês completo
        const ultimoDiaUltimoMes = new Date(anoAnterior, ultimoMes, 0).getDate();
        dataFimAnoAnterior = `${ultimoDiaUltimoMes}/${String(ultimoMes).padStart(2, '0')}/${anoAnterior}`;
      }

      const dataInicioAnoAnterior = `01/${String(primeiroMes).padStart(2, '0')}/${anoAnterior}`;

      console.log(`📊 [GESTAO INTELIGENTE] Buscando mesmo período do ano anterior: ${dataInicioAnoAnterior} a ${dataFimAnoAnterior}`);

      try {
        const dadosAnoAnterior = await this.buscarIndicadoresPeriodo(dataInicioAnoAnterior, dataFimAnoAnterior, codLoja);
        const indicadoresAnoAnterior = this.calcularIndicadores(dadosAnoAnterior);

        anoAnteriorData = {
          venda: indicadoresAnoAnterior.vendas,
          custo: indicadoresAnoAnterior.custoVendas,
          lucro: indicadoresAnoAnterior.lucro,
          margem: indicadoresAnoAnterior.markdown,
          margemLiquida: indicadoresAnoAnterior.margemLimpa,
          impostos: indicadoresAnoAnterior.impostos,
          markdownOferta: indicadoresAnoAnterior.markdownOferta,
          ticketMedio: indicadoresAnoAnterior.ticketMedio,
          cupons: indicadoresAnoAnterior.qtdCupons,
          skus: indicadoresAnoAnterior.qtdSkus,
          itensVendidos: indicadoresAnoAnterior.qtdItens,
          vendasOferta: indicadoresAnoAnterior.vendasOferta,
          pctOferta: indicadoresAnoAnterior.pctVendasOferta
        };

        console.log(`   ✅ Ano Anterior (${anoAnterior}): Venda ${indicadoresAnoAnterior.vendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
      } catch (error) {
        console.error(`   ❌ Erro ao buscar ano anterior:`, error);
      }
    }

    console.log(`✅ [GESTAO INTELIGENTE] ${resultados.length} meses processados`);
    return {
      meses: resultados,
      anoAnterior: anoAnteriorData
    };
  }

  /**
   * Busca vendas por setor anual (mês a mês, agrupado por setor)
   */
  /** Versao PG do getVendasPorSetorAnual — usa UNION vdonlineprod + vdadet por mês */
  private static async getVendasPorSetorAnualPg(ano: number, codLoja?: number): Promise<any> {
    console.log(`📊 [GI PG] Buscando vendas por setor anual ${ano}...`);
    const mesAtual = new Date().getMonth() + 1;
    const diaAtual = new Date().getDate();
    const anoAtual = new Date().getFullYear();
    let ultimoMes = 12;
    if (ano === anoAtual) ultimoMes = mesAtual;
    if (ano > anoAtual) return { setores: [] };
    const dataFimDia = (ano === anoAtual && ultimoMes === mesAtual) ? diaAtual : new Date(ano, ultimoMes, 0).getDate();
    const dtIni = `${ano}-01-01`;
    const dtFim = `${ano}-${String(ultimoMes).padStart(2,'0')}-${String(dataFimDia).padStart(2,'0')}`;

    const schema = await MappingService.getSchema();
    const vendasUnion = this.buildVendasUnionSql(dtIni, dtFim);
    const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
    const tabSecao = await MappingService.getRealTableName('TAB_SECAO');

    let sql = `SELECT s.${colCodSecao}::int AS "COD_SECAO", s.${colDesSecao} AS "SETOR",
      EXTRACT(MONTH FROM pv.data) AS "MES",
      COALESCE(SUM(pv.valor_total),0)::float AS "VENDA",
      COALESCE(SUM(pv.custo_total),0)::float AS "CUSTO",
      COALESCE(SUM(pv.qtde),0)::float AS "QTD",
      COUNT(DISTINCT pv.cupom||'-'||pv.pdv||'-'||pv.loja)::int AS "QTD_CUPONS",
      COUNT(DISTINCT pv.prod_codigo)::int AS "QTD_SKUS",
      COALESCE(SUM(CASE WHEN pv.oferta_flag=1 THEN pv.valor_total ELSE 0 END),0)::float AS "VENDAS_OFERTA"
    FROM ${vendasUnion}
    JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = pv.prod_codigo
    JOIN ${schema}.${tabSecao} s ON s.${colCodSecao} = p.${colCodSecaoProd}
    WHERE 1=1`;
    const params: any[] = [dtIni, dtFim];
    if (codLoja) { sql += ` AND pv.loja::int = $${params.length+1}::int`; params.push(codLoja); }
    sql += ` GROUP BY s.${colCodSecao}, s.${colDesSecao}, EXTRACT(MONTH FROM pv.data)`;

    const result = await PostgresErpService.query<any>(sql, params);

    // Ano anterior
    const anoAnt = ano - 1;
    const dtIniAnt = `${anoAnt}-01-01`;
    const dtFimAnt = `${anoAnt}-${String(ultimoMes).padStart(2,'0')}-${String(dataFimDia).padStart(2,'0')}`;
    const vendasUnionAnt = this.buildVendasUnionSql(dtIniAnt, dtFimAnt);
    let sqlAnt = `SELECT s.${colCodSecao}::int AS "COD_SECAO", s.${colDesSecao} AS "SETOR",
      COALESCE(SUM(pv.valor_total),0)::float AS "VENDA",
      COALESCE(SUM(pv.custo_total),0)::float AS "CUSTO",
      COALESCE(SUM(pv.qtde),0)::float AS "QTD",
      COUNT(DISTINCT pv.cupom||'-'||pv.pdv||'-'||pv.loja)::int AS "QTD_CUPONS",
      COUNT(DISTINCT pv.prod_codigo)::int AS "QTD_SKUS",
      COALESCE(SUM(CASE WHEN pv.oferta_flag=1 THEN pv.valor_total ELSE 0 END),0)::float AS "VENDAS_OFERTA"
    FROM ${vendasUnionAnt}
    JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = pv.prod_codigo
    JOIN ${schema}.${tabSecao} s ON s.${colCodSecao} = p.${colCodSecaoProd}
    WHERE 1=1`;
    const paramsAnt: any[] = [dtIniAnt, dtFimAnt];
    if (codLoja) { sqlAnt += ` AND pv.loja::int = $${paramsAnt.length+1}::int`; paramsAnt.push(codLoja); }
    sqlAnt += ` GROUP BY s.${colCodSecao}, s.${colDesSecao}`;

    let resultAnt: any[] = [];
    try { resultAnt = await PostgresErpService.query<any>(sqlAnt, paramsAnt); } catch { /* ano ant pode nao existir */ }

    // Montar resultado no mesmo formato do Oracle
    const mapAnt: Record<number, any> = {};
    resultAnt.forEach((r: any) => { mapAnt[r.COD_SECAO] = r; });

    const nomesMeses = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const setoresMap: Record<number, any> = {};

    result.forEach((row: any) => {
      const cod = row.COD_SECAO;
      if (!setoresMap[cod]) {
        setoresMap[cod] = { codSecao: cod, setor: row.SETOR, meses: [], total: { venda: 0, custo: 0, qtd: 0, cupons: 0, skus: 0, oferta: 0 } };
        for (let m = 1; m <= 12; m++) setoresMap[cod].meses.push({ mes: m, nome: nomesMeses[m], venda: 0, custo: 0, lucro: 0, margem: 0, qtd: 0, cupons: 0, skus: 0, oferta: 0 });
      }
      const mesIdx = Number(row.MES) - 1;
      if (mesIdx >= 0 && mesIdx < 12) {
        const m = setoresMap[cod].meses[mesIdx];
        m.venda = row.VENDA; m.custo = row.CUSTO; m.qtd = row.QTD; m.cupons = row.QTD_CUPONS; m.skus = row.QTD_SKUS; m.oferta = row.VENDAS_OFERTA;
        m.vendasOferta = parseFloat((row.VENDAS_OFERTA || 0).toFixed(2));
        m.lucro = parseFloat((m.venda - m.custo).toFixed(2));
        m.margem = m.venda > 0 ? parseFloat(((m.venda - m.custo) / m.venda * 100).toFixed(2)) : 0;
        m.ticketMedio = m.cupons > 0 ? parseFloat((m.venda / m.cupons).toFixed(2)) : 0;
        m.markdownOferta = m.vendasOferta > 0 ? parseFloat(((m.vendasOferta - (m.custo * m.vendasOferta / m.venda)) / m.vendasOferta * 100).toFixed(2)) : 0;
        m.pctOferta = m.venda > 0 ? parseFloat((m.vendasOferta / m.venda * 100).toFixed(2)) : 0;
        m.itensVendidos = parseFloat(m.qtd.toFixed(2));
        setoresMap[cod].total.venda += m.venda; setoresMap[cod].total.custo += m.custo;
        setoresMap[cod].total.qtd += m.qtd; setoresMap[cod].total.cupons += m.cupons;
        setoresMap[cod].total.oferta += m.oferta;
        setoresMap[cod].total.skus = Math.max(setoresMap[cod].total.skus, m.skus);
      }
    });

    const setores = Object.values(setoresMap).map((s: any) => {
      const t = s.total;
      const ant = mapAnt[s.codSecao];
      return {
        ...s,
        total: {
          ...t,
          lucro: parseFloat((t.venda - t.custo).toFixed(2)),
          margem: t.venda > 0 ? parseFloat(((t.venda - t.custo) / t.venda * 100).toFixed(2)) : 0,
          itensVendidos: t.qtd, vendasOferta: t.oferta,
          pctOferta: t.venda > 0 ? parseFloat((t.oferta / t.venda * 100).toFixed(2)) : 0
        },
        anoAnterior: {
          venda: ant?.VENDA || 0, custo: ant?.CUSTO || 0,
          lucro: ant ? parseFloat(((ant.VENDA || 0) - (ant.CUSTO || 0)).toFixed(2)) : 0,
          margem: ant && ant.VENDA > 0 ? parseFloat(((ant.VENDA - ant.CUSTO) / ant.VENDA * 100).toFixed(2)) : 0,
          ticketMedio: ant && ant.QTD_CUPONS > 0 ? parseFloat((ant.VENDA / ant.QTD_CUPONS).toFixed(2)) : 0,
          cupons: ant?.QTD_CUPONS || 0, skus: ant?.QTD_SKUS || 0,
          itensVendidos: ant?.QTD || 0, vendasOferta: ant?.VENDAS_OFERTA || 0,
          pctOferta: ant && ant.VENDA > 0 ? parseFloat((ant.VENDAS_OFERTA / ant.VENDA * 100).toFixed(2)) : 0
        }
      };
    });
    setores.sort((a, b) => b.total.venda - a.total.venda);
    console.log(`✅ [GI PG] ${setores.length} setores processados para ${ano}`);
    return { setores };
  }

  static async getVendasPorSetorAnual(ano: number, codLoja?: number): Promise<any> {
    const __dbType = await (this as any).detectActiveDbType();
    if (__dbType === 'postgresql') {
      return this.getVendasPorSetorAnualPg(ano, codLoja);
    }

    console.log(`📊 [GESTAO INTELIGENTE] Buscando vendas por setor anual ${ano}...`);

    const mesAtual = new Date().getMonth() + 1;
    const diaAtual = new Date().getDate();
    const anoAtual = new Date().getFullYear();

    let ultimoMes = 12;
    if (ano === anoAtual) ultimoMes = mesAtual;
    if (ano > anoAtual) return { setores: [] };

    // Data fim: até hoje se ano atual, senão último dia do último mês
    let dataFimDia: number;
    if (ano === anoAtual && ultimoMes === mesAtual) {
      dataFimDia = diaAtual;
    } else {
      dataFimDia = new Date(ano, ultimoMes, 0).getDate();
    }

    const dataInicio = `01/01/${ano}`;
    const dataFim = `${String(dataFimDia).padStart(2, '0')}/${String(ultimoMes).padStart(2, '0')}/${ano}`;

    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

    // Query: ano atual por setor + mês
    let sql = `
      SELECT
        s.COD_SECAO,
        s.DES_SECAO as SETOR,
        EXTRACT(MONTH FROM pv.DTA_SAIDA) as MES,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabSecao} s ON s.COD_SECAO = p.COD_SECAO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;
    const params: any = { dataInicio, dataFim };
    if (codLoja) {
      sql += ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }
    sql += ` GROUP BY s.COD_SECAO, s.DES_SECAO, EXTRACT(MONTH FROM pv.DTA_SAIDA)`;

    const result = await OracleService.query<any>(sql, params);

    // Query: ano anterior (mesmo período) por setor (totais)
    const anoAnt = ano - 1;
    const dataInicioAnt = `01/01/${anoAnt}`;
    const dataFimAnt = `${String(dataFimDia).padStart(2, '0')}/${String(ultimoMes).padStart(2, '0')}/${anoAnt}`;

    let sqlAnt = `
      SELECT
        s.COD_SECAO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabSecao} s ON s.COD_SECAO = p.COD_SECAO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicioAnt, 'DD/MM/YYYY') AND TO_DATE(:dataFimAnt, 'DD/MM/YYYY')
    `;
    const paramsAnt: any = { dataInicioAnt, dataFimAnt };
    if (codLoja) {
      sqlAnt += ` AND pv.COD_LOJA = :codLoja`;
      paramsAnt.codLoja = codLoja;
    }
    sqlAnt += ` GROUP BY s.COD_SECAO`;

    const resultAnt = await OracleService.query<any>(sqlAnt, paramsAnt);
    const antMap: Record<number, any> = {};
    for (const r of resultAnt) {
      antMap[r.COD_SECAO] = r;
    }

    // Agrupar por setor
    const setoresMap: Record<number, { codSecao: number; setor: string; meses: Record<number, any> }> = {};
    for (const row of result) {
      const cod = row.COD_SECAO;
      if (!setoresMap[cod]) {
        setoresMap[cod] = { codSecao: cod, setor: row.SETOR, meses: {} };
      }
      const v = row.VENDA || 0;
      const c = row.CUSTO || 0;
      const cupons = row.QTD_CUPONS || 0;
      setoresMap[cod].meses[row.MES] = {
        venda: parseFloat(v.toFixed(2)),
        custo: parseFloat(c.toFixed(2)),
        lucro: parseFloat((v - c).toFixed(2)),
        margem: v > 0 ? parseFloat((((v - c) / v) * 100).toFixed(2)) : 0,
        ticketMedio: cupons > 0 ? parseFloat((v / cupons).toFixed(2)) : 0,
        cupons,
        skus: row.QTD_SKUS || 0,
        itensVendidos: parseFloat((row.QTD || 0).toFixed(2)),
        vendasOferta: parseFloat((row.VENDAS_OFERTA || 0).toFixed(2)),
        pctOferta: v > 0 ? parseFloat((((row.VENDAS_OFERTA || 0) / v) * 100).toFixed(2)) : 0
      };
    }

    // Montar resposta com totais e ano anterior
    const setores = Object.values(setoresMap).map(s => {
      const mesesArr = Object.entries(s.meses);
      const totalVenda = mesesArr.reduce((a, [, m]) => a + m.venda, 0);
      const totalCusto = mesesArr.reduce((a, [, m]) => a + m.custo, 0);
      const totalCupons = mesesArr.reduce((a, [, m]) => a + m.cupons, 0);
      const totalOferta = mesesArr.reduce((a, [, m]) => a + m.vendasOferta, 0);

      const ant = antMap[s.codSecao];
      const antVenda = ant ? (ant.VENDA || 0) : 0;
      const antCusto = ant ? (ant.CUSTO || 0) : 0;
      const antCupons = ant ? (ant.QTD_CUPONS || 0) : 0;
      const antOferta = ant ? (ant.VENDAS_OFERTA || 0) : 0;

      return {
        codSecao: s.codSecao,
        setor: s.setor,
        meses: s.meses,
        total: {
          venda: parseFloat(totalVenda.toFixed(2)),
          custo: parseFloat(totalCusto.toFixed(2)),
          lucro: parseFloat((totalVenda - totalCusto).toFixed(2)),
          margem: totalVenda > 0 ? parseFloat((((totalVenda - totalCusto) / totalVenda) * 100).toFixed(2)) : 0,
          ticketMedio: totalCupons > 0 ? parseFloat((totalVenda / totalCupons).toFixed(2)) : 0,
          cupons: totalCupons,
          skus: Math.max(...mesesArr.map(([, m]) => m.skus), 0),
          itensVendidos: parseFloat(mesesArr.reduce((a, [, m]) => a + m.itensVendidos, 0).toFixed(2)),
          vendasOferta: parseFloat(totalOferta.toFixed(2)),
          pctOferta: totalVenda > 0 ? parseFloat(((totalOferta / totalVenda) * 100).toFixed(2)) : 0
        },
        anoAnterior: {
          venda: parseFloat(antVenda.toFixed(2)),
          custo: parseFloat(antCusto.toFixed(2)),
          lucro: parseFloat((antVenda - antCusto).toFixed(2)),
          margem: antVenda > 0 ? parseFloat((((antVenda - antCusto) / antVenda) * 100).toFixed(2)) : 0,
          ticketMedio: antCupons > 0 ? parseFloat((antVenda / antCupons).toFixed(2)) : 0,
          cupons: antCupons,
          skus: ant ? (ant.QTD_SKUS || 0) : 0,
          itensVendidos: ant ? parseFloat((ant.QTD || 0).toFixed(2)) : 0,
          vendasOferta: parseFloat(antOferta.toFixed(2)),
          pctOferta: antVenda > 0 ? parseFloat(((antOferta / antVenda) * 100).toFixed(2)) : 0
        }
      };
    });

    // Ordenar por venda total desc
    setores.sort((a, b) => b.total.venda - a.total.venda);

    console.log(`✅ [GESTAO INTELIGENTE] ${setores.length} setores processados para ${ano}`);
    return { setores };
  }

  /**
   * Busca vendas por dia da semana (mês a mês)
   * Retorna dados agrupados por dia da semana com feriados separados
   */
  static async getVendasPorDiaSemana(ano: number, codLoja?: number): Promise<{ meses: any[] }> {
    const __dbType = await (this as any).detectActiveDbType();
    if (__dbType === "postgresql") {
      // PG: busca vendas diárias por mês individual (evita UNION pesado)
      console.log(`📊 [GI PG] Buscando vendas por dia da semana ${ano}...`);
      const mesAtual = new Date().getMonth() + 1;
      const anoAtual = new Date().getFullYear();
      let ultimoMes = 12;
      if (ano === anoAtual) ultimoMes = mesAtual;
      if (ano > anoAtual) return { meses: [] };

      // Feriados
      let holidayDates = new Set<string>();
      try {
        if (AppDataSource.isInitialized) {
          const holidayRepository = AppDataSource.getRepository(Holiday);
          const holidays = await holidayRepository.find({ where: { active: true } });
          holidays.forEach(h => holidayDates.add(h.date));
        }
      } catch {}

      const nomesDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const nomesMes = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
      const meses = [];

      for (let m = 1; m <= ultimoMes; m++) {
        const ultimoDia = (ano === anoAtual && m === mesAtual) ? new Date().getDate() : new Date(ano, m, 0).getDate();
        const dtIni = `${ano}-${String(m).padStart(2,'0')}-01`;
        const dtFim = `${ano}-${String(m).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;
        const tabVda = `vdadet${String(m).padStart(2,'0')}${String(ano).slice(-2)}`;

        // Query simples na tabela do mês (sem UNION)
        let sql = `SELECT vdet_datamvto AS dia, COALESCE(SUM(vdet_valor - COALESCE(vdet_valordesc,0) + COALESCE(vdet_valoracfin,0)),0)::float AS venda
          FROM public.${tabVda}
          WHERE vdet_datamvto BETWEEN $1::date AND $2::date`;
        const params: any[] = [dtIni, dtFim];
        if (codLoja) { sql += ` AND vdet_unid_codigo::int = $3::int`; params.push(codLoja); }
        sql += ` GROUP BY vdet_datamvto ORDER BY vdet_datamvto`;

        let result: any[] = [];
        try { result = await PostgresErpService.query<any>(sql, params); } catch { /* tabela pode nao existir */ }

        // Complementar com vdonlineprod (dados recentes que nao estao no vdadet)
        try {
          let sqlOnline = `SELECT vopr_datamvto AS dia, COALESCE(SUM(vopr_valor - COALESCE(vopr_desconto,0) + COALESCE(vopr_acrescimo,0)),0)::float AS venda
            FROM public.vdonlineprod
            WHERE vopr_datamvto BETWEEN $1::date AND $2::date AND vopr_tiporeg = 'IT' AND COALESCE(vopr_cancmotivo,'') = ''
            AND vopr_datamvto >= COALESCE((SELECT MIN(vopr_datamvto) FROM public.vdonlineprod),'9999-12-31'::date)`;
          const paramsOnl: any[] = [dtIni, dtFim];
          if (codLoja) { sqlOnline += ` AND vopr_unid_codigo::int = $3::int`; paramsOnl.push(codLoja); }
          sqlOnline += ` GROUP BY vopr_datamvto`;
          const onlineResult = await PostgresErpService.query<any>(sqlOnline, paramsOnl);
          // Merge: dias do vdonlineprod que nao estao no vdadet
          const vdaDias = new Set(result.map((r: any) => String(r.dia).substring(0, 10)));
          onlineResult.forEach((r: any) => {
            if (!vdaDias.has(String(r.dia).substring(0, 10))) result.push(r);
          });
        } catch {}

        // Agrupar por dia da semana
        const mData: Record<string, { dias: number; vendas: number }> = {};
        nomesDia.forEach(d => { mData[d] = { dias: 0, vendas: 0 }; });
        mData['Feriado'] = { dias: 0, vendas: 0 };

        result.forEach((row: any) => {
          const d = new Date(row.dia);
          const mmdd = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const isHoliday = holidayDates.has(mmdd);
          const key = isHoliday ? 'Feriado' : nomesDia[d.getDay()];
          if (mData[key]) { mData[key].dias++; mData[key].vendas += Number(row.venda) || 0; }
        });

        const diasSemana = [...nomesDia, 'Feriado'].map(nome => ({
          diaSemana: nome,
          totalDias: mData[nome]?.dias || 0,
          totalVendas: parseFloat((mData[nome]?.vendas || 0).toFixed(2)),
          mediaVendas: mData[nome]?.dias > 0 ? parseFloat((mData[nome].vendas / mData[nome].dias).toFixed(2)) : 0
        }));
        meses.push({ mes: nomesMes[m], mesNum: m, dias: diasSemana });
      }
      return { meses };
    }

    console.log(`📊 [GESTAO INTELIGENTE] Buscando vendas por dia da semana ${ano}...`);

    // 1. Buscar feriados cadastrados na tela de Configurações (apenas os cadastrados)
    let holidayDates = new Set<string>(); // MM-DD format
    try {
      if (AppDataSource.isInitialized) {
        const holidayRepository = AppDataSource.getRepository(Holiday);
        let holidays: Holiday[];
        if (codLoja) {
          // Quando filtra por loja: buscar feriados nacionais (cod_loja = null) + municipais da loja
          const { IsNull } = await import('typeorm');
          holidays = await holidayRepository.find({
            where: [
              { active: true, type: 'national' },
              { active: true, cod_loja: IsNull() },
              { active: true, cod_loja: codLoja }
            ]
          });
        } else {
          // Sem filtro de loja: buscar todos os feriados ativos (nacionais + municipais)
          holidays = await holidayRepository.find({
            where: { active: true }
          });
        }
        // Deduplicar por data
        holidays.forEach(h => holidayDates.add(h.date)); // MM-DD format
      }
    } catch (err) {
      console.warn('⚠️ [GESTAO INTELIGENTE] Não foi possível carregar feriados:', err);
    }

    console.log(`   📅 ${holidayDates.size} feriados cadastrados carregados`);

    // 2. Determinar range de meses
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    let ultimoMes = 12;
    if (ano === anoAtual) ultimoMes = mesAtual;
    if (ano > anoAtual) return { meses: [] };

    // 3. Query Oracle: vendas diárias do ano inteiro (uma única query eficiente)
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const colValTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');

    const hoje = new Date();
    let ultimoDiaQuery: number;
    if (ano === anoAtual && ultimoMes === mesAtual) {
      // No mês atual, busca só até hoje
      ultimoDiaQuery = hoje.getDate();
    } else {
      ultimoDiaQuery = new Date(ano, ultimoMes, 0).getDate();
    }
    const dataInicio = `01/01/${ano}`;
    const dataFim = `${String(ultimoDiaQuery).padStart(2, '0')}/${String(ultimoMes).padStart(2, '0')}/${ano}`;

    let sql = `
      SELECT
        TRUNC(pv.${colDtaSaida}) as DIA,
        NVL(SUM(pv.${colValTotalProduto}), 0) as VENDA
      FROM ${tabProdutoPdv} pv
      WHERE pv.${colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;
    const params: any = { dataInicio, dataFim };
    if (codLoja) {
      sql += ` AND pv.${colCodLojaPdv} = :codLoja`;
      params.codLoja = codLoja;
    }
    sql += ` GROUP BY TRUNC(pv.${colDtaSaida}) ORDER BY DIA`;

    const result = await OracleService.query<any>(sql, params);
    console.log(`   📊 ${result.length} dias com vendas encontrados`);

    // 4. Inicializar estrutura: mês → diaSemana → {totalDias, totalVendas}
    const diasDaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const ordemDias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', 'Feriado'];
    const mesesNomes = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
                        'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

    const mesesData: Record<number, Record<string, { totalDias: number; totalVendas: number }>> = {};
    for (let m = 1; m <= 12; m++) {
      mesesData[m] = {};
      for (const dia of ordemDias) {
        mesesData[m][dia] = { totalDias: 0, totalVendas: 0 };
      }
    }

    // 5. Contar dias do calendário (Total de Dias) considerando feriados
    // Só conta até o mês atual e até o dia atual (não conta dias futuros)
    const diaHoje = new Date().getDate();
    for (let m = 1; m <= ultimoMes; m++) {
      const daysInMonth = new Date(ano, m, 0).getDate();
      // No mês atual do ano atual, conta só até o dia de hoje
      const ultimoDia = (ano === anoAtual && m === mesAtual) ? diaHoje : daysInMonth;
      for (let d = 1; d <= ultimoDia; d++) {
        const date = new Date(ano, m - 1, d);
        const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = date.getDay(); // 0=Dom, 1=Seg, ...

        if (holidayDates.has(mmdd)) {
          mesesData[m]['Feriado'].totalDias++;
        } else {
          mesesData[m][diasDaSemana[dayOfWeek]].totalDias++;
        }
      }
    }

    // 6. Distribuir vendas por dia da semana ou feriado
    for (const row of result) {
      const dia = new Date(row.DIA);
      const month = dia.getMonth() + 1;
      const dayOfMonth = dia.getDate();
      const mmdd = `${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
      const dayOfWeek = dia.getDay();

      if (holidayDates.has(mmdd)) {
        mesesData[month]['Feriado'].totalVendas += (row.VENDA || 0);
      } else {
        mesesData[month][diasDaSemana[dayOfWeek]].totalVendas += (row.VENDA || 0);
      }
    }

    // 7. Montar resposta
    const mesesResult = [];
    for (let m = 1; m <= 12; m++) {
      const dias = [];
      for (const diaSemana of ordemDias) {
        const data = mesesData[m][diaSemana];
        dias.push({
          diaSemana,
          totalDias: data.totalDias,
          totalVendas: parseFloat(data.totalVendas.toFixed(2)),
          mediaVendas: data.totalDias > 0 ? parseFloat((data.totalVendas / data.totalDias).toFixed(2)) : 0
        });
      }
      mesesResult.push({
        mes: mesesNomes[m],
        mesNum: m,
        dias
      });
    }

    console.log(`✅ [GESTAO INTELIGENTE] Vendas por dia da semana processadas (${ano})`);
    return { meses: mesesResult };
  }

  /**
   * Busca contagem de produtos "Mercadoria para Revenda" ativos e valor de estoque
   */
  static async getProdutosRevendaEstoque(codLoja?: number): Promise<{
    qtdProdutos: number;
    valorEstoque: number;
    qtdProducao: number;
  }> {
    // PG: conta produtos ativos com estoque > 0
    const dbType = await this.detectActiveDbType();
    if (dbType === 'postgresql') {
      const schemaPg = await MappingService.getSchema();
      let sqlPg = `SELECT COUNT(*)::int AS qtd, COALESCE(SUM(prun_estoque1 * prun_ctmedio), 0)::float AS val FROM ${schemaPg}.produn WHERE prun_bloqueado = 'N' AND prun_ativo = 'S' AND prun_estoque1 > 0`;
      const pPg: any[] = [];
      if (codLoja) { sqlPg += ` AND prun_unid_codigo::int = $1::int`; pPg.push(codLoja); }
      const r = await PostgresErpService.query<any>(sqlPg, pPg);
      return { qtdProdutos: Number(r[0]?.qtd) || 0, valorEstoque: Number(r[0]?.val) || 0, qtdProducao: 0 };
    }

    const schema = await MappingService.getSchema();
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

    const tipoEspecieCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_especie');
    const tipoEventoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_evento');
    const codProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const plInativoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
    const estoqueAtualCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const precoCustoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');

    let lojaFilter = '';
    const params: any = {};
    if (codLoja) {
      lojaFilter = ` AND pl.${plCodLojaCol} = :codLoja`;
      params.codLoja = codLoja;
    }

    // Mercadoria (tipo_especie=0): Direta (tipo_evento=0) + Producao (tipo_evento=3)
    // Exclui Composição (1) e Decomposição (2) - apenas itens ativos (INATIVO='N')
    let sql = `
      SELECT
        COUNT(DISTINCT CASE WHEN NVL(p.${tipoEventoCol}, 0) = 0 THEN p.${codProdutoCol} END) as QTD_REVENDA,
        NVL(SUM(pl.${estoqueAtualCol} * NVL(pl.${precoCustoCol}, 0)), 0) as VALOR_ESTOQUE,
        COUNT(DISTINCT CASE WHEN NVL(p.${tipoEventoCol}, 0) = 3 THEN p.${codProdutoCol} END) as QTD_PRODUCAO
      FROM ${tabProduto} p
      JOIN ${tabProdutoLoja} pl ON pl.${plCodProdutoCol} = p.${codProdutoCol}
      WHERE NVL(pl.${plInativoCol}, 'N') = 'N'
        AND NVL(p.${tipoEspecieCol}, 0) = 0
        AND NVL(p.${tipoEventoCol}, 0) IN (0, 3)
        ${lojaFilter}
    `;

    console.log(`📦 [GESTAO INTELIGENTE] Buscando produtos revenda, produção e estoque...`);
    console.log(`📦 [DEBUG SQL PRODUCAO] tipoEspecieCol=${tipoEspecieCol}, tipoEventoCol=${tipoEventoCol}`);
    console.log(`📦 [DEBUG SQL PRODUCAO] SQL:`, sql);
    const result = await OracleService.query<any>(sql, params);
    const row = result[0] || {};
    console.log(`📦 [DEBUG SQL PRODUCAO] ROW:`, JSON.stringify(row));

    return {
      qtdProdutos: row.QTD_REVENDA || 0,
      valorEstoque: parseFloat((row.VALOR_ESTOQUE || 0).toFixed(2)),
      qtdProducao: row.QTD_PRODUCAO || 0
    };
  }

  // ============================================================
  // ANALISE PRODUTOS ANUAL - Hierarquia mensal
  // ============================================================

  /**
   * Helper genérico para buscar dados mensais agrupados por qualquer nível hierárquico
   */
  private static async buscarHierarquiaMensal(
    ano: number,
    codLoja: number | undefined,
    groupByField: string,
    nameField: string,
    joinClause: string,
    whereClause: string,
    extraParams: Record<string, any> = {}
  ): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    if (__dbType === "postgresql") {
      // PG: busca setor/grupo/produto por mês usando vdadet individual
      console.log(`📊 [GI PG] buscarHierarquiaMensal ${ano}...`);
      const schema = await MappingService.getSchema();
      const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
      const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
      const colDesProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
      const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
      const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
      const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO');
      const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO');

      // Detectar nivel pela presença de codSecao/codGrupo nos extraParams
      let selectField: string, nameFieldPg: string, joinPg: string, wherePg: string;
      const codSecao = extraParams.codSecao;
      const codGrupo = extraParams.codGrupo;

      if (codGrupo) {
        // Nível produto (drill 3)
        selectField = `d.vdet_prod_codigo::int AS cod`; nameFieldPg = `p.${colDesProd} AS nome`;
        joinPg = ''; wherePg = ` AND p.${colCodGrupoProd}::int = ${Number(codGrupo)} AND p.${colCodSecaoProd}::int = ${Number(codSecao)}`;
      } else if (codSecao) {
        // Nível grupo (drill 2)
        selectField = `g.${colCodGrupo}::int AS cod`; nameFieldPg = `g.${colDesGrupo} AS nome`;
        joinPg = `JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupo} = p.${colCodGrupoProd}`;
        wherePg = ` AND p.${colCodSecaoProd}::int = ${Number(codSecao)}`;
      } else {
        // Nível setor (drill 1)
        selectField = `s.${colCodSecao}::int AS cod`; nameFieldPg = `s.${colDesSecao} AS nome`;
        joinPg = `JOIN ${schema}.${tabSecao} s ON s.${colCodSecao} = p.${colCodSecaoProd}`;
        wherePg = '';
      }

      const mesAtual = new Date().getMonth() + 1;
      const anoAtual = new Date().getFullYear();
      let ultimoMes = ano < anoAtual ? 12 : (ano === anoAtual ? mesAtual : 0);
      if (ultimoMes === 0) return [];

      const itemsMap: Record<string, { cod: number; nome: string; meses: Record<number, { venda: number; custo: number; imp: number; oferta: number; cupons: number; skus: number; qtd: number }> }> = {};

      for (let m = 1; m <= ultimoMes; m++) {
        const ultimoDia = (ano === anoAtual && m === mesAtual) ? new Date().getDate() : new Date(ano, m, 0).getDate();
        const dtIni = `${ano}-${String(m).padStart(2,'0')}-01`;
        const dtFim = `${ano}-${String(m).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;
        const tabVda = `vdadet${String(m).padStart(2,'0')}${String(ano).slice(-2)}`;

        let sql = `SELECT ${selectField}, ${nameFieldPg},
          COALESCE(SUM(d.vdet_valor - COALESCE(d.vdet_valordesc,0) + COALESCE(d.vdet_valoracfin,0)),0)::float AS venda,
          COALESCE(SUM(d.vdet_custounit * d.vdet_qtde + COALESCE(d.vdet_valoricms,0) + COALESCE(d.vdet_valorfcp,0)),0)::float AS custo,
          COALESCE(SUM(COALESCE(d.vdet_valoricms,0) + COALESCE(d.vdet_valorfcp,0)),0)::float AS imp,
          COALESCE(SUM(CASE WHEN d.vdet_oferta = 'S' THEN d.vdet_valor - COALESCE(d.vdet_valordesc,0) + COALESCE(d.vdet_valoracfin,0) ELSE 0 END),0)::float AS oferta,
          COUNT(DISTINCT d.vdet_cupom || '-' || d.vdet_pdv || '-' || d.vdet_unid_codigo)::int AS cupons,
          COUNT(DISTINCT d.vdet_prod_codigo)::int AS skus,
          COALESCE(SUM(d.vdet_qtde),0)::float AS qtd
          FROM public.${tabVda} d
          JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = d.vdet_prod_codigo
          ${joinPg}
          WHERE d.vdet_datamvto BETWEEN $1::date AND $2::date ${wherePg}`;
        const params: any[] = [dtIni, dtFim];
        if (codLoja) { sql += ` AND d.vdet_unid_codigo::int = $${params.length+1}::int`; params.push(codLoja); }
        sql += ` GROUP BY 1, 2`;

        try {
          const rows = await PostgresErpService.query<any>(sql, params);
          rows.forEach((r: any) => {
            const key = String(r.cod);
            if (!itemsMap[key]) itemsMap[key] = { cod: r.cod, nome: r.nome, meses: {} };
            if (!itemsMap[key].meses[m]) itemsMap[key].meses[m] = { venda: 0, custo: 0, imp: 0, oferta: 0, cupons: 0, skus: 0, qtd: 0 };
            const im = itemsMap[key].meses[m];
            im.venda += Number(r.venda); im.custo += Number(r.custo); im.imp += Number(r.imp);
            im.oferta += Number(r.oferta); im.cupons += Number(r.cupons); im.skus = Math.max(im.skus, Number(r.skus)); im.qtd += Number(r.qtd);
          });
        } catch {}
      }

      return Object.values(itemsMap).map((item: any) => {
        const mesesObj: Record<number, any> = {};
        const t = { venda: 0, custo: 0, imp: 0, oferta: 0, cupons: 0, skus: 0, qtd: 0 };
        for (let m = 1; m <= 12; m++) {
          const d = item.meses[m] || { venda: 0, custo: 0, imp: 0, oferta: 0, cupons: 0, skus: 0, qtd: 0 };
          const lucro = d.venda - d.custo;
          mesesObj[m] = {
            venda: parseFloat(d.venda.toFixed(2)), custo: parseFloat(d.custo.toFixed(2)),
            lucro: parseFloat(lucro.toFixed(2)),
            margem: d.venda > 0 ? parseFloat((lucro / d.venda * 100).toFixed(2)) : 0,
            margemLimpa: d.venda > 0 ? parseFloat(((lucro - d.imp) / d.venda * 100).toFixed(2)) : 0,
            impostos: parseFloat(d.imp.toFixed(2)),
            vendasOferta: parseFloat(d.oferta.toFixed(2)),
            pctOferta: d.venda > 0 ? parseFloat((d.oferta / d.venda * 100).toFixed(2)) : 0,
            ticketMedio: d.cupons > 0 ? parseFloat((d.venda / d.cupons).toFixed(2)) : 0,
            cupons: d.cupons, skus: d.skus, qtd: parseFloat(d.qtd.toFixed(2))
          };
          t.venda += d.venda; t.custo += d.custo; t.imp += d.imp; t.oferta += d.oferta; t.cupons += d.cupons; t.skus = Math.max(t.skus, d.skus); t.qtd += d.qtd;
        }
        const tLucro = t.venda - t.custo;
        const total = {
          venda: parseFloat(t.venda.toFixed(2)), custo: parseFloat(t.custo.toFixed(2)),
          lucro: parseFloat(tLucro.toFixed(2)),
          margem: t.venda > 0 ? parseFloat((tLucro / t.venda * 100).toFixed(2)) : 0,
          margemLimpa: t.venda > 0 ? parseFloat(((tLucro - t.imp) / t.venda * 100).toFixed(2)) : 0,
          impostos: parseFloat(t.imp.toFixed(2)),
          vendasOferta: parseFloat(t.oferta.toFixed(2)),
          pctOferta: t.venda > 0 ? parseFloat((t.oferta / t.venda * 100).toFixed(2)) : 0,
          ticketMedio: t.cupons > 0 ? parseFloat((t.venda / t.cupons).toFixed(2)) : 0,
          cupons: t.cupons, skus: t.skus, qtd: parseFloat(t.qtd.toFixed(2))
        };
        return { cod: item.cod, nome: item.nome, meses: mesesObj, total };
      }).sort((a, b) => b.total.venda - a.total.venda);
    }

    const mesAtual = new Date().getMonth() + 1;
    const diaAtual = new Date().getDate();
    const anoAtual = new Date().getFullYear();

    let ultimoMes = 12;
    if (ano === anoAtual) ultimoMes = mesAtual;
    if (ano > anoAtual) return [];

    let dataFimDia: number;
    if (ano === anoAtual && ultimoMes === mesAtual) {
      dataFimDia = diaAtual;
    } else {
      dataFimDia = new Date(ano, ultimoMes, 0).getDate();
    }

    const dataInicio = `01/01/${ano}`;
    const dataFim = `${String(dataFimDia).padStart(2, '0')}/${String(ultimoMes).padStart(2, '0')}/${ano}`;

    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const colImpostoDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito', 'VAL_IMPOSTO_DEBITO');
    const colImpostoCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito', 'VAL_IMPOSTO_CREDITO');

    let sql = `
      SELECT
        ${groupByField} as COD_ITEM,
        ${nameField} as NOME_ITEM,
        EXTRACT(MONTH FROM pv.DTA_SAIDA) as MES,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.${colImpostoDebito}), 0) as IMPOSTOS,
        NVL(SUM(pv.${colImpostoCredito}), 0) as IMPOSTO_CREDITO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD,
        COUNT(DISTINCT pv.NUM_CUPOM_FISCAL) as QTD_CUPONS,
        COUNT(DISTINCT pv.COD_PRODUTO) as QTD_SKUS,
        NVL(SUM(CASE WHEN NVL(pv.FLG_OFERTA, 'N') = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      ${joinClause}
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
      ${whereClause}
    `;

    const params: any = { dataInicio, dataFim, ...extraParams };
    if (codLoja) {
      sql += ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    sql += ` GROUP BY ${groupByField}, ${nameField}, EXTRACT(MONTH FROM pv.DTA_SAIDA)`;

    const result = await OracleService.query<any>(sql, params);

    // Agrupar por item
    const itemMap: Record<string, { cod: any; nome: string; meses: Record<number, any> }> = {};
    for (const row of result) {
      const cod = row.COD_ITEM;
      const key = String(cod);
      if (!itemMap[key]) {
        itemMap[key] = { cod, nome: row.NOME_ITEM, meses: {} };
      }
      const v = row.VENDA || 0;
      const c = row.CUSTO || 0;
      const imp = row.IMPOSTOS || 0;
      const impCred = row.IMPOSTO_CREDITO || 0;
      const cupons = row.QTD_CUPONS || 0;
      const vendasOferta = row.VENDAS_OFERTA || 0;
      itemMap[key].meses[row.MES] = {
        venda: parseFloat(v.toFixed(2)),
        custo: parseFloat(c.toFixed(2)),
        lucro: parseFloat((v - c).toFixed(2)),
        margem: v > 0 ? parseFloat((((v - c) / v) * 100).toFixed(2)) : 0,
        margemLimpa: v > 0 ? parseFloat((((v - c - imp + impCred) / v) * 100).toFixed(2)) : 0,
        impostos: parseFloat((imp - impCred).toFixed(2)),
        impCredito: parseFloat(impCred.toFixed(2)),
        ticketMedio: cupons > 0 ? parseFloat((v / cupons).toFixed(2)) : 0,
        cupons,
        skus: row.QTD_SKUS || 0,
        qtd: parseFloat((row.QTD || 0).toFixed(2)),
        vendasOferta: parseFloat(vendasOferta.toFixed(2)),
        pctOferta: v > 0 ? parseFloat(((vendasOferta / v) * 100).toFixed(2)) : 0
      };
    }

    // Montar resposta com totais
    const items = Object.values(itemMap).map(item => {
      const mesesArr = Object.entries(item.meses);
      const totalVenda = mesesArr.reduce((a, [, m]) => a + m.venda, 0);
      const totalCusto = mesesArr.reduce((a, [, m]) => a + m.custo, 0);
      const totalImpostos = mesesArr.reduce((a, [, m]) => a + m.impostos, 0);
      const totalImpCredito = mesesArr.reduce((a, [, m]) => a + (m.impCredito || 0), 0);
      const totalCupons = mesesArr.reduce((a, [, m]) => a + m.cupons, 0);
      const totalOferta = mesesArr.reduce((a, [, m]) => a + m.vendasOferta, 0);
      const totalQtd = mesesArr.reduce((a, [, m]) => a + m.qtd, 0);

      return {
        cod: item.cod,
        nome: item.nome,
        meses: item.meses,
        total: {
          venda: parseFloat(totalVenda.toFixed(2)),
          custo: parseFloat(totalCusto.toFixed(2)),
          lucro: parseFloat((totalVenda - totalCusto).toFixed(2)),
          margem: totalVenda > 0 ? parseFloat((((totalVenda - totalCusto) / totalVenda) * 100).toFixed(2)) : 0,
          margemLimpa: totalVenda > 0 ? parseFloat((((totalVenda - totalCusto - totalImpostos + totalImpCredito) / totalVenda) * 100).toFixed(2)) : 0,
          impostos: parseFloat(totalImpostos.toFixed(2)),
          ticketMedio: totalCupons > 0 ? parseFloat((totalVenda / totalCupons).toFixed(2)) : 0,
          cupons: totalCupons,
          skus: Math.max(...mesesArr.map(([, m]) => m.skus), 0),
          qtd: parseFloat(totalQtd.toFixed(2)),
          vendasOferta: parseFloat(totalOferta.toFixed(2)),
          pctOferta: totalVenda > 0 ? parseFloat(((totalOferta / totalVenda) * 100).toFixed(2)) : 0
        }
      };
    });

    items.sort((a, b) => b.total.venda - a.total.venda);
    return items;
  }

  /**
   * Setores mensais para Analise Produtos Anual
   */
  static async getProdutoAnualSetores(ano: number, codLoja?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    return this.buscarHierarquiaMensal(
      ano, codLoja,
      's.COD_SECAO', 's.DES_SECAO',
      `JOIN ${tabSecao} s ON s.COD_SECAO = p.COD_SECAO`,
      '', {}
    );
  }

  /**
   * Grupos mensais de uma seção
   */
  static async getProdutoAnualGrupos(ano: number, codSecao: number, codLoja?: number): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const schema = await MappingService.getSchema();
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    return this.buscarHierarquiaMensal(
      ano, codLoja,
      'g.COD_GRUPO', 'g.DES_GRUPO',
      `JOIN ${tabGrupo} g ON g.COD_GRUPO = p.COD_GRUPO AND g.COD_SECAO = :codSecao`,
      'AND p.COD_SECAO = :codSecao',
      { codSecao }
    );
  }

  /**
   * Subgrupos mensais de um grupo
   */
  static async getProdutoAnualSubgrupos(ano: number, codGrupo: number, codSecao: number, codLoja?: number): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const schema = await MappingService.getSchema();
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    return this.buscarHierarquiaMensal(
      ano, codLoja,
      'p.COD_SUB_GRUPO', 'sg.DES_SUB_GRUPO',
      `JOIN ${tabSubgrupo} sg ON sg.COD_SECAO = p.COD_SECAO AND sg.COD_GRUPO = p.COD_GRUPO AND sg.COD_SUB_GRUPO = p.COD_SUB_GRUPO`,
      'AND p.COD_GRUPO = :codGrupo AND p.COD_SECAO = :codSecao',
      { codGrupo, codSecao }
    );
  }

  /**
   * Produtos mensais de um subgrupo
   */
  static async getProdutoAnualItens(ano: number, codSubgrupo: number, codGrupo: number, codSecao: number, codLoja?: number): Promise<any[]> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    return this.buscarHierarquiaMensal(
      ano, codLoja,
      'p.COD_PRODUTO', 'p.DES_PRODUTO',
      '',
      'AND p.COD_SUB_GRUPO = :codSubgrupo AND p.COD_GRUPO = :codGrupo AND p.COD_SECAO = :codSecao',
      { codSubgrupo, codGrupo, codSecao }
    );
  }

  /**
   * Venda Dia a Dia: vendas por setor por dia do mês
   */
  static async getVendasDiaDia(ano: number, mes: number, codLoja?: number, tipoVenda?: number[]): Promise<any> {
    const __dbType = await (this as any).detectActiveDbType();
    if (__dbType === "postgresql") {
      // PG: vendas por dia + setor do mês
      console.log(`📊 [GI PG] Buscando vendas dia a dia ${mes}/${ano}...`);
      const schema = await MappingService.getSchema();
      const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
      const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO');

      const anoAtual = new Date().getFullYear();
      const mesAtual = new Date().getMonth() + 1;
      const ultimoDia = (ano === anoAtual && mes === mesAtual) ? new Date().getDate() : new Date(ano, mes, 0).getDate();
      const dtIni = `${ano}-${String(mes).padStart(2,'0')}-01`;
      const dtFim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;
      const tabVda = `vdadet${String(mes).padStart(2,'0')}${String(ano).slice(-2)}`;

      // Query por vdadet do mês + complemento vdonlineprod
      let sql = `SELECT d.vdet_datamvto AS dia, s.${colCodSecao}::int AS cod_secao, s.${colDesSecao} AS setor,
        COALESCE(SUM(d.vdet_valor - COALESCE(d.vdet_valordesc,0) + COALESCE(d.vdet_valoracfin,0)),0)::float AS venda
        FROM public.${tabVda} d
        JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = d.vdet_prod_codigo
        JOIN ${schema}.${tabSecao} s ON s.${colCodSecao} = p.${colCodSecaoProd}
        WHERE d.vdet_datamvto BETWEEN $1::date AND $2::date`;
      const params: any[] = [dtIni, dtFim];
      if (codLoja) { sql += ` AND d.vdet_unid_codigo::int = $3::int`; params.push(codLoja); }
      sql += ` GROUP BY d.vdet_datamvto, s.${colCodSecao}, s.${colDesSecao}`;

      let result: any[] = [];
      try { result = await PostgresErpService.query<any>(sql, params); } catch {}

      // Complementar com vdonlineprod
      try {
        let sqlOnl = `SELECT v.vopr_datamvto AS dia, s.${colCodSecao}::int AS cod_secao, s.${colDesSecao} AS setor,
          COALESCE(SUM(v.vopr_valor - COALESCE(v.vopr_desconto,0) + COALESCE(v.vopr_acrescimo,0)),0)::float AS venda
          FROM public.vdonlineprod v
          JOIN ${schema}.${tabProduto} p ON p.${colCodProd} = v.vopr_prod_codigo
          JOIN ${schema}.${tabSecao} s ON s.${colCodSecao} = p.${colCodSecaoProd}
          WHERE v.vopr_datamvto BETWEEN $1::date AND $2::date AND v.vopr_tiporeg = 'IT' AND COALESCE(v.vopr_cancmotivo,'') = ''
          AND v.vopr_datamvto >= COALESCE((SELECT MIN(vopr_datamvto) FROM public.vdonlineprod),'9999-12-31'::date)`;
        const pOnl: any[] = [dtIni, dtFim];
        if (codLoja) { sqlOnl += ` AND v.vopr_unid_codigo::int = $3::int`; pOnl.push(codLoja); }
        sqlOnl += ` GROUP BY v.vopr_datamvto, s.${colCodSecao}, s.${colDesSecao}`;
        const onlResult = await PostgresErpService.query<any>(sqlOnl, pOnl);
        const vdaDias = new Set(result.map((r: any) => `${r.dia}-${r.cod_secao}`));
        onlResult.forEach((r: any) => { if (!vdaDias.has(`${r.dia}-${r.cod_secao}`)) result.push(r); });
      } catch {}

      // Agrupar: setores com array de dias
      const setoresMap: Record<number, { codSecao: number; setor: string; dias: Record<number, number> }> = {};
      result.forEach((r: any) => {
        const cod = r.cod_secao;
        if (!setoresMap[cod]) setoresMap[cod] = { codSecao: cod, setor: r.setor, dias: {} };
        const d = new Date(r.dia).getDate();
        setoresMap[cod].dias[d] = (setoresMap[cod].dias[d] || 0) + Number(r.venda);
      });

      const setores = Object.values(setoresMap).map((s: any) => {
        const diasArr: any[] = [];
        for (let d = 1; d <= ultimoDia; d++) diasArr.push({ dia: d, venda: parseFloat((s.dias[d] || 0).toFixed(2)) });
        const totalVenda = diasArr.reduce((a, d) => a + d.venda, 0);
        return { codSecao: s.codSecao, secao: s.setor, dias: diasArr, total: parseFloat(totalVenda.toFixed(2)) };
      });
      setores.sort((a, b) => b.total - a.total);

      // Gerar diasInfo (mesmo formato do Oracle)
      const diasNoMes = new Date(ano, mes, 0).getDate();
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const diasInfo: any[] = [];
      for (let d = 1; d <= diasNoMes; d++) {
        const date = new Date(ano, mes - 1, d);
        diasInfo.push({ dia: d, diaSemana: diasSemana[date.getDay()] });
      }

      return { ano, mes, diasNoMes, ultimoDia, diasInfo, setores };
    }

    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const colValTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colTipoSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'tipo_saida');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const colCodSecaoSec = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    let ultimoDia: number;
    if (ano === anoAtual && mes === mesAtual) {
      ultimoDia = hoje.getDate();
    } else {
      ultimoDia = new Date(ano, mes, 0).getDate();
    }
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const dataInicio = `01/${String(mes).padStart(2, '0')}/${ano}`;
    const dataFim = `${String(ultimoDia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;

    let tipoVendaFilter = '';
    if (tipoVenda && tipoVenda.length > 0) {
      tipoVendaFilter = `AND pv.${colTipoSaida} IN (${tipoVenda.join(',')})`;
    }

    let lojaFilter = '';
    const params: any = { dataInicio, dataFim };
    if (codLoja) {
      lojaFilter = `AND pv.${colCodLoja} = :codLoja`;
      params.codLoja = codLoja;
    }

    const colValCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colQtd = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colImpDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito');
    const colImpCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito');
    const colNumCupom = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom');
    const colFlagOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');

    const sql = `
      SELECT
        s.${colDesSecao} as SECAO,
        s.${colCodSecaoSec} as COD_SECAO,
        EXTRACT(DAY FROM pv.${colDtaSaida}) as DIA,
        NVL(SUM(pv.${colValTotal}), 0) as VENDA,
        NVL(SUM(pv.${colValCusto} * pv.${colQtd}), 0) as CUSTO,
        NVL(SUM(NVL(pv.${colImpDebito}, 0)), 0) as IMPOSTOS,
        NVL(SUM(NVL(pv.${colImpCredito}, 0)), 0) as IMP_CREDITO,
        NVL(SUM(pv.${colQtd}), 0) as QTD,
        COUNT(DISTINCT pv.${colNumCupom} || '-' || pv.${colCodLoja}) as CUPONS,
        COUNT(DISTINCT pv.${colCodProduto}) as SKUS,
        NVL(SUM(CASE WHEN NVL(pv.${colFlagOferta}, 'N') = 'S' THEN pv.${colValTotal} ELSE 0 END), 0) as VENDA_OFERTA,
        NVL(SUM(CASE WHEN NVL(pv.${colFlagOferta}, 'N') = 'S' THEN pv.${colValCusto} * pv.${colQtd} ELSE 0 END), 0) as CUSTO_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.${colCodProduto}
      JOIN ${tabSecao} s ON s.${colCodSecaoSec} = p.${colCodSecao}
      WHERE pv.${colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
      ${lojaFilter}
      ${tipoVendaFilter}
      GROUP BY s.${colDesSecao}, s.${colCodSecaoSec}, EXTRACT(DAY FROM pv.${colDtaSaida})
      ORDER BY s.${colDesSecao}, EXTRACT(DAY FROM pv.${colDtaSaida})
    `;

    const rows = await OracleService.query<any>(sql, params);

    // Montar estrutura: setores com vendas por dia
    const setoresMap: Record<string, { codSecao: number; secao: string; dias: Record<number, any> }> = {};
    for (const r of rows) {
      const key = r.COD_SECAO;
      if (!setoresMap[key]) {
        setoresMap[key] = { codSecao: r.COD_SECAO, secao: r.SECAO, dias: {} };
      }
      const venda = Math.round((r.VENDA || 0) * 100) / 100;
      const custo = Math.round((r.CUSTO || 0) * 100) / 100;
      const impostos = Math.round((r.IMPOSTOS || 0) * 100) / 100;
      const impCredito = Math.round((r.IMP_CREDITO || 0) * 100) / 100;
      const lucro = Math.round((venda - custo) * 100) / 100;
      const markdown = venda > 0 ? Math.round((lucro / venda) * 10000) / 100 : 0;
      const mgLimpa = venda > 0 ? Math.round(((venda - custo - impostos + impCredito) / venda) * 10000) / 100 : 0;
      const ticketMedio = (r.CUPONS || 0) > 0 ? Math.round((venda / r.CUPONS) * 100) / 100 : 0;
      const pctOferta = venda > 0 ? Math.round(((r.VENDA_OFERTA || 0) / venda) * 10000) / 100 : 0;
      setoresMap[key].dias[r.DIA] = {
        venda, custo, lucro, markdown, mgLimpa, impostos: Math.round((impostos - impCredito) * 100) / 100,
        ticketMedio, vendaOferta: Math.round((r.VENDA_OFERTA || 0) * 100) / 100, pctOferta,
        cupons: r.CUPONS || 0, skus: r.SKUS || 0, qtd: Math.round((r.QTD || 0) * 100) / 100
      };
    }

    // Gerar nomes dos dias da semana pra cada dia do mês
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const diasInfo = [];
    for (let d = 1; d <= diasNoMes; d++) {
      const date = new Date(ano, mes - 1, d);
      diasInfo.push({ dia: d, diaSemana: diasSemana[date.getDay()] });
    }

    const setores = Object.values(setoresMap).sort((a, b) => {
      const totalA = Object.values(a.dias).reduce((s, v) => s + v, 0);
      const totalB = Object.values(b.dias).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });

    return {
      ano,
      mes,
      diasNoMes,
      ultimoDia,
      diasInfo,
      setores
    };
  }

  /**
   * Venda Dia a Dia - drill-down por grupo/subgrupo/item
   */
  static async getVendasDiaDiaDrill(params: {
    ano: number; mes: number; codLoja?: number; tipoVenda?: number[];
    nivel: 'grupo' | 'subgrupo' | 'item';
    codSecao?: number; codGrupo?: number; codSubGrupo?: number;
  }): Promise<any> {
    const __dbType = await (this as any).detectActiveDbType();
    // bifurcacao PG dentro do buscarHierarquiaMensal

    const { ano, mes, codLoja, tipoVenda, nivel, codSecao, codGrupo, codSubGrupo } = params;
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    const colValTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colValCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colTipoSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'tipo_saida');
    const colQtd = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colImpDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito');
    const colImpCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito');
    const colFlagOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');
    const colNumCupom = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const colDesSubgrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    const colCodGrupoGrp = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colCodSecaoGrp = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao');
    const colCodSubGrupoSg = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colCodGrupoSg = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo');
    const colCodSecaoSg = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao');

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const ultimoDia = (ano === anoAtual && mes === mesAtual) ? hoje.getDate() : new Date(ano, mes, 0).getDate();
    const dataInicio = `01/${String(mes).padStart(2, '0')}/${ano}`;
    const dataFim = `${String(ultimoDia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;

    let tipoVendaFilter = '';
    if (tipoVenda && tipoVenda.length > 0) tipoVendaFilter = `AND pv.${colTipoSaida} IN (${tipoVenda.join(',')})`;
    let lojaFilter = '';
    const queryParams: any = { dataInicio, dataFim };
    if (codLoja) { lojaFilter = `AND pv.${colCodLojaPdv} = :codLoja`; queryParams.codLoja = codLoja; }

    let selectCols = '', joinCols = '', groupCols = '', whereExtra = '', orderCols = '';

    if (nivel === 'grupo') {
      selectCols = `g.${colDesGrupo} as NOME, p.${colCodGrupo} as COD`;
      joinCols = `JOIN ${tabGrupo} g ON g.${colCodGrupoGrp} = p.${colCodGrupo} AND g.${colCodSecaoGrp} = p.${colCodSecao}`;
      groupCols = `g.${colDesGrupo}, p.${colCodGrupo}`;
      whereExtra = `AND p.${colCodSecao} = :codSecao`;
      queryParams.codSecao = codSecao;
      orderCols = `g.${colDesGrupo}`;
    } else if (nivel === 'subgrupo') {
      selectCols = `sg.${colDesSubgrupo} as NOME, p.${colCodSubGrupo} as COD`;
      joinCols = `JOIN ${tabSubgrupo} sg ON sg.${colCodSubGrupoSg} = p.${colCodSubGrupo} AND sg.${colCodGrupoSg} = p.${colCodGrupo} AND sg.${colCodSecaoSg} = p.${colCodSecao}`;
      groupCols = `sg.${colDesSubgrupo}, p.${colCodSubGrupo}`;
      whereExtra = `AND p.${colCodSecao} = :codSecao AND p.${colCodGrupo} = :codGrupo`;
      queryParams.codSecao = codSecao; queryParams.codGrupo = codGrupo;
      orderCols = `sg.${colDesSubgrupo}`;
    } else {
      selectCols = `p.${colDesProduto} as NOME, p.COD_PRODUTO as COD`;
      joinCols = '';
      groupCols = `p.${colDesProduto}, p.COD_PRODUTO`;
      whereExtra = `AND p.${colCodSecao} = :codSecao AND p.${colCodGrupo} = :codGrupo AND p.${colCodSubGrupo} = :codSubGrupo`;
      queryParams.codSecao = codSecao; queryParams.codGrupo = codGrupo; queryParams.codSubGrupo = codSubGrupo;
      orderCols = `p.${colDesProduto}`;
    }

    const sql = `
      SELECT ${selectCols},
        EXTRACT(DAY FROM pv.${colDtaSaida}) as DIA,
        NVL(SUM(pv.${colValTotal}), 0) as VENDA,
        NVL(SUM(pv.${colValCusto} * pv.${colQtd}), 0) as CUSTO,
        NVL(SUM(NVL(pv.${colImpDebito}, 0)), 0) as IMPOSTOS,
        NVL(SUM(NVL(pv.${colImpCredito}, 0)), 0) as IMP_CREDITO,
        NVL(SUM(pv.${colQtd}), 0) as QTD,
        COUNT(DISTINCT pv.${colNumCupom} || '-' || pv.${colCodLojaPdv}) as CUPONS,
        COUNT(DISTINCT pv.${colCodProduto}) as SKUS,
        NVL(SUM(CASE WHEN NVL(pv.${colFlagOferta}, 'N') = 'S' THEN pv.${colValTotal} ELSE 0 END), 0) as VENDA_OFERTA
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.${colCodProduto}
      ${joinCols}
      WHERE pv.${colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
      ${lojaFilter} ${tipoVendaFilter} ${whereExtra}
      GROUP BY ${groupCols}, EXTRACT(DAY FROM pv.${colDtaSaida})
      ORDER BY ${orderCols}, EXTRACT(DAY FROM pv.${colDtaSaida})
    `;

    const rows = await OracleService.query<any>(sql, queryParams);

    const itensMap: Record<string, { cod: any; nome: string; dias: Record<number, any> }> = {};
    for (const r of rows) {
      const key = String(r.COD);
      if (!itensMap[key]) itensMap[key] = { cod: r.COD, nome: r.NOME, dias: {} };
      const venda = Math.round((r.VENDA || 0) * 100) / 100;
      const custo = Math.round((r.CUSTO || 0) * 100) / 100;
      const impostos = Math.round((r.IMPOSTOS || 0) * 100) / 100;
      const impCredito = Math.round((r.IMP_CREDITO || 0) * 100) / 100;
      const lucro = Math.round((venda - custo) * 100) / 100;
      const markdown = venda > 0 ? Math.round(((venda - custo) / venda) * 10000) / 100 : 0;
      const mgLimpa = venda > 0 ? Math.round(((venda - custo - impostos + impCredito) / venda) * 10000) / 100 : 0;
      const ticketMedio = (r.CUPONS || 0) > 0 ? Math.round((venda / r.CUPONS) * 100) / 100 : 0;
      const pctOferta = venda > 0 ? Math.round(((r.VENDA_OFERTA || 0) / venda) * 10000) / 100 : 0;
      itensMap[key].dias[r.DIA] = {
        venda, custo, lucro, markdown, mgLimpa, impostos: Math.round((impostos - impCredito) * 100) / 100,
        ticketMedio, vendaOferta: Math.round((r.VENDA_OFERTA || 0) * 100) / 100, pctOferta,
        cupons: r.CUPONS || 0, skus: r.SKUS || 0, qtd: Math.round((r.QTD || 0) * 100) / 100
      };
    }

    return Object.values(itensMap).sort((a, b) => {
      const totalA = Object.values(a.dias).reduce((s: number, d: any) => s + (d?.venda || 0), 0);
      const totalB = Object.values(b.dias).reduce((s: number, d: any) => s + (d?.venda || 0), 0);
      return totalB - totalA;
    });
  }

  /**
   * Calcula projecao mensal baseada na media linear (mesma logica de dias da semana + feriados)
   * Retorna vendas e lucro projetados pra cada mes do ano
   */
  static async calcularProjecaoMensal(
    anoBase: number,
    codLoja?: number,
    tiposSaida?: string
  ): Promise<Array<{ mes: number; vendas: number; lucro: number; custo: number }>> {
    console.log(`📐 [PROJECAO MENSAL] Calculando projecao pra ${anoBase + 1} baseado em ${anoBase}`);

    // 1. Carregar feriados
    const diasDaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    let holidayDates = new Set<string>();
    try {
      if (AppDataSource.isInitialized) {
        const holidayRepository = AppDataSource.getRepository(Holiday);
        const holidays = codLoja
          ? await holidayRepository.find({ where: [{ active: true, type: 'national' as any }, { active: true, cod_loja: codLoja as any }] })
          : await holidayRepository.find({ where: { active: true } });
        holidays.forEach(h => holidayDates.add(h.date));
      }
    } catch (err) { /* ignore */ }

    // 2. Buscar vendas diarias do ano base agrupadas por dia da semana
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const colValTotal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colValCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colTipoSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'tipo_saida');
    const colValImpDebito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_debito');
    const colValImpCredito = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_imposto_credito');

    let filtroLoja = '';
    if (codLoja) filtroLoja = `AND pv.${colCodLoja} = ${codLoja}`;
    let filtroTipo = '';
    if (tiposSaida) {
      const tipos = tiposSaida.split(',').map(t => t.trim());
      filtroTipo = `AND pv.${colTipoSaida} IN (${tipos.join(',')})`;
    }

    // Buscar totais diarios do ano base
    const colQtd = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const sqlDiario = `
      SELECT TRUNC(pv.${colDtaSaida}) AS DIA,
             SUM(NVL(pv.${colValTotal}, 0)) AS VENDAS,
             SUM(NVL(pv.${colValCusto}, 0) * NVL(pv.${colQtd}, 0)) AS CUSTO,
             SUM(NVL(pv.${colValImpDebito}, 0)) AS IMP_DEBITO,
             SUM(NVL(pv.${colValImpCredito}, 0)) AS IMP_CREDITO
      FROM ${tabProdutoPdv} pv
      WHERE pv.${colDtaSaida} BETWEEN TO_DATE('${anoBase}-01-01', 'YYYY-MM-DD') AND TO_DATE('${anoBase}-12-31', 'YYYY-MM-DD')
      ${filtroLoja} ${filtroTipo}
      GROUP BY TRUNC(pv.${colDtaSaida})
      ORDER BY 1
    `;

    const dadosDiarios = await OracleService.query(sqlDiario);

    // 3. Calcular media por dia da semana (incluindo feriados como categoria separada)
    const mediaPorTipo: Record<string, { totalVendas: number; totalCusto: number; totalImpDeb: number; totalImpCred: number; dias: number }> = {};
    for (const dia of [...diasDaSemana, 'Feriado']) {
      mediaPorTipo[dia] = { totalVendas: 0, totalCusto: 0, totalImpDeb: 0, totalImpCred: 0, dias: 0 };
    }

    for (const row of dadosDiarios) {
      const data = new Date(row.DIA);
      const m = data.getMonth() + 1;
      const d = data.getDate();
      const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = data.getDay();
      const tipo = holidayDates.has(mmdd) ? 'Feriado' : diasDaSemana[dayOfWeek];

      mediaPorTipo[tipo].totalVendas += parseFloat(row.VENDAS) || 0;
      mediaPorTipo[tipo].totalCusto += parseFloat(row.CUSTO) || 0;
      mediaPorTipo[tipo].totalImpDeb += parseFloat(row.IMP_DEBITO) || 0;
      mediaPorTipo[tipo].totalImpCred += parseFloat(row.IMP_CREDITO) || 0;
      mediaPorTipo[tipo].dias++;
    }

    // Calcular medias
    const mediaDiaria: Record<string, { vendas: number; custo: number; lucro: number }> = {};
    for (const [tipo, dados] of Object.entries(mediaPorTipo)) {
      if (dados.dias > 0) {
        const vendaMedia = dados.totalVendas / dados.dias;
        const custoMedia = dados.totalCusto / dados.dias;
        const impMedia = (dados.totalImpDeb - dados.totalImpCred) / dados.dias;
        mediaDiaria[tipo] = {
          vendas: vendaMedia,
          custo: custoMedia,
          lucro: vendaMedia - custoMedia,
        };
      } else {
        mediaDiaria[tipo] = { vendas: 0, custo: 0, lucro: 0 };
      }
    }

    // 4. Projetar cada mes do ano seguinte
    const anoProjecao = anoBase + 1;
    const resultado: Array<{ mes: number; vendas: number; lucro: number; custo: number }> = [];

    for (let mes = 1; mes <= 12; mes++) {
      const diasNoMes = new Date(anoProjecao, mes, 0).getDate();
      let vendasMes = 0, custoMes = 0, lucroMes = 0;

      for (let d = 1; d <= diasNoMes; d++) {
        const data = new Date(anoProjecao, mes - 1, d);
        const mmdd = `${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = data.getDay();
        const tipo = holidayDates.has(mmdd) ? 'Feriado' : diasDaSemana[dayOfWeek];

        const media = mediaDiaria[tipo] || { vendas: 0, custo: 0, lucro: 0 };
        vendasMes += media.vendas;
        custoMes += media.custo;
        lucroMes += media.lucro;
      }

      resultado.push({
        mes,
        vendas: Math.round(vendasMes * 100) / 100,
        lucro: Math.round(lucroMes * 100) / 100,
        custo: Math.round(custoMes * 100) / 100,
      });
    }

    console.log(`✅ [PROJECAO MENSAL] Projecao calculada pra 12 meses`);
    return resultado;
  }
}
