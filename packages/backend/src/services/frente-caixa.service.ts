/**
 * Frente de Caixa Service
 * Serviço para consultas de vendas, cancelamentos, descontos e diferença de caixa por operador
 *
 * IMPORTANTE: SOMENTE LEITURA - Acesso ao Oracle é READ-ONLY
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { PostgresErpService } from './postgres-erp.service';
import { AppDataSource } from '../config/database';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';

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
  CANCELAMENTOS: number;     // Cancelamentos totais (item + cupom + venda)
  CANC_ITEM: number;         // Cancelamento de itens individuais
  CANC_CUPOM: number;        // Cancelamento de cupom inteiro
  CANC_VENDA: number;        // Cancelamento de venda (estorno sem operador)
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
  CANCELAMENTOS: number;     // Cancelamentos totais (item + cupom + venda)
  CANC_ITEM: number;         // Cancelamento de itens individuais
  CANC_CUPOM: number;        // Cancelamento de cupom inteiro
  CANC_VENDA: number;        // Cancelamento de venda (estorno sem operador)
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
  /** Detecta tipo de banco ativo */
  private static async detectDbType(): Promise<'oracle' | 'postgresql'> {
    try {
      if (!AppDataSource.isInitialized) return 'oracle';
      const repo = AppDataSource.getRepository(DatabaseConnection);
      let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
      if (!conn) conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
      if (conn?.type === DatabaseType.POSTGRESQL) return 'postgresql';
    } catch {}
    return 'oracle';
  }

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
      dtaMovimentoCol,
      // Campos de TAB_CUPOM_CANCELADO
      ccNumSeqCol,
      ccNumPdvCol,
      ccCodLojaCol,
      ccDtaSeqCol,
      ccFlgEstornoCol,
      // Campos de TAB_CUPOM_PDV
      cpNumCupomCol,
      cpNumPdvCol,
      cpCodLojaCol,
      cpDtaVendaCol,
      // Campos extras de TAB_OPERADORES
      opCodOperadorCol,
      opCodLojaCol
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
      MappingService.getColumnFromTable('TAB_TESOURARIA_HISTORICO', 'data_movimento'),
      // Campos de TAB_CUPOM_CANCELADO
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'numero_sequencia', 'NUM_SEQ'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'numero_pdv', 'NUM_PDV'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'codigo_loja', 'COD_LOJA'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'data_sequencia', 'DTA_SEQ'),
      MappingService.getColumnFromTable('TAB_CUPOM_CANCELADO', 'flag_estorno', 'FLG_ESTORNO'),
      // Campos de TAB_CUPOM_PDV
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'numero_cupom_fiscal', 'NUM_CUPOM_FISCAL'),
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'numero_pdv', 'NUM_PDV'),
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'codigo_loja', 'COD_LOJA'),
      MappingService.getColumnFromTable('TAB_CUPOM_PDV', 'data_venda', 'DTA_VENDA'),
      // Campos extras de TAB_OPERADORES
      MappingService.getColumnFromTable('TAB_OPERADORES', 'codigo_operador', 'COD_OPERADOR'),
      MappingService.getColumnFromTable('TAB_OPERADORES', 'codigo_loja', 'COD_LOJA')
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
      dtaMovimentoCol,
      // Campos de TAB_CUPOM_CANCELADO
      ccNumSeqCol,
      ccNumPdvCol,
      ccCodLojaCol,
      ccDtaSeqCol,
      ccFlgEstornoCol,
      // Campos de TAB_CUPOM_PDV
      cpNumCupomCol,
      cpNumPdvCol,
      cpCodLojaCol,
      cpDtaVendaCol,
      // Campos extras de TAB_OPERADORES
      opCodOperadorCol,
      opCodLojaCol
    };
  }

  /**
   * Lista operadores disponíveis
   * NOTA: TAB_OPERADORES sempre usa COD_OPERADOR e DES_OPERADOR (não usar mapeamento de vendas)
   */
  static async getOperadores(codLoja?: number): Promise<Operador[]> {
    if (await this.detectDbType() === 'postgresql') return this.getOperadoresPg(codLoja);

    const schema = await MappingService.getSchema();
    const tabOperadores = `${schema}.${await MappingService.getRealTableName('TAB_OPERADORES')}`;
    const opCodOperador = await MappingService.getColumnFromTable('TAB_OPERADORES', 'codigo_operador');
    const opDesOperador = await MappingService.getColumnFromTable('TAB_OPERADORES', 'nome_operador');
    const opCodLoja = await MappingService.getColumnFromTable('TAB_OPERADORES', 'codigo_loja');

    let sql = `SELECT DISTINCT o.${opCodOperador} as COD_OPERADOR, o.${opDesOperador} as DES_OPERADOR
      FROM ${tabOperadores} o WHERE o.${opDesOperador} IS NOT NULL`;
    const params: any = {};
    if (codLoja) { sql += ` AND o.${opCodLoja} = :codLoja`; params.codLoja = codLoja; }
    sql += ` ORDER BY o.${opDesOperador}`;
    return OracleService.query<Operador>(sql, params);
  }

  /** PG: lista operadores com nomes da tabela funcionarios */
  private static async getOperadoresPg(codLoja?: number): Promise<Operador[]> {
    let sql = `SELECT DISTINCT v.vopr_operador::int as "COD_OPERADOR",
      COALESCE(f.func_nome, 'Operador ' || v.vopr_operador) as "DES_OPERADOR"
      FROM public.vdonlineprod v
      LEFT JOIN public.funcionarios f ON f.func_codigo::int = v.vopr_operador::int
      WHERE v.vopr_tiporeg = 'IT' AND v.vopr_operador IS NOT NULL`;
    const params: any[] = [];
    if (codLoja) { sql += ` AND v.vopr_unid_codigo::int = $1::int`; params.push(codLoja); }
    sql += ` ORDER BY "DES_OPERADOR"`;
    return PostgresErpService.query<Operador>(sql, params);
  }

  /** PG: resumo por operador usando vdonlineprod + vdonlinefi + movfpdvc */
  private static async getResumoOperadoresPg(filters: FrenteCaixaFilters): Promise<OperadorResumo[]> {
    const toIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
    const dtIni = toIso(filters.dataInicio);
    const dtFim = toIso(filters.dataFim);
    const params: any[] = [dtIni, dtFim];
    let lojaWhere = '';
    let lojaWhereF = '';
    let lojaWhereM = '';
    if (filters.codLoja) {
      lojaWhere = ` AND v.vopr_unid_codigo::int = $3::int`;
      lojaWhereF = ` AND f.vofi_unid_codigo::int = $3::int`;
      lojaWhereM = ` AND mpdc_unid_codigo::int = $3::int`;
      params.push(filters.codLoja);
    }
    let opWhere = '';
    let opWhereF = '';
    if (filters.codOperador) {
      opWhere = ` AND v.vopr_operador::int = $${params.length + 1}::int`;
      opWhereF = ` AND f.vofi_pdvs_codigo IS NOT NULL`; // vdonlinefi nao tem operador, filtrar depois
      params.push(filters.codOperador);
    }

    console.log('📊 [Frente Caixa PG] Buscando resumo operadores...');

    // 1. Vendas + itens + descontos por operador (vdonlineprod + funcionarios)
    const sqlVendas = `SELECT v.vopr_operador::int as cod_op,
      COALESCE(MAX(f.func_nome), 'Operador ' || v.vopr_operador) as nome_op,
      COALESCE(SUM(v.vopr_valor - COALESCE(v.vopr_desconto,0) + COALESCE(v.vopr_acrescimo,0)),0)::float as vendas,
      COUNT(*)::int as itens,
      COUNT(DISTINCT v.vopr_cupom || '-' || v.vopr_pdvs_codigo)::int as cupons,
      COALESCE(SUM(COALESCE(v.vopr_desconto,0)),0)::float as descontos
      FROM public.vdonlineprod v
      LEFT JOIN public.funcionarios f ON f.func_codigo::int = v.vopr_operador::int
      WHERE v.vopr_datamvto BETWEEN $1 AND $2 AND v.vopr_tiporeg = 'IT'
      AND COALESCE(v.vopr_cancmotivo,'') = '' AND v.vopr_operador IS NOT NULL
      ${lojaWhere} ${opWhere}
      GROUP BY v.vopr_operador ORDER BY vendas DESC`;

    // 2. Finalizadoras por operador — vdonlinefi nao tem operador direto,
    //    entao cruzar cupom vdonlinefi com vdonlineprod pra pegar operador
    const sqlFin = `SELECT op::int as cod_op,
      COALESCE(SUM(CASE WHEN fin = '01' THEN val - troco ELSE 0 END),0)::float as dinheiro,
      COALESCE(SUM(CASE WHEN fin = '04' THEN val ELSE 0 END),0)::float as credito,
      COALESCE(SUM(CASE WHEN fin = '05' THEN val ELSE 0 END),0)::float as debito,
      COALESCE(SUM(CASE WHEN fin IN ('16','29') THEN val ELSE 0 END),0)::float as pix,
      COALESCE(SUM(CASE WHEN fin = '09' THEN val ELSE 0 END),0)::float as cartao_pos,
      COALESCE(SUM(CASE WHEN fin = '06' THEN val ELSE 0 END),0)::float as convenio_cli,
      COALESCE(SUM(CASE WHEN fin = '10' THEN val ELSE 0 END),0)::float as funcionario,
      COALESCE(SUM(CASE WHEN fin NOT IN ('01','04','05','06','09','10','16','29') THEN val ELSE 0 END),0)::float as outros
      FROM (
        SELECT DISTINCT ON (f.vofi_cupom, f.vofi_pdvs_codigo, f.vofi_sequencial)
          (SELECT MIN(vp.vopr_operador) FROM public.vdonlineprod vp
           WHERE vp.vopr_cupom = f.vofi_cupom AND vp.vopr_pdvs_codigo = f.vofi_pdvs_codigo
           AND vp.vopr_datamvto = f.vofi_datamvto AND vp.vopr_tiporeg = 'IT') as op,
          f.vofi_finalizadora as fin, f.vofi_valor::float as val, COALESCE(f.vofi_troco,0)::float as troco
        FROM public.vdonlinefi f
        WHERE f.vofi_datamvto BETWEEN $1 AND $2 AND f.vofi_tiporeg = 'FI'
        ${lojaWhereF}
      ) sub WHERE op IS NOT NULL
      GROUP BY op`;

    // 3. Cancelamentos (movfpdvc)
    const sqlCanc = `SELECT mpdc_func_codigo::int as cod_op,
      COALESCE(SUM(mpdc_cancelamentos),0)::float as cancelamentos,
      COALESCE(SUM(mpdc_devolucoes),0)::float as devolucoes
      FROM public.movfpdvc
      WHERE mpdc_datamvto BETWEEN $1 AND $2
      ${lojaWhereM}
      GROUP BY mpdc_func_codigo`;

    try {
      const [vendas, fins, cancs] = await Promise.all([
        PostgresErpService.query<any>(sqlVendas, params),
        PostgresErpService.query<any>(sqlFin, params.slice(0, filters.codLoja ? 3 : 2)),
        PostgresErpService.query<any>(sqlCanc, params.slice(0, filters.codLoja ? 3 : 2))
      ]);

      console.log(`✅ [Frente Caixa PG] Vendas: ${vendas.length} ops, Fins: ${fins.length}, Cancs: ${cancs.length}`);

      const finMap = new Map(fins.map((f: any) => [f.cod_op, f]));
      const cancMap = new Map(cancs.map((c: any) => [c.cod_op, c]));

      return vendas.map((v: any) => {
        const f = finMap.get(v.cod_op) || {};
        const c = cancMap.get(v.cod_op) || {};
        const cancTotal = Number(c.cancelamentos || 0) + Number(c.devolucoes || 0);
        return {
          COD_OPERADOR: v.cod_op,
          DES_OPERADOR: v.nome_op || String(v.cod_op),
          TOTAL_VENDAS: v.vendas,
          TOTAL_ITENS: v.itens,
          TOTAL_CUPONS: v.cupons,
          DINHEIRO: f.dinheiro || 0,
          CARTAO_DEBITO: f.debito || 0,
          CARTAO_CREDITO: f.credito || 0,
          PIX: f.pix || 0,
          FUNCIONARIO: f.funcionario || 0,
          CARTAO_POS: f.cartao_pos || 0,
          TRICARD_PARCELADO: 0,
          VALE_TROCA: 0,
          VALE_DESCONTO: 0,
          OUTROS: f.outros || 0,
          CONVENIO_CLIENTES: f.convenio_cli || 0,
          TOTAL_DESCONTOS: v.descontos,
          CANCELAMENTOS: cancTotal,
          CANC_ITEM: Number(c.cancelamentos || 0),
          CANC_CUPOM: 0,
          CANC_VENDA: Number(c.devolucoes || 0),
          ESTORNOS_ORFAOS: 0,
          VAL_SOBRA: 0,
          VAL_QUEBRA: 0,
          VAL_DIFERENCA: 0
        } as OperadorResumo;
      });
    } catch (e: any) {
      console.error('❌ [Frente Caixa PG] Erro:', e.message);
      return [];
    }
  }

  /**
   * Busca resumo consolidado por operador
   */
  static async getResumoOperadores(filters: FrenteCaixaFilters): Promise<OperadorResumo[]> {
    if (await this.detectDbType() === 'postgresql') return this.getResumoOperadoresPg(filters);

    const { dataInicio, dataFim, codOperador, codLoja } = filters;
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabOperadores = `${schema}.${await MappingService.getRealTableName('TAB_OPERADORES')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabTesourariaHistorico = `${schema}.${await MappingService.getRealTableName('TAB_TESOURARIA_HISTORICO')}`;
    const tabCupomCancelado = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_CANCELADO')}`;
    const tabCupomPdv = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_PDV')}`;

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
      dtaMovimentoCol,
      ccNumSeqCol,
      ccNumPdvCol,
      ccCodLojaCol,
      ccDtaSeqCol,
      ccFlgEstornoCol,
      cpNumCupomCol,
      cpNumPdvCol,
      cpCodLojaCol,
      cpDtaVendaCol,
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

    // Buscar cancelamentos de cupom (cupons cancelados inteiros)
    // Valor vem do cupom SEGUINTE (NUM_SEQ + 1) na TAB_CUPOM_FINALIZADORA
    // Operador vem do cupom mais próximo na finalizadora
    let sqlEstornosOrfaos = `
      SELECT
        NVL(
          (SELECT MIN(cf_op.${codOperadorCol}) KEEP (DENSE_RANK FIRST ORDER BY ABS(cf_op.${numeroCupomCol} - cc.${ccNumSeqCol}))
           FROM ${tabCupomFinalizadora} cf_op
           WHERE cf_op.${codPdvCol} = cc.${ccNumPdvCol}
           AND cf_op.${codLojaCol} = cc.${ccCodLojaCol}
           AND TRUNC(cf_op.${dataVendaCol}) = TRUNC(cc.${ccDtaSeqCol})),
          0) as COD_OPERADOR,
        NVL(ABS(
          (SELECT SUM(cf_val.${valorLiquidoCol})
           FROM ${tabCupomFinalizadora} cf_val
           WHERE cf_val.${numeroCupomCol} = cc.${ccNumSeqCol} + 1
           AND cf_val.${codPdvCol} = cc.${ccNumPdvCol}
           AND cf_val.${codLojaCol} = cc.${ccCodLojaCol}
           AND TRUNC(cf_val.${dataVendaCol}) = TRUNC(cc.${ccDtaSeqCol}))
        ), 0) as VALOR_CUPOM
      FROM ${tabCupomCancelado} cc
      WHERE cc.${ccDtaSeqCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cc.${ccDtaSeqCol} < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
        AND cc.${ccFlgEstornoCol} = 'S'
        ${codLoja ? `AND cc.${ccCodLojaCol} = :codLoja` : ''}`;

    // Buscar cancelamentos de venda (TAB_PRODUTO_PDV_ESTORNO sem cupom na finalizadora)
    // Operador: busca pelo cupom mais próximo (mesmo PDV/dia) na finalizadora
    let sqlCancVenda = `
      SELECT
        NVL(
          (SELECT MIN(cf_near.${codOperadorCol}) KEEP (DENSE_RANK FIRST ORDER BY ABS(cf_near.${numeroCupomCol} - e.${numeroCupomCol}))
           FROM ${tabCupomFinalizadora} cf_near
           WHERE cf_near.${codPdvCol} = e.${codPdvCol}
           AND cf_near.${codLojaCol} = e.${codLojaCol}
           AND TRUNC(cf_near.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})),
          0) as COD_OPERADOR,
        e.${valorTotalCol} as VALOR_VENDA
      FROM ${tabProdutoPdvEstorno} e
      WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
        AND NOT EXISTS (
          SELECT 1 FROM ${tabCupomFinalizadora} cf4
          WHERE cf4.${numeroCupomCol} = e.${numeroCupomCol}
          AND cf4.${codPdvCol} = e.${codPdvCol}
          AND cf4.${codLojaCol} = e.${codLojaCol}
          AND TRUNC(cf4.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})
        )`;

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
    const [cancelamentos, estornosOrfaosRaw, cancVendaRaw, tesouraria] = await Promise.all([
      OracleService.query<any>(sqlCancelamentos, params),
      OracleService.query<any>(sqlEstornosOrfaos, params),
      OracleService.query<any>(sqlCancVenda, params),
      OracleService.query<any>(sqlTesouraria, params)
    ]);
    console.log(`  📊 Lote 2 OK (${((Date.now() - startTime2) / 1000).toFixed(1)}s) - CancItem: ${cancelamentos.length}, CancCupom: ${estornosOrfaosRaw.length}, CancVenda: ${cancVendaRaw.length}, Tesouraria: ${tesouraria.length}`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [Frente Caixa] Total: ${elapsed}s`);

    const itensMap = new Map(itens.map(i => [i.COD_OPERADOR, i.TOTAL_ITENS]));
    const descontosMap = new Map(descontos.map(d => [d.COD_OPERADOR, d.TOTAL_DESCONTOS]));
    // Canc. Item = TAB_PRODUTO_PDV_ESTORNO (com operador na finalizadora)
    const cancelamentosMap = new Map(cancelamentos.map(c => [c.COD_OPERADOR, c.TOTAL_CANCELAMENTOS]));
    // Canc. Cupom = TAB_CUPOM_CANCELADO (valor do cupom seguinte)
    const cancCupomMap = new Map<number, number>();
    for (const row of estornosOrfaosRaw) {
      const op = row.COD_OPERADOR || 0;
      cancCupomMap.set(op, (cancCupomMap.get(op) || 0) + (Number(row.VALOR_CUPOM) || 0));
    }
    // Canc. Venda = TAB_PRODUTO_PDV_ESTORNO (sem cupom na finalizadora)
    const cancVendaMap = new Map<number, number>();
    for (const row of cancVendaRaw) {
      const op = row.COD_OPERADOR || 0;
      cancVendaMap.set(op, (cancVendaMap.get(op) || 0) + (Number(row.VALOR_VENDA) || 0));
    }
    const tesourariaMap = new Map(tesouraria.map(t => [t.COD_OPERADOR, { sobra: t.VAL_SOBRA || 0, quebra: t.VAL_QUEBRA || 0 }]));

    // Combinar resultados
    return vendas.map(v => {
      const tes = tesourariaMap.get(v.COD_OPERADOR) || { sobra: 0, quebra: 0 };
      const cancItem = cancelamentosMap.get(v.COD_OPERADOR) || 0;
      const cancCupom = cancCupomMap.get(v.COD_OPERADOR) || 0;
      const cancVenda = cancVendaMap.get(v.COD_OPERADOR) || 0;
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
        CANCELAMENTOS: cancItem + cancCupom + cancVenda,
        CANC_ITEM: cancItem,
        CANC_CUPOM: cancCupom,
        CANC_VENDA: cancVenda,
        ESTORNOS_ORFAOS: 0, // Agora incluído em CANC_CUPOM
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
    if (await this.detectDbType() === 'postgresql') return this.getDetalheOperadorPorDiaPg(filters);

    const { dataInicio, dataFim, codOperador, codLoja } = filters;
    if (!codOperador) throw new Error('codOperador é obrigatório para detalhe por dia');
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabOperadores = `${schema}.${await MappingService.getRealTableName('TAB_OPERADORES')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabTesourariaHistorico = `${schema}.${await MappingService.getRealTableName('TAB_TESOURARIA_HISTORICO')}`;
    const tabCupomCancelado = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_CANCELADO')}`;
    const tabCupomPdv = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_PDV')}`;

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
      dtaMovimentoCol,
      ccNumSeqCol,
      ccNumPdvCol,
      ccCodLojaCol,
      ccDtaSeqCol,
      ccFlgEstornoCol,
      cpNumCupomCol,
      cpNumPdvCol,
      cpCodLojaCol,
      cpDtaVendaCol,
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

    // Buscar cancelamentos de cupom por dia (cupons finalizados que foram cancelados inteiros)
    let sqlEstornosOrfaos = `
      SELECT
        TO_CHAR(cc.${ccDtaSeqCol}, 'DD/MM/YYYY') as DATA,
        NVL(SUM(cf.${valorLiquidoCol}), 0) as TOTAL_ESTORNOS_ORFAOS
      FROM ${tabCupomCancelado} cc
      JOIN ${tabCupomPdv} cp
        ON cp.${numeroCupomCol} = cc.${ccNumSeqCol}
        AND cp.${codPdvCol} = cc.${ccNumPdvCol}
        AND cp.${cpCodLojaCol} = cc.${ccCodLojaCol}
        AND TRUNC(cp.${dataVendaCol}) = TRUNC(cc.${ccDtaSeqCol})
      JOIN ${tabCupomFinalizadora} cf
        ON cf.${numeroCupomCol} = cc.${ccNumSeqCol}
        AND cf.${codPdvCol} = cc.${ccNumPdvCol}
        AND cf.${codLojaCol} = cc.${ccCodLojaCol}
        AND TRUNC(cf.${dataVendaCol}) = TRUNC(cc.${ccDtaSeqCol})
        AND cf.${codTipoCol} = 1110
      WHERE cc.${ccDtaSeqCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cc.${ccDtaSeqCol} < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
        AND cc.${ccFlgEstornoCol} = 'S'
        ${codLoja ? `AND cc.${ccCodLojaCol} = :codLoja` : ''}
        AND cf.${codOperadorCol} = :codOperador
      GROUP BY TO_CHAR(cc.${ccDtaSeqCol}, 'DD/MM/YYYY')`;

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
        CANCELAMENTOS: (cancelamentosMap.get(v.DATA) || 0) + (estornosOrfaosMap.get(v.DATA) || 0),
        CANC_ITEM: cancelamentosMap.get(v.DATA) || 0,
        CANC_CUPOM: estornosOrfaosMap.get(v.DATA) || 0,
        CANC_VENDA: 0,
        ESTORNOS_ORFAOS: 0,
        VAL_SOBRA: tes.sobra,
        VAL_QUEBRA: tes.quebra,
        VAL_DIFERENCA: tes.sobra - tes.quebra
      };
    });
  }

  /** PG: detalhe por dia de um operador */
  private static async getDetalheOperadorPorDiaPg(filters: FrenteCaixaFilters): Promise<OperadorPorDia[]> {
    if (!filters.codOperador) throw new Error('codOperador é obrigatório');
    const toIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
    const dtIni = toIso(filters.dataInicio);
    const dtFim = toIso(filters.dataFim);
    const params: any[] = [dtIni, dtFim, filters.codOperador];
    let lojaWhere = '';
    if (filters.codLoja) { lojaWhere = ` AND v.vopr_unid_codigo::int = $4::int`; params.push(filters.codLoja); }

    const sql = `SELECT v.vopr_datamvto::text as data, EXTRACT(DAY FROM v.vopr_datamvto)::int as dia,
      v.vopr_operador::int as cod_op,
      COALESCE(SUM(v.vopr_valor - COALESCE(v.vopr_desconto,0) + COALESCE(v.vopr_acrescimo,0)),0)::float as vendas,
      COUNT(*)::int as itens,
      COUNT(DISTINCT v.vopr_cupom || '-' || v.vopr_pdvs_codigo)::int as cupons,
      COALESCE(SUM(COALESCE(v.vopr_desconto,0)),0)::float as descontos
      FROM public.vdonlineprod v
      WHERE v.vopr_datamvto BETWEEN $1 AND $2 AND v.vopr_tiporeg = 'IT'
      AND COALESCE(v.vopr_cancmotivo,'') = '' AND v.vopr_operador::int = $3::int
      ${lojaWhere}
      GROUP BY v.vopr_datamvto, v.vopr_operador ORDER BY v.vopr_datamvto`;

    try {
      const rows = await PostgresErpService.query<any>(sql, params);
      return rows.map((r: any) => ({
        COD_OPERADOR: r.cod_op, DES_OPERADOR: String(r.cod_op),
        DATA: r.data, DIA: r.dia,
        TOTAL_VENDAS: r.vendas, TOTAL_ITENS: r.itens, TOTAL_CUPONS: r.cupons,
        DINHEIRO: 0, CARTAO_DEBITO: 0, CARTAO_CREDITO: 0, PIX: 0,
        FUNCIONARIO: 0, CARTAO_POS: 0, TRICARD_PARCELADO: 0,
        VALE_TROCA: 0, VALE_DESCONTO: 0, OUTROS: 0,
        TOTAL_DESCONTOS: r.descontos, CANCELAMENTOS: 0,
        CANC_ITEM: 0, CANC_CUPOM: 0, CANC_VENDA: 0, ESTORNOS_ORFAOS: 0,
        VAL_SOBRA: 0, VAL_QUEBRA: 0, VAL_DIFERENCA: 0
      } as OperadorPorDia));
    } catch (e: any) {
      console.error('❌ [Frente Caixa PG] Detalhe por dia erro:', e.message);
      return [];
    }
  }

  /**
   * Busca totais gerais do período
   */
  static async getTotais(filters: FrenteCaixaFilters): Promise<any> {
    if (await this.detectDbType() === 'postgresql') {
      // PG: usar o resumo como base
      const resumo = await this.getResumoOperadoresPg(filters);
      const totais = resumo.reduce((acc, r) => ({
        TOTAL_VENDAS: acc.TOTAL_VENDAS + r.TOTAL_VENDAS,
        TOTAL_ITENS: acc.TOTAL_ITENS + r.TOTAL_ITENS,
        TOTAL_CUPONS: acc.TOTAL_CUPONS + r.TOTAL_CUPONS,
        TOTAL_DESCONTOS: acc.TOTAL_DESCONTOS + r.TOTAL_DESCONTOS,
        CANCELAMENTOS: acc.CANCELAMENTOS + r.CANCELAMENTOS,
        DINHEIRO: acc.DINHEIRO + r.DINHEIRO,
        CARTAO_DEBITO: acc.CARTAO_DEBITO + r.CARTAO_DEBITO,
        CARTAO_CREDITO: acc.CARTAO_CREDITO + r.CARTAO_CREDITO,
        PIX: acc.PIX + r.PIX,
      }), { TOTAL_VENDAS: 0, TOTAL_ITENS: 0, TOTAL_CUPONS: 0, TOTAL_DESCONTOS: 0, CANCELAMENTOS: 0, DINHEIRO: 0, CARTAO_DEBITO: 0, CARTAO_CREDITO: 0, PIX: 0 });
      return totais;
    }
    const { dataInicio, dataFim, codLoja } = filters;

    // Busca schema e nomes reais das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabCupomFinalizadora = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_FINALIZADORA')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoPdvEstorno = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV_ESTORNO')}`;
    const tabTesourariaHistorico = `${schema}.${await MappingService.getRealTableName('TAB_TESOURARIA_HISTORICO')}`;
    const tabCupomCancelado = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_CANCELADO')}`;
    const tabCupomPdv = `${schema}.${await MappingService.getRealTableName('TAB_CUPOM_PDV')}`;

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
      dtaMovimentoCol,
      ccNumSeqCol,
      ccNumPdvCol,
      ccCodLojaCol,
      ccDtaSeqCol,
      ccFlgEstornoCol,
      cpCodLojaCol,
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

    // Cancelamento de cupom = TAB_CUPOM_CANCELADO (valor do cupom seguinte NUM_SEQ+1)
    const sqlCancCupomTotal = `
      SELECT NVL(SUM(ABS(
        (SELECT SUM(cf_val.${valorLiquidoCol})
         FROM ${tabCupomFinalizadora} cf_val
         WHERE cf_val.${numeroCupomCol} = cc.${ccNumSeqCol} + 1
         AND cf_val.${codPdvCol} = cc.${ccNumPdvCol}
         AND cf_val.${codLojaCol} = cc.${ccCodLojaCol}
         AND TRUNC(cf_val.${dataVendaCol}) = TRUNC(cc.${ccDtaSeqCol}))
      )), 0) as CANC_CUPOM
      FROM ${tabCupomCancelado} cc
      WHERE cc.${ccDtaSeqCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND cc.${ccDtaSeqCol} < TO_DATE(:dataFim, 'DD/MM/YYYY') + 1
        AND cc.${ccFlgEstornoCol} = 'S'
        ${codLoja ? `AND cc.${ccCodLojaCol} = :codLoja` : ''}
    `;
    const cancCupomTotal = await OracleService.query<any>(sqlCancCupomTotal, params);

    // Cancelamento de venda = estornos SEM cupom na finalizadora
    const sqlCancVendaTotal = `
      SELECT NVL(SUM(e.${valorTotalCol}), 0) as CANC_VENDA
      FROM ${tabProdutoPdvEstorno} e
      WHERE e.${dataSaidaCol} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')
        AND e.${dataSaidaCol} <= TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${codLoja ? `AND e.${codLojaCol} = :codLoja` : ''}
        AND NOT EXISTS (
          SELECT 1 FROM ${tabCupomFinalizadora} cf4
          WHERE cf4.${numeroCupomCol} = e.${numeroCupomCol}
          AND cf4.${codPdvCol} = e.${codPdvCol}
          AND cf4.${codLojaCol} = e.${codLojaCol}
          AND TRUNC(cf4.${dataVendaCol}) = TRUNC(e.${dataSaidaCol})
        )
    `;
    const cancVendaTotal = await OracleService.query<any>(sqlCancVendaTotal, params);

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
      CANCELAMENTOS: (cancelamentos[0]?.CANCELAMENTOS || 0) + (cancCupomTotal[0]?.CANC_CUPOM || 0) + (cancVendaTotal[0]?.CANC_VENDA || 0),
      CANC_ITEM: cancelamentos[0]?.CANCELAMENTOS || 0,
      CANC_CUPOM: cancCupomTotal[0]?.CANC_CUPOM || 0,
      CANC_VENDA: cancVendaTotal[0]?.CANC_VENDA || 0,
      ESTORNOS_ORFAOS: 0,
      TOTAL_SOBRA: tesouraria[0]?.TOTAL_SOBRA || 0,
      TOTAL_QUEBRA: tesouraria[0]?.TOTAL_QUEBRA || 0,
      TOTAL_DIFERENCA: (tesouraria[0]?.TOTAL_SOBRA || 0) - (tesouraria[0]?.TOTAL_QUEBRA || 0)
    };
  }

  /**
   * Busca cupons de um operador em uma data específica
   */
  static async getCuponsPorDia(codOperador: number, data: string, codLoja?: number): Promise<any[]> {
    if (await this.detectDbType() === 'postgresql') {
      const toIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
      const dia = toIso(data);
      const params: any[] = [dia, codOperador];
      let lojaWhere = '';
      if (codLoja) { lojaWhere = ` AND vopr_unid_codigo::int = $3::int`; params.push(codLoja); }
      const sql = `SELECT vopr_cupom as "NUM_CUPOM_FISCAL", vopr_unid_codigo as "COD_LOJA",
        vopr_datamvto::text || ' ' || MIN(vopr_hora) as "DATA_HORA",
        SUM(vopr_valor - COALESCE(vopr_desconto,0) + COALESCE(vopr_acrescimo,0))::float as "VALOR_CUPOM",
        SUM(COALESCE(vopr_desconto,0))::float as "TOTAL_DESCONTO",
        SUM(CASE WHEN vopr_desconto > 0 THEN 1 ELSE 0 END)::int as "QTD_ITENS_DESCONTO",
        0::float as "TOTAL_CANCELADO", 0::int as "QTD_ITENS_CANCELADOS",
        COUNT(*)::int as "QTD_ITENS_TOTAL", 'N' as "FLG_CANCELADO"
        FROM public.vdonlineprod
        WHERE vopr_datamvto = $1 AND vopr_tiporeg = 'IT' AND vopr_operador::int = $2::int
        AND COALESCE(vopr_cancmotivo,'') = '' ${lojaWhere}
        GROUP BY vopr_cupom, vopr_unid_codigo, vopr_datamvto
        ORDER BY MIN(vopr_hora)`;
      return PostgresErpService.query<any>(sql, params);
    }

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
    if (await this.detectDbType() === 'postgresql') {
      const schema = await MappingService.getSchema();
      const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colDesc = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const tabProd = await MappingService.getRealTableName('TAB_PRODUTO');
      const params: any[] = [numCupom, codLoja];
      let dateWhere = '';
      if (data) { const [dd, mm, yyyy] = data.split('/'); dateWhere = ` AND v.vopr_datamvto = $3::date`; params.push(`${yyyy}-${mm}-${dd}`); }
      const sql = `SELECT v.vopr_prod_codigo as "COD_PRODUTO", p.${colDesc} as "DES_PRODUTO",
        v.vopr_qtde::float as "QTD_TOTAL_PRODUTO", v.vopr_valor::float as "VAL_TOTAL_PRODUTO",
        COALESCE(v.vopr_desconto,0)::float as "VAL_DESCONTO",
        CASE WHEN v.vopr_cancmotivo IS NOT NULL AND v.vopr_cancmotivo != '' THEN 'S' ELSE 'N' END as "FLG_CANCELADO",
        v.vopr_hora as "HORA"
        FROM public.vdonlineprod v
        LEFT JOIN ${schema}.${tabProd} p ON p.${colCodProd} = v.vopr_prod_codigo
        WHERE v.vopr_cupom::int = $1::int AND v.vopr_unid_codigo::int = $2::int
        AND v.vopr_tiporeg = 'IT' ${dateWhere}
        ORDER BY v.vopr_hora`;
      return PostgresErpService.query<any>(sql, params);
    }

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
