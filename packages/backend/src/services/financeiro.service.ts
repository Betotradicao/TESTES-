/**
 * Financeiro Service
 * Consultas na TAB_FLUXO (contas a pagar e receber) do Intersolid
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

interface FinanceiroFilters {
  dataInicio?: string;
  dataFim?: string;
  tipoConta?: string;    // '0' = pagar (saída), '1' = receber (entrada), '' = todos
  quitado?: string;      // 'S', 'N', '' = todos
  tipoParceiro?: string; // '0','1','3','4','5', '' = todos
  codBanco?: string;
  codEntidade?: string;
  codCategoria?: string;
  parceiro?: string;     // busca textual no nome do parceiro
  codLoja?: string;
}

export class FinanceiroService {

  /**
   * Monta cláusulas WHERE baseadas nos filtros
   */
  private static buildFilters(filters: FinanceiroFilters, params: any): string {
    let where = ' WHERE 1=1';

    if (filters.dataInicio) {
      where += ` AND f.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`;
      params.dataInicio = filters.dataInicio;
    }
    if (filters.dataFim) {
      where += ` AND f.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
      params.dataFim = filters.dataFim;
    }
    if (filters.tipoConta !== undefined && filters.tipoConta !== '') {
      where += ` AND f.TIPO_CONTA = :tipoConta`;
      params.tipoConta = Number(filters.tipoConta);
    }
    if (filters.quitado && filters.quitado !== '') {
      where += ` AND f.FLG_QUITADO = :quitado`;
      params.quitado = filters.quitado;
    }
    if (filters.tipoParceiro !== undefined && filters.tipoParceiro !== '') {
      where += ` AND f.TIPO_PARCEIRO = :tipoParceiro`;
      params.tipoParceiro = Number(filters.tipoParceiro);
    }
    if (filters.codBanco) {
      where += ` AND f.COD_BANCO_PGTO = :codBanco`;
      params.codBanco = Number(filters.codBanco);
    }
    if (filters.codEntidade) {
      where += ` AND f.COD_ENTIDADE = :codEntidade`;
      params.codEntidade = Number(filters.codEntidade);
    }
    if (filters.codCategoria) {
      where += ` AND f.COD_CATEGORIA = :codCategoria`;
      params.codCategoria = Number(filters.codCategoria);
    }
    if (filters.parceiro) {
      where += ` AND UPPER(f.DES_PARCEIRO) LIKE UPPER(:parceiro)`;
      params.parceiro = `%${filters.parceiro}%`;
    }
    if (filters.codLoja) {
      where += ` AND f.COD_LOJA = :codLoja`;
      params.codLoja = Number(filters.codLoja);
    }

    return where;
  }

  /**
   * Busca títulos do fluxo financeiro (TAB_FLUXO)
   */
  static async getEntradasSaidas(filters: FinanceiroFilters): Promise<any> {
    const schema = await MappingService.getSchema();
    const params: any = {};
    const where = this.buildFilters(filters, params);

    const sql = `
      SELECT * FROM (
        SELECT
          f.NUM_REGISTRO,
          f.COD_LOJA,
          f.TIPO_PARCEIRO,
          f.TIPO_CONTA,
          f.COD_PARCEIRO,
          f.DES_PARCEIRO,
          f.NUM_CGC_CPF,
          f.DTA_ENTRADA,
          f.DTA_EMISSAO,
          f.DTA_VENCIMENTO,
          f.VAL_PARCELA,
          f.NUM_PARCELA,
          f.QTD_PARCELA,
          f.NUM_DOCTO,
          f.NUM_NF,
          f.NUM_SERIE_NF,
          f.FLG_QUITADO,
          f.DTA_QUITADA,
          f.DTA_PGTO,
          f.COD_BANCO_PGTO,
          f.DES_CC,
          f.COD_ENTIDADE,
          f.COD_CATEGORIA,
          f.COD_SUBCATEGORIA,
          f.VAL_JUROS,
          f.VAL_DESCONTO,
          f.VAL_CREDITO,
          f.VAL_DEVOLUCAO,
          f.DES_OBSERVACAO,
          f.DES_USUARIO_QUIT,
          f.USUARIO,
          f.NUM_BORDERO,
          f.FLG_COMPENSADO,
          b.DES_BANCO,
          e.DES_ENTIDADE,
          c.DES_CATEGORIA,
          sc.DES_SUBCATEGORIA
        FROM ${schema}.TAB_FLUXO f
        LEFT JOIN ${schema}.TAB_BANCO b ON b.COD_BANCO = f.COD_BANCO_PGTO
        LEFT JOIN ${schema}.TAB_ENTIDADE e ON e.COD_ENTIDADE = f.COD_ENTIDADE
        LEFT JOIN ${schema}.TAB_CATEGORIA c ON c.COD_CATEGORIA = f.COD_CATEGORIA
        LEFT JOIN ${schema}.TAB_SUBCATEGORIA sc ON sc.COD_CATEGORIA = f.COD_CATEGORIA AND sc.COD_SUBCATEGORIA = f.COD_SUBCATEGORIA
        ${where}
        ORDER BY f.DTA_VENCIMENTO DESC, f.NUM_REGISTRO DESC
      ) WHERE ROWNUM <= 500
    `;

    const data = await OracleService.query<any>(sql, params);

    return {
      success: true,
      data,
      count: data.length
    };
  }

  /**
   * Resumo: totais de entradas, saídas, saldo
   */
  static async getResumo(filters: FinanceiroFilters): Promise<any> {
    const schema = await MappingService.getSchema();
    const params: any = {};
    const where = this.buildFilters(filters, params);

    const sql = `
      SELECT
        SUM(CASE WHEN f.TIPO_CONTA = 1 THEN f.VAL_PARCELA ELSE 0 END) as TOTAL_ENTRADAS,
        SUM(CASE WHEN f.TIPO_CONTA = 0 THEN f.VAL_PARCELA ELSE 0 END) as TOTAL_SAIDAS,
        SUM(CASE WHEN f.TIPO_CONTA = 1 THEN f.VAL_PARCELA ELSE 0 END)
          - SUM(CASE WHEN f.TIPO_CONTA = 0 THEN f.VAL_PARCELA ELSE 0 END) as SALDO,
        SUM(CASE WHEN f.FLG_QUITADO = 'N' THEN 1 ELSE 0 END) as QTD_ABERTOS,
        SUM(CASE WHEN f.FLG_QUITADO = 'S' THEN 1 ELSE 0 END) as QTD_QUITADOS,
        SUM(CASE WHEN f.FLG_QUITADO = 'N' AND f.TIPO_CONTA = 0 THEN f.VAL_PARCELA ELSE 0 END) as SAIDAS_ABERTAS,
        SUM(CASE WHEN f.FLG_QUITADO = 'N' AND f.TIPO_CONTA = 1 THEN f.VAL_PARCELA ELSE 0 END) as ENTRADAS_ABERTAS,
        COUNT(*) as TOTAL_REGISTROS
      FROM ${schema}.TAB_FLUXO f
      ${where}
    `;

    const result = await OracleService.query<any>(sql, params);
    return result[0] || {};
  }

  /**
   * Lista bancos para dropdown
   */
  static async getBancos(): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const sql = `
      SELECT DISTINCT b.COD_BANCO, b.DES_BANCO
      FROM ${schema}.TAB_BANCO b
      WHERE EXISTS (SELECT 1 FROM ${schema}.TAB_FLUXO f WHERE f.COD_BANCO_PGTO = b.COD_BANCO)
      ORDER BY b.DES_BANCO
    `;
    return OracleService.query(sql);
  }

  /**
   * Lista entidades (formas de pagamento) para dropdown
   */
  static async getEntidades(): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const sql = `
      SELECT COD_ENTIDADE, DES_ENTIDADE
      FROM ${schema}.TAB_ENTIDADE
      ORDER BY DES_ENTIDADE
    `;
    return OracleService.query(sql);
  }

  /**
   * Lista categorias financeiras para dropdown
   */
  static async getCategorias(): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const sql = `
      SELECT COD_CATEGORIA, DES_CATEGORIA
      FROM ${schema}.TAB_CATEGORIA
      ORDER BY DES_CATEGORIA
    `;
    return OracleService.query(sql);
  }
}
