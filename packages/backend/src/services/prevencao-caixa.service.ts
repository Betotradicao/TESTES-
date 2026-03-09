/**
 * Prevenção de Caixa Service
 * Serviço para consultas de cancelamentos (Item, Cupom, Venda) do Oracle
 *
 * IMPORTANTE: SOMENTE LEITURA - Acesso ao Oracle é READ-ONLY
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

// Interfaces
export interface PrevencaoCaixaFilters {
  dataInicio: string; // DD/MM/YYYY
  dataFim: string;    // DD/MM/YYYY
  tipo?: 'ITEM' | 'CUPOM' | 'VENDA';
  codOperador?: number;
  codLoja?: number;
  numPdv?: number;
}

export interface CancelamentoRow {
  TIPO: string;           // 'ITEM' | 'CUPOM' | 'VENDA'
  DATA: string;           // DD/MM/YYYY
  HORA: string;           // HH:MI
  COO: number;            // NUM_CUPOM_FISCAL or NUM_SEQ
  NUM_PDV: number;
  COD_OPERADOR: number | null;
  DES_OPERADOR: string | null;
  COD_FISCAL: number | null;
  DES_FISCAL: string | null;
  COD_PRODUTO: string | null;
  DES_PRODUTO: string | null;
  VALOR: number;
}

export interface ResumoCancelamentos {
  TOTAL_ITENS: number;
  VALOR_ITENS: number;
  TOTAL_CUPONS: number;
  VALOR_CUPONS: number;
  TOTAL_VENDAS: number;
  VALOR_VENDAS: number;
}

export class PrevencaoCaixaService {

  /**
   * Helper para buscar mapeamentos de colunas das tabelas mapeadas
   */
  private static async getMappings() {
    const [
      // TAB_PRODUTO_PDV_ESTORNO
      estornoDtaSaidaCol,
      estornoDesHoraCol,
      estornoNumCupomCol,
      estornoNumPdvCol,
      estornoCodLojaCol,
      estornoCodProdutoCol,
      estornoValTotalCol,
      // TAB_CUPOM_FINALIZADORA
      cfNumCupomCol,
      cfNumPdvCol,
      cfCodLojaCol,
      cfCodOperadorCol,
      cfCodTipoCol,
      cfDataVendaCol,
      cfValLiquidoCol,
      // TAB_PRODUTO
      prodCodProdutoCol,
      prodDesProdutoCol,
      // TAB_OPERADORES
      opNomeCol,
      // TAB_CUPOM_CANCELADO
      ccNumSeqCol,
      ccNumPdvCol,
      ccCodLojaCol,
      ccDtaSeqCol,
      ccFlgEstornoCol,
      // TAB_CUPOM_PDV
      cpNumCupomCol,
      cpNumPdvCol,
      cpCodLojaCol,
      cpDtaVendaCol,
      // TAB_OPERADORES extras
      opCodOperadorCol,
      opCodLojaCol
    ] = await Promise.all([
      // TAB_PRODUTO_PDV_ESTORNO
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV_ESTORNO', 'data_venda', 'DTA_SAIDA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV_ESTORNO', 'des_hora', 'DES_HORA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV_ESTORNO', 'numero_cupom', 'NUM_CUPOM_FISCAL'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV_ESTORNO', 'numero_pdv', 'NUM_PDV'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV_ESTORNO', 'codigo_loja', 'COD_LOJA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV_ESTORNO', 'codigo_produto', 'COD_PRODUTO'),
      MappingService.getColumnFromTable('TAB_PRODUTO_PDV_ESTORNO', 'valor_total', 'VAL_TOTAL_PRODUTO'),
      // TAB_CUPOM_FINALIZADORA
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'numero_cupom', 'NUM_CUPOM_FISCAL'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'numero_pdv', 'NUM_PDV'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_loja', 'COD_LOJA'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_operador', 'COD_OPERADOR'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'codigo_tipo', 'COD_TIPO'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'data_venda', 'DTA_VENDA'),
      MappingService.getColumnFromTable('TAB_CUPOM_FINALIZADORA', 'valor_liquido', 'VAL_LIQUIDO'),
      // TAB_PRODUTO
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO'),
      // TAB_OPERADORES
      MappingService.getColumnFromTable('TAB_OPERADORES', 'nome_operador', 'DES_OPERADOR'),
      // TAB_CUPOM_CANCELADO
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'numero_sequencia', 'NUM_SEQ'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'numero_pdv', 'NUM_PDV'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'codigo_loja', 'COD_LOJA'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'data_sequencia', 'DTA_SEQ'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'flag_estorno', 'FLG_ESTORNO'),
      // TAB_CUPOM_PDV
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'numero_cupom_fiscal', 'NUM_CUPOM_FISCAL'),
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'numero_pdv', 'NUM_PDV'),
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'codigo_loja', 'COD_LOJA'),
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'data_venda', 'DTA_VENDA'),
      // TAB_OPERADORES (COD_OPERADOR e COD_LOJA)
      MappingService.getColumnFromTable('TAB_OPERADORES', 'codigo_operador', 'COD_OPERADOR'),
      MappingService.getColumnFromTable('TAB_OPERADORES', 'codigo_loja', 'COD_LOJA')
    ]);

    return {
      // TAB_PRODUTO_PDV_ESTORNO
      estornoDtaSaidaCol,
      estornoDesHoraCol,
      estornoNumCupomCol,
      estornoNumPdvCol,
      estornoCodLojaCol,
      estornoCodProdutoCol,
      estornoValTotalCol,
      // TAB_CUPOM_FINALIZADORA
      cfNumCupomCol,
      cfNumPdvCol,
      cfCodLojaCol,
      cfCodOperadorCol,
      cfCodTipoCol,
      cfDataVendaCol,
      cfValLiquidoCol,
      // TAB_PRODUTO
      prodCodProdutoCol,
      prodDesProdutoCol,
      // TAB_OPERADORES
      opNomeCol,
      // TAB_CUPOM_CANCELADO
      ccNumSeqCol,
      ccNumPdvCol,
      ccCodLojaCol,
      ccDtaSeqCol,
      ccFlgEstornoCol,
      // TAB_CUPOM_PDV
      cpNumCupomCol,
      cpNumPdvCol,
      cpCodLojaCol,
      cpDtaVendaCol,
      // TAB_OPERADORES extras
      opCodOperadorCol,
      opCodLojaCol
    };
  }

  /**
   * Helper para buscar nomes reais das tabelas com schema
   */
  private static async getTableNames() {
    const schema = await MappingService.getSchema();

    const [
      tabProdutoPdvEstorno,
      tabCupomFinalizadora,
      tabProduto,
      tabOperadores,
      tabCupomCancelado,
      tabCupomPdv,
      tabSeqCupom,
      tabProdutoPdv
    ] = await Promise.all([
      MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO'),
      MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA'),
      MappingService.getRealTableName('TAB_PRODUTO'),
      MappingService.getRealTableName('TAB_OPERADORES'),
      MappingService.getRealTableName('TAB_CUPOM_CANCELADO'),
      MappingService.getRealTableName('TAB_CUPOM_PDV'),
      MappingService.getRealTableName('TAB_SEQ_CUPOM'),
      MappingService.getRealTableName('TAB_PRODUTO_PDV')
    ]);

    return {
      schema,
      tabProdutoPdvEstorno: `${schema}.${tabProdutoPdvEstorno}`,
      tabCupomFinalizadora: `${schema}.${tabCupomFinalizadora}`,
      tabProduto: `${schema}.${tabProduto}`,
      tabOperadores: `${schema}.${tabOperadores}`,
      tabCupomCancelado: `${schema}.${tabCupomCancelado}`,
      tabCupomPdv: `${schema}.${tabCupomPdv}`,
      tabSeqCupom: `${schema}.${tabSeqCupom}`,
      tabProdutoPdv: `${schema}.${tabProdutoPdv}`
    };
  }

  /**
   * Busca lista unificada de cancelamentos (ITEM, CUPOM, VENDA)
   */
  static async getCancelamentos(filters: PrevencaoCaixaFilters): Promise<CancelamentoRow[]> {
    const { dataInicio, dataFim, tipo, codOperador, codLoja, numPdv } = filters;

    const tables = await this.getTableNames();
    const cols = await this.getMappings();

    const params: any = {
      dataInicio: dataInicio,
      dataFim: dataFim
    };

    if (codLoja) {
      params.codLoja = codLoja;
    }

    const lojaFilterEstorno = codLoja ? `AND e.${cols.estornoCodLojaCol} = :codLoja` : '';
    const lojaFilterCC = codLoja ? `AND cc.${cols.ccCodLojaCol} = :codLoja` : '';
    const lojaFilterSC = codLoja ? `AND sc.COD_LOJA = :codLoja` : ''; // TAB_SEQ_CUPOM não usado em queries atuais

    // ----------------------------------------------------------
    // Type ITEM: from TAB_PRODUTO_PDV_ESTORNO (items with operator = finalized sale)
    // ----------------------------------------------------------
    const sqlItem = `
      SELECT * FROM (
        SELECT 'ITEM' as TIPO,
          TO_CHAR(e.${cols.estornoDtaSaidaCol}, 'DD/MM/YYYY') as DATA,
          CASE WHEN e.${cols.estornoDesHoraCol} IS NOT NULL AND LENGTH(TRIM(TO_CHAR(e.${cols.estornoDesHoraCol}))) >= 3
            THEN SUBSTR(LPAD(TRIM(TO_CHAR(e.${cols.estornoDesHoraCol})), 4, '0'), 1, 2) || ':' || SUBSTR(LPAD(TRIM(TO_CHAR(e.${cols.estornoDesHoraCol})), 4, '0'), 3, 2)
            ELSE '00:00' END as HORA,
          e.${cols.estornoNumCupomCol} as COO,
          e.${cols.estornoNumPdvCol} as NUM_PDV,
          NVL(
            (SELECT MAX(cf.${cols.cfCodOperadorCol}) FROM ${tables.tabCupomFinalizadora} cf
             WHERE cf.${cols.cfNumCupomCol} = e.${cols.estornoNumCupomCol}
             AND cf.${cols.cfNumPdvCol} = e.${cols.estornoNumPdvCol}
             AND cf.${cols.cfCodLojaCol} = e.${cols.estornoCodLojaCol}
             AND TRUNC(cf.${cols.cfDataVendaCol}) = TRUNC(e.${cols.estornoDtaSaidaCol})),
            (SELECT MAX(cf2.${cols.cfCodOperadorCol}) FROM ${tables.tabCupomFinalizadora} cf2
             WHERE cf2.${cols.cfNumCupomCol} = e.${cols.estornoNumCupomCol}
             AND cf2.${cols.cfNumPdvCol} = e.${cols.estornoNumPdvCol}
             AND cf2.${cols.cfCodLojaCol} = e.${cols.estornoCodLojaCol})
          ) as COD_OPERADOR,
          NULL as COD_FISCAL,
          e.${cols.estornoCodProdutoCol} as COD_PRODUTO,
          p.${cols.prodDesProdutoCol} as DES_PRODUTO,
          e.${cols.estornoValTotalCol} as VALOR
        FROM ${tables.tabProdutoPdvEstorno} e
        LEFT JOIN ${tables.tabProduto} p ON p.${cols.prodCodProdutoCol} = e.${cols.estornoCodProdutoCol}
        WHERE e.${cols.estornoDtaSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND e.${cols.estornoDtaSaidaCol} < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
          ${lojaFilterEstorno}
      ) WHERE COD_OPERADOR IS NOT NULL
    `;

    // ----------------------------------------------------------
    // Type CUPOM: from TAB_CUPOM_CANCELADO (finalized sale then cancelled)
    // O Intersolid cria um cupom sequencial (NUM_SEQ+1) com valor negativo ao cancelar.
    // Ex: cupom 537835 cancelado → cupom 537836 criado com -19.49
    // Buscamos o valor absoluto desse cupom seguinte na TAB_CUPOM_FINALIZADORA.
    // Operador e hora são obtidos do cupom mais próximo (mesma técnica do VENDA).
    // JOIN com TAB_CUPOM_PDV garante 1 registro por cancelamento (deduplica pares de COO).
    // ----------------------------------------------------------
    const sqlCupom = `
      SELECT 'CUPOM' as TIPO,
        TO_CHAR(cc.${cols.ccDtaSeqCol}, 'DD/MM/YYYY') as DATA,
        NVL(
          (SELECT TO_CHAR(MIN(cf_h.HORA_MOV) KEEP (DENSE_RANK FIRST ORDER BY ABS(cf_h.${cols.cfNumCupomCol} - cc.${cols.ccNumSeqCol})), 'HH24:MI')
           FROM ${tables.tabCupomFinalizadora} cf_h
           WHERE cf_h.${cols.cfNumPdvCol} = cc.${cols.ccNumPdvCol}
           AND cf_h.${cols.cfCodLojaCol} = cc.${cols.ccCodLojaCol}
           AND TRUNC(cf_h.${cols.cfDataVendaCol}) = TRUNC(cc.${cols.ccDtaSeqCol})),
          '00:00') as HORA,
        cc.${cols.ccNumSeqCol} as COO,
        cc.${cols.ccNumPdvCol} as NUM_PDV,
        (SELECT MIN(cf_near.${cols.cfCodOperadorCol}) KEEP (DENSE_RANK FIRST ORDER BY ABS(cf_near.${cols.cfNumCupomCol} - cc.${cols.ccNumSeqCol}))
         FROM ${tables.tabCupomFinalizadora} cf_near
         WHERE cf_near.${cols.cfNumPdvCol} = cc.${cols.ccNumPdvCol}
         AND cf_near.${cols.cfCodLojaCol} = cc.${cols.ccCodLojaCol}
         AND TRUNC(cf_near.${cols.cfDataVendaCol}) = TRUNC(cc.${cols.ccDtaSeqCol})) as COD_OPERADOR,
        NULL as COD_FISCAL,
        NULL as COD_PRODUTO,
        NULL as DES_PRODUTO,
        NVL(
          ABS(
            (SELECT SUM(cf_val.${cols.cfValLiquidoCol})
             FROM ${tables.tabCupomFinalizadora} cf_val
             WHERE cf_val.${cols.cfNumCupomCol} = cc.${cols.ccNumSeqCol} + 1
             AND cf_val.${cols.cfNumPdvCol} = cc.${cols.ccNumPdvCol}
             AND cf_val.${cols.cfCodLojaCol} = cc.${cols.ccCodLojaCol}
             AND TRUNC(cf_val.${cols.cfDataVendaCol}) = TRUNC(cc.${cols.ccDtaSeqCol}))
          ),
          0) as VALOR
      FROM ${tables.tabCupomCancelado} cc
      JOIN ${tables.tabCupomPdv} cp ON cp.${cols.cpNumCupomCol} = cc.${cols.ccNumSeqCol}
        AND cp.${cols.cpNumPdvCol} = cc.${cols.ccNumPdvCol}
        AND cp.${cols.cpCodLojaCol} = cc.${cols.ccCodLojaCol}
        AND TRUNC(cp.${cols.cpDtaVendaCol}) = TRUNC(cc.${cols.ccDtaSeqCol})
      WHERE cc.${cols.ccDtaSeqCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cc.${cols.ccDtaSeqCol} < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
        AND cc.${cols.ccFlgEstornoCol} = 'S'
        ${lojaFilterCC}
    `;

    // ----------------------------------------------------------
    // Type VENDA: from TAB_PRODUTO_PDV_ESTORNO where NO operator found
    // (items from sales cancelled before payment finalization)
    // Operator: busca pelo cupom mais próximo (mesmo PDV/dia) na finalizadora
    // (pois TAB_SEQ_CUPOM.COD_OPERADOR é sempre NULL para vendas canceladas)
    // ----------------------------------------------------------
    const sqlVenda = `
      SELECT TIPO, DATA, HORA, COO, NUM_PDV, COD_OPERADOR, COD_FISCAL, COD_PRODUTO, DES_PRODUTO, VALOR FROM (
        SELECT 'VENDA' as TIPO,
          TO_CHAR(e.${cols.estornoDtaSaidaCol}, 'DD/MM/YYYY') as DATA,
          CASE WHEN e.${cols.estornoDesHoraCol} IS NOT NULL AND LENGTH(TRIM(TO_CHAR(e.${cols.estornoDesHoraCol}))) >= 3
            THEN SUBSTR(LPAD(TRIM(TO_CHAR(e.${cols.estornoDesHoraCol})), 4, '0'), 1, 2) || ':' || SUBSTR(LPAD(TRIM(TO_CHAR(e.${cols.estornoDesHoraCol})), 4, '0'), 3, 2)
            ELSE '00:00' END as HORA,
          e.${cols.estornoNumCupomCol} as COO,
          e.${cols.estornoNumPdvCol} as NUM_PDV,
          (SELECT MIN(cf_near.${cols.cfCodOperadorCol}) KEEP (DENSE_RANK FIRST ORDER BY ABS(cf_near.${cols.cfNumCupomCol} - e.${cols.estornoNumCupomCol}))
           FROM ${tables.tabCupomFinalizadora} cf_near
           WHERE cf_near.${cols.cfNumPdvCol} = e.${cols.estornoNumPdvCol}
           AND cf_near.${cols.cfCodLojaCol} = e.${cols.estornoCodLojaCol}
           AND TRUNC(cf_near.${cols.cfDataVendaCol}) = TRUNC(e.${cols.estornoDtaSaidaCol})) as COD_OPERADOR,
          NULL as COD_FISCAL,
          e.${cols.estornoCodProdutoCol} as COD_PRODUTO,
          p.${cols.prodDesProdutoCol} as DES_PRODUTO,
          e.${cols.estornoValTotalCol} as VALOR,
          NVL(
            (SELECT MAX(cf.${cols.cfCodOperadorCol}) FROM ${tables.tabCupomFinalizadora} cf
             WHERE cf.${cols.cfNumCupomCol} = e.${cols.estornoNumCupomCol}
             AND cf.${cols.cfNumPdvCol} = e.${cols.estornoNumPdvCol}
             AND cf.${cols.cfCodLojaCol} = e.${cols.estornoCodLojaCol}
             AND TRUNC(cf.${cols.cfDataVendaCol}) = TRUNC(e.${cols.estornoDtaSaidaCol})),
            (SELECT MAX(cf2.${cols.cfCodOperadorCol}) FROM ${tables.tabCupomFinalizadora} cf2
             WHERE cf2.${cols.cfNumCupomCol} = e.${cols.estornoNumCupomCol}
             AND cf2.${cols.cfNumPdvCol} = e.${cols.estornoNumPdvCol}
             AND cf2.${cols.cfCodLojaCol} = e.${cols.estornoCodLojaCol})
          ) as FIN_OPERADOR
        FROM ${tables.tabProdutoPdvEstorno} e
        LEFT JOIN ${tables.tabProduto} p ON p.${cols.prodCodProdutoCol} = e.${cols.estornoCodProdutoCol}
        WHERE e.${cols.estornoDtaSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
          AND e.${cols.estornoDtaSaidaCol} < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
          ${lojaFilterEstorno}
      ) WHERE FIN_OPERADOR IS NULL
    `;

    // Build the UNION ALL query based on tipo filter
    let unionParts: string[] = [];
    if (!tipo || tipo === 'ITEM') unionParts.push(sqlItem);
    if (!tipo || tipo === 'CUPOM') unionParts.push(sqlCupom);
    if (!tipo || tipo === 'VENDA') unionParts.push(sqlVenda);

    const sql = `
      SELECT * FROM (
        ${unionParts.join('\n        UNION ALL\n        ')}
      ) cancelamentos
      ORDER BY DATA DESC, HORA DESC
    `;

    console.log('[PrevencaoCaixa] Buscando cancelamentos:', { dataInicio, dataFim, tipo, codOperador, codLoja, numPdv });

    const rows = await OracleService.query<any>(sql, params);

    // Buscar nomes dos operadores via TAB_OPERADORES
    const operadorIds = [...new Set(rows.filter(r => r.COD_OPERADOR != null).map(r => r.COD_OPERADOR))];

    let operadoresMap: Map<number, string> = new Map();

    if (operadorIds.length > 0) {
      // Buscar nomes em lotes de 100
      const batchSize = 100;
      for (let i = 0; i < operadorIds.length; i += batchSize) {
        const batch = operadorIds.slice(i, i + batchSize);
        const placeholders = batch.map((_, idx) => `:op${i + idx}`).join(',');
        const opParams: any = {};
        batch.forEach((id, idx) => { opParams[`op${i + idx}`] = id; });

        if (codLoja) {
          opParams.codLojaOp = codLoja;
        }

        const opSql = `
          SELECT DISTINCT ${cols.opCodOperadorCol} as COD_OPERADOR, ${cols.opNomeCol} as DES_OPERADOR
          FROM ${tables.tabOperadores}
          WHERE ${cols.opCodOperadorCol} IN (${placeholders})
          ${codLoja ? `AND ${cols.opCodLojaCol} = :codLojaOp` : ''}
        `;

        const opRows = await OracleService.query<any>(opSql, opParams);
        opRows.forEach((r: any) => {
          if (r.COD_OPERADOR != null && r.DES_OPERADOR) {
            operadoresMap.set(r.COD_OPERADOR, r.DES_OPERADOR);
          }
        });
      }
    }

    // Enrich rows with operator names and apply optional filters
    let result: CancelamentoRow[] = rows.map(row => ({
      TIPO: row.TIPO,
      DATA: row.DATA || '',
      HORA: row.HORA || '00:00',
      COO: row.COO,
      NUM_PDV: row.NUM_PDV,
      COD_OPERADOR: row.COD_OPERADOR || null,
      DES_OPERADOR: operadoresMap.get(row.COD_OPERADOR) || null,
      COD_FISCAL: row.COD_FISCAL || null,
      DES_FISCAL: null,
      COD_PRODUTO: row.COD_PRODUTO || null,
      DES_PRODUTO: row.DES_PRODUTO || null,
      VALOR: Number(row.VALOR) || 0
    }));

    // Apply optional filters
    if (codOperador) {
      result = result.filter(r => r.COD_OPERADOR === codOperador);
    }
    if (numPdv) {
      result = result.filter(r => r.NUM_PDV === numPdv);
    }

    console.log(`[PrevencaoCaixa] Encontrados ${result.length} cancelamentos`);

    return result;
  }

  /**
   * Busca resumo de cancelamentos (totais por tipo)
   */
  /**
   * Busca resumo de vendas com desconto no periodo
   */
  static async getResumoDescontos(filters: PrevencaoCaixaFilters) {
    const { dataInicio, dataFim, codLoja } = filters;
    const tables = await this.getTableNames();
    const params: any = { dataInicio, dataFim };
    const lojaFilter = codLoja ? `AND pdv.COD_LOJA = :codLoja` : '';
    if (codLoja) params.codLoja = codLoja;

    const sql = `
      SELECT
        COUNT(*) as TOTAL_ITENS_DESC,
        NVL(SUM(pdv.VAL_DESCONTO), 0) as VALOR_TOTAL_DESC,
        COUNT(DISTINCT pdv.NUM_CUPOM_FISCAL || '-' || pdv.NUM_PDV) as TOTAL_CUPONS_DESC
      FROM ${tables.tabProdutoPdv} pdv
      WHERE pdv.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND pdv.DTA_SAIDA < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
        AND pdv.VAL_DESCONTO > 0
        ${lojaFilter}
    `;

    const rows = await OracleService.query<any>(sql, params);
    const row = rows[0] || {};

    return {
      TOTAL_ITENS_DESC: Number(row.TOTAL_ITENS_DESC) || 0,
      VALOR_TOTAL_DESC: Number(row.VALOR_TOTAL_DESC) || 0,
      TOTAL_CUPONS_DESC: Number(row.TOTAL_CUPONS_DESC) || 0
    };
  }

  /**
   * Busca lista de itens vendidos com desconto no periodo
   */
  static async getItensComDesconto(filters: PrevencaoCaixaFilters) {
    const { dataInicio, dataFim, codLoja, codOperador, numPdv } = filters;
    const tables = await this.getTableNames();
    const cols = await this.getMappings();
    const params: any = { dataInicio, dataFim };

    let extraFilters = '';
    if (codLoja) { extraFilters += ` AND pdv.COD_LOJA = :codLoja`; params.codLoja = codLoja; }
    if (numPdv) { extraFilters += ` AND pdv.NUM_PDV = :numPdv`; params.numPdv = numPdv; }

    const sql = `
      SELECT 'DESCONTO' as TIPO,
        TO_CHAR(pdv.DTA_SAIDA, 'DD/MM/YYYY') as DATA,
        CASE WHEN pdv.DES_HORA IS NOT NULL AND LENGTH(TRIM(TO_CHAR(pdv.DES_HORA))) >= 3
          THEN SUBSTR(LPAD(TRIM(TO_CHAR(pdv.DES_HORA)), 4, '0'), 1, 2) || ':' || SUBSTR(LPAD(TRIM(TO_CHAR(pdv.DES_HORA)), 4, '0'), 3, 2)
          ELSE '00:00' END as HORA,
        pdv.NUM_CUPOM_FISCAL as COO,
        pdv.NUM_PDV,
        NVL(
          (SELECT MAX(cf.${cols.cfCodOperadorCol}) FROM ${tables.tabCupomFinalizadora} cf
           WHERE cf.${cols.cfNumCupomCol} = pdv.NUM_CUPOM_FISCAL
           AND cf.${cols.cfNumPdvCol} = pdv.NUM_PDV
           AND cf.${cols.cfCodLojaCol} = pdv.COD_LOJA
           AND TRUNC(cf.${cols.cfDataVendaCol}) = TRUNC(pdv.DTA_SAIDA)),
          NULL
        ) as COD_OPERADOR,
        NULL as COD_FISCAL,
        pdv.COD_PRODUTO,
        p.${cols.prodDesProdutoCol} as DES_PRODUTO,
        pdv.VAL_DESCONTO as VALOR
      FROM ${tables.tabProdutoPdv} pdv
      LEFT JOIN ${tables.tabProduto} p ON p.${cols.prodCodProdutoCol} = pdv.COD_PRODUTO
      WHERE pdv.DTA_SAIDA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND pdv.DTA_SAIDA < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
        AND pdv.VAL_DESCONTO > 0
        ${extraFilters}
      ORDER BY pdv.DTA_SAIDA DESC, pdv.DES_HORA DESC
    `;

    const rows = await OracleService.query<any>(sql, params);

    // Buscar nomes dos operadores
    const operadorIds = [...new Set(rows.filter((r: any) => r.COD_OPERADOR != null).map((r: any) => r.COD_OPERADOR))];
    let operadoresMap: Map<number, string> = new Map();

    if (operadorIds.length > 0) {
      const placeholders = operadorIds.map((_: any, idx: number) => `:op${idx}`).join(',');
      const opParams: any = {};
      operadorIds.forEach((id: any, idx: number) => { opParams[`op${idx}`] = id; });

      const opSql = `
        SELECT DISTINCT ${cols.opCodOperadorCol} as COD_OPERADOR, ${cols.opNomeCol} as DES_OPERADOR
        FROM ${tables.tabOperadores}
        WHERE ${cols.opCodOperadorCol} IN (${placeholders})
      `;
      const opRows = await OracleService.query<any>(opSql, opParams);
      opRows.forEach((r: any) => {
        if (r.COD_OPERADOR != null && r.DES_OPERADOR) {
          operadoresMap.set(r.COD_OPERADOR, r.DES_OPERADOR);
        }
      });
    }

    let result = rows.map((row: any) => ({
      TIPO: 'DESCONTO',
      DATA: row.DATA || '',
      HORA: row.HORA || '00:00',
      COO: row.COO,
      NUM_PDV: row.NUM_PDV,
      COD_OPERADOR: row.COD_OPERADOR || null,
      DES_OPERADOR: operadoresMap.get(row.COD_OPERADOR) || null,
      COD_FISCAL: null,
      DES_FISCAL: null,
      COD_PRODUTO: row.COD_PRODUTO || null,
      DES_PRODUTO: row.DES_PRODUTO || null,
      VALOR: Number(row.VALOR) || 0
    }));

    if (codOperador) {
      result = result.filter((r: any) => r.COD_OPERADOR === codOperador);
    }

    return result;
  }

  static async getResumoCancelamentos(filters: PrevencaoCaixaFilters): Promise<ResumoCancelamentos> {
    const { dataInicio, dataFim, codOperador, codLoja, numPdv } = filters;

    // Reutiliza getCancelamentos para obter todos os dados
    const cancelamentos = await this.getCancelamentos(filters);

    const itens = cancelamentos.filter(c => c.TIPO === 'ITEM');
    const cupons = cancelamentos.filter(c => c.TIPO === 'CUPOM');
    const vendas = cancelamentos.filter(c => c.TIPO === 'VENDA');

    return {
      TOTAL_ITENS: itens.length,
      VALOR_ITENS: itens.reduce((sum, c) => sum + c.VALOR, 0),
      TOTAL_CUPONS: cupons.length,
      VALOR_CUPONS: cupons.reduce((sum, c) => sum + c.VALOR, 0),
      TOTAL_VENDAS: vendas.length,
      VALOR_VENDAS: vendas.reduce((sum, c) => sum + c.VALOR, 0)
    };
  }
}
