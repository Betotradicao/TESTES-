import axios from 'axios';
import { ConfigurationService } from './configuration.service';
import { OracleService } from './oracle.service';

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

export class SalesService {
  private static adjustTimezone(dateTimeStr: string): string {
    if (!dateTimeStr) return dateTimeStr;
    const date = new Date(dateTimeStr);
    date.setHours(date.getHours() + 3);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  static async fetchSalesFromERP(fromDate: string, toDate: string): Promise<Sale[]> {
    // Verifica configuração para usar Oracle ou Zanthus (default: oracle)
    const salesSource = await ConfigurationService.get('sales_source', 'oracle');

    if (salesSource === 'oracle') {
      console.log('📊 [SALES] Usando Oracle como fonte de vendas');
      // Converter fromDate de YYYYMMDD para YYYY-MM-DD se necessário
      const fromDateFormatted = fromDate.length === 8
        ? `${fromDate.slice(0, 4)}-${fromDate.slice(4, 6)}-${fromDate.slice(6, 8)}`
        : fromDate;
      const toDateFormatted = toDate.length === 8
        ? `${toDate.slice(0, 4)}-${toDate.slice(4, 6)}-${toDate.slice(6, 8)}`
        : toDate;
      return this.fetchSalesFromOracle(fromDateFormatted, toDateFormatted);
    }

    console.log('📊 [SALES] Usando Zanthus como fonte de vendas');
    return this.fetchSalesFromZanthus(fromDate, toDate);
  }

  private static async fetchSalesFromIntersolid(fromDate: string, toDate: string): Promise<Sale[]> {
    // Busca configurações do banco de dados (fallback para .env)
    const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
    const port = await ConfigurationService.get('intersolid_port', null);
    const salesEndpoint = await ConfigurationService.get('intersolid_sales_endpoint', '/v1/vendas');

    // Monta a URL completa
    const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
    const erpApiUrl = baseUrl
      ? `${baseUrl}${salesEndpoint}`
      : process.env.ERP_SALES_API_URL || 'http://mock-erp-sales-api.com';

    console.log('Fetching sales from Intersolid ERP API:', erpApiUrl);
    const params = {
      dta_de: fromDate,
      dta_ate: toDate
    };

    // Busca credenciais se configuradas
    const username = await ConfigurationService.get('intersolid_username', null);
    const password = await ConfigurationService.get('intersolid_password', null);

    const config: any = { params };
    if (username && password) {
      config.auth = { username, password };
    }

    const response = await axios.get(erpApiUrl, config);
    return response.data;
  }

  private static async fetchSalesFromZanthus(fromDate: string, toDate: string): Promise<Sale[]> {
    // Busca configurações do banco de dados (fallback para .env)
    const apiUrl = await ConfigurationService.get('zanthus_api_url', null);
    const port = await ConfigurationService.get('zanthus_port', null);
    const salesEndpoint = await ConfigurationService.get('zanthus_sales_endpoint', '/manager/restful/integracao/cadastro_sincrono.php5');

    // Monta a URL completa
    const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
    const zanthusApiUrl = baseUrl
      ? `${baseUrl}${salesEndpoint}`
      : process.env.API_ZANTHUS_URL;

    if (!zanthusApiUrl) {
      throw new Error('Zanthus API URL not configured. Please configure it in the settings.');
    }

    console.log('Fetching sales from Zanthus ERP API:', zanthusApiUrl);

    // Format dates for SQL query (YYYY-MM-DD)
    const formattedFromDate = this.formatDateForSQL(fromDate);
    const formattedToDate = this.formatDateForSQL(toDate);

    // Build SQL query - campos baseados no retorno real da API com JOIN para pegar descrição do produto
    const sql = `
      SELECT
        z.M00AC as codCaixa,
        z.M00ZA as codLoja,
        z.M43AH as codProduto,
        LPAD(z.M43AH, 13, '0') as codBarraPrincipal,
        z.M00AF as dtaSaida,
        z.M00AD as numCupomFiscal,
        z.M43DQ as valVenda,
        z.M43AO as qtdTotalProduto,
        z.M43AP as valTotalProduto,
        z.M43AQ as descontoAplicado,
        TO_CHAR(TO_TIMESTAMP(TO_CHAR(z.M00AF,'YYYY-MM-DD') || ' ' || LPAD(z.M43AS,4,'0'), 'YYYY-MM-DD HH24MI'), 'YYYY-MM-DD HH24:MI:SS') AS dataHoraVenda,
        z.M43BV as motivoCancelamento,
        z.M43BW as funcionarioCancelamento,
        z.M43CF as tipoCancelamento,
        p.DESCRICAO_PRODUTO as desProduto
      FROM ZAN_M43 z
      LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
      WHERE TRUNC(z.M00AF) BETWEEN TO_DATE('${formattedFromDate}','YYYY-MM-DD') AND TO_DATE('${formattedToDate}','YYYY-MM-DD')
    `.replace(/\s+/g, ' ').trim();

    // Build JSON structure
    const jsonData = {
      ZMI: {
        DATABASES: {
          DATABASE: {
            "@attributes": {
              NAME: "MANAGER",
              AUTOCOMMIT_VALUE: "1000",
              AUTOCOMMIT_ENABLED: "1",
              HALTONERROR: "1"
            },
            COMMANDS: {
              SELECT: {
                MERCADORIAS: {
                  MERCADORIA: {
                    SQL: sql
                  }
                }
              }
            }
          }
        }
      }
    };

    // Create form-urlencoded body
    const formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(jsonData));

    console.log('Zanthus URL:', zanthusApiUrl);
    console.log('Zanthus JSON Data:', JSON.stringify(jsonData, null, 2));

    const response = await axios.post(zanthusApiUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 600000 // 10 minutes timeout (600,000 milliseconds)
    });

    // Process Zanthus response and convert to Sale format
    return this.processZanthusResponse(response.data);
  }

  private static processZanthusResponse(data: any): Sale[] {
    const sales: Sale[] = [];

    try {
      // Navigate through the response structure
      const queryContent = data?.QUERY?.CONTENT;

      if (!queryContent || !Array.isArray(queryContent)) {
        console.warn('No sales data found in Zanthus response');
        return sales;
      }

      for (const item of queryContent) {
        // Skip empty objects or summary
        if (!item || Object.keys(item).length === 0) continue;

        const sale: Sale = {
          codLoja: parseInt(item.CODLOJA || 0),
          desProduto: String(item.DESPRODUTO || ''),
          codProduto: String(item.CODPRODUTO || ''),
          codBarraPrincipal: String(item.CODBARRAPRINCIPAL || ''),
          dtaSaida: this.formatDateFromZanthus(item.DTASAIDA || ''),
          numCupomFiscal: parseInt(item.NUMCUPOMFISCAL || 0),
          codCaixa: parseInt(item.CODCAIXA || 0),
          valVenda: parseFloat(item.VALVENDA || 0),
          qtdTotalProduto: parseFloat(item.QTDTOTALPRODUTO || 0),
          valTotalProduto: parseFloat(item.VALTOTALPRODUTO || 0),
          totalCusto: 0, // TOTALCUSTO não está presente no retorno atual do Zanthus
          descontoAplicado: item.DESCONTOAPLICADO ? parseFloat(item.DESCONTOAPLICADO) : undefined,
          dataHoraVenda: item.DATAHORAVENDA, // Usa direto do ERP, sem conversão de timezone
          motivoCancelamento: item.MOTIVOCANCELAMENTO,
          funcionarioCancelamento: item.FUNCIONARIOCANCELAMENTO,
          tipoCancelamento: item.TIPOCANCELAMENTO
        };

        sales.push(sale);
      }

      console.log(`Processed ${sales.length} sales from Zanthus response`);
    } catch (error) {
      console.error('Error processing Zanthus response:', error);
      throw new Error('Failed to process Zanthus sales data');
    }

    return sales;
  }

  private static formatDateForSQL(date: string): string {
    // If date is already in YYYY-MM-DD format, return as is
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }

    // If date is in YYYYMMDD format, convert to YYYY-MM-DD
    if (date.match(/^\d{8}$/)) {
      return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    }

    // Default return
    return date;
  }

  private static formatDateFromZanthus(dateValue: any): string {
    if (!dateValue) return '';

    // If it's already a string in format YYYYMMDD
    if (typeof dateValue === 'string' && dateValue.match(/^\d{8}$/)) {
      return dateValue;
    }

    // If it's a date string with time (YYYY-MM-DD HH:MM:SS or similar)
    if (typeof dateValue === 'string' && dateValue.includes('-')) {
      return dateValue.split(' ')[0].replace(/-/g, '');
    }

    // If it's a Date object
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    }

    return String(dateValue);
  }

  static formatDateToERP(date: string): string {
    return date.replace(/-/g, '');
  }

  /**
   * Busca vendas diretamente do Oracle Intersolid
   * Retorna no mesmo formato da interface Sale para compatibilidade
   * @param fromDate Data inicial no formato YYYY-MM-DD
   * @param toDate Data final no formato YYYY-MM-DD
   * @param codLoja Código da loja (opcional)
   */
  static async fetchSalesFromOracle(fromDate: string, toDate: string, codLoja?: number): Promise<Sale[]> {
    try {
      console.log(`📊 [ORACLE] Buscando vendas de ${fromDate} a ${toDate}...`);

      // Converter datas para formato Oracle (DD/MM/YYYY)
      const dataInicio = this.formatDateToOracle(fromDate);
      const dataFim = this.formatDateToOracle(toDate);

      let sql = `
        SELECT
          pv.NUM_CUPOM_FISCAL,
          pv.NUM_SEQ_ITEM,
          pv.COD_PRODUTO,
          p.DES_PRODUTO,
          pv.COD_PRODUTO as COD_BARRA_PRINCIPAL,
          pv.VAL_TOTAL_PRODUTO,
          pv.QTD_TOTAL_PRODUTO,
          pv.VAL_CUSTO_REP,
          pv.DTA_SAIDA,
          pv.TIM_HORA,
          pv.NUM_PDV,
          pv.COD_LOJA,
          pv.FLG_OFERTA,
          cf.COD_OPERADOR,
          o.DES_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV pv
        JOIN INTERSOLID.TAB_PRODUTO p ON p.COD_PRODUTO = pv.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf
          ON cf.NUM_CUPOM_FISCAL = pv.NUM_CUPOM_FISCAL
          AND cf.NUM_PDV = pv.NUM_PDV
          AND cf.COD_LOJA = pv.COD_LOJA
          AND TRUNC(cf.DTA_VENDA) = TRUNC(pv.DTA_SAIDA)
          AND cf.COD_TIPO = 1110
        LEFT JOIN INTERSOLID.TAB_OPERADORES o ON o.COD_OPERADOR = cf.COD_OPERADOR
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND pv.NUM_CUPOM_FISCAL > 0
      `;

      const params: any = { dataInicio, dataFim };

      if (codLoja) {
        sql += ` AND pv.COD_LOJA = :codLoja`;
        params.codLoja = codLoja;
      }

      sql += ` ORDER BY pv.TIM_HORA DESC`;

      const result = await OracleService.query<any>(sql, params);

      // Converter para formato Sale
      const sales: Sale[] = result.map((row: any) => {
        // Formatar data/hora
        let dataHoraVenda = '';
        if (row.TIM_HORA) {
          const hora = new Date(row.TIM_HORA);
          dataHoraVenda = hora.toISOString().replace('T', ' ').substring(0, 19);
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

      let sql = `
        SELECT
          pv.NUM_CUPOM_FISCAL,
          pv.NUM_SEQ_ITEM,
          pv.COD_PRODUTO,
          p.DES_PRODUTO,
          pv.COD_PRODUTO as COD_BARRA_PRINCIPAL,
          pv.VAL_TOTAL_PRODUTO,
          pv.QTD_TOTAL_PRODUTO,
          pv.VAL_CUSTO_REP,
          pv.DTA_SAIDA,
          pv.TIM_HORA,
          pv.NUM_PDV,
          pv.COD_LOJA,
          pv.FLG_OFERTA,
          cf.COD_OPERADOR,
          o.DES_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV pv
        JOIN INTERSOLID.TAB_PRODUTO p ON p.COD_PRODUTO = pv.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf
          ON cf.NUM_CUPOM_FISCAL = pv.NUM_CUPOM_FISCAL
          AND cf.NUM_PDV = pv.NUM_PDV
          AND cf.COD_LOJA = pv.COD_LOJA
          AND TRUNC(cf.DTA_VENDA) = TRUNC(pv.DTA_SAIDA)
          AND cf.COD_TIPO = 1110
        LEFT JOIN INTERSOLID.TAB_OPERADORES o ON o.COD_OPERADOR = cf.COD_OPERADOR
        WHERE TRUNC(pv.DTA_SAIDA) = TRUNC(SYSDATE)
          AND pv.TIM_HORA >= SYSDATE - INTERVAL '${minutosAtras}' MINUTE
          AND pv.NUM_CUPOM_FISCAL > 0
      `;

      const params: any = {};

      if (codLoja) {
        sql += ` AND pv.COD_LOJA = :codLoja`;
        params.codLoja = codLoja;
      }

      sql += ` ORDER BY pv.TIM_HORA DESC`;

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