/**
 * Frente de Caixa Service
 * Serviço para consultas de vendas, cancelamentos, descontos e diferença de caixa por operador
 *
 * IMPORTANTE: SOMENTE LEITURA - Acesso ao Oracle é READ-ONLY
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

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
  ESTORNOS_ORFAOS: number;   // Estornos órfãos associados por PDV + horário
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
  ESTORNOS_ORFAOS: number;   // Estornos órfãos associados por PDV + horário
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
   * Helper para buscar todos os mapeamentos de vendas/PDV
   * Inclui campos de cupom finalizadora, produto PDV e estornos
   */
  private static async getVendasMappings() {
    const [
      // Campos de cupom/venda
      numeroCupomCol,
      dataVendaCol,
      valorTotalCol,
      codOperadorCol,
      nomeOperadorCol,
      codPdvCol,
      statusCupomCol,
      // Campos de finalizadora
      valorLiquidoCol,
      codFinalizadoraCol,
      codTipoCol,
      // Campos de produto PDV
      dataSaidaCol,
      valorDescontoCol,
      qtdTotalProdutoCol,
      codLojaCol,
      // Campos de estorno
      desHoraCol,
      // Campos de tesouraria
      valSobraCol,
      valQuebraCol,
      numTurnoCol,
      numRegistroCol,
      // Campos de produto
      codProdutoCol,
      desProdutoCol,
      // Campos de tesouraria (TAB_TESOURARIA_HISTORICO)
      dtaMovimentoCol
    ] = await Promise.all([
      // Campos de TAB_PRODUTO_PDV (cupom/venda)
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_cupom'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'data_venda'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_operador'),
      MappingService.getColumnFromTable('TAB_OPERADORES', 'nome_operador'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'numero_pdv'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'cupom_cancelado'),
      // Campos de TAB_CUPOM_FINALIZADORA
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'valor_liquido'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_finalizadora'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_tipo'),
      // Campos de TAB_PRODUTO_PDV
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_desconto'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_loja'),
      // Campos de estorno (TAB_PRODUTO_PDV)
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'des_hora'),
      // Campos de tesouraria (TAB_CUPOM_FINALIZADORA)
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'val_sobra'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'val_quebra'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'num_turno'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'num_registro'),
      // Campos de TAB_PRODUTO
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao'),
      // Campos de TAB_TESOURARIA_HISTORICO
      MappingService.getColumnFromTable('TAB_TESOURARIA_HISTORICO', 'data_movimento')
    ]);
    return {
      // Campos de cupom/venda
      numeroCupomCol,
      dataVendaCol,
      valorTotalCol,
      codOperadorCol,
      nomeOperadorCol,
      codPdvCol,
      statusCupomCol,
      // Campos de finalizadora
      valorLiquidoCol,
      codFinalizadoraCol,
      codTipoCol,
      // Campos de produto PDV
      dataSaidaCol,
      valorDescontoCol,
      qtdTotalProdutoCol,
      codLojaCol,
      // Campos de estorno
      desHoraCol,
      // Campos de tesouraria
      valSobraCol,
      valQuebraCol,
      numTurnoCol,
      numRegistroCol,
      // Campos de produto
      codProdutoCol,
      desProdutoCol,
      // Campos de tesouraria (TAB_TESOURARIA_HISTORICO)
      dtaMovimentoCol
    };
  }

  /**
   * Lista operadores disponíveis
   * NOTA: TAB_OPERADORES sempre usa COD_OPERADOR e DES_OPERADOR (não usar mapeamento de vendas)
   */
  static async getOperadores(codLoja?: number): Promise<Operador[]> {
    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabOperadores = `${schema}.${await MappingService.getRealTableName('TAB_OPERADORES')}`;

    // TAB_OPERADORES tem colunas fixas: COD_OPERADOR, DES_OPERADOR, COD_LOJA
    // Não confundir com COD_VENDEDOR que é da TAB_PRODUTO_PDV
    let sql = `
      SELECT DISTINCT
        o.COD_OPERADOR as COD_OPERADOR,
        o.DES_OPERADOR as DES_OPERADOR
      FROM ${tabOperadores} o
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

    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabOperadores = `${schema}.${await MappingService.getRealTableName('TAB_OPERADORES')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabTesourariaHistorico = `${schema}.${await MappingService.getRealTableName('TAB_TESOURARIA_HISTORICO')}`;

    // Busca mapeamentos dinâmicos
    const {
      codOperadorCol,
      nomeOperadorCol,
      valorLiquidoCol,
      numeroCupomCol,
      codFinalizadoraCol,
      dataVendaCol,
      codTipoCol,
      codLojaCol,
      dataSaidaCol,
      statusCupomCol,
      codProdutoCol,
      valorTotalCol,
      valorDescontoCol,
      codPdvCol,
      desHoraCol,
      valSobraCol,
      valQuebraCol,
      numTurnoCol,
      numRegistroCol,
      dtaMovimentoCol
    } = await this.getVendasMappings();

    // Query principal - vendas por operador
    let sqlVendas = `
      SELECT
        cf.${codOperadorCol} as COD_OPERADOR,
        o.${nomeOperadorCol} as DES_OPERADOR,
        SUM(cf.${valorLiquidoCol}) as TOTAL_VENDAS,
        COUNT(DISTINCT cf.${numeroCupomCol}) as TOTAL_CUPONS,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 1 THEN cf.${valorLiquidoCol} ELSE 0 END) as DINHEIRO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 7 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_DEBITO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 6 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_CREDITO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 15 THEN cf.${valorLiquidoCol} ELSE 0 END) as PIX,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 4 THEN cf.${valorLiquidoCol} ELSE 0 END) as FUNCIONARIO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 5 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_POS,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 8 THEN cf.${valorLiquidoCol} ELSE 0 END) as TRICARD_PARCELADO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 10 THEN cf.${valorLiquidoCol} ELSE 0 END) as VALE_TROCA,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 13 THEN cf.${valorLiquidoCol} ELSE 0 END) as VALE_DESCONTO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} NOT IN (1, 4, 5, 6, 7, 8, 10, 13, 15) THEN cf.${valorLiquidoCol} ELSE 0 END) as OUTROS
      FROM ${tabCupomFinalizadora} cf
      LEFT JOIN ${tabOperadores} o ON cf.${codOperadorCol} = o.${codOperadorCol} AND cf.${codLojaCol} = o.${codLojaCol}
      WHERE cf.${dataVendaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cf.${dataVendaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.${codTipoCol} = 1110
    `;

    const params: any = { dataInicio, dataFim };

    if (codOperador) {
      sqlVendas += ` AND cf.${codOperadorCol} = :codOperador`;
      params.codOperador = codOperador;
    }

    if (codLoja) {
      sqlVendas += ` AND cf.${codLojaCol} = :codLoja`;
      params.codLoja = codLoja;
    }

    sqlVendas += `
      GROUP BY cf.${codOperadorCol}, o.${nomeOperadorCol}
      ORDER BY TOTAL_VENDAS DESC
    `;

    // Buscar itens vendidos usando subquery para evitar produto cartesiano
    let sqlItens = `
      SELECT
        sub.COD_OPERADOR,
        COUNT(*) as TOTAL_ITENS
      FROM (
        SELECT DISTINCT p.${numeroCupomCol}, p.${codProdutoCol}, cf.${codOperadorCol} as COD_OPERADOR
        FROM ${tabProdutoPdv} p
        JOIN ${tabCupomFinalizadora} cf ON p.${numeroCupomCol} = cf.${numeroCupomCol}
          AND p.${codLojaCol} = cf.${codLojaCol}
        WHERE p.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND NVL(p.${statusCupomCol}, 'N') = 'N'
    `;
    if (codOperador) sqlItens += ` AND cf.${codOperadorCol} = :codOperador`;
    if (codLoja) sqlItens += ` AND p.${codLojaCol} = :codLoja`;
    sqlItens += `) sub GROUP BY sub.COD_OPERADOR`;

    // Buscar descontos usando subquery (exclui itens com 100% de desconto = bonificações)
    let sqlDescontos = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_DESCONTO) as TOTAL_DESCONTOS
      FROM (
        SELECT DISTINCT p.${numeroCupomCol}, p.${codProdutoCol}, p.${valorDescontoCol} as VAL_DESCONTO, cf.${codOperadorCol} as COD_OPERADOR
        FROM ${tabProdutoPdv} p
        JOIN ${tabCupomFinalizadora} cf ON p.${numeroCupomCol} = cf.${numeroCupomCol}
          AND p.${codLojaCol} = cf.${codLojaCol}
        WHERE p.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND p.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND NVL(p.${valorDescontoCol}, 0) > 0
          AND NVL(p.${valorDescontoCol}, 0) < NVL(p.${valorTotalCol}, 0)
    `;
    if (codOperador) sqlDescontos += ` AND cf.${codOperadorCol} = :codOperador`;
    if (codLoja) sqlDescontos += ` AND p.${codLojaCol} = :codLoja`;
    sqlDescontos += `) sub GROUP BY sub.COD_OPERADOR`;

    // Buscar cancelamentos - usa APENAS TAB_PRODUTO_PDV_ESTORNO (corresponde ao Z003)
    let sqlCancelamentos = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_TOTAL_PRODUTO) as TOTAL_CANCELAMENTOS
      FROM (
        SELECT
          e.${valorTotalCol} as VAL_TOTAL_PRODUTO,
          NVL(
            (SELECT MAX(cf.${codOperadorCol}) FROM ${tabCupomFinalizadora} cf
             WHERE cf.${numeroCupomCol} = e.${numeroCupomCol}
             AND cf.${codLojaCol} = e.${codLojaCol}
             AND cf.${codPdvCol} = e.${codPdvCol}
             AND TRUNC(cf.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})),
            (SELECT MAX(cf2.${codOperadorCol}) FROM ${tabCupomFinalizadora} cf2
             WHERE cf2.${numeroCupomCol} = e.${numeroCupomCol}
             AND cf2.${codLojaCol} = e.${codLojaCol}
             AND cf2.${codPdvCol} = e.${codPdvCol})
          ) as COD_OPERADOR
        FROM ${tabProdutoPdvEstorno} e
        WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
      ) sub
      WHERE sub.COD_OPERADOR IS NOT NULL
        ${codOperador ? 'AND sub.COD_OPERADOR = :codOperador' : ''}
      GROUP BY sub.COD_OPERADOR`;

    // Buscar estornos órfãos
    let sqlEstornosOrfaos = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_TOTAL_PRODUTO) as TOTAL_ESTORNOS_ORFAOS
      FROM (
        SELECT
          e.${valorTotalCol} as VAL_TOTAL_PRODUTO,
          e.${codPdvCol},
          e.${dataSaidaCol},
          e.${desHoraCol},
          NVL(
            (
              SELECT MIN(cf.${codOperadorCol}) KEEP (DENSE_RANK FIRST ORDER BY ABS(TO_NUMBER(TO_CHAR(cf.${dataVendaCol}, 'HH24MI')) - TO_NUMBER(NVL(e.${desHoraCol}, '0'))))
              FROM ${tabCupomFinalizadora} cf
              WHERE cf.${codPdvCol} = e.${codPdvCol}
                AND cf.${codLojaCol} = e.${codLojaCol}
                AND TRUNC(cf.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})
            ),
            (
              SELECT MAX(th.${codOperadorCol}) FROM ${tabTesourariaHistorico} th
              WHERE th.${codPdvCol} = e.${codPdvCol}
                AND th.${codLojaCol} = e.${codLojaCol}
                AND TRUNC(th.${dtaMovimentoCol}) = TRUNC(e.${dataSaidaCol})
            )
          ) as COD_OPERADOR
        FROM ${tabProdutoPdvEstorno} e
        WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
          AND NOT EXISTS (
            SELECT 1 FROM ${tabCupomFinalizadora} cf
            WHERE cf.${numeroCupomCol} = e.${numeroCupomCol}
            AND cf.${codLojaCol} = e.${codLojaCol}
            AND cf.${codPdvCol} = e.${codPdvCol}
          )
      ) sub
      WHERE sub.COD_OPERADOR IS NOT NULL
        ${codOperador ? 'AND sub.COD_OPERADOR = :codOperador' : ''}
      GROUP BY sub.COD_OPERADOR`;

    // Buscar sobra/quebra de caixa
    let sqlTesouraria = `
      SELECT
        sub.COD_OPERADOR,
        SUM(sub.VAL_SOBRA) as VAL_SOBRA,
        SUM(sub.VAL_QUEBRA) as VAL_QUEBRA
      FROM (
        SELECT th.${codOperadorCol} as COD_OPERADOR, th.${codLojaCol}, th.${codPdvCol}, th.${numTurnoCol}, th.${valSobraCol} as VAL_SOBRA, th.${valQuebraCol} as VAL_QUEBRA
        FROM ${tabTesourariaHistorico} th
        WHERE th.${dtaMovimentoCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND th.${dtaMovimentoCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND th.${numRegistroCol} = (
            SELECT MAX(th2.${numRegistroCol})
            FROM ${tabTesourariaHistorico} th2
            WHERE th2.${codOperadorCol} = th.${codOperadorCol}
              AND th2.${codLojaCol} = th.${codLojaCol}
              AND th2.${codPdvCol} = th.${codPdvCol}
              AND th2.${numTurnoCol} = th.${numTurnoCol}
              AND th2.${dtaMovimentoCol} = th.${dtaMovimentoCol}
          )
    `;
    if (codOperador) sqlTesouraria += ` AND th.${codOperadorCol} = :codOperador`;
    if (codLoja) sqlTesouraria += ` AND th.${codLojaCol} = :codLoja`;
    sqlTesouraria += `) sub GROUP BY sub.COD_OPERADOR`;

    // Executar em 2 lotes para não sobrecarregar o Oracle
    // Lote 1: queries mais leves (vendas, itens, descontos)
    // Lote 2: queries mais pesadas (cancelamentos, estornos órfãos, tesouraria)
    console.log('🔍 [Frente Caixa] Executando queries em 2 lotes...');
    const startTime = Date.now();

    const [vendas, itens, descontos] = await Promise.all([
      OracleService.query<any>(sqlVendas, params),
      OracleService.query<any>(sqlItens, params),
      OracleService.query<any>(sqlDescontos, params)
    ]);
    console.log(`  📊 Lote 1 OK (${((Date.now() - startTime) / 1000).toFixed(1)}s) - Vendas: ${vendas.length}, Itens: ${itens.length}, Descontos: ${descontos.length}`);

    const startTime2 = Date.now();
    const [cancelamentos, estornosOrfaos, tesouraria] = await Promise.all([
      OracleService.query<any>(sqlCancelamentos, params),
      OracleService.query<any>(sqlEstornosOrfaos, params),
      OracleService.query<any>(sqlTesouraria, params)
    ]);
    console.log(`  📊 Lote 2 OK (${((Date.now() - startTime2) / 1000).toFixed(1)}s) - Cancel: ${cancelamentos.length}, Estornos: ${estornosOrfaos.length}, Tesouraria: ${tesouraria.length}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [Frente Caixa] Total: ${elapsed}s`);

    const itensMap = new Map(itens.map(i => [i.COD_OPERADOR, i.TOTAL_ITENS]));
    const descontosMap = new Map(descontos.map(d => [d.COD_OPERADOR, d.TOTAL_DESCONTOS]));
    const cancelamentosMap = new Map(cancelamentos.map(c => [c.COD_OPERADOR, c.TOTAL_CANCELAMENTOS]));
    const estornosOrfaosMap = new Map(estornosOrfaos.map(e => [e.COD_OPERADOR, e.TOTAL_ESTORNOS_ORFAOS]));
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
        ESTORNOS_ORFAOS: estornosOrfaosMap.get(v.COD_OPERADOR) || 0,
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

    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabOperadores = `${schema}.${await MappingService.getRealTableName('TAB_OPERADORES')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabTesourariaHistorico = `${schema}.${await MappingService.getRealTableName('TAB_TESOURARIA_HISTORICO')}`;

    // Busca mapeamentos dinâmicos
    const {
      codOperadorCol,
      nomeOperadorCol,
      valorLiquidoCol,
      numeroCupomCol,
      codFinalizadoraCol,
      dataVendaCol,
      codTipoCol,
      codLojaCol,
      dataSaidaCol,
      statusCupomCol,
      codProdutoCol,
      valorTotalCol,
      valorDescontoCol,
      codPdvCol,
      desHoraCol,
      valSobraCol,
      valQuebraCol,
      numTurnoCol,
      numRegistroCol,
      dtaMovimentoCol
    } = await this.getVendasMappings();

    // Query principal - vendas por dia
    const sqlVendas = `
      SELECT
        cf.${codOperadorCol} as COD_OPERADOR,
        o.${nomeOperadorCol} as DES_OPERADOR,
        TO_CHAR(cf.${dataVendaCol}, 'DD/MM/YYYY') as DATA,
        EXTRACT(DAY FROM cf.${dataVendaCol}) as DIA,
        SUM(cf.${valorLiquidoCol}) as TOTAL_VENDAS,
        COUNT(DISTINCT cf.${numeroCupomCol}) as TOTAL_CUPONS,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 1 THEN cf.${valorLiquidoCol} ELSE 0 END) as DINHEIRO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 7 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_DEBITO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 6 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_CREDITO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 15 THEN cf.${valorLiquidoCol} ELSE 0 END) as PIX,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 4 THEN cf.${valorLiquidoCol} ELSE 0 END) as FUNCIONARIO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 5 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_POS,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 8 THEN cf.${valorLiquidoCol} ELSE 0 END) as TRICARD_PARCELADO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 10 THEN cf.${valorLiquidoCol} ELSE 0 END) as VALE_TROCA,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 13 THEN cf.${valorLiquidoCol} ELSE 0 END) as VALE_DESCONTO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} NOT IN (1, 4, 5, 6, 7, 8, 10, 13, 15) THEN cf.${valorLiquidoCol} ELSE 0 END) as OUTROS
      FROM ${tabCupomFinalizadora} cf
      LEFT JOIN ${tabOperadores} o ON cf.${codOperadorCol} = o.${codOperadorCol} AND cf.${codLojaCol} = o.${codLojaCol}
      WHERE cf.${dataVendaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cf.${dataVendaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.${codTipoCol} = 1110
        AND cf.${codOperadorCol} = :codOperador
        ${codLoja ? `AND cf.${codLojaCol} = :codLoja` : ''}
      GROUP BY cf.${codOperadorCol}, o.${nomeOperadorCol}, cf.${dataVendaCol}
      ORDER BY cf.${dataVendaCol}
    `;

    const params: any = { dataInicio, dataFim, codOperador };
    if (codLoja) params.codLoja = codLoja;

    const vendas = await OracleService.query<any>(sqlVendas, params);

    // Buscar itens por dia - contagem direta (NUM_SEQ_ITEM não existe na tabela)
    let sqlItens = `
      SELECT
        TO_CHAR(p.${dataSaidaCol}, 'DD/MM/YYYY') as DATA,
        COUNT(*) as TOTAL_ITENS
      FROM ${tabProdutoPdv} p
      JOIN ${tabCupomFinalizadora} cf ON p.${numeroCupomCol} = cf.${numeroCupomCol}
        AND p.${codLojaCol} = cf.${codLojaCol}
      WHERE p.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND p.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND NVL(p.${statusCupomCol}, 'N') = 'N'
        AND cf.${codOperadorCol} = :codOperador
    `;
    if (codLoja) sqlItens += ` AND p.${codLojaCol} = :codLoja`;
    sqlItens += ` GROUP BY TO_CHAR(p.${dataSaidaCol}, 'DD/MM/YYYY')`;

    const itens = await OracleService.query<any>(sqlItens, params);
    const itensMap = new Map(itens.map(i => [i.DATA, i.TOTAL_ITENS]));

    // Buscar descontos por dia (exclui itens com 100% de desconto = bonificações)
    let sqlDescontos = `
      SELECT
        TO_CHAR(p.${dataSaidaCol}, 'DD/MM/YYYY') as DATA,
        SUM(NVL(p.${valorDescontoCol}, 0)) as TOTAL_DESCONTOS
      FROM ${tabProdutoPdv} p
      JOIN ${tabCupomFinalizadora} cf ON p.${numeroCupomCol} = cf.${numeroCupomCol}
        AND p.${codLojaCol} = cf.${codLojaCol}
      WHERE p.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND p.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND NVL(p.${valorDescontoCol}, 0) > 0
        AND NVL(p.${valorDescontoCol}, 0) < NVL(p.${valorTotalCol}, 0)
        AND cf.${codOperadorCol} = :codOperador
    `;
    if (codLoja) sqlDescontos += ` AND p.${codLojaCol} = :codLoja`;
    sqlDescontos += ` GROUP BY TO_CHAR(p.${dataSaidaCol}, 'DD/MM/YYYY')`;

    const descontos = await OracleService.query<any>(sqlDescontos, params);
    const descontosMap = new Map(descontos.map(d => [d.DATA, d.TOTAL_DESCONTOS]));

    // Buscar cancelamentos por dia - usa APENAS TAB_PRODUTO_PDV_ESTORNO (corresponde ao Z003)
    // Busca operador pelo cupom original - primeiro tenta mesma data, senão usa qualquer ocorrência do cupom
    let sqlCancelamentos = `
      SELECT
        TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY') as DATA,
        SUM(e.${valorTotalCol}) as TOTAL_CANCELAMENTOS
      FROM ${tabProdutoPdvEstorno} e
      WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
        AND (
          EXISTS (
            SELECT 1 FROM ${tabCupomFinalizadora} cf
            WHERE cf.${numeroCupomCol} = e.${numeroCupomCol}
            AND cf.${codLojaCol} = e.${codLojaCol}
            AND cf.${codPdvCol} = e.${codPdvCol}
            AND TRUNC(cf.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})
            AND cf.${codOperadorCol} = :codOperador
          )
          OR EXISTS (
            SELECT 1 FROM ${tabCupomFinalizadora} cf2
            WHERE cf2.${numeroCupomCol} = e.${numeroCupomCol}
            AND cf2.${codLojaCol} = e.${codLojaCol}
            AND cf2.${codPdvCol} = e.${codPdvCol}
            AND cf2.${codOperadorCol} = :codOperador
            AND NOT EXISTS (
              SELECT 1 FROM ${tabCupomFinalizadora} cf3
              WHERE cf3.${numeroCupomCol} = e.${numeroCupomCol}
              AND cf3.${codLojaCol} = e.${codLojaCol}
              AND cf3.${codPdvCol} = e.${codPdvCol}
              AND TRUNC(cf3.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})
            )
          )
        )
      GROUP BY TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY')`;

    const cancelamentos = await OracleService.query<any>(sqlCancelamentos, params);
    const cancelamentosMap = new Map(cancelamentos.map(c => [c.DATA, c.TOTAL_CANCELAMENTOS]));

    // Buscar estornos órfãos por dia - associados pelo operador que fez a venda mais próxima (por horário) no mesmo PDV
    // FALLBACK: Se não houver vendas no PDV, busca quem fechou o caixa (tesouraria) naquele PDV no dia
    let sqlEstornosOrfaos = `
      SELECT
        TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY') as DATA,
        SUM(e.${valorTotalCol}) as TOTAL_ESTORNOS_ORFAOS
      FROM ${tabProdutoPdvEstorno} e
      WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
        -- Somente estornos órfãos (sem match de cupom no mesmo PDV)
        AND NOT EXISTS (
          SELECT 1 FROM ${tabCupomFinalizadora} cf
          WHERE cf.${numeroCupomCol} = e.${numeroCupomCol}
          AND cf.${codLojaCol} = e.${codLojaCol}
          AND cf.${codPdvCol} = e.${codPdvCol}
        )
        -- Associar ao operador: primeiro pela venda mais próxima, fallback pela tesouraria
        AND :codOperador = NVL(
          (
            SELECT MIN(cf2.${codOperadorCol}) KEEP (DENSE_RANK FIRST ORDER BY ABS(TO_NUMBER(TO_CHAR(cf2.${dataVendaCol}, 'HH24MI')) - TO_NUMBER(NVL(e.${desHoraCol}, '0'))))
            FROM ${tabCupomFinalizadora} cf2
            WHERE cf2.${codPdvCol} = e.${codPdvCol}
              AND cf2.${codLojaCol} = e.${codLojaCol}
              AND TRUNC(cf2.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})
          ),
          (
            -- Fallback: quem estava na tesouraria (fechou caixa) nesse PDV no mesmo dia
            SELECT MAX(th.${codOperadorCol}) FROM ${tabTesourariaHistorico} th
            WHERE th.${codPdvCol} = e.${codPdvCol}
              AND th.${codLojaCol} = e.${codLojaCol}
              AND TRUNC(th.${dtaMovimentoCol}) = TRUNC(e.${dataSaidaCol})
          )
        )
      GROUP BY TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY')`;

    const estornosOrfaos = await OracleService.query<any>(sqlEstornosOrfaos, params);
    const estornosOrfaosMap = new Map(estornosOrfaos.map(e => [e.DATA, e.TOTAL_ESTORNOS_ORFAOS]));

    // Buscar sobra/quebra por dia (pegando apenas o último registro de cada combinação)
    let sqlTesouraria = `
      SELECT
        sub.DATA,
        SUM(sub.VAL_SOBRA) as VAL_SOBRA,
        SUM(sub.VAL_QUEBRA) as VAL_QUEBRA
      FROM (
        SELECT TO_CHAR(th.${dtaMovimentoCol}, 'DD/MM/YYYY') as DATA, th.${codLojaCol}, th.${codPdvCol}, th.${numTurnoCol}, th.${valSobraCol} as VAL_SOBRA, th.${valQuebraCol} as VAL_QUEBRA
        FROM ${tabTesourariaHistorico} th
        WHERE th.${dtaMovimentoCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND th.${dtaMovimentoCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND th.${codOperadorCol} = :codOperador
          AND th.${numRegistroCol} = (
            SELECT MAX(th2.${numRegistroCol})
            FROM ${tabTesourariaHistorico} th2
            WHERE th2.${codOperadorCol} = th.${codOperadorCol}
              AND th2.${codLojaCol} = th.${codLojaCol}
              AND th2.${codPdvCol} = th.${codPdvCol}
              AND th2.${numTurnoCol} = th.${numTurnoCol}
              AND th2.${dtaMovimentoCol} = th.${dtaMovimentoCol}
          )
    `;
    if (codLoja) sqlTesouraria += ` AND th.${codLojaCol} = :codLoja`;
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
        ESTORNOS_ORFAOS: estornosOrfaosMap.get(v.DATA) || 0,
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

    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabTesourariaHistorico = `${schema}.${await MappingService.getRealTableName('TAB_TESOURARIA_HISTORICO')}`;

    // Busca mapeamentos dinâmicos
    const {
      valorLiquidoCol,
      numeroCupomCol,
      codFinalizadoraCol,
      dataVendaCol,
      codTipoCol,
      codLojaCol,
      codOperadorCol,
      dataSaidaCol,
      valorDescontoCol,
      valorTotalCol,
      codPdvCol,
      valSobraCol,
      valQuebraCol,
      numTurnoCol,
      numRegistroCol,
      dtaMovimentoCol
    } = await this.getVendasMappings();

    const params: any = { dataInicio, dataFim };
    if (codLoja) params.codLoja = codLoja;

    const sqlTotais = `
      SELECT
        SUM(cf.${valorLiquidoCol}) as TOTAL_VENDAS,
        COUNT(DISTINCT cf.${numeroCupomCol}) as TOTAL_CUPONS,
        COUNT(DISTINCT cf.${codOperadorCol}) as TOTAL_OPERADORES,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 1 THEN cf.${valorLiquidoCol} ELSE 0 END) as DINHEIRO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 7 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_DEBITO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 6 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_CREDITO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 15 THEN cf.${valorLiquidoCol} ELSE 0 END) as PIX,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 4 THEN cf.${valorLiquidoCol} ELSE 0 END) as FUNCIONARIO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 5 THEN cf.${valorLiquidoCol} ELSE 0 END) as CARTAO_POS,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 8 THEN cf.${valorLiquidoCol} ELSE 0 END) as TRICARD_PARCELADO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 10 THEN cf.${valorLiquidoCol} ELSE 0 END) as VALE_TROCA,
        SUM(CASE WHEN cf.${codFinalizadoraCol} = 13 THEN cf.${valorLiquidoCol} ELSE 0 END) as VALE_DESCONTO,
        SUM(CASE WHEN cf.${codFinalizadoraCol} NOT IN (1, 4, 5, 6, 7, 8, 10, 13, 15) THEN cf.${valorLiquidoCol} ELSE 0 END) as OUTROS
      FROM ${tabCupomFinalizadora} cf
      WHERE cf.${dataVendaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cf.${dataVendaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND cf.${codTipoCol} = 1110
        ${codLoja ? `AND cf.${codLojaCol} = :codLoja` : ''}
    `;

    const totais = await OracleService.query<any>(sqlTotais, params);

    // Buscar totais de descontos
    const sqlDescontos = `
      SELECT SUM(${valorDescontoCol}) as TOTAL_DESCONTOS
      FROM ${tabProdutoPdv}
      WHERE ${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND ${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND ${valorDescontoCol} > 0
        ${codLoja ? `AND ${codLojaCol} = :codLoja` : ''}
    `;
    const descontos = await OracleService.query<any>(sqlDescontos, params);

    // Buscar totais de cancelamentos (estornos) - separando os que têm associação dos órfãos
    // Cancelamentos com associação = estornos onde existe cupom no mesmo PDV
    const sqlCancelamentos = `
      SELECT SUM(${valorTotalCol}) as CANCELAMENTOS
      FROM ${tabProdutoPdvEstorno} e
      WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
        AND EXISTS (
          SELECT 1 FROM ${tabCupomFinalizadora} cf
          WHERE cf.${numeroCupomCol} = e.${numeroCupomCol}
          AND cf.${codLojaCol} = e.${codLojaCol}
          AND cf.${codPdvCol} = e.${codPdvCol}
        )
    `;
    const cancelamentos = await OracleService.query<any>(sqlCancelamentos, params);

    // Estornos órfãos = estornos onde NÃO existe cupom no mesmo PDV
    const sqlEstornosOrfaos = `
      SELECT SUM(${valorTotalCol}) as ESTORNOS_ORFAOS
      FROM ${tabProdutoPdvEstorno} e
      WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
        AND NOT EXISTS (
          SELECT 1 FROM ${tabCupomFinalizadora} cf
          WHERE cf.${numeroCupomCol} = e.${numeroCupomCol}
          AND cf.${codLojaCol} = e.${codLojaCol}
          AND cf.${codPdvCol} = e.${codPdvCol}
        )
    `;
    const estornosOrfaos = await OracleService.query<any>(sqlEstornosOrfaos, params);

    // Buscar totais de sobra/quebra (pegando apenas o último registro de cada combinação)
    const sqlTesouraria = `
      SELECT
        SUM(sub.VAL_SOBRA) as TOTAL_SOBRA,
        SUM(sub.VAL_QUEBRA) as TOTAL_QUEBRA
      FROM (
        SELECT th.${codOperadorCol}, th.${codLojaCol}, th.${codPdvCol}, th.${numTurnoCol}, th.${dtaMovimentoCol}, th.${valSobraCol} as VAL_SOBRA, th.${valQuebraCol} as VAL_QUEBRA
        FROM ${tabTesourariaHistorico} th
        WHERE th.${dtaMovimentoCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND th.${dtaMovimentoCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${codLoja ? `AND th.${codLojaCol} = :codLoja` : ''}
          AND th.${numRegistroCol} = (
            SELECT MAX(th2.${numRegistroCol})
            FROM ${tabTesourariaHistorico} th2
            WHERE th2.${codOperadorCol} = th.${codOperadorCol}
              AND th2.${codLojaCol} = th.${codLojaCol}
              AND th2.${codPdvCol} = th.${codPdvCol}
              AND th2.${numTurnoCol} = th.${numTurnoCol}
              AND th2.${dtaMovimentoCol} = th.${dtaMovimentoCol}
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
      ESTORNOS_ORFAOS: estornosOrfaos[0]?.ESTORNOS_ORFAOS || 0,
      TOTAL_SOBRA: tesouraria[0]?.TOTAL_SOBRA || 0,
      TOTAL_QUEBRA: tesouraria[0]?.TOTAL_QUEBRA || 0,
      TOTAL_DIFERENCA: (tesouraria[0]?.TOTAL_SOBRA || 0) - (tesouraria[0]?.TOTAL_QUEBRA || 0)
    };
  }

  /**
   * Busca cupons de um operador em uma data específica
   */
  static async getCuponsPorDia(codOperador: number, data: string, codLoja?: number): Promise<any[]> {
    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;

    // Busca mapeamentos dinâmicos
    const {
      numeroCupomCol,
      codLojaCol,
      dataVendaCol,
      valorLiquidoCol,
      codOperadorCol,
      codTipoCol,
      dataSaidaCol,
      valorDescontoCol,
      valorTotalCol,
      statusCupomCol
    } = await this.getVendasMappings();

    const params: any = { codOperador, data };
    if (codLoja) params.codLoja = codLoja;

    // Query com JOIN para trazer informações de desconto e cancelamento
    // Inclui itens da TAB_PRODUTO_PDV (100% desconto) E da TAB_PRODUTO_PDV_ESTORNO (estornos)
    // Filtra itens pela mesma data do cupom para evitar mostrar itens de datas diferentes
    let sql = `
      SELECT
        cf.${numeroCupomCol} as NUM_CUPOM_FISCAL,
        cf.${codLojaCol} as COD_LOJA,
        TO_CHAR(MIN(cf.${dataVendaCol}), 'DD/MM/YYYY HH24:MI') as DATA_HORA,
        SUM(cf.${valorLiquidoCol}) as VALOR_CUPOM,
        NVL(info.TOTAL_DESCONTO, 0) as TOTAL_DESCONTO,
        NVL(info.QTD_ITENS_DESCONTO, 0) as QTD_ITENS_DESCONTO,
        NVL(info.TOTAL_CANCELADO, 0) + NVL(estornos.TOTAL_ESTORNOS, 0) as TOTAL_CANCELADO,
        NVL(info.QTD_ITENS_CANCELADOS, 0) + NVL(estornos.QTD_ESTORNOS, 0) as QTD_ITENS_CANCELADOS,
        NVL(info.QTD_ITENS_TOTAL, 0) as QTD_ITENS_TOTAL,
        CASE WHEN NVL(info.QTD_ITENS_CANCELADOS, 0) + NVL(estornos.QTD_ESTORNOS, 0) = NVL(info.QTD_ITENS_TOTAL, 0) AND NVL(info.QTD_ITENS_TOTAL, 0) > 0 THEN 'S' ELSE 'N' END as FLG_CANCELADO
      FROM ${tabCupomFinalizadora} cf
      LEFT JOIN (
        SELECT
          pv.${numeroCupomCol} as NUM_CUPOM_FISCAL,
          pv.${codLojaCol} as COD_LOJA,
          SUM(CASE WHEN NVL(pv.${valorDescontoCol}, 0) < NVL(pv.${valorTotalCol}, 0) THEN NVL(pv.${valorDescontoCol}, 0) ELSE 0 END) as TOTAL_DESCONTO,
          SUM(CASE WHEN NVL(pv.${valorDescontoCol}, 0) > 0 AND NVL(pv.${valorDescontoCol}, 0) < NVL(pv.${valorTotalCol}, 0) THEN 1 ELSE 0 END) as QTD_ITENS_DESCONTO,
          SUM(CASE WHEN pv.${statusCupomCol} = 'S' OR NVL(pv.${valorDescontoCol}, 0) >= NVL(pv.${valorTotalCol}, 0) THEN NVL(pv.${valorTotalCol}, 0) ELSE 0 END) as TOTAL_CANCELADO,
          SUM(CASE WHEN pv.${statusCupomCol} = 'S' OR NVL(pv.${valorDescontoCol}, 0) >= NVL(pv.${valorTotalCol}, 0) THEN 1 ELSE 0 END) as QTD_ITENS_CANCELADOS,
          COUNT(*) as QTD_ITENS_TOTAL
        FROM ${tabProdutoPdv} pv
        WHERE TO_CHAR(pv.${dataSaidaCol}, 'DD/MM/YYYY') = :data
        GROUP BY pv.${numeroCupomCol}, pv.${codLojaCol}
      ) info ON cf.${numeroCupomCol} = info.NUM_CUPOM_FISCAL AND cf.${codLojaCol} = info.COD_LOJA
      LEFT JOIN (
        SELECT
          e.${numeroCupomCol} as NUM_CUPOM_FISCAL,
          e.${codLojaCol} as COD_LOJA,
          SUM(e.${valorTotalCol}) as TOTAL_ESTORNOS,
          COUNT(*) as QTD_ESTORNOS
        FROM ${tabProdutoPdvEstorno} e
        WHERE TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY') = :data
        GROUP BY e.${numeroCupomCol}, e.${codLojaCol}
      ) estornos ON cf.${numeroCupomCol} = estornos.NUM_CUPOM_FISCAL AND cf.${codLojaCol} = estornos.COD_LOJA
      WHERE cf.${codOperadorCol} = :codOperador
        AND TO_CHAR(cf.${dataVendaCol}, 'DD/MM/YYYY') = :data
        AND cf.${codTipoCol} = 1110
    `;
    if (codLoja) sql += ` AND cf.${codLojaCol} = :codLoja`;
    sql += ` GROUP BY cf.${numeroCupomCol}, cf.${codLojaCol}, info.TOTAL_DESCONTO, info.QTD_ITENS_DESCONTO, info.TOTAL_CANCELADO, info.QTD_ITENS_CANCELADOS, info.QTD_ITENS_TOTAL, estornos.TOTAL_ESTORNOS, estornos.QTD_ESTORNOS`;
    sql += ` ORDER BY MIN(cf.${dataVendaCol})`;

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
    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;

    // Busca mapeamentos dinâmicos
    const {
      codProdutoCol,
      desProdutoCol,
      qtdTotalProdutoCol,
      valorTotalCol,
      valorDescontoCol,
      statusCupomCol,
      numeroCupomCol,
      codLojaCol,
      dataSaidaCol
    } = await this.getVendasMappings();

    // Query corrigida - TAB_PRODUTO_PDV tem colunas diferentes
    // Fazemos JOIN com TAB_PRODUTO para pegar a descrição do produto
    // Itens com 100% de desconto são marcados como estornados
    const params: any = { numCupom, codLoja };

    // Query para itens normais
    let sqlItens = `
      SELECT
        pv.${codProdutoCol} as COD_PRODUTO,
        p.${desProdutoCol} as DES_PRODUTO,
        pv.${qtdTotalProdutoCol} as QTD_PRODUTO,
        CASE WHEN pv.${qtdTotalProdutoCol} > 0
             THEN pv.${valorTotalCol} / pv.${qtdTotalProdutoCol}
             ELSE 0
        END as VAL_UNITARIO,
        pv.${valorTotalCol} as VAL_TOTAL_PRODUTO,
        CASE WHEN NVL(pv.${valorDescontoCol}, 0) >= NVL(pv.${valorTotalCol}, 0) AND NVL(pv.${valorTotalCol}, 0) > 0
             THEN 0
             ELSE NVL(pv.${valorDescontoCol}, 0)
        END as VAL_DESCONTO,
        CASE WHEN pv.${statusCupomCol} = 'S' OR (NVL(pv.${valorDescontoCol}, 0) >= NVL(pv.${valorTotalCol}, 0) AND NVL(pv.${valorTotalCol}, 0) > 0)
             THEN 'S'
             ELSE 'N'
        END as FLG_ESTORNADO,
        'N' as ITEM_ESTORNO
      FROM ${tabProdutoPdv} pv
      LEFT JOIN ${tabProduto} p ON pv.${codProdutoCol} = p.${codProdutoCol}
      WHERE pv.${numeroCupomCol} = :numCupom
        AND pv.${codLojaCol} = :codLoja
    `;

    if (data) {
      sqlItens += ` AND TO_CHAR(pv.${dataSaidaCol}, 'DD/MM/YYYY') = :data`;
      params.data = data;
    }

    // Query para itens estornados (da TAB_PRODUTO_PDV_ESTORNO)
    let sqlEstornos = `
      SELECT
        e.${codProdutoCol} as COD_PRODUTO,
        p.${desProdutoCol} as DES_PRODUTO,
        e.${qtdTotalProdutoCol} as QTD_PRODUTO,
        CASE WHEN e.${qtdTotalProdutoCol} > 0
             THEN e.${valorTotalCol} / e.${qtdTotalProdutoCol}
             ELSE 0
        END as VAL_UNITARIO,
        e.${valorTotalCol} as VAL_TOTAL_PRODUTO,
        0 as VAL_DESCONTO,
        'S' as FLG_ESTORNADO,
        'S' as ITEM_ESTORNO
      FROM ${tabProdutoPdvEstorno} e
      LEFT JOIN ${tabProduto} p ON e.${codProdutoCol} = p.${codProdutoCol}
      WHERE e.${numeroCupomCol} = :numCupom
        AND e.${codLojaCol} = :codLoja
    `;

    if (data) {
      sqlEstornos += ` AND TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY') = :data`;
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

  /**
   * Busca estornos órfãos atribuídos a um operador em uma data específica
   * Estornos órfãos são cancelamentos que não têm cupom associado no mesmo PDV
   * São atribuídos ao operador que estava trabalhando no PDV naquele horário
   */
  static async getEstornosOrfaos(
    codOperador: number,
    data: string,
    codLoja?: number
  ): Promise<any[]> {
    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabTesourariaHistorico = `${schema}.${await MappingService.getRealTableName('TAB_TESOURARIA_HISTORICO')}`;

    // Busca mapeamentos dinâmicos
    const {
      numeroCupomCol,
      codPdvCol,
      codProdutoCol,
      desProdutoCol,
      qtdTotalProdutoCol,
      valorTotalCol,
      desHoraCol,
      dataSaidaCol,
      codLojaCol,
      codOperadorCol,
      dataVendaCol,
      dtaMovimentoCol
    } = await this.getVendasMappings();

    const params: any = {
      codOperador,
      data
    };
    if (codLoja) params.codLoja = codLoja;

    const sql = `
      SELECT
        sub.NUM_CUPOM_FISCAL,
        sub.NUM_PDV,
        sub.COD_PRODUTO,
        sub.DES_PRODUTO,
        sub.QTD_TOTAL_PRODUTO,
        sub.VAL_TOTAL_PRODUTO,
        sub.DES_HORA,
        sub.DATA_HORA,
        sub.COD_OPERADOR_ATRIBUIDO
      FROM (
        SELECT
          e.${numeroCupomCol} as NUM_CUPOM_FISCAL,
          e.${codPdvCol} as NUM_PDV,
          e.${codProdutoCol} as COD_PRODUTO,
          p.${desProdutoCol} as DES_PRODUTO,
          e.${qtdTotalProdutoCol} as QTD_TOTAL_PRODUTO,
          e.${valorTotalCol} as VAL_TOTAL_PRODUTO,
          e.${desHoraCol} as DES_HORA,
          TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY HH24:MI') as DATA_HORA,
          NVL(
            (
              -- Primeira tentativa: operador que fez a venda mais próxima (por horário) no mesmo PDV no mesmo dia
              SELECT MIN(cf.${codOperadorCol}) KEEP (DENSE_RANK FIRST ORDER BY ABS(TO_NUMBER(TO_CHAR(cf.${dataVendaCol}, 'HH24MI')) - TO_NUMBER(NVL(e.${desHoraCol}, '0'))))
              FROM ${tabCupomFinalizadora} cf
              WHERE cf.${codPdvCol} = e.${codPdvCol}
                AND cf.${codLojaCol} = e.${codLojaCol}
                AND TRUNC(cf.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})
            ),
            (
              -- Fallback: quem estava na tesouraria (fechou caixa) nesse PDV no mesmo dia
              SELECT MAX(th.${codOperadorCol}) FROM ${tabTesourariaHistorico} th
              WHERE th.${codPdvCol} = e.${codPdvCol}
                AND th.${codLojaCol} = e.${codLojaCol}
                AND TRUNC(th.${dtaMovimentoCol}) = TRUNC(e.${dataSaidaCol})
            )
          ) as COD_OPERADOR_ATRIBUIDO
        FROM ${tabProdutoPdvEstorno} e
        LEFT JOIN ${tabProduto} p ON e.${codProdutoCol} = p.${codProdutoCol}
        WHERE TO_CHAR(e.${dataSaidaCol}, 'DD/MM/YYYY') = :data
          ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
          -- Somente estornos órfãos (sem match de cupom no mesmo PDV)
          AND NOT EXISTS (
            SELECT 1 FROM ${tabCupomFinalizadora} cf
            WHERE cf.${numeroCupomCol} = e.${numeroCupomCol}
              AND cf.${codLojaCol} = e.${codLojaCol}
              AND cf.${codPdvCol} = e.${codPdvCol}
          )
      ) sub
      WHERE sub.COD_OPERADOR_ATRIBUIDO = :codOperador
      ORDER BY sub.NUM_PDV, sub.DES_HORA
    `;

    console.log('🔍 [Frente Caixa] Buscando estornos órfãos do operador', codOperador, 'em', data);

    try {
      const estornos = await OracleService.query<any>(sql, params);
      console.log(`✅ [Frente Caixa] Encontrados ${estornos.length} estornos órfãos`);
      return estornos;
    } catch (error: any) {
      console.error('❌ [Frente Caixa] Erro na query de estornos órfãos:', error.message);
      throw error;
    }
  }
}
