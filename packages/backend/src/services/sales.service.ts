import axios from 'axios';
import { ConfigurationService } from './configuration.service';

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
    // Vendas SEMPRE vem da API Zanthus
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
        TO_CHAR(TO_TIMESTAMP(TO_CHAR(z.M00AF,'YYYY-MM-DD') || ' ' || LPAD(z.M43AS,4,'0'), 'YYYY-MM-DD HH24MI') + INTERVAL '3' HOUR, 'YYYY-MM-DD HH24:MI:SS') AS dataHoraVenda,
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
          dataHoraVenda: this.adjustTimezone(item.DATAHORAVENDA),
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