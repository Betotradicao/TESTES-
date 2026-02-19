/**
 * Demonstrativo de Caixa Service
 * Orçamento Gerencial - consulta TAB_ORCAMENTO_GERENCIAL + TAB_FLUXO + TAB_CATEGORIA + TAB_SUBCATEGORIA
 *
 * TODAS as tabelas e colunas são resolvidas via MappingService (sem hardcode).
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

interface DemonstrativoFilters {
  dataInicio?: string;   // formato "YYYY-MM-DD"
  dataFim?: string;      // formato "YYYY-MM-DD"
  codLoja?: string;
  regime?: string;       // 'caixa' ou 'competencia'
  tipoFluxo?: string;    // filtro por tab: '', '1', '2', '3', '4'
  incluirMovBanco?: string; // 'sim' ou 'nao' - incluir movimentações bancárias (TAB_MOV_BCO)
}

/**
 * Resolve todas as tabelas e colunas via MappingService de uma vez
 */
async function resolveMapping() {
  const schema = await MappingService.getSchema();

  // Tabelas
  const tabCategoria = `${schema}.${await MappingService.getRealTableName('TAB_CATEGORIA')}`;
  const tabSubcategoria = `${schema}.${await MappingService.getRealTableName('TAB_SUBCATEGORIA')}`;
  const tabOrcamento = `${schema}.${await MappingService.getRealTableName('TAB_ORCAMENTO_GERENCIAL')}`;
  const tabFluxo = `${schema}.${await MappingService.getRealTableName('TAB_FLUXO')}`;
  const tabFluxoEvento = `${schema}.${await MappingService.getRealTableName('TAB_FLUXO_EVENTO')}`;
  const tabEventoFinanceiro = `${schema}.${await MappingService.getRealTableName('TAB_EVENTO_FINANCEIRO')}`;
  const tabMovBco = `${schema}.${await MappingService.getRealTableName('TAB_MOV_BCO')}`;
  const tabEntidade = `${schema}.${await MappingService.getRealTableName('TAB_ENTIDADE')}`;
  const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
  const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
  const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;

  // Colunas TAB_CATEGORIA
  const catCodCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'cod_categoria');
  const catDesCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'des_categoria');
  const catTipoCategoria = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'tipo_categoria');
  const catNumOrdem = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'num_ordem');
  const catTipoFluxo = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'tipo_fluxo');
  const catFlgInativo = await MappingService.getColumnFromTable('TAB_CATEGORIA', 'flg_inativo');

  // Colunas TAB_SUBCATEGORIA
  const subCodCategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_categoria');
  const subCodSubcategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'cod_subcategoria');
  const subDesSubcategoria = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'des_subcategoria');
  const subNumOrdem = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'num_ordem');
  const subFlgIgnoraOrcto = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'flg_ignora_orcto');
  let subFlgInativo = 'FLG_INATIVO';
  try { const v = await MappingService.getColumnFromTable('TAB_SUBCATEGORIA', 'flg_inativo'); if (v) subFlgInativo = v; } catch {}

  // Colunas TAB_ORCAMENTO_GERENCIAL
  const orcDtaMensal = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'dta_mensal');
  const orcCodLoja = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'cod_loja');
  const orcCodCategoria = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'cod_categoria');
  const orcCodSubcategoria = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'cod_subcategoria');
  const orcValPrevisao = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'val_previsao');
  const orcValAberto = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'val_aberto');
  const orcValQuitado = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'val_quitado');
  const orcValRealizado = await MappingService.getColumnFromTable('TAB_ORCAMENTO_GERENCIAL', 'val_realizado');

  // Colunas TAB_FLUXO
  const flxNumRegistro = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_registro');
  const flxCodLoja = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_loja');
  const flxTipoConta = await MappingService.getColumnFromTable('TAB_FLUXO', 'tipo_conta');
  const flxTipoParceiro = await MappingService.getColumnFromTable('TAB_FLUXO', 'tipo_parceiro');
  const flxCodParceiro = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_parceiro');
  const flxDesParceiro = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_parceiro');
  const flxNumDocto = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_docto');
  const flxNumNf = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_nf');
  const flxNumSerieNf = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_serie_nf');
  const flxValParcela = await MappingService.getColumnFromTable('TAB_FLUXO', 'val_parcela');
  const flxNumParcela = await MappingService.getColumnFromTable('TAB_FLUXO', 'num_parcela');
  const flxQtdParcela = await MappingService.getColumnFromTable('TAB_FLUXO', 'qtd_parcela');
  const flxFlgQuitado = await MappingService.getColumnFromTable('TAB_FLUXO', 'flg_quitado');
  const flxDtaVencimento = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_vencimento');
  const flxDtaEntrada = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_entrada');
  const flxDtaQuitada = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_quitada');
  const flxDtaEmissao = await MappingService.getColumnFromTable('TAB_FLUXO', 'dta_emissao');
  const flxCodEntidade = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_entidade');
  const flxCodCategoria = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_categoria');
  const flxCodSubcategoria = await MappingService.getColumnFromTable('TAB_FLUXO', 'cod_subcategoria');
  const flxDesObservacao = await MappingService.getColumnFromTable('TAB_FLUXO', 'des_observacao');

  // Colunas TAB_FLUXO_EVENTO
  const feNumRegistro = await MappingService.getColumnFromTable('TAB_FLUXO_EVENTO', 'num_registro');
  const feTipoConta = await MappingService.getColumnFromTable('TAB_FLUXO_EVENTO', 'tipo_conta');
  const feTipoParceiro = await MappingService.getColumnFromTable('TAB_FLUXO_EVENTO', 'tipo_parceiro');
  const feCodParceiro = await MappingService.getColumnFromTable('TAB_FLUXO_EVENTO', 'cod_parceiro');
  const feCodLoja = await MappingService.getColumnFromTable('TAB_FLUXO_EVENTO', 'cod_loja');
  const feCodEvento = await MappingService.getColumnFromTable('TAB_FLUXO_EVENTO', 'cod_evento');
  const feValEvento = await MappingService.getColumnFromTable('TAB_FLUXO_EVENTO', 'val_evento');

  // Colunas TAB_EVENTO_FINANCEIRO
  const efCodEvento = await MappingService.getColumnFromTable('TAB_EVENTO_FINANCEIRO', 'cod_evento');
  const efCodCategoriaRec = await MappingService.getColumnFromTable('TAB_EVENTO_FINANCEIRO', 'cod_categoria_rec');
  const efCodSubcategoriaRec = await MappingService.getColumnFromTable('TAB_EVENTO_FINANCEIRO', 'cod_subcategoria_rec');
  const efCodCategoriaPag = await MappingService.getColumnFromTable('TAB_EVENTO_FINANCEIRO', 'cod_categoria_pag');
  const efCodSubcategoriaPag = await MappingService.getColumnFromTable('TAB_EVENTO_FINANCEIRO', 'cod_subcategoria_pag');

  // Colunas TAB_MOV_BCO
  const mbCodLoja = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_loja');
  const mbDtaEntrada = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'dta_entrada');
  const mbDtaQuitada = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'dta_quitada');
  const mbValDocto = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'val_docto');
  const mbTipoOperacao = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'tipo_operacao');
  const mbTipoSituacao = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'tipo_situacao');
  const mbFlgEstorno = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'flg_estorno');
  const mbCodCategoria = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_categoria');
  const mbCodSubcategoria = await MappingService.getColumnFromTable('TAB_MOV_BCO', 'cod_subcategoria');

  // Colunas TAB_ENTIDADE
  const entCodEntidade = await MappingService.getColumnFromTable('TAB_ENTIDADE', 'cod_entidade');
  const entDesEntidade = await MappingService.getColumnFromTable('TAB_ENTIDADE', 'des_entidade');

  // Colunas TAB_NF
  const nfNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
  const nfSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
  const nfCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');

  // Colunas TAB_NF_ITEM
  const niNumNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
  const niSerieNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
  const niCodParceiro = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
  const niCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');
  const niQtdEntrada = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'quantidade_entrada');
  const niValCusto = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_custo');
  const niValTotal = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');

  // Colunas TAB_PRODUTO
  const prCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
  const prDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');

  return {
    // Tabelas
    tabCategoria, tabSubcategoria, tabOrcamento, tabFluxo, tabFluxoEvento,
    tabEventoFinanceiro, tabMovBco, tabEntidade, tabNf, tabNfItem, tabProduto,
    // Colunas TAB_CATEGORIA
    catCodCategoria, catDesCategoria, catTipoCategoria, catNumOrdem, catTipoFluxo, catFlgInativo,
    // Colunas TAB_SUBCATEGORIA
    subCodCategoria, subCodSubcategoria, subDesSubcategoria, subNumOrdem, subFlgIgnoraOrcto, subFlgInativo,
    // Colunas TAB_ORCAMENTO_GERENCIAL
    orcDtaMensal, orcCodLoja, orcCodCategoria, orcCodSubcategoria,
    orcValPrevisao, orcValAberto, orcValQuitado, orcValRealizado,
    // Colunas TAB_FLUXO
    flxNumRegistro, flxCodLoja, flxTipoConta, flxTipoParceiro, flxCodParceiro, flxDesParceiro,
    flxNumDocto, flxNumNf, flxNumSerieNf, flxValParcela, flxNumParcela, flxQtdParcela,
    flxFlgQuitado, flxDtaVencimento, flxDtaEntrada, flxDtaQuitada, flxDtaEmissao,
    flxCodEntidade, flxCodCategoria, flxCodSubcategoria, flxDesObservacao,
    // Colunas TAB_FLUXO_EVENTO
    feNumRegistro, feTipoConta, feTipoParceiro, feCodParceiro, feCodLoja, feCodEvento, feValEvento,
    // Colunas TAB_EVENTO_FINANCEIRO
    efCodEvento, efCodCategoriaRec, efCodSubcategoriaRec, efCodCategoriaPag, efCodSubcategoriaPag,
    // Colunas TAB_MOV_BCO
    mbCodLoja, mbDtaEntrada, mbDtaQuitada, mbValDocto, mbTipoOperacao, mbTipoSituacao,
    mbFlgEstorno, mbCodCategoria, mbCodSubcategoria,
    // Colunas TAB_ENTIDADE
    entCodEntidade, entDesEntidade,
    // Colunas TAB_NF
    nfNumNf, nfSerieNf, nfCodParceiro,
    // Colunas TAB_NF_ITEM
    niNumNf, niSerieNf, niCodParceiro, niCodItem, niQtdEntrada, niValCusto, niValTotal,
    // Colunas TAB_PRODUTO
    prCodProduto, prDesProduto,
  };
}

export class DemonstrativoCaixaService {

  /**
   * Busca dados completos do demonstrativo: categorias + subcategorias + metas + valores reais
   */
  static async getDados(filters: DemonstrativoFilters): Promise<any> {
    const m = await resolveMapping();

    // Determina período
    const hoje = new Date();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    const anoAtual = String(hoje.getFullYear());
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    // Defaults: dia 01 do mês até ontem
    const dataInicio = filters.dataInicio || `${anoAtual}-${mesAtual}-01`;
    const dataFim = filters.dataFim || `${anoAtual}-${mesAtual}-${String(Math.max(1, hoje.getDate() - 1)).padStart(2, '0')}`;

    // Derivar lista de meses para query de metas (agrega todos os meses do período)
    const partsInicio = dataInicio.split('-');
    const partsFim = dataFim.split('-');
    const mes = partsInicio[1];
    const ano = partsInicio[0];

    // Gerar todos os meses entre dataInicio e dataFim para TAB_ORCAMENTO_GERENCIAL
    const mesesPeriodo: string[] = [];
    const startYear = Number(partsInicio[0]);
    const startMonth = Number(partsInicio[1]);
    const endYear = Number(partsFim[0]);
    const endMonth = Number(partsFim[1]);
    let curYear = startYear;
    let curMonth = startMonth;
    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
      mesesPeriodo.push(`${String(curMonth).padStart(2, '0')}${curYear}`);
      curMonth++;
      if (curMonth > 12) { curMonth = 1; curYear++; }
    }

    // 1. Buscar categorias ativas ordenadas
    const categorias = await OracleService.query<any>(`
      SELECT ${m.catCodCategoria} as COD_CATEGORIA, ${m.catDesCategoria} as DES_CATEGORIA,
             ${m.catTipoCategoria} as TIPO_CATEGORIA, ${m.catNumOrdem} as NUM_ORDEM,
             ${m.catTipoFluxo} as TIPO_FLUXO
      FROM ${m.tabCategoria}
      WHERE NVL(${m.catFlgInativo}, 'N') = 'N'
      ORDER BY ${m.catNumOrdem}
    `);

    // 2. Buscar subcategorias ativas
    const subcategorias = await OracleService.query<any>(`
      SELECT ${m.subCodCategoria} as COD_CATEGORIA, ${m.subCodSubcategoria} as COD_SUBCATEGORIA,
             ${m.subDesSubcategoria} as DES_SUBCATEGORIA, ${m.subNumOrdem} as NUM_ORDEM,
             NVL(${m.subFlgIgnoraOrcto}, 'N') as FLG_IGNORA_ORCTO
      FROM ${m.tabSubcategoria}
      WHERE NVL(${m.subFlgInativo}, 'N') = 'N'
        AND ${m.subDesSubcategoria} NOT LIKE '##%'
        AND ${m.subDesSubcategoria} NOT LIKE '###%'
        AND ${m.subDesSubcategoria} NOT LIKE '####%'
        AND ${m.subDesSubcategoria} NOT LIKE '*%'
      ORDER BY ${m.subCodCategoria}, ${m.subNumOrdem}, ${m.subCodSubcategoria}
    `);

    // 3. Buscar metas do TAB_ORCAMENTO_GERENCIAL (todos os meses do período)
    const paramsMeta: any = {};
    const mesesBinds = mesesPeriodo.map((mes, i) => {
      paramsMeta[`m${i}`] = mes;
      return `:m${i}`;
    });
    let whereMeta = `WHERE og.${m.orcDtaMensal} IN (${mesesBinds.join(',')})`;
    if (filters.codLoja) {
      whereMeta += ` AND og.${m.orcCodLoja} = :codLoja`;
      paramsMeta.codLoja = Number(filters.codLoja);
    }

    const metas = await OracleService.query<any>(`
      SELECT og.${m.orcCodCategoria} as COD_CATEGORIA, og.${m.orcCodSubcategoria} as COD_SUBCATEGORIA,
             SUM(og.${m.orcValPrevisao}) as META,
             SUM(og.${m.orcValAberto}) as ORC_ABERTO,
             SUM(og.${m.orcValQuitado}) as ORC_QUITADO,
             SUM(og.${m.orcValRealizado}) as ORC_REALIZADO
      FROM ${m.tabOrcamento} og
      ${whereMeta}
      GROUP BY og.${m.orcCodCategoria}, og.${m.orcCodSubcategoria}
    `, paramsMeta);

    // 4. Buscar valores reais do TAB_FLUXO
    // Regime Caixa: abertos por DTA_VENCIMENTO, quitados por DTA_QUITADA (quando o dinheiro efetivamente entrou/saiu)
    // Regime Competência: todos por DTA_ENTRADA
    const paramsFluxo: any = { dataInicio, dataFim };
    let whereFluxo: string;
    if (filters.regime === 'competencia') {
      whereFluxo = `WHERE f.${m.flxDtaEntrada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND f.${m.flxDtaEntrada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
    } else {
      // Regime Caixa (híbrido): abertos por vencimento, quitados por data de quitação
      whereFluxo = `WHERE (
        (f.${m.flxFlgQuitado} = 'N' AND f.${m.flxDtaVencimento} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.${m.flxDtaVencimento} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        OR
        (f.${m.flxFlgQuitado} = 'S' AND f.${m.flxDtaQuitada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.${m.flxDtaQuitada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
      )`;
    }
    if (filters.codLoja) {
      whereFluxo += ` AND f.${m.flxCodLoja} = :codLoja`;
      paramsFluxo.codLoja = Number(filters.codLoja);
    }

    const fluxo = await OracleService.query<any>(`
      SELECT f.${m.flxCodCategoria} as COD_CATEGORIA, f.${m.flxCodSubcategoria} as COD_SUBCATEGORIA,
             SUM(CASE WHEN f.${m.flxFlgQuitado} = 'N' THEN f.${m.flxValParcela} ELSE 0 END) as VAL_ABERTO,
             SUM(CASE WHEN f.${m.flxFlgQuitado} = 'S' THEN f.${m.flxValParcela} ELSE 0 END) as VAL_QUITADO,
             SUM(f.${m.flxValParcela}) as VAL_REALIZADO,
             COUNT(*) as QTD
      FROM ${m.tabFluxo} f
      ${whereFluxo}
      GROUP BY f.${m.flxCodCategoria}, f.${m.flxCodSubcategoria}
    `, paramsFluxo);

    // 4b. Buscar eventos financeiros (TAB_FLUXO_EVENTO)
    const paramsEvento: any = { dataInicio, dataFim };
    let whereEvento: string;
    if (filters.regime === 'competencia') {
      whereEvento = `f.${m.flxDtaEntrada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND f.${m.flxDtaEntrada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
    } else {
      whereEvento = `(
        (f.${m.flxFlgQuitado} = 'N' AND f.${m.flxDtaVencimento} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.${m.flxDtaVencimento} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        OR
        (f.${m.flxFlgQuitado} = 'S' AND f.${m.flxDtaQuitada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.${m.flxDtaQuitada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
      )`;
    }
    let whereEventoLoja = '';
    if (filters.codLoja) {
      whereEventoLoja = ` AND fe.${m.feCodLoja} = :codLoja`;
      paramsEvento.codLoja = Number(filters.codLoja);
    }

    const eventos = await OracleService.query<any>(`
      SELECT
        CASE WHEN f.${m.flxTipoConta} = 1 THEN ef.${m.efCodCategoriaRec} ELSE ef.${m.efCodCategoriaPag} END as COD_CATEGORIA,
        CASE WHEN f.${m.flxTipoConta} = 1 THEN ef.${m.efCodSubcategoriaRec} ELSE ef.${m.efCodSubcategoriaPag} END as COD_SUBCATEGORIA,
        SUM(CASE WHEN f.${m.flxFlgQuitado} = 'N' THEN fe.${m.feValEvento} ELSE 0 END) as VAL_ABERTO,
        SUM(CASE WHEN f.${m.flxFlgQuitado} = 'S' THEN fe.${m.feValEvento} ELSE 0 END) as VAL_QUITADO,
        SUM(fe.${m.feValEvento}) as VAL_REALIZADO,
        COUNT(*) as QTD
      FROM ${m.tabFluxoEvento} fe
      JOIN ${m.tabFluxo} f ON f.${m.flxNumRegistro} = fe.${m.feNumRegistro}
                            AND f.${m.flxTipoConta} = fe.${m.feTipoConta}
                            AND f.${m.flxTipoParceiro} = fe.${m.feTipoParceiro}
                            AND f.${m.flxCodParceiro} = fe.${m.feCodParceiro}
                            AND f.${m.flxCodLoja} = fe.${m.feCodLoja}
      JOIN ${m.tabEventoFinanceiro} ef ON ef.${m.efCodEvento} = fe.${m.feCodEvento}
      WHERE ${whereEvento}${whereEventoLoja}
      GROUP BY
        CASE WHEN f.${m.flxTipoConta} = 1 THEN ef.${m.efCodCategoriaRec} ELSE ef.${m.efCodCategoriaPag} END,
        CASE WHEN f.${m.flxTipoConta} = 1 THEN ef.${m.efCodSubcategoriaRec} ELSE ef.${m.efCodSubcategoriaPag} END
    `, paramsEvento);

    // 5. Montar mapas para lookup rápido
    const metaMap = new Map<string, any>();
    for (const mt of metas) {
      metaMap.set(`${mt.COD_CATEGORIA}_${mt.COD_SUBCATEGORIA}`, mt);
    }

    const fluxoMap = new Map<string, any>();
    for (const f of fluxo) {
      fluxoMap.set(`${f.COD_CATEGORIA}_${f.COD_SUBCATEGORIA}`, f);
    }

    // Mesclar eventos no fluxoMap (somar aos valores existentes)
    for (const ev of eventos) {
      const key = `${ev.COD_CATEGORIA}_${ev.COD_SUBCATEGORIA}`;
      const existing = fluxoMap.get(key);
      if (existing) {
        existing.VAL_ABERTO = (Number(existing.VAL_ABERTO) || 0) + (Number(ev.VAL_ABERTO) || 0);
        existing.VAL_QUITADO = (Number(existing.VAL_QUITADO) || 0) + (Number(ev.VAL_QUITADO) || 0);
        existing.VAL_REALIZADO = (Number(existing.VAL_REALIZADO) || 0) + (Number(ev.VAL_REALIZADO) || 0);
      } else {
        fluxoMap.set(key, {
          COD_CATEGORIA: ev.COD_CATEGORIA,
          COD_SUBCATEGORIA: ev.COD_SUBCATEGORIA,
          VAL_ABERTO: Number(ev.VAL_ABERTO) || 0,
          VAL_QUITADO: Number(ev.VAL_QUITADO) || 0,
          VAL_REALIZADO: Number(ev.VAL_REALIZADO) || 0,
        });
      }
    }

    // 4c. Buscar movimentações bancárias (TAB_MOV_BCO)
    if (filters.incluirMovBanco !== 'nao') {
      const paramsMovBco: any = { dataInicio, dataFim };
      let whereMovBco: string;
      if (filters.regime === 'competencia') {
        whereMovBco = `WHERE m.${m.mbDtaEntrada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
          AND m.${m.mbDtaEntrada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
      } else {
        whereMovBco = `WHERE (
          (m.${m.mbTipoSituacao} = 0 AND m.${m.mbDtaEntrada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND m.${m.mbDtaEntrada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
          OR
          (m.${m.mbTipoSituacao} = 1 AND NVL(m.${m.mbDtaQuitada}, m.${m.mbDtaEntrada}) >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND NVL(m.${m.mbDtaQuitada}, m.${m.mbDtaEntrada}) <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        )`;
      }
      if (filters.codLoja) {
        whereMovBco += ` AND m.${m.mbCodLoja} = :codLoja`;
        paramsMovBco.codLoja = Number(filters.codLoja);
      }
      whereMovBco += ` AND m.${m.mbFlgEstorno} = 'N' AND m.${m.mbCodCategoria} IS NOT NULL`;

      const movBco = await OracleService.query<any>(`
        SELECT m.${m.mbCodCategoria} as COD_CATEGORIA, m.${m.mbCodSubcategoria} as COD_SUBCATEGORIA,
               SUM(CASE WHEN m.${m.mbTipoSituacao} = 0 THEN m.${m.mbValDocto} ELSE 0 END) as VAL_ABERTO,
               SUM(CASE WHEN m.${m.mbTipoSituacao} = 1 THEN m.${m.mbValDocto} ELSE 0 END) as VAL_QUITADO,
               SUM(m.${m.mbValDocto}) as VAL_REALIZADO,
               COUNT(*) as QTD
        FROM ${m.tabMovBco} m
        ${whereMovBco}
        GROUP BY m.${m.mbCodCategoria}, m.${m.mbCodSubcategoria}
      `, paramsMovBco);

      // Mesclar movimentações bancárias no fluxoMap
      for (const mb of movBco) {
        if (!mb.COD_CATEGORIA) continue;
        const key = `${mb.COD_CATEGORIA}_${mb.COD_SUBCATEGORIA}`;
        const existing = fluxoMap.get(key);
        if (existing) {
          existing.VAL_ABERTO = (Number(existing.VAL_ABERTO) || 0) + (Number(mb.VAL_ABERTO) || 0);
          existing.VAL_QUITADO = (Number(existing.VAL_QUITADO) || 0) + (Number(mb.VAL_QUITADO) || 0);
          existing.VAL_REALIZADO = (Number(existing.VAL_REALIZADO) || 0) + (Number(mb.VAL_REALIZADO) || 0);
        } else {
          fluxoMap.set(key, {
            COD_CATEGORIA: mb.COD_CATEGORIA,
            COD_SUBCATEGORIA: mb.COD_SUBCATEGORIA,
            VAL_ABERTO: Number(mb.VAL_ABERTO) || 0,
            VAL_QUITADO: Number(mb.VAL_QUITADO) || 0,
            VAL_REALIZADO: Number(mb.VAL_REALIZADO) || 0,
          });
        }
      }
    }

    // 6. Montar estrutura hierárquica
    let totalReceitas = 0;
    let totalDespesas = 0;
    let totalMetaReceitas = 0;
    let totalMetaDespesas = 0;
    let totalAbertoReceitas = 0;
    let totalAbertoDespesas = 0;
    let totalQuitadoReceitas = 0;
    let totalQuitadoDespesas = 0;

    const resultado = [];

    for (const cat of categorias) {
      // Filtro por tab (tipoFluxo)
      if (filters.tipoFluxo && filters.tipoFluxo !== '') {
        if (cat.TIPO_FLUXO !== Number(filters.tipoFluxo)) continue;
      } else {
        // Tab Geral: excluir apenas "TRANSFERENCIA ENTRE CONTAS"
        const nomeUpper = (cat.DES_CATEGORIA || '').trim().toUpperCase();
        if (nomeUpper.includes('TRANSFERENCIA ENTRE CONTAS') || nomeUpper.includes('TRANSFERÊNCIA ENTRE CONTAS')) continue;
      }

      const subs = subcategorias.filter((s: any) => s.COD_CATEGORIA === cat.COD_CATEGORIA);
      let catMeta = 0;
      let catAberto = 0;
      let catQuitado = 0;
      let catRealizado = 0;

      const subsResult = [];

      for (const sub of subs) {
        const key = `${sub.COD_CATEGORIA}_${sub.COD_SUBCATEGORIA}`;
        const meta = metaMap.get(key);
        const flux = fluxoMap.get(key);

        const subMeta = meta ? Number(meta.META) || 0 : 0;
        const subAberto = flux ? Number(flux.VAL_ABERTO) || 0 : 0;
        const subQuitado = flux ? Number(flux.VAL_QUITADO) || 0 : 0;
        const subRealizado = flux ? Number(flux.VAL_REALIZADO) || 0 : 0;

        // Pula subcategorias sem movimento e sem meta
        if (subMeta === 0 && subRealizado === 0) continue;

        catMeta += subMeta;
        catAberto += subAberto;
        catQuitado += subQuitado;
        catRealizado += subRealizado;

        subsResult.push({
          COD_SUBCATEGORIA: sub.COD_SUBCATEGORIA,
          DES_SUBCATEGORIA: (sub.DES_SUBCATEGORIA || '').trim(),
          META: subMeta,
          VAL_ABERTO: subAberto,
          VAL_QUITADO: subQuitado,
          VAL_REALIZADO: subRealizado,
          VAL_DIFERENCA: subMeta - subRealizado,
        });
      }

      // Pula categorias sem dados
      if (catRealizado === 0 && catMeta === 0 && subsResult.length === 0) continue;

      // Determina se é receita ou despesa pelo nome da categoria
      const nomeCategoria = (cat.DES_CATEGORIA || '').trim().toUpperCase();
      const isReceita = nomeCategoria.startsWith('RECEITA');
      const isDespesa = !isReceita;

      if (isReceita) {
        totalReceitas += catRealizado;
        totalMetaReceitas += catMeta;
        totalAbertoReceitas += catAberto;
        totalQuitadoReceitas += catQuitado;
      }
      if (isDespesa) {
        totalDespesas += catRealizado;
        totalMetaDespesas += catMeta;
        totalAbertoDespesas += catAberto;
        totalQuitadoDespesas += catQuitado;
      }

      resultado.push({
        COD_CATEGORIA: cat.COD_CATEGORIA,
        DES_CATEGORIA: (cat.DES_CATEGORIA || '').trim(),
        NUM_ORDEM: cat.NUM_ORDEM,
        TIPO_CATEGORIA: cat.TIPO_CATEGORIA,
        TIPO_FLUXO: cat.TIPO_FLUXO,
        IS_RECEITA: isReceita,
        IS_DESPESA: isDespesa,
        META: catMeta,
        VAL_ABERTO: catAberto,
        VAL_QUITADO: catQuitado,
        VAL_REALIZADO: catRealizado,
        VAL_DIFERENCA: catMeta - catRealizado,
        subcategorias: subsResult,
      });
    }

    return {
      success: true,
      categorias: resultado,
      totais: {
        totalReceitas,
        totalDespesas,
        totalMetaReceitas,
        totalMetaDespesas,
        totalAbertoReceitas,
        totalAbertoDespesas,
        totalQuitadoReceitas,
        totalQuitadoDespesas,
        saldo: totalReceitas - totalDespesas,
      },
      filtros: {
        dataInicio,
        dataFim,
        mes,
        ano,
        regime: filters.regime || 'caixa',
      }
    };
  }

  /**
   * Lista categorias disponíveis
   */
  static async getCategorias(): Promise<any[]> {
    const m = await resolveMapping();
    return OracleService.query(`
      SELECT ${m.catCodCategoria} as COD_CATEGORIA, ${m.catDesCategoria} as DES_CATEGORIA,
             ${m.catTipoCategoria} as TIPO_CATEGORIA, ${m.catNumOrdem} as NUM_ORDEM,
             ${m.catTipoFluxo} as TIPO_FLUXO
      FROM ${m.tabCategoria}
      WHERE NVL(${m.catFlgInativo}, 'N') = 'N'
      ORDER BY ${m.catNumOrdem}
    `);
  }

  /**
   * Busca títulos individuais (detalhamento) de uma categoria/subcategoria
   */
  static async getTitulos(filters: {
    codCategoria: number;
    codSubcategoria?: number;
    dataInicio: string;
    dataFim: string;
    codLoja?: string;
    regime?: string;
    status?: string; // 'aberto', 'quitado', 'todos'
  }): Promise<any> {
    const m = await resolveMapping();
    const params: any = {
      codCategoria: filters.codCategoria,
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
    };

    // Mesma lógica híbrida: Regime Caixa usa DTA_VENCIMENTO para abertos e DTA_QUITADA para quitados
    let whereDate: string;
    let orderDate: string;
    if (filters.regime === 'competencia') {
      whereDate = `f.${m.flxDtaEntrada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.${m.flxDtaEntrada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
      orderDate = `f.${m.flxDtaEntrada}`;
    } else {
      whereDate = `(
        (f.${m.flxFlgQuitado} = 'N' AND f.${m.flxDtaVencimento} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.${m.flxDtaVencimento} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        OR
        (f.${m.flxFlgQuitado} = 'S' AND f.${m.flxDtaQuitada} >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.${m.flxDtaQuitada} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
      )`;
      orderDate = `NVL(f.${m.flxDtaQuitada}, f.${m.flxDtaVencimento})`;
    }

    let where = `WHERE f.${m.flxCodCategoria} = :codCategoria AND ${whereDate}`;

    if (filters.codSubcategoria != null) {
      where += ` AND f.${m.flxCodSubcategoria} = :codSubcategoria`;
      params.codSubcategoria = filters.codSubcategoria;
    }
    if (filters.codLoja) {
      where += ` AND f.${m.flxCodLoja} = :codLoja`;
      params.codLoja = Number(filters.codLoja);
    }
    if (filters.status === 'aberto') {
      where += ` AND f.${m.flxFlgQuitado} = 'N'`;
    } else if (filters.status === 'quitado') {
      where += ` AND f.${m.flxFlgQuitado} = 'S'`;
    }

    const titulos = await OracleService.query<any>(`
      SELECT f.${m.flxNumRegistro} as NUM_REGISTRO, f.${m.flxFlgQuitado} as FLG_QUITADO,
             f.${m.flxCodLoja} as COD_LOJA, f.${m.flxTipoConta} as TIPO_CONTA,
             f.${m.flxDesParceiro} as DES_PARCEIRO, f.${m.flxNumDocto} as NUM_DOCTO,
             f.${m.flxNumNf} as NUM_NF, f.${m.flxNumSerieNf} as NUM_SERIE_NF,
             f.${m.flxCodParceiro} as COD_PARCEIRO, f.${m.flxValParcela} as VAL_PARCELA,
             f.${m.flxNumParcela} as NUM_PARCELA, f.${m.flxQtdParcela} as QTD_PARCELA,
             f.${m.flxDtaVencimento} as DTA_VENCIMENTO, f.${m.flxDtaEntrada} as DTA_ENTRADA,
             f.${m.flxDtaQuitada} as DTA_QUITADA, f.${m.flxDtaEmissao} as DTA_EMISSAO,
             f.${m.flxCodEntidade} as COD_ENTIDADE, f.${m.flxCodCategoria} as COD_CATEGORIA,
             f.${m.flxCodSubcategoria} as COD_SUBCATEGORIA,
             f.${m.flxDesObservacao} as DES_OBSERVACAO,
             e.${m.entDesEntidade} as DES_ENTIDADE
      FROM ${m.tabFluxo} f
      LEFT JOIN ${m.tabEntidade} e ON e.${m.entCodEntidade} = f.${m.flxCodEntidade}
      ${where}
      ORDER BY ${orderDate} DESC, f.${m.flxNumRegistro} DESC
    `, params);

    // Calcular totais
    let totalAberto = 0;
    let totalQuitado = 0;
    for (const t of titulos) {
      if (t.FLG_QUITADO === 'S') {
        totalQuitado += Number(t.VAL_PARCELA) || 0;
      } else {
        totalAberto += Number(t.VAL_PARCELA) || 0;
      }
    }

    return {
      success: true,
      titulos,
      totais: {
        totalAberto,
        totalQuitado,
        totalGeral: totalAberto + totalQuitado,
        qtdTitulos: titulos.length,
      }
    };
  }

  /**
   * Busca itens da NF associada a um título
   */
  static async getItensNF(filters: {
    numNf: string;
    numSerieNf: string;
    codParceiro: number;
  }): Promise<any> {
    const m = await resolveMapping();

    const itens = await OracleService.query<any>(`
      SELECT ni.${m.niCodItem} as COD_ITEM, p.${m.prDesProduto} as DES_PRODUTO,
             ni.${m.niQtdEntrada} as QTD_TOTAL, ni.${m.niValCusto} as VAL_CUSTO,
             ni.${m.niValTotal} as VAL_TOTAL_ITEM
      FROM ${m.tabNf} nf
      JOIN ${m.tabNfItem} ni ON nf.${m.nfNumNf} = ni.${m.niNumNf}
                              AND nf.${m.nfSerieNf} = ni.${m.niSerieNf}
                              AND nf.${m.nfCodParceiro} = ni.${m.niCodParceiro}
      LEFT JOIN ${m.tabProduto} p ON ni.${m.niCodItem} = p.${m.prCodProduto}
      WHERE nf.${m.nfNumNf} = :numNf
        AND nf.${m.nfSerieNf} = :numSerieNf
        AND nf.${m.nfCodParceiro} = :codParceiro
      ORDER BY ni.${m.niCodItem}
    `, {
      numNf: filters.numNf,
      numSerieNf: filters.numSerieNf,
      codParceiro: filters.codParceiro,
    });

    return {
      success: true,
      itens,
      totalItens: itens.length,
    };
  }

  private static getMesAnoAtual(): string {
    const now = new Date();
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const ano = String(now.getFullYear());
    return `${mes}${ano}`;
  }
}
