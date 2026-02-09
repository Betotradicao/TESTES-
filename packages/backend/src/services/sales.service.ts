import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export interface Sale {
  codLoja: number;
  desProduto: string;
  codProduto: string;
  codBarraPrincipal: string;
  dtaSaida: string;
  numCupomFiscal: number;
  codCaixa: number;
  valVenda: number;
  qtdTotalProduto: number;
  valTotalProduto: number;
  totalCusto: number;
  descontoAplicado?: number;
  dataHoraVenda?: string;
  motivoCancelamento?: string;
  funcionarioCancelamento?: string;
  tipoCancelamento?: string;
  // Campos de operador (Oracle)
  codOperador?: number;
  desOperador?: string;
  numSeqItem?: number;
}

/**
 * Interface para os mapeamentos de colunas usados nas queries
 */
interface SalesMappings {
  schema: string;
  // Tabelas
  tabProdutoPdv: string;
  tabProduto: string;
  tabCupomFinalizadora: string;
  tabOperadores: string;
  // Colunas TAB_PRODUTO_PDV
  colNumCupomFiscal: string;
  colNumSeqItem: string;
  colCodProdutoPdv: string;
  colValTotalProduto: string;
  colQtdTotalProduto: string;
  colValCustoRep: string;
  colDtaSaida: string;
  colTimHora: string;
  colNumPdv: string;
  colCodLojaPdv: string;
  colFlgOferta: string;
  // Colunas TAB_PRODUTO
  colDesProduto: string;
  colCodProduto: string;
  // Colunas TAB_CUPOM_FINALIZADORA
  colCodOperadorCf: string;
  colNumCupomFiscalCf: string;
  colNumPdvCf: string;
  colCodLojaCf: string;
  colDtaVendaCf: string;
  colCodTipoCf: string;
  // Colunas TAB_OPERADORES
  colCodOperador: string;
  colDesOperador: string;
}

export class SalesService {
  /**
   * Busca os mapeamentos de colunas do banco de dados
   * Usa MappingService para buscar valores configurados, com fallback para Intersolid
   */
  private static async getMappings(): Promise<SalesMappings> {
    const schema = await MappingService.getSchema();

    // Buscar nomes reais das tabelas
    const tabProdutoPdv = await MappingService.getRealTableName('TAB_PRODUTO_PDV');
    const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
    const tabCupomFinalizadora = await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA');
    const tabOperadores = await MappingService.getRealTableName('TAB_OPERADORES');

    // Buscar colunas TAB_PRODUTO_PDV (todas via MappingService)
    const colNumCupomFiscal = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom');
    const colNumSeqItem = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'sequencia_item');
    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto');
    const colValTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total');
    const colQtdTotalProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade');
    const colValCustoRep = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_custo_reposicao');
    const colDtaSaida = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda');
    const colTimHora = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'hora_venda');
    const colNumPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_pdv');
    const colCodLojaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja');
    const colFlgOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'flag_oferta');

    // Buscar colunas TAB_PRODUTO
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');

    // Buscar colunas TAB_CUPOM_FINALIZADORA
    const colCodOperadorCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_operador');
    const colNumCupomFiscalCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'numero_cupom');
    const colNumPdvCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'numero_pdv');
    const colCodLojaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_loja');
    const colDtaVendaCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'data_venda');
    const colCodTipoCf = await MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_tipo');

    // Buscar colunas TAB_OPERADORES
    const colCodOperador = await MappingService.getColumnFromTable('TAB_OPERADORES', 'codigo_operador');
    const colDesOperador = await MappingService.getColumnFromTable('TAB_OPERADORES', 'nome_operador');

    return {
      schema,
      tabProdutoPdv,
      tabProduto,
      tabCupomFinalizadora,
      tabOperadores,
      colNumCupomFiscal,
      colNumSeqItem,
      colCodProdutoPdv,
      colValTotalProduto,
      colQtdTotalProduto,
      colValCustoRep,
      colDtaSaida,
      colTimHora,
      colNumPdv,
      colCodLojaPdv,
      colFlgOferta,
      colDesProduto,
      colCodProduto,
      colCodOperadorCf,
      colNumCupomFiscalCf,
      colNumPdvCf,
      colCodLojaCf,
      colDtaVendaCf,
      colCodTipoCf,
      colCodOperador,
      colDesOperador,
    };
  }

  /**
   * Busca vendas do ERP - SEMPRE usa Oracle Intersolid
   */
  static async fetchSalesFromERP(fromDate: string, toDate: string): Promise<Sale[]> {
    console.log('📊 [SALES] Buscando vendas do Oracle Intersolid');

    // Converter fromDate de YYYYMMDD para YYYY-MM-DD se necessário
    const fromDateFormatted = fromDate.length === 8
      ? `${fromDate.slice(0, 4)}-${fromDate.slice(4, 6)}-${fromDate.slice(6, 8)}`
      : fromDate;
    const toDateFormatted = toDate.length === 8
      ? `${toDate.slice(0, 4)}-${toDate.slice(4, 6)}-${toDate.slice(6, 8)}`
      : toDate;

    return this.fetchSalesFromOracle(fromDateFormatted, toDateFormatted);
  }

  static formatDateToERP(date: string): string {
    return date.replace(/-/g, '');
  }

  /**
   * Busca vendas diretamente do Oracle Intersolid
   * Usa mapeamentos dinâmicos da tela de Configuração de Tabelas
   * @param fromDate Data inicial no formato YYYY-MM-DD
   * @param toDate Data final no formato YYYY-MM-DD
   * @param codLoja Código da loja (opcional)
   */
  static async fetchSalesFromOracle(fromDate: string, toDate: string, codLoja?: number): Promise<Sale[]> {
    try {
      console.log(`📊 [ORACLE] Buscando vendas de ${fromDate} a ${toDate}...`);

      // Buscar mapeamentos dinâmicos
      const m = await this.getMappings();
      console.log(`📊 [ORACLE] Usando schema: ${m.schema}, tabelas: ${m.tabProdutoPdv}, ${m.tabProduto}, ${m.tabCupomFinalizadora}, ${m.tabOperadores}`);

      // Converter datas para formato Oracle (DD/MM/YYYY)
      const dataInicio = this.formatDateToOracle(fromDate);
      const dataFim = this.formatDateToOracle(toDate);

      let sql = `
        SELECT
          pv.${m.colNumCupomFiscal} as NUM_CUPOM_FISCAL,
          pv.${m.colNumSeqItem} as NUM_SEQ_ITEM,
          pv.${m.colCodProdutoPdv} as COD_PRODUTO,
          p.${m.colDesProduto} as DES_PRODUTO,
          pv.${m.colCodProdutoPdv} as COD_BARRA_PRINCIPAL,
          pv.${m.colValTotalProduto} as VAL_TOTAL_PRODUTO,
          pv.${m.colQtdTotalProduto} as QTD_TOTAL_PRODUTO,
          pv.${m.colValCustoRep} as VAL_CUSTO_REP,
          pv.${m.colDtaSaida} as DTA_SAIDA,
          pv.${m.colTimHora} as TIM_HORA,
          pv.${m.colNumPdv} as NUM_PDV,
          pv.${m.colCodLojaPdv} as COD_LOJA,
          pv.${m.colFlgOferta} as FLG_OFERTA,
          cf.${m.colCodOperadorCf} as COD_OPERADOR,
          o.${m.colDesOperador} as DES_OPERADOR
        FROM ${m.schema}.${m.tabProdutoPdv} pv
        JOIN ${m.schema}.${m.tabProduto} p ON p.${m.colCodProduto} = pv.${m.colCodProdutoPdv}
        LEFT JOIN ${m.schema}.${m.tabCupomFinalizadora} cf
          ON cf.${m.colNumCupomFiscalCf} = pv.${m.colNumCupomFiscal}
          AND cf.${m.colNumPdvCf} = pv.${m.colNumPdv}
          AND cf.${m.colCodLojaCf} = pv.${m.colCodLojaPdv}
          AND TRUNC(cf.${m.colDtaVendaCf}) = TRUNC(pv.${m.colDtaSaida})
          AND cf.${m.colCodTipoCf} = 1110
        LEFT JOIN ${m.schema}.${m.tabOperadores} o ON o.${m.colCodOperador} = cf.${m.colCodOperadorCf}
        WHERE pv.${m.colDtaSaida} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND pv.${m.colNumCupomFiscal} > 0
      `;

      const params: any = { dataInicio, dataFim };

      if (codLoja) {
        sql += ` AND pv.${m.colCodLojaPdv} = :codLoja`;
        params.codLoja = codLoja;
      }

      sql += ` ORDER BY pv.${m.colTimHora} DESC`;

      const result = await OracleService.query<any>(sql, params);

      // Converter para formato Sale
      const sales: Sale[] = result.map((row: any) => {
        // Formatar data/hora (usar getters locais para preservar timezone do Oracle/BRT)
        let dataHoraVenda = '';
        if (row.TIM_HORA) {
          const hora = new Date(row.TIM_HORA);
          const hh = String(hora.getHours()).padStart(2, '0');
          const mi = String(hora.getMinutes()).padStart(2, '0');
          const ss = String(hora.getSeconds()).padStart(2, '0');
          const yy = hora.getFullYear();
          const mm = String(hora.getMonth() + 1).padStart(2, '0');
          const dd = String(hora.getDate()).padStart(2, '0');
          dataHoraVenda = `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
        }

        // Formatar data saída para YYYYMMDD
        let dtaSaida = '';
        if (row.DTA_SAIDA) {
          const data = new Date(row.DTA_SAIDA);
          dtaSaida = `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}${String(data.getDate()).padStart(2, '0')}`;
        }

        return {
          codLoja: row.COD_LOJA || 1,
          desProduto: row.DES_PRODUTO || '',
          codProduto: String(row.COD_PRODUTO || ''),
          codBarraPrincipal: String(row.COD_BARRA_PRINCIPAL || row.COD_PRODUTO || '').padStart(13, '0'),
          dtaSaida,
          numCupomFiscal: row.NUM_CUPOM_FISCAL || 0,
          codCaixa: row.NUM_PDV || 0,
          valVenda: row.VAL_TOTAL_PRODUTO || 0,
          qtdTotalProduto: row.QTD_TOTAL_PRODUTO || 0,
          valTotalProduto: row.VAL_TOTAL_PRODUTO || 0,
          totalCusto: row.VAL_CUSTO_REP || 0,
          descontoAplicado: undefined,
          dataHoraVenda,
          // Campos extras do Oracle
          numSeqItem: row.NUM_SEQ_ITEM,
          codOperador: row.COD_OPERADOR,
          desOperador: row.DES_OPERADOR
        } as Sale;
      });

      console.log(`✅ [ORACLE] ${sales.length} vendas encontradas`);

      // Log para debug: verificar se operador está vindo
      const salesWithOperator = sales.filter(s => s.codOperador || s.desOperador);
      console.log(`👤 [ORACLE] ${salesWithOperator.length} vendas com operador de ${sales.length} total`);
      if (salesWithOperator.length > 0) {
        const sample = salesWithOperator[0];
        console.log(`   Exemplo: Operador ${sample.codOperador} - ${sample.desOperador}`);
      }

      return sales;
    } catch (error) {
      console.error('❌ [ORACLE] Erro ao buscar vendas:', error);
      throw error;
    }
  }

  /**
   * Busca vendas recentes do Oracle (últimos X minutos)
   * Ideal para matching de bipagens em tempo real
   */
  static async fetchRecentSalesFromOracle(minutosAtras: number = 5, codLoja?: number): Promise<Sale[]> {
    try {
      console.log(`📊 [ORACLE] Buscando vendas dos últimos ${minutosAtras} minutos...`);

      // Buscar mapeamentos dinâmicos
      const m = await this.getMappings();

      let sql = `
        SELECT
          pv.${m.colNumCupomFiscal} as NUM_CUPOM_FISCAL,
          pv.${m.colNumSeqItem} as NUM_SEQ_ITEM,
          pv.${m.colCodProdutoPdv} as COD_PRODUTO,
          p.${m.colDesProduto} as DES_PRODUTO,
          pv.${m.colCodProdutoPdv} as COD_BARRA_PRINCIPAL,
          pv.${m.colValTotalProduto} as VAL_TOTAL_PRODUTO,
          pv.${m.colQtdTotalProduto} as QTD_TOTAL_PRODUTO,
          pv.${m.colValCustoRep} as VAL_CUSTO_REP,
          pv.${m.colDtaSaida} as DTA_SAIDA,
          pv.${m.colTimHora} as TIM_HORA,
          pv.${m.colNumPdv} as NUM_PDV,
          pv.${m.colCodLojaPdv} as COD_LOJA,
          pv.${m.colFlgOferta} as FLG_OFERTA,
          cf.${m.colCodOperadorCf} as COD_OPERADOR,
          o.${m.colDesOperador} as DES_OPERADOR
        FROM ${m.schema}.${m.tabProdutoPdv} pv
        JOIN ${m.schema}.${m.tabProduto} p ON p.${m.colCodProduto} = pv.${m.colCodProdutoPdv}
        LEFT JOIN ${m.schema}.${m.tabCupomFinalizadora} cf
          ON cf.${m.colNumCupomFiscalCf} = pv.${m.colNumCupomFiscal}
          AND cf.${m.colNumPdvCf} = pv.${m.colNumPdv}
          AND cf.${m.colCodLojaCf} = pv.${m.colCodLojaPdv}
          AND TRUNC(cf.${m.colDtaVendaCf}) = TRUNC(pv.${m.colDtaSaida})
          AND cf.${m.colCodTipoCf} = 1110
        LEFT JOIN ${m.schema}.${m.tabOperadores} o ON o.${m.colCodOperador} = cf.${m.colCodOperadorCf}
        WHERE TRUNC(pv.${m.colDtaSaida}) = TRUNC(SYSDATE)
          AND pv.${m.colTimHora} >= SYSDATE - INTERVAL '${minutosAtras}' MINUTE
          AND pv.${m.colNumCupomFiscal} > 0
      `;

      const params: any = {};

      if (codLoja) {
        sql += ` AND pv.${m.colCodLojaPdv} = :codLoja`;
        params.codLoja = codLoja;
      }

      sql += ` ORDER BY pv.${m.colTimHora} DESC`;

      const result = await OracleService.query<any>(sql, params);

      // Converter para formato Sale
      const sales: Sale[] = result.map((row: any) => {
        let dataHoraVenda = '';
        if (row.TIM_HORA) {
          const hora = new Date(row.TIM_HORA);
          dataHoraVenda = hora.toISOString().replace('T', ' ').substring(0, 19);
        }

        let dtaSaida = '';
        if (row.DTA_SAIDA) {
          const data = new Date(row.DTA_SAIDA);
          dtaSaida = `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}${String(data.getDate()).padStart(2, '0')}`;
        }

        return {
          codLoja: row.COD_LOJA || 1,
          desProduto: row.DES_PRODUTO || '',
          codProduto: String(row.COD_PRODUTO || ''),
          codBarraPrincipal: String(row.COD_BARRA_PRINCIPAL || row.COD_PRODUTO || '').padStart(13, '0'),
          dtaSaida,
          numCupomFiscal: row.NUM_CUPOM_FISCAL || 0,
          codCaixa: row.NUM_PDV || 0,
          valVenda: row.VAL_TOTAL_PRODUTO || 0,
          qtdTotalProduto: row.QTD_TOTAL_PRODUTO || 0,
          valTotalProduto: row.VAL_TOTAL_PRODUTO || 0,
          totalCusto: row.VAL_CUSTO_REP || 0,
          descontoAplicado: undefined,
          dataHoraVenda,
          numSeqItem: row.NUM_SEQ_ITEM,
          codOperador: row.COD_OPERADOR,
          desOperador: row.DES_OPERADOR
        } as Sale;
      });

      console.log(`✅ [ORACLE] ${sales.length} vendas recentes encontradas`);
      return sales;
    } catch (error) {
      console.error('❌ [ORACLE] Erro ao buscar vendas recentes:', error);
      throw error;
    }
  }

  /**
   * Converte data de YYYY-MM-DD para DD/MM/YYYY (formato Oracle)
   */
  private static formatDateToOracle(date: string): string {
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-');
      return `${day}/${month}/${year}`;
    }
    return date;
  }

  static validateDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(date);
  }

  static isTodayDate(date: string): boolean {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    return date === todayString;
  }
}
