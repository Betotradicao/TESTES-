/**
 * Financeiro Service
 * Consultas na TAB_FLUXO (contas a pagar e receber) do Intersolid
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

interface FinanceiroFilters {
  vencInicio?: string;
  vencFim?: string;
  entradaInicio?: string;
  entradaFim?: string;
  tipoConta?: string;    // '0' = pagar (saída), '1' = receber (entrada), '' = todos
  quitado?: string;      // 'S', 'N', '' = todos
  tipoParceiro?: string; // '0','1','3','4','5', '' = todos
  codBanco?: string;
  codEntidade?: string;
  codCategoria?: string;
  parceiro?: string;     // busca textual no nome do parceiro
  codLoja?: string;
  incluirMovBanco?: string; // 'sim' ou 'nao' - incluir movimentações bancárias (TAB_MOV_BCO)
}

export class FinanceiroService {

  /**
   * Monta cláusulas WHERE baseadas nos filtros
   */
  private static buildFilters(filters: FinanceiroFilters, params: any): string {
    let where = ' WHERE 1=1';

    if (filters.vencInicio) {
      where += ` AND f.DTA_VENCIMENTO >= TO_DATE(:vencInicio, 'YYYY-MM-DD')`;
      params.vencInicio = filters.vencInicio;
    }
    if (filters.vencFim) {
      where += ` AND f.DTA_VENCIMENTO <= TO_DATE(:vencFim, 'YYYY-MM-DD') + 0.99999`;
      params.vencFim = filters.vencFim;
    }
    if (filters.entradaInicio) {
      where += ` AND f.DTA_ENTRADA >= TO_DATE(:entradaInicio, 'YYYY-MM-DD')`;
      params.entradaInicio = filters.entradaInicio;
    }
    if (filters.entradaFim) {
      where += ` AND f.DTA_ENTRADA <= TO_DATE(:entradaFim, 'YYYY-MM-DD') + 0.99999`;
      params.entradaFim = filters.entradaFim;
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
    console.log('[FINANCEIRO-SVC] WHERE clause:', where);
    console.log('[FINANCEIRO-SVC] SQL params:', JSON.stringify(params));

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

    // Se incluirMovBanco='sim', buscar também de TAB_MOV_BCO
    if (filters.incluirMovBanco === 'sim') {
      const movBcoData = await this.getMovBcoData(filters);
      data.push(...movBcoData);
    }

    return {
      success: true,
      data,
      count: data.length
    };
  }

  /**
   * Busca movimentações bancárias (TAB_MOV_BCO)
   * Mapeia colunas para o mesmo formato de TAB_FLUXO
   */
  private static async getMovBcoData(filters: FinanceiroFilters): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const params: any = {};
    let where = ' WHERE m.FLG_ESTORNO = \'N\' AND m.COD_CATEGORIA IS NOT NULL';

    if (filters.vencInicio) {
      where += ` AND m.DTA_ENTRADA >= TO_DATE(:vencInicio, 'YYYY-MM-DD')`;
      params.vencInicio = filters.vencInicio;
    }
    if (filters.vencFim) {
      where += ` AND m.DTA_ENTRADA <= TO_DATE(:vencFim, 'YYYY-MM-DD') + 0.99999`;
      params.vencFim = filters.vencFim;
    }
    if (filters.entradaInicio) {
      where += ` AND m.DTA_ENTRADA >= TO_DATE(:entradaInicio, 'YYYY-MM-DD')`;
      params.entradaInicio = filters.entradaInicio;
    }
    if (filters.entradaFim) {
      where += ` AND m.DTA_ENTRADA <= TO_DATE(:entradaFim, 'YYYY-MM-DD') + 0.99999`;
      params.entradaFim = filters.entradaFim;
    }
    // TIPO_OPERACAO: 0=depósito(entrada), 1=pagamento(saída)
    if (filters.tipoConta !== undefined && filters.tipoConta !== '') {
      // tipoConta: 0=saída, 1=entrada -> MOV_BCO: TIPO_OPERACAO 1=saída, 0=entrada
      const tipoOp = filters.tipoConta === '0' ? 1 : 0;
      where += ` AND m.TIPO_OPERACAO = :tipoOp`;
      params.tipoOp = tipoOp;
    }
    // TIPO_SITUACAO: 0=aberto, 1=quitado
    if (filters.quitado && filters.quitado !== '') {
      const tipoSit = filters.quitado === 'S' ? 1 : 0;
      where += ` AND m.TIPO_SITUACAO = :tipoSit`;
      params.tipoSit = tipoSit;
    }
    if (filters.codCategoria) {
      where += ` AND m.COD_CATEGORIA = :codCategoria`;
      params.codCategoria = Number(filters.codCategoria);
    }
    if (filters.parceiro) {
      where += ` AND UPPER(m.FAVORECIDO) LIKE UPPER(:parceiro)`;
      params.parceiro = `%${filters.parceiro}%`;
    }
    if (filters.codLoja) {
      where += ` AND m.COD_LOJA = :codLoja`;
      params.codLoja = Number(filters.codLoja);
    }
    if (filters.codBanco) {
      where += ` AND m.COD_BANCO = :codBanco`;
      params.codBanco = Number(filters.codBanco);
    }

    const sql = `
      SELECT * FROM (
        SELECT
          m.COD_CHAVE_MOV_CTA as NUM_REGISTRO,
          m.COD_LOJA,
          3 as TIPO_PARCEIRO,
          CASE WHEN m.TIPO_OPERACAO = 0 THEN 1 ELSE 0 END as TIPO_CONTA,
          0 as COD_PARCEIRO,
          m.FAVORECIDO as DES_PARCEIRO,
          NULL as NUM_CGC_CPF,
          m.DTA_ENTRADA,
          m.DTA_ENTRADA as DTA_EMISSAO,
          m.DTA_ENTRADA as DTA_VENCIMENTO,
          m.VAL_DOCTO as VAL_PARCELA,
          1 as NUM_PARCELA,
          1 as QTD_PARCELA,
          m.NUM_DOCTO_PGTO as NUM_DOCTO,
          NULL as NUM_NF,
          NULL as NUM_SERIE_NF,
          CASE WHEN m.TIPO_SITUACAO = 1 THEN 'S' ELSE 'N' END as FLG_QUITADO,
          m.DTA_QUITADA,
          m.DTA_PGTO,
          m.COD_BANCO as COD_BANCO_PGTO,
          m.DES_CC,
          NULL as COD_ENTIDADE,
          m.COD_CATEGORIA,
          m.COD_SUBCATEGORIA,
          0 as VAL_JUROS,
          0 as VAL_DESCONTO,
          0 as VAL_CREDITO,
          0 as VAL_DEVOLUCAO,
          m.DES_OBSERVACAO,
          NULL as DES_USUARIO_QUIT,
          NULL as USUARIO,
          NULL as NUM_BORDERO,
          NULL as FLG_COMPENSADO,
          b.DES_BANCO,
          NULL as DES_ENTIDADE,
          c.DES_CATEGORIA,
          sc.DES_SUBCATEGORIA
        FROM ${schema}.TAB_MOV_BCO m
        LEFT JOIN ${schema}.TAB_BANCO b ON b.COD_BANCO = m.COD_BANCO
        LEFT JOIN ${schema}.TAB_CATEGORIA c ON c.COD_CATEGORIA = m.COD_CATEGORIA
        LEFT JOIN ${schema}.TAB_SUBCATEGORIA sc ON sc.COD_CATEGORIA = m.COD_CATEGORIA AND sc.COD_SUBCATEGORIA = m.COD_SUBCATEGORIA
        ${where}
        ORDER BY m.DTA_ENTRADA DESC
      ) WHERE ROWNUM <= 500
    `;

    return OracleService.query<any>(sql, params);
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
    const resumo = result[0] || {};

    // Incluir mov banco no resumo
    if (filters.incluirMovBanco === 'sim') {
      const movBcoData = await this.getMovBcoData(filters);
      for (const row of movBcoData) {
        const tipoConta = Number(row.TIPO_CONTA);
        const val = Number(row.VAL_PARCELA) || 0;
        const quitado = row.FLG_QUITADO;
        if (tipoConta === 1) resumo.TOTAL_ENTRADAS = (Number(resumo.TOTAL_ENTRADAS) || 0) + val;
        else resumo.TOTAL_SAIDAS = (Number(resumo.TOTAL_SAIDAS) || 0) + val;
        if (quitado === 'N') {
          resumo.QTD_ABERTOS = (Number(resumo.QTD_ABERTOS) || 0) + 1;
          if (tipoConta === 0) resumo.SAIDAS_ABERTAS = (Number(resumo.SAIDAS_ABERTAS) || 0) + val;
          else resumo.ENTRADAS_ABERTAS = (Number(resumo.ENTRADAS_ABERTAS) || 0) + val;
        } else {
          resumo.QTD_QUITADOS = (Number(resumo.QTD_QUITADOS) || 0) + 1;
        }
        resumo.TOTAL_REGISTROS = (Number(resumo.TOTAL_REGISTROS) || 0) + 1;
      }
      resumo.SALDO = (Number(resumo.TOTAL_ENTRADAS) || 0) - (Number(resumo.TOTAL_SAIDAS) || 0);
    }

    return resumo;
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
