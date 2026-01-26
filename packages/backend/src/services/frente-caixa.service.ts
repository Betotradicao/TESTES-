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
        SELECT DISTINCT p.NUM_CUPOM_FISCAL, p.COD_PRODUTO, cf.COD_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV p
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND p.COD_LOJA = cf.COD_LOJA
        WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND NVL(p.FLG_CUPOM_CANCELADO, 'N') = 'N'
    `;
    if (codOperador) sqlItens += ` AND cf.COD_OPERADOR = :codOperador`;
    if (codLoja) sqlItens += ` AND p.COD_LOJA = :codLoja`;
    sqlItens += `) sub GROUP BY sub.COD_OPERADOR`;

    console.log('🔍 [Frente Caixa] Executando query de itens...');
    const itens = await OracleService.query<any>(sqlItens, params);
    console.log(`✅ [Frente Caixa] Itens: ${itens.length} registros`);
    const itensMap = new Map(itens.map(i => [i.COD_OPERADOR, i.TOTAL_ITENS]));

    // Buscar descontos usando subquery (exclui itens com 100% de desconto = bonificações)
    let sqlDescontos = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_DESCONTO) as TOTAL_DESCONTOS
      FROM (
        SELECT DISTINCT p.NUM_CUPOM_FISCAL, p.COD_PRODUTO, p.VAL_DESCONTO, cf.COD_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV p
        JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
          AND p.COD_LOJA = cf.COD_LOJA
        WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND NVL(p.VAL_DESCONTO, 0) > 0
          AND NVL(p.VAL_DESCONTO, 0) < NVL(p.VAL_TOTAL_PRODUTO, 0)
    `;
    if (codOperador) sqlDescontos += ` AND cf.COD_OPERADOR = :codOperador`;
    if (codLoja) sqlDescontos += ` AND p.COD_LOJA = :codLoja`;
    sqlDescontos += `) sub GROUP BY sub.COD_OPERADOR`;

    console.log('🔍 [Frente Caixa] Executando query de descontos...');
    const descontos = await OracleService.query<any>(sqlDescontos, params);
    console.log(`✅ [Frente Caixa] Descontos: ${descontos.length} registros`);
    const descontosMap = new Map(descontos.map(d => [d.COD_OPERADOR, d.TOTAL_DESCONTOS]));

    // Buscar cancelamentos - usa APENAS TAB_PRODUTO_PDV_ESTORNO (corresponde ao Z003)
    // Busca operador pelo cupom original - primeiro tenta mesma data, senão usa última ocorrência do cupom
    let sqlCancelamentos = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_TOTAL_PRODUTO) as TOTAL_CANCELAMENTOS
      FROM (
        SELECT
          e.VAL_TOTAL_PRODUTO,
          NVL(
            (SELECT MAX(cf.COD_OPERADOR) FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
             WHERE cf.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
             AND cf.COD_LOJA = e.COD_LOJA
             AND cf.NUM_PDV = e.NUM_PDV
             AND TRUNC(cf.DTA_VENDA) = TRUNC(e.DTA_SAIDA)),
            (SELECT MAX(cf2.COD_OPERADOR) FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf2
             WHERE cf2.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
             AND cf2.COD_LOJA = e.COD_LOJA
             AND cf2.NUM_PDV = e.NUM_PDV)
          ) as COD_OPERADOR
        FROM INTERSOLID.TAB_PRODUTO_PDV_ESTORNO e
        WHERE e.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND e.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${codLoja ? 'AND e.COD_LOJA = :codLoja' : ''}
      ) sub
      WHERE sub.COD_OPERADOR IS NOT NULL
        ${codOperador ? 'AND sub.COD_OPERADOR = :codOperador' : ''}
      GROUP BY sub.COD_OPERADOR`;

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

    // Buscar itens por dia - contagem direta (NUM_SEQ_ITEM não existe na tabela)
    let sqlItens = `
      SELECT
        TO_CHAR(p.DTA_SAIDA, 'DD/MM/YYYY') as DATA,
        COUNT(*) as TOTAL_ITENS
      FROM INTERSOLID.TAB_PRODUTO_PDV p
      JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
        AND p.COD_LOJA = cf.COD_LOJA
      WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND NVL(p.FLG_CUPOM_CANCELADO, 'N') = 'N'
        AND cf.COD_OPERADOR = :codOperador
    `;
    if (codLoja) sqlItens += ` AND p.COD_LOJA = :codLoja`;
    sqlItens += ` GROUP BY TO_CHAR(p.DTA_SAIDA, 'DD/MM/YYYY')`;

    const itens = await OracleService.query<any>(sqlItens, params);
    const itensMap = new Map(itens.map(i => [i.DATA, i.TOTAL_ITENS]));

    // Buscar descontos por dia (exclui itens com 100% de desconto = bonificações)
    let sqlDescontos = `
      SELECT
        TO_CHAR(p.DTA_SAIDA, 'DD/MM/YYYY') as DATA,
        SUM(NVL(p.VAL_DESCONTO, 0)) as TOTAL_DESCONTOS
      FROM INTERSOLID.TAB_PRODUTO_PDV p
      JOIN INTERSOLID.TAB_CUPOM_FINALIZADORA cf ON p.NUM_CUPOM_FISCAL = cf.NUM_CUPOM_FISCAL
        AND p.COD_LOJA = cf.COD_LOJA
      WHERE p.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND p.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND NVL(p.VAL_DESCONTO, 0) > 0
        AND NVL(p.VAL_DESCONTO, 0) < NVL(p.VAL_TOTAL_PRODUTO, 0)
        AND cf.COD_OPERADOR = :codOperador
    `;
    if (codLoja) sqlDescontos += ` AND p.COD_LOJA = :codLoja`;
    sqlDescontos += ` GROUP BY TO_CHAR(p.DTA_SAIDA, 'DD/MM/YYYY')`;

    const descontos = await OracleService.query<any>(sqlDescontos, params);
    const descontosMap = new Map(descontos.map(d => [d.DATA, d.TOTAL_DESCONTOS]));

    // Buscar cancelamentos por dia - usa APENAS TAB_PRODUTO_PDV_ESTORNO (corresponde ao Z003)
    // Busca operador pelo cupom original - primeiro tenta mesma data, senão usa qualquer ocorrência do cupom
    let sqlCancelamentos = `
      SELECT
        TO_CHAR(e.DTA_SAIDA, 'DD/MM/YYYY') as DATA,
        SUM(e.VAL_TOTAL_PRODUTO) as TOTAL_CANCELAMENTOS
      FROM INTERSOLID.TAB_PRODUTO_PDV_ESTORNO e
      WHERE e.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND e.DTA_SAIDA <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? 'AND e.COD_LOJA = :codLoja' : ''}
        AND (
          EXISTS (
            SELECT 1 FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
            WHERE cf.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
            AND cf.COD_LOJA = e.COD_LOJA
            AND cf.NUM_PDV = e.NUM_PDV
            AND TRUNC(cf.DTA_VENDA) = TRUNC(e.DTA_SAIDA)
            AND cf.COD_OPERADOR = :codOperador
          )
          OR EXISTS (
            SELECT 1 FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf2
            WHERE cf2.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
            AND cf2.COD_LOJA = e.COD_LOJA
            AND cf2.NUM_PDV = e.NUM_PDV
            AND cf2.COD_OPERADOR = :codOperador
            AND NOT EXISTS (
              SELECT 1 FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf3
              WHERE cf3.NUM_CUPOM_FISCAL = e.NUM_CUPOM_FISCAL
              AND cf3.COD_LOJA = e.COD_LOJA
              AND cf3.NUM_PDV = e.NUM_PDV
              AND TRUNC(cf3.DTA_VENDA) = TRUNC(e.DTA_SAIDA)
            )
          )
        )
      GROUP BY TO_CHAR(e.DTA_SAIDA, 'DD/MM/YYYY')`;

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

    // Query com JOIN para trazer informações de desconto e cancelamento
    // Inclui itens da TAB_PRODUTO_PDV (100% desconto) E da TAB_PRODUTO_PDV_ESTORNO (estornos)
    // Filtra itens pela mesma data do cupom para evitar mostrar itens de datas diferentes
    let sql = `
      SELECT
        cf.NUM_CUPOM_FISCAL,
        cf.COD_LOJA,
        TO_CHAR(MIN(cf.DTA_VENDA), 'DD/MM/YYYY HH24:MI') as DATA_HORA,
        SUM(cf.VAL_LIQUIDO) as VALOR_CUPOM,
        NVL(info.TOTAL_DESCONTO, 0) as TOTAL_DESCONTO,
        NVL(info.QTD_ITENS_DESCONTO, 0) as QTD_ITENS_DESCONTO,
        NVL(info.TOTAL_CANCELADO, 0) + NVL(estornos.TOTAL_ESTORNOS, 0) as TOTAL_CANCELADO,
        NVL(info.QTD_ITENS_CANCELADOS, 0) + NVL(estornos.QTD_ESTORNOS, 0) as QTD_ITENS_CANCELADOS,
        NVL(info.QTD_ITENS_TOTAL, 0) as QTD_ITENS_TOTAL,
        CASE WHEN NVL(info.QTD_ITENS_CANCELADOS, 0) + NVL(estornos.QTD_ESTORNOS, 0) = NVL(info.QTD_ITENS_TOTAL, 0) AND NVL(info.QTD_ITENS_TOTAL, 0) > 0 THEN 'S' ELSE 'N' END as FLG_CANCELADO
      FROM INTERSOLID.TAB_CUPOM_FINALIZADORA cf
      LEFT JOIN (
        SELECT
          pv.NUM_CUPOM_FISCAL,
          pv.COD_LOJA,
          SUM(CASE WHEN NVL(pv.VAL_DESCONTO, 0) < NVL(pv.VAL_TOTAL_PRODUTO, 0) THEN NVL(pv.VAL_DESCONTO, 0) ELSE 0 END) as TOTAL_DESCONTO,
          SUM(CASE WHEN NVL(pv.VAL_DESCONTO, 0) > 0 AND NVL(pv.VAL_DESCONTO, 0) < NVL(pv.VAL_TOTAL_PRODUTO, 0) THEN 1 ELSE 0 END) as QTD_ITENS_DESCONTO,
          SUM(CASE WHEN pv.FLG_CUPOM_CANCELADO = 'S' OR NVL(pv.VAL_DESCONTO, 0) >= NVL(pv.VAL_TOTAL_PRODUTO, 0) THEN NVL(pv.VAL_TOTAL_PRODUTO, 0) ELSE 0 END) as TOTAL_CANCELADO,
          SUM(CASE WHEN pv.FLG_CUPOM_CANCELADO = 'S' OR NVL(pv.VAL_DESCONTO, 0) >= NVL(pv.VAL_TOTAL_PRODUTO, 0) THEN 1 ELSE 0 END) as QTD_ITENS_CANCELADOS,
          COUNT(*) as QTD_ITENS_TOTAL
        FROM INTERSOLID.TAB_PRODUTO_PDV pv
        WHERE TO_CHAR(pv.DTA_SAIDA, 'DD/MM/YYYY') = :data
        GROUP BY pv.NUM_CUPOM_FISCAL, pv.COD_LOJA
      ) info ON cf.NUM_CUPOM_FISCAL = info.NUM_CUPOM_FISCAL AND cf.COD_LOJA = info.COD_LOJA
      LEFT JOIN (
        SELECT
          e.NUM_CUPOM_FISCAL,
          e.COD_LOJA,
          SUM(e.VAL_TOTAL_PRODUTO) as TOTAL_ESTORNOS,
          COUNT(*) as QTD_ESTORNOS
        FROM INTERSOLID.TAB_PRODUTO_PDV_ESTORNO e
        WHERE TO_CHAR(e.DTA_SAIDA, 'DD/MM/YYYY') = :data
        GROUP BY e.NUM_CUPOM_FISCAL, e.COD_LOJA
      ) estornos ON cf.NUM_CUPOM_FISCAL = estornos.NUM_CUPOM_FISCAL AND cf.COD_LOJA = estornos.COD_LOJA
      WHERE cf.COD_OPERADOR = :codOperador
        AND TO_CHAR(cf.DTA_VENDA, 'DD/MM/YYYY') = :data
        AND cf.COD_TIPO = 1110
    `;
    if (codLoja) sql += ` AND cf.COD_LOJA = :codLoja`;
    sql += ` GROUP BY cf.NUM_CUPOM_FISCAL, cf.COD_LOJA, info.TOTAL_DESCONTO, info.QTD_ITENS_DESCONTO, info.TOTAL_CANCELADO, info.QTD_ITENS_CANCELADOS, info.QTD_ITENS_TOTAL, estornos.TOTAL_ESTORNOS, estornos.QTD_ESTORNOS`;
    sql += ` ORDER BY MIN(cf.DTA_VENDA)`;

    console.log('🔍 [Frente Caixa] Buscando cupons do operador', codOperador, 'em', data);
    console.log('🔍 [Frente Caixa] SQL:', sql);
    console.log('🔍 [Frente Caixa] Params:', params);

    try {
      const cupons = await OracleService.query<any>(sql, params);
      console.log(`✅ [Frente Caixa] Encontrados ${cupons.length} cupons`);
      return cupons;
    } catch (error: any) {
      console.error('❌ [Frente Caixa] Erro na query de cupons:', error.message);
      throw error;
    }
  }

  /**
   * Busca itens de um cupom específico
   * @param data - Data opcional para filtrar itens apenas dessa data
   */
  static async getItensPorCupom(numCupom: number, codLoja: number, data?: string): Promise<any[]> {
    // Query corrigida - TAB_PRODUTO_PDV tem colunas diferentes
    // Fazemos JOIN com TAB_PRODUTO para pegar a descrição do produto
    // Itens com 100% de desconto são marcados como estornados
    const params: any = { numCupom, codLoja };

    // Query para itens normais
    let sqlItens = `
      SELECT
        pv.COD_PRODUTO,
        p.DES_PRODUTO,
        pv.QTD_TOTAL_PRODUTO as QTD_PRODUTO,
        CASE WHEN pv.QTD_TOTAL_PRODUTO > 0
             THEN pv.VAL_TOTAL_PRODUTO / pv.QTD_TOTAL_PRODUTO
             ELSE 0
        END as VAL_UNITARIO,
        pv.VAL_TOTAL_PRODUTO,
        CASE WHEN NVL(pv.VAL_DESCONTO, 0) >= NVL(pv.VAL_TOTAL_PRODUTO, 0) AND NVL(pv.VAL_TOTAL_PRODUTO, 0) > 0
             THEN 0
             ELSE NVL(pv.VAL_DESCONTO, 0)
        END as VAL_DESCONTO,
        CASE WHEN pv.FLG_CUPOM_CANCELADO = 'S' OR (NVL(pv.VAL_DESCONTO, 0) >= NVL(pv.VAL_TOTAL_PRODUTO, 0) AND NVL(pv.VAL_TOTAL_PRODUTO, 0) > 0)
             THEN 'S'
             ELSE 'N'
        END as FLG_ESTORNADO,
        'N' as ITEM_ESTORNO
      FROM INTERSOLID.TAB_PRODUTO_PDV pv
      LEFT JOIN INTERSOLID.TAB_PRODUTO p ON pv.COD_PRODUTO = p.COD_PRODUTO
      WHERE pv.NUM_CUPOM_FISCAL = :numCupom
        AND pv.COD_LOJA = :codLoja
    `;

    if (data) {
      sqlItens += ` AND TO_CHAR(pv.DTA_SAIDA, 'DD/MM/YYYY') = :data`;
      params.data = data;
    }

    // Query para itens estornados (da TAB_PRODUTO_PDV_ESTORNO)
    let sqlEstornos = `
      SELECT
        e.COD_PRODUTO,
        p.DES_PRODUTO,
        e.QTD_TOTAL_PRODUTO as QTD_PRODUTO,
        CASE WHEN e.QTD_TOTAL_PRODUTO > 0
             THEN e.VAL_TOTAL_PRODUTO / e.QTD_TOTAL_PRODUTO
             ELSE 0
        END as VAL_UNITARIO,
        e.VAL_TOTAL_PRODUTO,
        0 as VAL_DESCONTO,
        'S' as FLG_ESTORNADO,
        'S' as ITEM_ESTORNO
      FROM INTERSOLID.TAB_PRODUTO_PDV_ESTORNO e
      LEFT JOIN INTERSOLID.TAB_PRODUTO p ON e.COD_PRODUTO = p.COD_PRODUTO
      WHERE e.NUM_CUPOM_FISCAL = :numCupom
        AND e.COD_LOJA = :codLoja
    `;

    if (data) {
      sqlEstornos += ` AND TO_CHAR(e.DTA_SAIDA, 'DD/MM/YYYY') = :data`;
    }

    console.log('🔍 [Frente Caixa] Buscando itens do cupom', numCupom, 'loja', codLoja, data ? `data: ${data}` : '');

    try {
      // Buscar itens normais
      const itens = await OracleService.query<any>(sqlItens, params);
      console.log(`✅ [Frente Caixa] Encontrados ${itens.length} itens normais`);

      // Buscar itens estornados
      const estornos = await OracleService.query<any>(sqlEstornos, params);
      console.log(`✅ [Frente Caixa] Encontrados ${estornos.length} itens estornados`);

      // Combinar e numerar
      const todos = [...itens, ...estornos].map((item, index) => ({
        ...item,
        NUM_SEQ_ITEM: index + 1
      }));

      return todos;
    } catch (error: any) {
      console.error('❌ [Frente Caixa] Erro na query de itens:', error.message);
      throw error;
    }
  }
}
