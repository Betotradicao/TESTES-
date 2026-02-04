/**
 * Gestao Inteligente Service
 * Serviço para buscar indicadores consolidados de vendas
 * Fonte: Banco Oracle Intersolid
 * Cache: 5 minutos com opção de limpar manualmente
 */

import { OracleService } from './oracle.service';
import { CacheService } from './cache.service';

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
  }> {
    let vendasQuery = `
      SELECT
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDAS,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO_VENDAS,
        NVL(SUM(pv.VAL_IMPOSTO_DEBITO), 0) as IMPOSTOS,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD_ITENS,
        NVL(SUM(CASE WHEN pv.FLG_OFERTA = 'S' THEN pv.VAL_TOTAL_PRODUTO ELSE 0 END), 0) as VENDAS_OFERTA,
        NVL(SUM(CASE WHEN pv.FLG_OFERTA = 'S' THEN pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO ELSE 0 END), 0) as CUSTO_OFERTA
      FROM INTERSOLID.TAB_PRODUTO_PDV pv
      WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;
    const vendasParams: any = { dataInicio, dataFim };
    if (codLoja) {
      vendasQuery += ` AND pv.COD_LOJA = :codLoja`;
      vendasParams.codLoja = codLoja;
    }

    let cuponsQuery = `
      SELECT COUNT(DISTINCT cf.NUM_CUPOM_FISCAL) as QTD_CUPONS
      FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
      WHERE cf.DTA_VENDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.COD_TIPO = 1110
    `;
    const cuponsParams: any = { dataInicio, dataFim };
    if (codLoja) {
      cuponsQuery += ` AND cf.COD_LOJA = :codLoja`;
      cuponsParams.codLoja = codLoja;
    }

    let comprasQuery = `
      SELECT NVL(SUM(ni.QTD_ENTRADA * ni.VAL_TABELA), 0) as COMPRAS
      FROM INTERSOLID.TAB_FORNECEDOR_NOTA n
      JOIN INTERSOLID.TAB_FORNECEDOR_PRODUTO ni ON ni.NUM_NF_FORN = n.NUM_NF_FORN
        AND ni.COD_FORNECEDOR = n.COD_FORNECEDOR
      WHERE TRUNC(n.DTA_ENTRADA) BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND NVL(n.FLG_CANCELADO, 'N') = 'N'
    `;
    const comprasParams: any = { dataInicio, dataFim };
    if (codLoja) {
      comprasQuery += ` AND n.COD_LOJA = :codLoja`;
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
      custoOferta: vendasResult[0]?.CUSTO_OFERTA || 0
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
  }) {
    const { vendas, custoVendas, impostos, qtdItens, qtdCupons, compras, vendasOferta, custoOferta } = dados;

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

    let sql = `
      SELECT
        s.COD_SECAO,
        s.DES_SECAO as SETOR,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
      FROM INTERSOLID.TAB_PRODUTO_PDV pv
      JOIN INTERSOLID.TAB_PRODUTO p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN INTERSOLID.TAB_SECAO s ON s.COD_SECAO = p.COD_SECAO
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

    // Calcular margem para cada setor
    const resultadoComMargem = result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;

      return {
        codSecao: row.COD_SECAO,
        setor: row.SETOR,
        venda: parseFloat(venda.toFixed(2)),
        margem: parseFloat(margem.toFixed(2)),
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

    // Buscar grupos que pertencem diretamente à seção (via TAB_GRUPO.COD_SECAO)
    // E que tiveram vendas no período
    let sql = `
      SELECT
        g.COD_GRUPO,
        g.DES_GRUPO as GRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
      FROM INTERSOLID.TAB_PRODUTO_PDV pv
      JOIN INTERSOLID.TAB_PRODUTO p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN INTERSOLID.TAB_GRUPO g ON g.COD_GRUPO = p.COD_GRUPO AND g.COD_SECAO = :codSecao
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

    return result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;

      return {
        codGrupo: row.COD_GRUPO,
        grupo: row.GRUPO,
        venda: parseFloat(venda.toFixed(2)),
        margem: parseFloat(margem.toFixed(2)),
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

    // Buscar subgrupos através dos produtos que pertencem ao grupo
    let sql = `
      SELECT
        p.COD_SUBGRUPO,
        sg.DES_SUBGRUPO as SUBGRUPO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
      FROM INTERSOLID.TAB_PRODUTO_PDV pv
      JOIN INTERSOLID.TAB_PRODUTO p ON p.COD_PRODUTO = pv.COD_PRODUTO
      JOIN INTERSOLID.TAB_SUBGRUPO sg ON sg.COD_SUBGRUPO = p.COD_SUBGRUPO
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
      GROUP BY p.COD_SUBGRUPO, sg.DES_SUBGRUPO
      ORDER BY VENDA DESC
    `;

    console.log('📊 [GESTAO INTELIGENTE] Buscando subgrupos do grupo:', filters.codGrupo, 'seção:', filters.codSecao);
    const result = await OracleService.query<any>(sql, params);

    return result.map((row: any) => {
      const venda = row.VENDA || 0;
      const custo = row.CUSTO || 0;
      const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;

      return {
        codSubgrupo: row.COD_SUBGRUPO,
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

    // Buscar produtos que pertencem ao subgrupo, grupo e seção corretos
    let sql = `
      SELECT
        p.COD_PRODUTO,
        p.DES_PRODUTO as PRODUTO,
        NVL(SUM(pv.VAL_TOTAL_PRODUTO), 0) as VENDA,
        NVL(SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO), 0) as CUSTO,
        NVL(SUM(pv.QTD_TOTAL_PRODUTO), 0) as QTD
      FROM INTERSOLID.TAB_PRODUTO_PDV pv
      JOIN INTERSOLID.TAB_PRODUTO p ON p.COD_PRODUTO = pv.COD_PRODUTO
        AND p.COD_SUBGRUPO = :codSubgrupo
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
   * Busca lojas disponíveis
   */
  static async getLojas(): Promise<any[]> {
    try {
      const sql = `
        SELECT COD_LOJA, DES_LOJA
        FROM INTERSOLID.TAB_LOJA
        ORDER BY COD_LOJA
      `;

      console.log('📍 [GESTAO INTELIGENTE] Buscando lojas...');
      const result = await OracleService.query(sql);
      console.log('📍 [GESTAO INTELIGENTE] Lojas encontradas:', result?.length || 0);
      return result;
    } catch (error) {
      console.error('❌ [GESTAO INTELIGENTE] Erro ao buscar lojas:', error);
      throw error;
    }
  }
}
