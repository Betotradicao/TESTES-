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

export interface IndicadoresGestao {
  vendas: number;           // Total de vendas no período
  custoVendas: number;      // Custo das mercadorias vendidas
  compras: number;          // Total de compras no período
  impostos: number;         // Total de impostos
  markdown: number;         // (Vendas - Custo) / Vendas * 100
  margemLimpa: number;      // Margem sem impostos
  ticketMedio: number;      // Vendas / Qtd Cupons
  pctCompraVenda: number;   // Compras / Vendas * 100
  qtdCupons: number;        // Quantidade de cupons
  qtdItens: number;         // Quantidade de itens vendidos
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
   * Busca indicadores consolidados de vendas (com cache de 5 minutos)
   */
  static async getIndicadores(filters: IndicadoresFilters): Promise<IndicadoresGestao> {
    const cacheKey = `${CACHE_KEY}-${filters.dataInicio}-${filters.dataFim}-${filters.codLoja || 'all'}`;

    return CacheService.executeWithCache(
      cacheKey,
      async () => {
        const dataInicio = this.formatDateToOracle(filters.dataInicio);
        const dataFim = this.formatDateToOracle(filters.dataFim);

        // Query para vendas, custo e impostos
        let vendasQuery = `
          SELECT
            NVL(SUM(ni.VAL_TOTAL_ITEM), 0) as VENDAS,
            NVL(SUM(ni.VAL_CUSTO_ITEM), 0) as CUSTO_VENDAS,
            NVL(SUM(ni.VAL_IMPOSTO_DEBITO), 0) as IMPOSTOS,
            COUNT(DISTINCT n.NUM_NF || '-' || n.NUM_SERIE_NF || '-' || n.COD_LOJA) as QTD_CUPONS,
            NVL(SUM(ni.QTD_ITEM), 0) as QTD_ITENS
          FROM INTERSOLID.TAB_NF n
          JOIN INTERSOLID.TAB_NF_ITEM ni ON ni.NUM_NF = n.NUM_NF
            AND ni.NUM_SERIE_NF = n.NUM_SERIE_NF
            AND ni.TIPO_NF = n.TIPO_NF
          WHERE n.TIPO_NF IN ('NFC', 'SAT', 'SAV', 'COO', 'NFS')
            AND TRUNC(n.DTA_SAIDA) BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
            AND NVL(n.FLG_CANCELADO, 'N') = 'N'
        `;

        const vendasParams: any = { dataInicio, dataFim };

        if (filters.codLoja) {
          vendasQuery += ` AND n.COD_LOJA = :codLoja`;
          vendasParams.codLoja = filters.codLoja;
        }

        // Query para compras (entradas)
        let comprasQuery = `
          SELECT
            NVL(SUM(ni.QTD_ENTRADA * ni.VAL_TABELA), 0) as COMPRAS
          FROM INTERSOLID.TAB_FORNECEDOR_NOTA n
          JOIN INTERSOLID.TAB_FORNECEDOR_PRODUTO ni ON ni.NUM_NF_FORN = n.NUM_NF_FORN
            AND ni.COD_FORNECEDOR = n.COD_FORNECEDOR
            AND ni.COD_LOJA = n.COD_LOJA
          WHERE TRUNC(n.DTA_ENTRADA) BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
            AND NVL(n.FLG_CANCELADO, 'N') = 'N'
        `;

        const comprasParams: any = { dataInicio, dataFim };

        if (filters.codLoja) {
          comprasQuery += ` AND n.COD_LOJA = :codLoja`;
          comprasParams.codLoja = filters.codLoja;
        }

        console.log('📊 [GESTAO INTELIGENTE] Buscando indicadores do Oracle...');

        // Executar queries em paralelo
        const [vendasResult, comprasResult] = await Promise.all([
          OracleService.query<any>(vendasQuery, vendasParams),
          OracleService.query<any>(comprasQuery, comprasParams)
        ]);

        const vendas = vendasResult[0]?.VENDAS || 0;
        const custoVendas = vendasResult[0]?.CUSTO_VENDAS || 0;
        const impostos = vendasResult[0]?.IMPOSTOS || 0;
        const qtdCupons = vendasResult[0]?.QTD_CUPONS || 0;
        const qtdItens = vendasResult[0]?.QTD_ITENS || 0;
        const compras = comprasResult[0]?.COMPRAS || 0;

        // Calcular indicadores
        const markdown = vendas > 0 ? ((vendas - custoVendas) / vendas) * 100 : 0;
        const vendasLiquidas = vendas - impostos;
        const lucroLiquido = vendasLiquidas - custoVendas;
        const margemLimpa = vendasLiquidas > 0 ? (lucroLiquido / vendasLiquidas) * 100 : 0;
        const ticketMedio = qtdCupons > 0 ? vendas / qtdCupons : 0;
        const pctCompraVenda = vendas > 0 ? (compras / vendas) * 100 : 0;

        console.log('✅ [GESTAO INTELIGENTE] Indicadores calculados com sucesso');

        return {
          vendas,
          custoVendas,
          compras,
          impostos,
          markdown: parseFloat(markdown.toFixed(2)),
          margemLimpa: parseFloat(margemLimpa.toFixed(2)),
          ticketMedio: parseFloat(ticketMedio.toFixed(2)),
          pctCompraVenda: parseFloat(pctCompraVenda.toFixed(2)),
          qtdCupons,
          qtdItens: parseFloat(qtdItens.toFixed(2))
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
