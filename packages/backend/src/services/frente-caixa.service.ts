/**
 * Frente de Caixa Service
 * Serviço para consultas de vendas, cancelamentos, descontos e diferença de caixa por operador
 *
 * IMPORTANTE: SOMENTE LEITURA - Acesso ao Oracle é READ-ONLY
 */

import { OracleService } from './oracle.service';

// Interfaces
export interface FrenteCaixaFilters {
  dataInicio: string; // DD/MM/YYYY
  dataFim: string;    // DD/MM/YYYY
  codOperador?: number;
  codLoja?: number;
}

export interface OperadorResumo {
  COD_OPERADOR: number;
  DES_OPERADOR: string;
  TOTAL_VENDAS: number;
  TOTAL_ITENS: number;
  TOTAL_CUPONS: number;
  DINHEIRO: number;
  CARTAO_DEBITO: number;
  CARTAO_CREDITO: number;
  PIX: number;
  FUNCIONARIO: number;
  CARTAO_POS: number;
  TRICARD_PARCELADO: number;
  VALE_TROCA: number;
  VALE_DESCONTO: number;
  OUTROS: number;
  TOTAL_DESCONTOS: number;
  CANCELAMENTOS: number;     // Cancelamentos (estornos de itens/cupons)
  VAL_SOBRA: number;
  VAL_QUEBRA: number;
  VAL_DIFERENCA: number;
}

export interface OperadorPorDia {
  COD_OPERADOR: number;
  DES_OPERADOR: string;
  DATA: string;
  DIA: number;
  TOTAL_VENDAS: number;
  TOTAL_ITENS: number;
  TOTAL_CUPONS: number;
  DINHEIRO: number;
  CARTAO_DEBITO: number;
  CARTAO_CREDITO: number;
  PIX: number;
  FUNCIONARIO: number;
  CARTAO_POS: number;
  TRICARD_PARCELADO: number;
  VALE_TROCA: number;
  VALE_DESCONTO: number;
  OUTROS: number;
  TOTAL_DESCONTOS: number;
  CANCELAMENTOS: number;     // Cancelamentos (estornos de itens/cupons)
  VAL_SOBRA: number;
  VAL_QUEBRA: number;
  VAL_DIFERENCA: number;
}

export interface Operador {
  COD_OPERADOR: number;
  DES_OPERADOR: string;
}

export class FrenteCaixaService {
  /**
   * Mapeamento de finalizadoras (CORRIGIDO)
   * 1 = Dinheiro
   * 4 = Funcionário
   * 5 = Cartão POS
   * 6 = Cartão Crédito
   * 7 = Cartão Débito
   * 8 = Tricard Parcelado
   * 10 = Vale Troca
   * 13 = Vale Compra
   * 15 = PIX
   */

  /**
   * Lista operadores disponíveis
   */
  static async getOperadores(codLoja?: number): Promise<Operador[]> {
    let sql = `
      SELECT DISTINCT
        o.COD_OPERADOR,
        o.DES_OPERADOR
      FROM INTERSOLID.TAB_OPERADORES o
      WHERE o.DES_OPERADOR IS NOT NULL
    `;

    const params: any = {};

    if (codLoja) {
      sql += ` AND o.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    sql += ` ORDER BY o.DES_OPERADOR`;

    return OracleService.query<Operador>(sql, params);
  }

  /**
   * Busca resumo consolidado por operador
   */
  static async getResumoOperadores(filters: FrenteCaixaFilters): Promise<OperadorResumo[]> {
    const { dataInicio, dataFim, codOperador, codLoja } = filters;

    // Query principal - vendas por operador
    let sqlVendas = `
      SELECT
        cf.COD_OPERADOR,
        o.DES_OPERADOR,
        SUM(cf.VAL_LIQUIDO) as TOTAL_VENDAS,
        COUNT(DISTINCT cf.NUM_CUPOM_FISCAL) as TOTAL_CUPONS,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 1 THEN cf.VAL_LIQUIDO ELSE 0 END) as DINHEIRO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 7 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_DEBITO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 6 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_CREDITO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 15 THEN cf.VAL_LIQUIDO ELSE 0 END) as PIX,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 4 THEN cf.VAL_LIQUIDO ELSE 0 END) as FUNCIONARIO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 5 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_POS,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 8 THEN cf.VAL_LIQUIDO ELSE 0 END) as TRICARD_PARCELADO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 10 THEN cf.VAL_LIQUIDO ELSE 0 END) as VALE_TROCA,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 13 THEN cf.VAL_LIQUIDO ELSE 0 END) as VALE_DESCONTO,
        SUM(CASE WHEN cf.COD_FINALIZADORA NOT IN (1, 4, 5, 6, 7, 8, 10, 13, 15) THEN cf.VAL_LIQUIDO ELSE 0 END) as OUTROS
      FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
      LEFT JOIN INTERSOLID.TAB_OPERADORES o ON cf.COD_OPERADOR = o.COD_OPERADOR AND cf.COD_LOJA = o.COD_LOJA
      WHERE cf.DTA_VENDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cf.DTA_VENDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.COD_TIPO = 1110
    `;

    const params: any = { dataInicio, dataFim };

    if (codOperador) {
      sqlVendas += ` AND cf.COD_OPERADOR = :codOperador`;
      params.codOperador = codOperador;
    }

    if (codLoja) {
      sqlVendas += ` AND cf.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    sqlVendas += `
      GROUP BY cf.COD_OPERADOR, o.DES_OPERADOR
      ORDER BY TOTAL_VENDAS DESC
    `;

    console.log('🔍 [Frente Caixa] Executando query de vendas...');
    const vendas = await OracleService.query<any>(sqlVendas, params);
    console.log(`✅ [Frente Caixa] Vendas: ${vendas.length} registros`);

    // Buscar itens vendidos usando subquery para evitar produto cartesiano
    let sqlItens = `
      SELECT
        sub.COD_OPERADOR,
        COUNT(*) as TOTAL_ITENS
      FROM (
        SELECT DISTINCT p.NUM_CUPOM_FISCAL, p.NUM_SEQ_ITEM, cf.COD_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV p
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND p.COD_LOJA = cf.COD_LOJA
        WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND p.FLG_CUPOM_CANCELADO = 'N'
    `;
    if (codOperador) sqlItens += ` AND cf.COD_OPERADOR = :codOperador`;
    if (codLoja) sqlItens += ` AND p.COD_LOJA = :codLoja`;
    sqlItens += `) sub GROUP BY sub.COD_OPERADOR`;

    console.log('🔍 [Frente Caixa] Executando query de itens...');
    const itens = await OracleService.query<any>(sqlItens, params);
    console.log(`✅ [Frente Caixa] Itens: ${itens.length} registros`);
    const itensMap = new Map(itens.map(i => [i.COD_OPERADOR, i.TOTAL_ITENS]));

    // Buscar descontos usando subquery
    let sqlDescontos = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_DESCONTO) as TOTAL_DESCONTOS
      FROM (
        SELECT DISTINCT p.NUM_CUPOM_FISCAL, p.NUM_SEQ_ITEM, p.VAL_DESCONTO, cf.COD_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV p
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND p.COD_LOJA = cf.COD_LOJA
        WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND p.VAL_DESCONTO > 0
    `;
    if (codOperador) sqlDescontos += ` AND cf.COD_OPERADOR = :codOperador`;
    if (codLoja) sqlDescontos += ` AND p.COD_LOJA = :codLoja`;
    sqlDescontos += `) sub GROUP BY sub.COD_OPERADOR`;

    console.log('🔍 [Frente Caixa] Executando query de descontos...');
    const descontos = await OracleService.query<any>(sqlDescontos, params);
    console.log(`✅ [Frente Caixa] Descontos: ${descontos.length} registros`);
    const descontosMap = new Map(descontos.map(d => [d.COD_OPERADOR, d.TOTAL_DESCONTOS]));

    // Buscar cancelamentos usando subquery
    let sqlCancelamentos = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_TOTAL_PRODUTO) as TOTAL_CANCELAMENTOS
      FROM (
        SELECT DISTINCT e.NUM_CUPOM_FISCAL, e.NUM_SEQ_ITEM, e.VAL_TOTAL_PRODUTO, cf.COD_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV_ESTORNO e
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON e.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND e.COD_LOJA = cf.COD_LOJA
        WHERE e.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND e.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
    `;
    if (codOperador) sqlCancelamentos += ` AND cf.COD_OPERADOR = :codOperador`;
    if (codLoja) sqlCancelamentos += ` AND e.COD_LOJA = :codLoja`;
    sqlCancelamentos += `) sub GROUP BY sub.COD_OPERADOR`;

    console.log('🔍 [Frente Caixa] Executando query de cancelamentos...');
    const cancelamentos = await OracleService.query<any>(sqlCancelamentos, params);
    console.log(`✅ [Frente Caixa] Cancelamentos: ${cancelamentos.length} registros`);
    const cancelamentosMap = new Map(cancelamentos.map(c => [c.COD_OPERADOR, c.TOTAL_CANCELAMENTOS]));

    // Buscar sobra/quebra de caixa (pegando apenas o último registro de cada combinação)
    let sqlTesouraria = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_SOBRA) as VAL_SOBRA,
        SUM(sub.VAL_QUEBRA) as VAL_QUEBRA
      FROM (
        SELECT th.COD_OPERADOR, th.COD_LOJA, th.NUM_PDV, th.NUM_TURNO, th.VAL_SOBRA, th.VAL_QUEBRA
        FROM INTERSOLID.TAB_TESOURARIA_HISTORICO th
        WHERE th.DTA_MOVIMENTO >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND th.DTA_MOVIMENTO <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND th.NUM_REGISTRO = (
            SELECT MAX(th2.NUM_REGISTRO)
            FROM INTERSOLID.TAB_TESOURARIA_HISTORICO th2
            WHERE th2.COD_OPERADOR = th.COD_OPERADOR
              AND th2.COD_LOJA = th.COD_LOJA
              AND th2.NUM_PDV = th.NUM_PDV
              AND th2.NUM_TURNO = th.NUM_TURNO
              AND th2.DTA_MOVIMENTO = th.DTA_MOVIMENTO
          )
    `;
    if (codOperador) sqlTesouraria += ` AND th.COD_OPERADOR = :codOperador`;
    if (codLoja) sqlTesouraria += ` AND th.COD_LOJA = :codLoja`;
    sqlTesouraria += `) sub GROUP BY sub.COD_OPERADOR`;

    console.log('🔍 [Frente Caixa] Executando query de tesouraria...');
    const tesouraria = await OracleService.query<any>(sqlTesouraria, params);
    console.log(`✅ [Frente Caixa] Tesouraria: ${tesouraria.length} registros`);
    const tesourariaMap = new Map(tesouraria.map(t => [t.COD_OPERADOR, { sobra: t.VAL_SOBRA || 0, quebra: t.VAL_QUEBRA || 0 }]));

    // Combinar resultados
    return vendas.map(v => {
      const tes = tesourariaMap.get(v.COD_OPERADOR) || { sobra: 0, quebra: 0 };
      return {
        COD_OPERADOR: v.COD_OPERADOR,
        DES_OPERADOR: v.DES_OPERADOR || 'N/A',
        TOTAL_VENDAS: v.TOTAL_VENDAS || 0,
        TOTAL_ITENS: itensMap.get(v.COD_OPERADOR) || 0,
        TOTAL_CUPONS: v.TOTAL_CUPONS || 0,
        DINHEIRO: v.DINHEIRO || 0,
        CARTAO_DEBITO: v.CARTAO_DEBITO || 0,
        CARTAO_CREDITO: v.CARTAO_CREDITO || 0,
        PIX: v.PIX || 0,
        FUNCIONARIO: v.FUNCIONARIO || 0,
        CARTAO_POS: v.CARTAO_POS || 0,
        TRICARD_PARCELADO: v.TRICARD_PARCELADO || 0,
        VALE_TROCA: v.VALE_TROCA || 0,
        VALE_DESCONTO: v.VALE_DESCONTO || 0,
        OUTROS: v.OUTROS || 0,
        TOTAL_DESCONTOS: descontosMap.get(v.COD_OPERADOR) || 0,
        CANCELAMENTOS: cancelamentosMap.get(v.COD_OPERADOR) || 0,
        VAL_SOBRA: tes.sobra,
        VAL_QUEBRA: tes.quebra,
        VAL_DIFERENCA: tes.sobra - tes.quebra
      };
    });
  }

  /**
   * Busca detalhamento por dia de um operador
   */
  static async getDetalheOperadorPorDia(filters: FrenteCaixaFilters): Promise<OperadorPorDia[]> {
    const { dataInicio, dataFim, codOperador, codLoja } = filters;

    if (!codOperador) {
      throw new Error('codOperador é obrigatório para detalhe por dia');
    }

    // Query principal - vendas por dia
    const sqlVendas = `
      SELECT
        cf.COD_OPERADOR,
        o.DES_OPERADOR,
        TO_CHAR(cf.DTA_VENDA, 'DD/MM/YYYY') as DATA,
        EXTRACT(DAY FROM cf.DTA_VENDA) as DIA,
        SUM(cf.VAL_LIQUIDO) as TOTAL_VENDAS,
        COUNT(DISTINCT cf.NUM_CUPOM_FISCAL) as TOTAL_CUPONS,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 1 THEN cf.VAL_LIQUIDO ELSE 0 END) as DINHEIRO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 7 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_DEBITO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 6 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_CREDITO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 15 THEN cf.VAL_LIQUIDO ELSE 0 END) as PIX,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 4 THEN cf.VAL_LIQUIDO ELSE 0 END) as FUNCIONARIO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 5 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_POS,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 8 THEN cf.VAL_LIQUIDO ELSE 0 END) as TRICARD_PARCELADO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 10 THEN cf.VAL_LIQUIDO ELSE 0 END) as VALE_TROCA,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 13 THEN cf.VAL_LIQUIDO ELSE 0 END) as VALE_DESCONTO,
        SUM(CASE WHEN cf.COD_FINALIZADORA NOT IN (1, 4, 5, 6, 7, 8, 10, 13, 15) THEN cf.VAL_LIQUIDO ELSE 0 END) as OUTROS
      FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
      LEFT JOIN INTERSOLID.TAB_OPERADORES o ON cf.COD_OPERADOR = o.COD_OPERADOR AND cf.COD_LOJA = o.COD_LOJA
      WHERE cf.DTA_VENDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cf.DTA_VENDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.COD_TIPO = 1110
        AND cf.COD_OPERADOR = :codOperador
        ${codLoja ? 'AND cf.COD_LOJA = :codLoja' : ''}
      GROUP BY cf.COD_OPERADOR, o.DES_OPERADOR, cf.DTA_VENDA
      ORDER BY cf.DTA_VENDA
    `;

    const params: any = { dataInicio, dataFim, codOperador };
    if (codLoja) params.codLoja = codLoja;

    const vendas = await OracleService.query<any>(sqlVendas, params);

    // Buscar itens por dia usando subquery para evitar produto cartesiano
    let sqlItens = `
      SELECT
        sub.DATA,
        COUNT(*) as TOTAL_ITENS
      FROM (
        SELECT DISTINCT p.NUM_CUPOM_FISCAL, p.NUM_SEQ_ITEM, TO_CHAR(p.DTA_SAIDA, 'DD/MM/YYYY') as DATA
        FROM INTERSOLID.TAB_PRODUTO_PDV p
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND p.COD_LOJA = cf.COD_LOJA
        WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND p.FLG_CUPOM_CANCELADO = 'N'
          AND cf.COD_OPERADOR = :codOperador
    `;
    if (codLoja) sqlItens += ` AND p.COD_LOJA = :codLoja`;
    sqlItens += `) sub GROUP BY sub.DATA`;

    const itens = await OracleService.query<any>(sqlItens, params);
    const itensMap = new Map(itens.map(i => [i.DATA, i.TOTAL_ITENS]));

    // Buscar descontos por dia usando subquery
    let sqlDescontos = `
      SELECT
        sub.DATA,
        SUM(sub.VAL_DESCONTO) as TOTAL_DESCONTOS
      FROM (
        SELECT DISTINCT p.NUM_CUPOM_FISCAL, p.NUM_SEQ_ITEM, p.VAL_DESCONTO, TO_CHAR(p.DTA_SAIDA, 'DD/MM/YYYY') as DATA
        FROM INTERSOLID.TAB_PRODUTO_PDV p
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND p.COD_LOJA = cf.COD_LOJA
        WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND p.VAL_DESCONTO > 0
          AND cf.COD_OPERADOR = :codOperador
    `;
    if (codLoja) sqlDescontos += ` AND p.COD_LOJA = :codLoja`;
    sqlDescontos += `) sub GROUP BY sub.DATA`;

    const descontos = await OracleService.query<any>(sqlDescontos, params);
    const descontosMap = new Map(descontos.map(d => [d.DATA, d.TOTAL_DESCONTOS]));

    // Buscar cancelamentos por dia usando subquery
    let sqlCancelamentos = `
      SELECT
        sub.DATA,
        SUM(sub.VAL_TOTAL_PRODUTO) as TOTAL_CANCELAMENTOS
      FROM (
        SELECT DISTINCT e.NUM_CUPOM_FISCAL, e.NUM_SEQ_ITEM, e.VAL_TOTAL_PRODUTO, TO_CHAR(e.DTA_SAIDA, 'DD/MM/YYYY') as DATA
        FROM INTERSOLID.TAB_PRODUTO_PDV_ESTORNO e
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON e.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND e.COD_LOJA = cf.COD_LOJA
        WHERE e.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND e.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND cf.COD_OPERADOR = :codOperador
    `;
    if (codLoja) sqlCancelamentos += ` AND e.COD_LOJA = :codLoja`;
    sqlCancelamentos += `) sub GROUP BY sub.DATA`;

    const cancelamentos = await OracleService.query<any>(sqlCancelamentos, params);
    const cancelamentosMap = new Map(cancelamentos.map(c => [c.DATA, c.TOTAL_CANCELAMENTOS]));

    // Buscar sobra/quebra por dia (pegando apenas o último registro de cada combinação)
    let sqlTesouraria = `
      SELECT
        sub.DATA,
        SUM(sub.VAL_SOBRA) as VAL_SOBRA,
        SUM(sub.VAL_QUEBRA) as VAL_QUEBRA
      FROM (
        SELECT TO_CHAR(th.DTA_MOVIMENTO, 'DD/MM/YYYY') as DATA, th.COD_LOJA, th.NUM_PDV, th.NUM_TURNO, th.VAL_SOBRA, th.VAL_QUEBRA
        FROM INTERSOLID.TAB_TESOURARIA_HISTORICO th
        WHERE th.DTA_MOVIMENTO >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND th.DTA_MOVIMENTO <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND th.COD_OPERADOR = :codOperador
          AND th.NUM_REGISTRO = (
            SELECT MAX(th2.NUM_REGISTRO)
            FROM INTERSOLID.TAB_TESOURARIA_HISTORICO th2
            WHERE th2.COD_OPERADOR = th.COD_OPERADOR
              AND th2.COD_LOJA = th.COD_LOJA
              AND th2.NUM_PDV = th.NUM_PDV
              AND th2.NUM_TURNO = th.NUM_TURNO
              AND th2.DTA_MOVIMENTO = th.DTA_MOVIMENTO
          )
    `;
    if (codLoja) sqlTesouraria += ` AND th.COD_LOJA = :codLoja`;
    sqlTesouraria += `) sub GROUP BY sub.DATA`;

    const tesouraria = await OracleService.query<any>(sqlTesouraria, params);
    const tesourariaMap = new Map(tesouraria.map(t => [t.DATA, { sobra: t.VAL_SOBRA || 0, quebra: t.VAL_QUEBRA || 0 }]));

    // Combinar resultados
    return vendas.map(v => {
      const tes = tesourariaMap.get(v.DATA) || { sobra: 0, quebra: 0 };
      return {
        COD_OPERADOR: v.COD_OPERADOR,
        DES_OPERADOR: v.DES_OPERADOR || 'N/A',
        DATA: v.DATA,
        DIA: v.DIA,
        TOTAL_VENDAS: v.TOTAL_VENDAS || 0,
        TOTAL_ITENS: itensMap.get(v.DATA) || 0,
        TOTAL_CUPONS: v.TOTAL_CUPONS || 0,
        DINHEIRO: v.DINHEIRO || 0,
        CARTAO_DEBITO: v.CARTAO_DEBITO || 0,
        CARTAO_CREDITO: v.CARTAO_CREDITO || 0,
        PIX: v.PIX || 0,
        FUNCIONARIO: v.FUNCIONARIO || 0,
        CARTAO_POS: v.CARTAO_POS || 0,
        TRICARD_PARCELADO: v.TRICARD_PARCELADO || 0,
        VALE_TROCA: v.VALE_TROCA || 0,
        VALE_DESCONTO: v.VALE_DESCONTO || 0,
        OUTROS: v.OUTROS || 0,
        TOTAL_DESCONTOS: descontosMap.get(v.DATA) || 0,
        CANCELAMENTOS: cancelamentosMap.get(v.DATA) || 0,
        VAL_SOBRA: tes.sobra,
        VAL_QUEBRA: tes.quebra,
        VAL_DIFERENCA: tes.sobra - tes.quebra
      };
    });
  }

  /**
   * Busca totais gerais do período
   */
  static async getTotais(filters: FrenteCaixaFilters): Promise<any> {
    const { dataInicio, dataFim, codLoja } = filters;

    const params: any = { dataInicio, dataFim };
    if (codLoja) params.codLoja = codLoja;

    const sqlTotais = `
      SELECT
        SUM(cf.VAL_LIQUIDO) as TOTAL_VENDAS,
        COUNT(DISTINCT cf.NUM_CUPOM_FISCAL) as TOTAL_CUPONS,
        COUNT(DISTINCT cf.COD_OPERADOR) as TOTAL_OPERADORES,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 1 THEN cf.VAL_LIQUIDO ELSE 0 END) as DINHEIRO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 7 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_DEBITO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 6 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_CREDITO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 15 THEN cf.VAL_LIQUIDO ELSE 0 END) as PIX,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 4 THEN cf.VAL_LIQUIDO ELSE 0 END) as FUNCIONARIO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 5 THEN cf.VAL_LIQUIDO ELSE 0 END) as CARTAO_POS,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 8 THEN cf.VAL_LIQUIDO ELSE 0 END) as TRICARD_PARCELADO,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 10 THEN cf.VAL_LIQUIDO ELSE 0 END) as VALE_TROCA,
        SUM(CASE WHEN cf.COD_FINALIZADORA = 13 THEN cf.VAL_LIQUIDO ELSE 0 END) as VALE_DESCONTO,
        SUM(CASE WHEN cf.COD_FINALIZADORA NOT IN (1, 4, 5, 6, 7, 8, 10, 13, 15) THEN cf.VAL_LIQUIDO ELSE 0 END) as OUTROS
      FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
      WHERE cf.DTA_VENDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cf.DTA_VENDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.COD_TIPO = 1110
        ${codLoja ? 'AND cf.COD_LOJA = :codLoja' : ''}
    `;

    const totais = await OracleService.query<any>(sqlTotais, params);

    // Buscar totais de descontos
    const sqlDescontos = `
      SELECT SUM(VAL_DESCONTO) as TOTAL_DESCONTOS
      FROM INTERSOLID.TAB_PRODUTO_PDV
      WHERE DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND VAL_DESCONTO > 0
        ${codLoja ? 'AND COD_LOJA = :codLoja' : ''}
    `;
    const descontos = await OracleService.query<any>(sqlDescontos, params);

    // Buscar totais de cancelamentos (estornos)
    const sqlCancelamentos = `
      SELECT SUM(VAL_TOTAL_PRODUTO) as CANCELAMENTOS
      FROM INTERSOLID.TAB_PRODUTO_PDV_ESTORNO
      WHERE DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? 'AND COD_LOJA = :codLoja' : ''}
    `;
    const cancelamentos = await OracleService.query<any>(sqlCancelamentos, params);

    // Buscar totais de sobra/quebra (pegando apenas o último registro de cada combinação)
    const sqlTesouraria = `
      SELECT
        SUM(sub.VAL_SOBRA) as TOTAL_SOBRA,
        SUM(sub.VAL_QUEBRA) as TOTAL_QUEBRA
      FROM (
        SELECT th.COD_OPERADOR, th.COD_LOJA, th.NUM_PDV, th.NUM_TURNO, th.DTA_MOVIMENTO, th.VAL_SOBRA, th.VAL_QUEBRA
        FROM INTERSOLID.TAB_TESOURARIA_HISTORICO th
        WHERE th.DTA_MOVIMENTO >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND th.DTA_MOVIMENTO <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${codLoja ? 'AND th.COD_LOJA = :codLoja' : ''}
          AND th.NUM_REGISTRO = (
            SELECT MAX(th2.NUM_REGISTRO)
            FROM INTERSOLID.TAB_TESOURARIA_HISTORICO th2
            WHERE th2.COD_OPERADOR = th.COD_OPERADOR
              AND th2.COD_LOJA = th.COD_LOJA
              AND th2.NUM_PDV = th.NUM_PDV
              AND th2.NUM_TURNO = th.NUM_TURNO
              AND th2.DTA_MOVIMENTO = th.DTA_MOVIMENTO
          )
      ) sub
    `;
    const tesouraria = await OracleService.query<any>(sqlTesouraria, params);

    return {
      TOTAL_VENDAS: totais[0]?.TOTAL_VENDAS || 0,
      TOTAL_CUPONS: totais[0]?.TOTAL_CUPONS || 0,
      TOTAL_OPERADORES: totais[0]?.TOTAL_OPERADORES || 0,
      DINHEIRO: totais[0]?.DINHEIRO || 0,
      CARTAO_DEBITO: totais[0]?.CARTAO_DEBITO || 0,
      CARTAO_CREDITO: totais[0]?.CARTAO_CREDITO || 0,
      PIX: totais[0]?.PIX || 0,
      FUNCIONARIO: totais[0]?.FUNCIONARIO || 0,
      CARTAO_POS: totais[0]?.CARTAO_POS || 0,
      TRICARD_PARCELADO: totais[0]?.TRICARD_PARCELADO || 0,
      VALE_TROCA: totais[0]?.VALE_TROCA || 0,
      VALE_DESCONTO: totais[0]?.VALE_DESCONTO || 0,
      OUTROS: totais[0]?.OUTROS || 0,
      TOTAL_DESCONTOS: descontos[0]?.TOTAL_DESCONTOS || 0,
      CANCELAMENTOS: cancelamentos[0]?.CANCELAMENTOS || 0,
      TOTAL_SOBRA: tesouraria[0]?.TOTAL_SOBRA || 0,
      TOTAL_QUEBRA: tesouraria[0]?.TOTAL_QUEBRA || 0,
      TOTAL_DIFERENCA: (tesouraria[0]?.TOTAL_SOBRA || 0) - (tesouraria[0]?.TOTAL_QUEBRA || 0)
    };
  }

  /**
   * Busca cupons de um operador em uma data específica
   */
  static async getCuponsPorDia(codOperador: number, data: string, codLoja?: number): Promise<any[]> {
    const params: any = { codOperador, data };
    if (codLoja) params.codLoja = codLoja;

    let sql = `
      SELECT DISTINCT
        cf.NUM_CUPOM_FISCAL,
        cf.COD_LOJA,
        TO_CHAR(cf.DTA_VENDA, 'DD/MM/YYYY HH24:MI') as DATA_HORA,
        cf.VAL_LIQUIDO as VALOR_CUPOM,
        CASE WHEN cc.NUM_CFE IS NOT NULL THEN 'S' ELSE 'N' END as FLG_CANCELADO
      FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
      LEFT JOIN INTERSOLID.TAB_CUPOM_CANCELADO cc ON cf.NUM_CUPOM_FISCAL = cc.NUM_CFE
        AND cf.COD_LOJA = cc.COD_LOJA
      WHERE cf.COD_OPERADOR = :codOperador
        AND TO_CHAR(cf.DTA_VENDA, 'DD/MM/YYYY') = :data
        AND cf.COD_TIPO = 1110
    `;
    if (codLoja) sql += ` AND cf.COD_LOJA = :codLoja`;
    sql += ` ORDER BY cf.DTA_VENDA`;

    console.log('🔍 [Frente Caixa] Buscando cupons do operador', codOperador, 'em', data);
    const cupons = await OracleService.query<any>(sql, params);
    console.log(`✅ [Frente Caixa] Encontrados ${cupons.length} cupons`);

    return cupons;
  }

  /**
   * Busca itens de um cupom específico
   */
  static async getItensPorCupom(numCupom: number, codLoja: number): Promise<any[]> {
    const sql = `
      SELECT
        p.NUM_SEQ_ITEM,
        p.COD_PRODUTO,
        p.DES_PRODUTO,
        p.QTD_PRODUTO,
        p.VAL_UNITARIO,
        p.VAL_TOTAL_PRODUTO,
        p.VAL_DESCONTO,
        CASE WHEN e.NUM_CUPOM_FISCAL IS NOT NULL THEN 'S' ELSE 'N' END as FLG_ESTORNADO
      FROM INTERSOLID.TAB_PRODUTO_PDV p
      LEFT JOIN INTERSOLID.TAB_PRODUTO_PDV_ESTORNO e ON p.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
        AND p.COD_LOJA = e.COD_LOJA
        AND p.NUM_SEQ_ITEM = e.NUM_SEQ_ITEM
      WHERE p.NUM_CUPOM_FISCAL = :numCupom
        AND p.COD_LOJA = :codLoja
      ORDER BY p.NUM_SEQ_ITEM
    `;

    console.log('🔍 [Frente Caixa] Buscando itens do cupom', numCupom, 'loja', codLoja);
    const itens = await OracleService.query<any>(sql, { numCupom, codLoja });
    console.log(`✅ [Frente Caixa] Encontrados ${itens.length} itens`);

    return itens;
  }
}
