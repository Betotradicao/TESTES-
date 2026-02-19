/**
 * Financeiro Service
 * Consultas na TAB_FLUXO (contas a pagar e receber)
 *
 * TODAS as tabelas e colunas são resolvidas via MappingService (sem hardcode).
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

/**
 * Resolve todas as tabelas e colunas via MappingService de uma vez
 */
async function resolveMapping() {
  const schema = await MappingService.getSchema();

  // Tabelas
  const tabFluxo = `${schema}.${await MappingService.getRealTableName('TAB_FLUXO')}`;
  const tabBanco = `${schema}.${await MappingService.getRealTableName('TAB_BANCO')}`;
  const tabEntidade = `${schema}.${await MappingService.getRealTableName('TAB_ENTIDADE')}`;
  const tabCategoria = `${schema}.${await MappingService.getRealTableName('TAB_CATEGORIA')}`;
  const tabSubcategoria = `${schema}.${await MappingService.getRealTableName('TAB_SUBCATEGORIA')}`;
  const tabMovBco = `${schema}.${await MappingService.getRealTableName('TAB_MOV_BCO')}`;

  // Colunas TAB_FLUXO
  const flxNumRegistro = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_registro');
  const flxCodLoja = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_loja');
  const flxTipoParceiro = await MappingService.getColumnFromTable('TAB_FLUXO', 'tipo_parceiro');
  const flxTipoConta = await MappingService.getColumnFromTable('TAB_FLUXO', 'tipo_conta');
  const flxCodParceiro = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_parceiro');
  const flxDesParceiro = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_parceiro');
  const flxNumCgcCpf = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_cgc_cpf');
  const flxDtaEntrada = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_entrada');
  const flxDtaEmissao = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_emissao');
  const flxDtaVencimento = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_vencimento');
  const flxValParcela = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_parcela');
  const flxNumParcela = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_parcela');
  const flxQtdParcela = await MappingService.getColumnFromTable('TAB_FLUXO', 'qtd_parcela');
  const flxNumDocto = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_docto');
  const flxNumNf = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_nf');
  const flxNumSerieNf = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_serie_nf');
  const flxFlgQuitado = await MappingService.getColumnFromTable('TAB_FLUXO', 'flg_quitado');
  const flxDtaQuitada = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_quitada');
  const flxDtaPgto = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_pgto');
  const flxCodBancoPgto = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_banco_pgto');
  const flxDesCc = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_cc');
  const flxCodEntidade = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_entidade');
  const flxCodCategoria = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_categoria');
  const flxCodSubcategoria = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_subcategoria');
  const flxValJuros = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_juros');
  const flxValDesconto = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_desconto');
  const flxValCredito = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_credito');
  const flxValDevolucao = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_devolucao');
  const flxDesObservacao = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_observacao');
  const flxDesUsuarioQuit = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_usuario_quit');
  const flxUsuario = await MappingService.getColumnFromTable('TAB_FLUXO', 'usuario');
  const flxNumBordero = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_bordero');
  const flxFlgCompensado = await MappingService.getColumnFromTable('TAB_FLUXO', 'flg_compensado');

  // Colunas TAB_BANCO
  const bcoCodBanco = await MappingService.getColumnFromTable('TAB_BANCO', 'cod_banco');
  const bcoDesBanco = await MappingService.getColumnFromTable('TAB_BANCO', 'des_banco');

  // Colunas TAB_ENTIDADE
  const entCodEntidade = await MappingService.getColumnFromTable('TAB_ENTIDADE', 'cod_entidade');
  const entDesEntidade = await MappingService.getColumnFromTable('TAB_ENTIDADE', 'des_entidade');

  // Colunas TAB_CATEGORIA
  const catCodCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'cod_categoria');
  const catDesCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'des_categoria');

  // Colunas TAB_SUBCATEGORIA
  const subCodCategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_categoria');
  const subCodSubcategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_subcategoria');
  const subDesSubcategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'des_subcategoria');

  // Colunas TAB_MOV_BCO
  const mbCodChaveMovCta = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_chave_mov_cta');
  const mbCodBanco = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_banco');
  const mbCodLoja = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_loja');
  const mbDtaEntrada = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'dta_entrada');
  const mbDtaQuitada = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'dta_quitada');
  const mbValDocto = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'val_docto');
  const mbFavorecido = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'favorecido');
  const mbNumDoctoPgto = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'num_docto_pgto');
  const mbTipoOperacao = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'tipo_operacao');
  const mbTipoSituacao = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'tipo_situacao');
  const mbFlgEstorno = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'flg_estorno');
  const mbCodCategoria = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_categoria');
  const mbCodSubcategoria = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_subcategoria');
  const mbDesObservacao = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'des_observacao');

  return {
    tabFluxo, tabBanco, tabEntidade, tabCategoria, tabSubcategoria, tabMovBco,
    flxNumRegistro, flxCodLoja, flxTipoParceiro, flxTipoConta, flxCodParceiro, flxDesParceiro,
    flxNumCgcCpf, flxDtaEntrada, flxDtaEmissao, flxDtaVencimento, flxValParcela,
    flxNumParcela, flxQtdParcela, flxNumDocto, flxNumNf, flxNumSerieNf,
    flxFlgQuitado, flxDtaQuitada, flxDtaPgto, flxCodBancoPgto, flxDesCc,
    flxCodEntidade, flxCodCategoria, flxCodSubcategoria,
    flxValJuros, flxValDesconto, flxValCredito, flxValDevolucao,
    flxDesObservacao, flxDesUsuarioQuit, flxUsuario, flxNumBordero, flxFlgCompensado,
    bcoCodBanco, bcoDesBanco,
    entCodEntidade, entDesEntidade,
    catCodCategoria, catDesCategoria,
    subCodCategoria, subCodSubcategoria, subDesSubcategoria,
    mbCodChaveMovCta, mbCodBanco, mbCodLoja, mbDtaEntrada, mbDtaQuitada,
    mbValDocto, mbFavorecido, mbNumDoctoPgto, mbTipoOperacao, mbTipoSituacao,
    mbFlgEstorno, mbCodCategoria, mbCodSubcategoria, mbDesObservacao,
  };
}

export class FinanceiroService {

  /**
   * Monta cláusulas WHERE baseadas nos filtros (usa nomes de coluna mapeados)
   */
  private static buildFilters(filters: FinanceiroFilters, params: any, m: any): string {
    let where = ' WHERE 1=1';

    if (filters.vencInicio) {
      where += ` AND f.${m.flxDtaVencimento} >= TO_DATE(:vencInicio, 'YYYY-MM-DD')`;
      params.vencInicio = filters.vencInicio;
    }
    if (filters.vencFim) {
      where += ` AND f.${m.flxDtaVencimento} <= TO_DATE(:vencFim, 'YYYY-MM-DD') + 0.99999`;
      params.vencFim = filters.vencFim;
    }
    if (filters.entradaInicio) {
      where += ` AND f.${m.flxDtaEntrada} >= TO_DATE(:entradaInicio, 'YYYY-MM-DD')`;
      params.entradaInicio = filters.entradaInicio;
    }
    if (filters.entradaFim) {
      where += ` AND f.${m.flxDtaEntrada} <= TO_DATE(:entradaFim, 'YYYY-MM-DD') + 0.99999`;
      params.entradaFim = filters.entradaFim;
    }
    if (filters.tipoConta !== undefined && filters.tipoConta !== '') {
      where += ` AND f.${m.flxTipoConta} = :tipoConta`;
      params.tipoConta = Number(filters.tipoConta);
    }
    if (filters.quitado && filters.quitado !== '') {
      where += ` AND f.${m.flxFlgQuitado} = :quitado`;
      params.quitado = filters.quitado;
    }
    if (filters.tipoParceiro !== undefined && filters.tipoParceiro !== '') {
      where += ` AND f.${m.flxTipoParceiro} = :tipoParceiro`;
      params.tipoParceiro = Number(filters.tipoParceiro);
    }
    if (filters.codBanco) {
      where += ` AND f.${m.flxCodBancoPgto} = :codBanco`;
      params.codBanco = Number(filters.codBanco);
    }
    if (filters.codEntidade) {
      where += ` AND f.${m.flxCodEntidade} = :codEntidade`;
      params.codEntidade = Number(filters.codEntidade);
    }
    if (filters.codCategoria) {
      where += ` AND f.${m.flxCodCategoria} = :codCategoria`;
      params.codCategoria = Number(filters.codCategoria);
    }
    if (filters.parceiro) {
      where += ` AND UPPER(f.${m.flxDesParceiro}) LIKE UPPER(:parceiro)`;
      params.parceiro = `%${filters.parceiro}%`;
    }
    if (filters.codLoja) {
      where += ` AND f.${m.flxCodLoja} = :codLoja`;
      params.codLoja = Number(filters.codLoja);
    }

    return where;
  }

  /**
   * Busca títulos do fluxo financeiro (TAB_FLUXO)
   */
  static async getEntradasSaidas(filters: FinanceiroFilters): Promise<any> {
    const m = await resolveMapping();
    const params: any = {};
    const where = this.buildFilters(filters, params, m);

    const sql = `
      SELECT * FROM (
        SELECT
          f.${m.flxNumRegistro} as NUM_REGISTRO,
          f.${m.flxCodLoja} as COD_LOJA,
          f.${m.flxTipoParceiro} as TIPO_PARCEIRO,
          f.${m.flxTipoConta} as TIPO_CONTA,
          f.${m.flxCodParceiro} as COD_PARCEIRO,
          f.${m.flxDesParceiro} as DES_PARCEIRO,
          f.${m.flxNumCgcCpf} as NUM_CGC_CPF,
          f.${m.flxDtaEntrada} as DTA_ENTRADA,
          f.${m.flxDtaEmissao} as DTA_EMISSAO,
          f.${m.flxDtaVencimento} as DTA_VENCIMENTO,
          f.${m.flxValParcela} as VAL_PARCELA,
          f.${m.flxNumParcela} as NUM_PARCELA,
          f.${m.flxQtdParcela} as QTD_PARCELA,
          f.${m.flxNumDocto} as NUM_DOCTO,
          f.${m.flxNumNf} as NUM_NF,
          f.${m.flxNumSerieNf} as NUM_SERIE_NF,
          f.${m.flxFlgQuitado} as FLG_QUITADO,
          f.${m.flxDtaQuitada} as DTA_QUITADA,
          f.${m.flxDtaPgto} as DTA_PGTO,
          f.${m.flxCodBancoPgto} as COD_BANCO_PGTO,
          f.${m.flxDesCc} as DES_CC,
          f.${m.flxCodEntidade} as COD_ENTIDADE,
          f.${m.flxCodCategoria} as COD_CATEGORIA,
          f.${m.flxCodSubcategoria} as COD_SUBCATEGORIA,
          f.${m.flxValJuros} as VAL_JUROS,
          f.${m.flxValDesconto} as VAL_DESCONTO,
          f.${m.flxValCredito} as VAL_CREDITO,
          f.${m.flxValDevolucao} as VAL_DEVOLUCAO,
          f.${m.flxDesObservacao} as DES_OBSERVACAO,
          f.${m.flxDesUsuarioQuit} as DES_USUARIO_QUIT,
          f.${m.flxUsuario} as USUARIO,
          f.${m.flxNumBordero} as NUM_BORDERO,
          f.${m.flxFlgCompensado} as FLG_COMPENSADO,
          b.${m.bcoDesBanco} as DES_BANCO,
          e.${m.entDesEntidade} as DES_ENTIDADE,
          c.${m.catDesCategoria} as DES_CATEGORIA,
          sc.${m.subDesSubcategoria} as DES_SUBCATEGORIA
        FROM ${m.tabFluxo} f
        LEFT JOIN ${m.tabBanco} b ON b.${m.bcoCodBanco} = f.${m.flxCodBancoPgto}
        LEFT JOIN ${m.tabEntidade} e ON e.${m.entCodEntidade} = f.${m.flxCodEntidade}
        LEFT JOIN ${m.tabCategoria} c ON c.${m.catCodCategoria} = f.${m.flxCodCategoria}
        LEFT JOIN ${m.tabSubcategoria} sc ON sc.${m.subCodCategoria} = f.${m.flxCodCategoria} AND sc.${m.subCodSubcategoria} = f.${m.flxCodSubcategoria}
        ${where}
        ORDER BY f.${m.flxDtaVencimento} DESC, f.${m.flxNumRegistro} DESC
      ) WHERE ROWNUM <= 500
    `;

    const data = await OracleService.query<any>(sql, params);

    // Se incluirMovBanco='sim', buscar também de TAB_MOV_BCO
    if (filters.incluirMovBanco === 'sim') {
      const movBcoData = await this.getMovBcoData(filters, m);
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
  private static async getMovBcoData(filters: FinanceiroFilters, m?: any): Promise<any[]> {
    if (!m) m = await resolveMapping();
    const params: any = {};
    let where = ` WHERE m.${m.mbFlgEstorno} = 'N' AND m.${m.mbCodCategoria} IS NOT NULL`;

    if (filters.vencInicio) {
      where += ` AND m.${m.mbDtaEntrada} >= TO_DATE(:vencInicio, 'YYYY-MM-DD')`;
      params.vencInicio = filters.vencInicio;
    }
    if (filters.vencFim) {
      where += ` AND m.${m.mbDtaEntrada} <= TO_DATE(:vencFim, 'YYYY-MM-DD') + 0.99999`;
      params.vencFim = filters.vencFim;
    }
    if (filters.entradaInicio) {
      where += ` AND m.${m.mbDtaEntrada} >= TO_DATE(:entradaInicio, 'YYYY-MM-DD')`;
      params.entradaInicio = filters.entradaInicio;
    }
    if (filters.entradaFim) {
      where += ` AND m.${m.mbDtaEntrada} <= TO_DATE(:entradaFim, 'YYYY-MM-DD') + 0.99999`;
      params.entradaFim = filters.entradaFim;
    }
    if (filters.tipoConta !== undefined && filters.tipoConta !== '') {
      const tipoOp = filters.tipoConta === '0' ? 1 : 0;
      where += ` AND m.${m.mbTipoOperacao} = :tipoOp`;
      params.tipoOp = tipoOp;
    }
    if (filters.quitado && filters.quitado !== '') {
      const tipoSit = filters.quitado === 'S' ? 1 : 0;
      where += ` AND m.${m.mbTipoSituacao} = :tipoSit`;
      params.tipoSit = tipoSit;
    }
    if (filters.codCategoria) {
      where += ` AND m.${m.mbCodCategoria} = :codCategoria`;
      params.codCategoria = Number(filters.codCategoria);
    }
    if (filters.parceiro) {
      where += ` AND UPPER(m.${m.mbFavorecido}) LIKE UPPER(:parceiro)`;
      params.parceiro = `%${filters.parceiro}%`;
    }
    if (filters.codLoja) {
      where += ` AND m.${m.mbCodLoja} = :codLoja`;
      params.codLoja = Number(filters.codLoja);
    }
    if (filters.codBanco) {
      where += ` AND m.${m.mbCodBanco} = :codBanco`;
      params.codBanco = Number(filters.codBanco);
    }

    const sql = `
      SELECT * FROM (
        SELECT
          m.${m.mbCodChaveMovCta} as NUM_REGISTRO,
          m.${m.mbCodLoja} as COD_LOJA,
          3 as TIPO_PARCEIRO,
          CASE WHEN m.${m.mbTipoOperacao} = 0 THEN 1 ELSE 0 END as TIPO_CONTA,
          0 as COD_PARCEIRO,
          m.${m.mbFavorecido} as DES_PARCEIRO,
          NULL as NUM_CGC_CPF,
          m.${m.mbDtaEntrada} as DTA_ENTRADA,
          m.${m.mbDtaEntrada} as DTA_EMISSAO,
          m.${m.mbDtaEntrada} as DTA_VENCIMENTO,
          m.${m.mbValDocto} as VAL_PARCELA,
          1 as NUM_PARCELA,
          1 as QTD_PARCELA,
          m.${m.mbNumDoctoPgto} as NUM_DOCTO,
          NULL as NUM_NF,
          NULL as NUM_SERIE_NF,
          CASE WHEN m.${m.mbTipoSituacao} = 1 THEN 'S' ELSE 'N' END as FLG_QUITADO,
          m.${m.mbDtaQuitada} as DTA_QUITADA,
          m.${m.mbDtaQuitada} as DTA_PGTO,
          m.${m.mbCodBanco} as COD_BANCO_PGTO,
          NULL as DES_CC,
          NULL as COD_ENTIDADE,
          m.${m.mbCodCategoria} as COD_CATEGORIA,
          m.${m.mbCodSubcategoria} as COD_SUBCATEGORIA,
          0 as VAL_JUROS,
          0 as VAL_DESCONTO,
          0 as VAL_CREDITO,
          0 as VAL_DEVOLUCAO,
          m.${m.mbDesObservacao} as DES_OBSERVACAO,
          NULL as DES_USUARIO_QUIT,
          NULL as USUARIO,
          NULL as NUM_BORDERO,
          NULL as FLG_COMPENSADO,
          b.${m.bcoDesBanco} as DES_BANCO,
          NULL as DES_ENTIDADE,
          c.${m.catDesCategoria} as DES_CATEGORIA,
          sc.${m.subDesSubcategoria} as DES_SUBCATEGORIA
        FROM ${m.tabMovBco} m
        LEFT JOIN ${m.tabBanco} b ON b.${m.bcoCodBanco} = m.${m.mbCodBanco}
        LEFT JOIN ${m.tabCategoria} c ON c.${m.catCodCategoria} = m.${m.mbCodCategoria}
        LEFT JOIN ${m.tabSubcategoria} sc ON sc.${m.subCodCategoria} = m.${m.mbCodCategoria} AND sc.${m.subCodSubcategoria} = m.${m.mbCodSubcategoria}
        ${where}
        ORDER BY m.${m.mbDtaEntrada} DESC
      ) WHERE ROWNUM <= 500
    `;

    return OracleService.query<any>(sql, params);
  }

  /**
   * Resumo: totais de entradas, saídas, saldo
   */
  static async getResumo(filters: FinanceiroFilters): Promise<any> {
    const m = await resolveMapping();
    const params: any = {};
    const where = this.buildFilters(filters, params, m);

    const sql = `
      SELECT
        SUM(CASE WHEN f.${m.flxTipoConta} = 1 THEN f.${m.flxValParcela} ELSE 0 END) as TOTAL_ENTRADAS,
        SUM(CASE WHEN f.${m.flxTipoConta} = 0 THEN f.${m.flxValParcela} ELSE 0 END) as TOTAL_SAIDAS,
        SUM(CASE WHEN f.${m.flxTipoConta} = 1 THEN f.${m.flxValParcela} ELSE 0 END)
          - SUM(CASE WHEN f.${m.flxTipoConta} = 0 THEN f.${m.flxValParcela} ELSE 0 END) as SALDO,
        SUM(CASE WHEN f.${m.flxFlgQuitado} = 'N' THEN 1 ELSE 0 END) as QTD_ABERTOS,
        SUM(CASE WHEN f.${m.flxFlgQuitado} = 'S' THEN 1 ELSE 0 END) as QTD_QUITADOS,
        SUM(CASE WHEN f.${m.flxFlgQuitado} = 'N' AND f.${m.flxTipoConta} = 0 THEN f.${m.flxValParcela} ELSE 0 END) as SAIDAS_ABERTAS,
        SUM(CASE WHEN f.${m.flxFlgQuitado} = 'N' AND f.${m.flxTipoConta} = 1 THEN f.${m.flxValParcela} ELSE 0 END) as ENTRADAS_ABERTAS,
        COUNT(*) as TOTAL_REGISTROS
      FROM ${m.tabFluxo} f
      ${where}
    `;

    const result = await OracleService.query<any>(sql, params);
    const resumo = result[0] || {};

    // Incluir mov banco no resumo
    if (filters.incluirMovBanco === 'sim') {
      const movBcoData = await this.getMovBcoData(filters, m);
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
    const m = await resolveMapping();
    const sql = `
      SELECT DISTINCT b.${m.bcoCodBanco} as COD_BANCO, b.${m.bcoDesBanco} as DES_BANCO
      FROM ${m.tabBanco} b
      WHERE EXISTS (SELECT 1 FROM ${m.tabFluxo} f WHERE f.${m.flxCodBancoPgto} = b.${m.bcoCodBanco})
      ORDER BY b.${m.bcoDesBanco}
    `;
    return OracleService.query(sql);
  }

  /**
   * Lista entidades (formas de pagamento) para dropdown
   */
  static async getEntidades(): Promise<any[]> {
    const m = await resolveMapping();
    const sql = `
      SELECT ${m.entCodEntidade} as COD_ENTIDADE, ${m.entDesEntidade} as DES_ENTIDADE
      FROM ${m.tabEntidade}
      ORDER BY ${m.entDesEntidade}
    `;
    return OracleService.query(sql);
  }

  /**
   * Lista categorias financeiras para dropdown
   */
  static async getCategorias(): Promise<any[]> {
    const m = await resolveMapping();
    const sql = `
      SELECT ${m.catCodCategoria} as COD_CATEGORIA, ${m.catDesCategoria} as DES_CATEGORIA
      FROM ${m.tabCategoria}
      ORDER BY ${m.catDesCategoria}
    `;
    return OracleService.query(sql);
  }
}
