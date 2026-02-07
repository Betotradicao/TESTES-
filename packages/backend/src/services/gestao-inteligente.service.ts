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
import { MappingService } from './mapping.service';

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

    const formatDate = (dia: number, mes: number, ano: number) => {
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    };

    return {
      inicio: formatDate(diaIni, mesIniNovo, anoIniNovo),
      fim: formatDate(diaFim, mesFimNovo, anoFimNovo)
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

    const formatDate = (dia: number, mes: number, ano: number) => {
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    };

    return {
      inicio: formatDate(diaIni, mesIni, anoIni - 1),
      fim: formatDate(diaFim, mesFim, anoFim - 1)
    };
  }

  /**
   * Busca indicadores de um período específico (função auxiliar)
   */
  private static async buscarIndicadoresPeriodo(
    dataInicio: string,
    dataFim: string,
    codLoja?: number
  ): Promise<{
    vendas: number;
    custoVendas: number;
    impostos: number;
    qtdItens: number;
    qtdCupons: number;
    compras: number;
    vendasOferta: number;
    custoOferta: number;
    qtdSkus: number;
  }> {
    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV')}`;
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA', 'TAB_CUPOM_FINALIZADORA')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_NOTA_FISCAL', 'TAB_FORNECEDOR_NOTA')}`;
    const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO', 'TAB_FORNECEDOR_PRODUTO')}`;

    // Resolver colunas via MappingService
    const colValTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total', 'VAL_TOTAL_PRODUTO');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao', 'VAL_CUSTO_REP');
    const colQtdTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade', 'QTD_TOTAL_PRODUTO');
    const colFlgOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta', 'FLG_OFERTA');
    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto', 'COD_PRODUTO');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda', 'DTA_SAIDA');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja', 'COD_LOJA');
    const colNumCupomCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'numero_cupom', 'NUM_CUPOM_FISCAL');
    const colDtaVendaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'data_venda', 'DTA_VENDA');
    const colCodTipoCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_tipo', 'COD_TIPO');
    const colCodLojaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_loja', 'COD_LOJA');
    const colDtaEntradaNf = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada', 'DTA_ENTRADA');
    const colFlgCanceladoNf = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'flag_cancelado', 'FLG_CANCELADO');
    const colCodLojaNf = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_loja', 'COD_LOJA');
    const colCodFornecedorNf = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor', 'COD_FORNECEDOR');
    const colNumNfForn = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf', 'NUM_NF_FORN');
    const colQtdEntradaNi = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'quantidade_entrada', 'QTD_ENTRADA');
    const colValTabelaNi = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'valor_tabela', 'VAL_TABELA');

    let vendasQuery = `
      SELECT
        NVL(SUM(pv.${colValTotalProduto}), 0) as VENDAS,
        NVL(SUM(pv.${colValCustoRep} * pv.${colQtdTotalProduto}), 0) as CUSTO_VENDAS,
        NVL(SUM(pv.VAL_IMPOSTO_DEBITO), 0) as IMPOSTOS,
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
      SELECT NVL(SUM(ni.${colQtdEntradaNi} * ni.${colValTabelaNi}), 0) as COMPRAS
      FROM ${tabFornecedorNota} n
      JOIN ${tabFornecedorProduto} ni ON ni.${colNumNfForn} = n.${colNumNfForn}
        AND ni.${colCodFornecedorNf} = n.${colCodFornecedorNf}
      WHERE TRUNC(n.${colDtaEntradaNf}) BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND NVL(n.${colFlgCanceladoNf}, 'N') = 'N'
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
    qtdItens: number;
    qtdCupons: number;
    compras: number;
    vendasOferta: number;
    custoOferta: number;
    qtdSkus?: number;
  }) {
    const { vendas, custoVendas, impostos, qtdItens, qtdCupons, compras, vendasOferta, custoOferta, qtdSkus = 0 } = dados;

    const lucro = vendas - custoVendas;
    const markdown = vendas > 0 ? ((vendas - custoVendas) / vendas) * 100 : 0;
    const vendasLiquidas = vendas - impostos;
    const lucroLiquido = vendasLiquidas - custoVendas;
    const margemLimpa = vendasLiquidas > 0 ? (lucroLiquido / vendasLiquidas) * 100 : 0;
    const ticketMedio = qtdCupons > 0 ? vendas / qtdCupons : 0;
    const pctCompraVenda = vendas > 0 ? (compras / vendas) * 100 : 0;
    const pctVendasOferta = vendas > 0 ? (vendasOferta / vendas) * 100 : 0;
    const markdownOferta = vendasOferta > 0 ? ((vendasOferta - custoOferta) / vendasOferta) * 100 : 0;

    return {
      vendas,
      lucro: parseFloat(lucro.toFixed(2)),
      custoVendas,
      compras,
      impostos,
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
   * Busca indicadores consolidados de vendas com comparativos (cache de 5 minutos)
   */
  static async getIndicadores(filters: IndicadoresFilters): Promise<IndicadoresGestao> {
    const cacheKey = `${CACHE_KEY}-${filters.dataInicio}-${filters.dataFim}-${filters.codLoja || 'all'}`;

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

        // Buscar dados de todos os períodos em paralelo
        const [dadosAtual, dadosMesPassado, dadosAnoPassado] = await Promise.all([
          this.buscarIndicadoresPeriodo(dataInicio, dataFim, filters.codLoja),
          this.buscarIndicadoresPeriodo(mesPassado.inicio, mesPassado.fim, filters.codLoja),
          this.buscarIndicadoresPeriodo(anoPassado.inicio, anoPassado.fim, filters.codLoja)
        ]);

        // Calcular indicadores de cada período
        const indicadoresAtual = this.calcularIndicadores(dadosAtual);
        const indicadoresMesPassado = this.calcularIndicadores(dadosMesPassado);
        const indicadoresAnoPassado = this.calcularIndicadores(dadosAnoPassado);

        console.log('✅ [GESTAO INTELIGENTE] Indicadores com comparativos calculados');

        // Montar resposta com comparativos
        const criarComparativo = (campo: string): IndicadorComparativo => ({
          atual: (indicadoresAtual as any)[campo],
          mesPassado: (indicadoresMesPassado as any)[campo],
          anoPassado: (indicadoresAnoPassado as any)[campo],
          mediaLinear: 0 // TODO: Implementar média linear
        });

        return {
          vendas: criarComparativo('vendas'),
          lucro: criarComparativo('lucro'),
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

    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO')}`;

    let sql = `
      SELECT
        s.COD_SECAO,
        s.DES_SECAO as SETOR,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
      FROM ${tabProdutoPdv} pv
      JOIN ${tabProduto} p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN ${tabSecao} s ON s.COD_SECAO = p.COD_SECAO
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;

    const params: any = { dataInicio, dataFim };

    if (filters.codLoja) {
      sql += ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = filters.codLoja;
    }

    sql += `
      GROUP BY s.COD_SECAO, s.DES_SECAO
      ORDER BY VENDA DESC
    `;

    console.log('📊 [GESTAO INTELIGENTE] Buscando vendas por setor...');
    const result = await OracleService.query<any>(sql, params);

    // Calcular total de vendas para % representatividade
    const totalVendas = result.reduce((acc: number, row: any) => acc + (row.VENDA || 0), 0);

    // Calcular métricas para cada setor
    const resultadoComMargem = result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const lucro = venda - custo;
      const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
      const margemLiquida = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const percentualSetor = totalVendas > 0 ? (venda / totalVendas) * 100 : 0;

      return {
        codSecao: row.COD_SECAO,
        setor: row.SETOR,
        venda: parseFloat(venda.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markup: parseFloat(markup.toFixed(2)),
        margemLiquida: parseFloat(margemLiquida.toFixed(2)),
        margem: parseFloat(margemLiquida.toFixed(2)), // mantém para compatibilidade
        percentualSetor: parseFloat(percentualSetor.toFixed(2)),
        qtd: parseFloat((row.QTD || 0).toFixed(2))
      };
    });

    console.log(`✅ [GESTAO INTELIGENTE] ${resultadoComMargem.length} setores encontrados`);
    return resultadoComMargem;
  }

  /**
   * Busca grupos de uma seção (nível 2 da hierarquia)
   */
  static async getGruposPorSecao(filters: IndicadoresFilters & { codSecao: number }): Promise<any[]> {
    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);

    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO')}`;

    // Buscar grupos que pertencem diretamente à seção (via TAB_GRUPO.COD_SECAO)
    // E que tiveram vendas no período
    let sql = `
      SELECT
        g.COD_GRUPO,
        g.DES_GRUPO as GRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
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
      const lucro = venda - custo;
      const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
      const margemLiquida = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const percentualSetor = totalVendas > 0 ? (venda / totalVendas) * 100 : 0;

      return {
        codGrupo: row.COD_GRUPO,
        grupo: row.GRUPO,
        venda: parseFloat(venda.toFixed(2)),
        custo: parseFloat(custo.toFixed(2)),
        lucro: parseFloat(lucro.toFixed(2)),
        markup: parseFloat(markup.toFixed(2)),
        margemLiquida: parseFloat(margemLiquida.toFixed(2)),
        margem: parseFloat(margemLiquida.toFixed(2)),
        percentualSetor: parseFloat(percentualSetor.toFixed(2)),
        qtd: parseFloat((row.QTD || 0).toFixed(2))
      };
    });
  }

  /**
   * Busca subgrupos de um grupo (nível 3 da hierarquia)
   */
  static async getSubgruposPorGrupo(filters: IndicadoresFilters & { codGrupo: number; codSecao?: number }): Promise<any[]> {
    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);

    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO')}`;

    // Buscar subgrupos através dos produtos que pertencem ao grupo
    // IMPORTANTE: Colunas são COD_SUB_GRUPO e DES_SUB_GRUPO (com underscore)
    // TAB_SUBGRUPO tem chave composta: COD_SECAO, COD_GRUPO, COD_SUB_GRUPO
    let sql = `
      SELECT
        p.COD_SUB_GRUPO,
        sg.DES_SUB_GRUPO as SUBGRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
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

    return result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;

      return {
        codSubgrupo: row.COD_SUB_GRUPO,
        subgrupo: row.SUBGRUPO,
        venda: parseFloat(venda.toFixed(2)),
        margem: parseFloat(margem.toFixed(2)),
        qtd: parseFloat((row.QTD || 0).toFixed(2))
      };
    });
  }

  /**
   * Busca itens de um subgrupo (nível 4 da hierarquia)
   */
  static async getItensPorSubgrupo(filters: IndicadoresFilters & { codSubgrupo: number; codGrupo?: number; codSecao?: number }): Promise<any[]> {
    const dataInicio = this.formatDateToOracle(filters.dataInicio);
    const dataFim = this.formatDateToOracle(filters.dataFim);

    // Obter schema e nomes reais das tabelas via MappingService
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;

    // Buscar produtos que pertencem ao subgrupo, grupo e seção corretos
    // IMPORTANTE: Coluna é COD_SUB_GRUPO (com underscore)
    let sql = `
      SELECT
        p.COD_PRODUTO,
        p.DES_PRODUTO as PRODUTO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
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

    return result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;

      return {
        codProduto: row.COD_PRODUTO,
        produto: row.PRODUTO,
        venda: parseFloat(venda.toFixed(2)),
        margem: parseFloat(margem.toFixed(2)),
        qtd: parseFloat((row.QTD || 0).toFixed(2))
      };
    });
  }

  /**
   * Busca lojas disponíveis (Oracle) com apelidos (PostgreSQL)
   */
  static async getLojas(): Promise<any[]> {
    try {
      // Obter schema e nome real da tabela via MappingService
      const schema = await MappingService.getSchema();
      const tabLoja = `${schema}.${await MappingService.getRealTableName('TAB_LOJA', 'TAB_LOJA')}`;

      const sql = `
        SELECT COD_LOJA, DES_LOJA
        FROM ${tabLoja}
        ORDER BY COD_LOJA
      `;

      console.log('📍 [GESTAO INTELIGENTE] Buscando lojas...');
      const result = await OracleService.query(sql);
      console.log('📍 [GESTAO INTELIGENTE] Lojas encontradas:', result?.length || 0);

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
          console.log('📍 [GESTAO INTELIGENTE] Apelidos carregados:', apelidos.size);
        }
      } catch (err) {
        console.warn('⚠️ [GESTAO INTELIGENTE] Não foi possível carregar apelidos:', err);
      }

      // Mesclar dados do Oracle com apelidos do PostgreSQL
      return result.map((loja: any) => ({
        ...loja,
        APELIDO: apelidos.get(loja.COD_LOJA) || null
      }));
    } catch (error) {
      console.error('❌ [GESTAO INTELIGENTE] Erro ao buscar lojas:', error);
      throw error;
    }
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
          lucro: indicadores.lucro,
          margem: indicadores.markdown,
          margemLiquida: indicadores.margemLimpa,
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
          lucro: 0,
          margem: 0,
          margemLiquida: 0,
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
      lucro: 0,
      margem: 0,
      margemLiquida: 0,
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
          lucro: indicadoresAnoAnterior.lucro,
          margem: indicadoresAnoAnterior.markdown,
          margemLiquida: indicadoresAnoAnterior.margemLimpa,
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
}
