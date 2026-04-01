import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

export interface TributacaoItem {
  cod_produto: string;
  des_produto: string;
  cod_secao: number;
  des_secao: string;
  cod_grupo: number;
  des_grupo: string;
  cod_sub_grupo: number;
  des_sub_grupo: string;
  cod_segmento: number;
  des_segmento: string;
  ncm: string;
  ncm_completo: string;
  beneficio_fiscal: string;
  des_beneficio: string;
  des_tributacao: string;
  cst_icms: string;
  cod_tributacao: number;
  cod_trib_entrada: number;
  per_icms_entrada: number;
  per_icms_saida: number;
  per_aliq_outorg: number;
  per_reducao_bc: number;
  per_pis_entrada: number;
  per_pis_saida: number;
  per_cofins_entrada: number;
  per_cofins_saida: number;
  cst_pis_cof_entrada: string;
  cst_pis_cof_saida: string;
  flg_nao_icms: string;
  flg_nao_pis_cofins: string;
  val_venda: number;
  val_custo_rep: number;
  markdown_pct: number;
  mg_liquida_pct: number;
  cod_fornecedor: number;
  des_fornecedor: string;
  status: 'OK' | 'ATENCAO' | 'ALERTA';
  motivo: string;
}

export interface TributacaoFilters {
  codLoja?: number;
  codSecao?: number;
  codGrupo?: number;
  codSubGrupo?: number;
  codSegmento?: number;
  statusFilter?: 'TODOS' | 'OK' | 'ATENCAO' | 'ALERTA' | 'DIVERGENTES';
  uf?: string;
}

function classifyTax(
  perIcmsEntrada: number,
  perIcmsSaida: number,
  perAliqOutorg: number,
  flgNaoIcms: string
): { status: 'OK' | 'ATENCAO' | 'ALERTA'; motivo: string } {
  if (flgNaoIcms === 'S' || (perIcmsEntrada === 0 && perIcmsSaida === 0)) {
    return { status: 'OK', motivo: '' };
  }

  if (Math.abs(perIcmsEntrada - perIcmsSaida) < 0.01) {
    return { status: 'OK', motivo: '' };
  }

  if (perIcmsEntrada === 0 && perIcmsSaida > 0) {
    return { status: 'ALERTA', motivo: `Entrada 0% e saída ${perIcmsSaida}% — sem crédito de ICMS` };
  }

  if (perIcmsEntrada > 0 && perIcmsSaida === 0) {
    return { status: 'ATENCAO', motivo: `Entrada ${perIcmsEntrada}% e saída isenta/0%` };
  }

  if (perIcmsEntrada !== perIcmsSaida) {
    if (perAliqOutorg > 0 && Math.abs(perAliqOutorg - perIcmsSaida) < 0.01) {
      return { status: 'OK', motivo: `Redução BC aplicada — outorgado ${perAliqOutorg}%` };
    }
    const reductions = [1/3, 0.2, 0.25, 0.4, 0.5];
    for (const r of reductions) {
      const effective = Math.round(perIcmsEntrada * (1 - r) * 100) / 100;
      if (Math.abs(effective - perIcmsSaida) < 0.5) {
        return { status: 'OK', motivo: `Redução de BC de ${Math.round(r * 100)}% — ${perIcmsEntrada}% → ${perIcmsSaida}%` };
      }
    }
    if (perIcmsEntrada < perIcmsSaida) {
      return { status: 'ALERTA', motivo: `Entrada ${perIcmsEntrada}% < Saída ${perIcmsSaida}% — débito maior que crédito` };
    }
    return { status: 'ATENCAO', motivo: `Entrada ${perIcmsEntrada}% ≠ Saída ${perIcmsSaida}% sem redução de BC cadastrada` };
  }

  return { status: 'OK', motivo: '' };
}

export class TributacaoService {
  static async getProdutosTributacao(filters: TributacaoFilters): Promise<TributacaoItem[]> {
    const schema       = await MappingService.getSchema();
    const tabProduto   = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdLoja  = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabSecao     = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabGrupo     = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubgrupo  = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    let   tabSegmento  = `${schema}.TAB_SEGMENTO`;
    try { tabSegmento  = `${schema}.${await MappingService.getRealTableName('TAB_SEGMENTO')}`; } catch {}
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabNcm = `${schema}.TAB_NCM`;
    const tabNcmUf = `${schema}.TAB_NCM_UF`;
    const tabBenefFiscal = `${schema}.TAB_BENEFICIO_FISCAL`;
    const tabTributacao = `${schema}.TAB_TRIBUTACAO`;
    const colFornCodigo = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
    const colFornFantasia = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'nome_fantasia');
    const colFornUltCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra');

    // ── TAB_PRODUTO ──────────────────────────────────────────────────────────
    const colCodProd        = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProd        = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecao       = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupo       = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubGrupo    = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colCodSegmento    = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_segmento');
    const colStatusProd     = await MappingService.getColumnFromTable('TAB_PRODUTO', 'status_produto');
    const colCodNbm         = await MappingService.getColumnFromTable('TAB_PRODUTO', 'cod_nbm');
    const colCstPisCofEnt   = await MappingService.getColumnFromTable('TAB_PRODUTO', 'cst_pis_cofins_entrada');
    const colCstPisCofSai   = await MappingService.getColumnFromTable('TAB_PRODUTO', 'cst_pis_cofins_saida');
    const colFlgNaoIcms     = await MappingService.getColumnFromTable('TAB_PRODUTO', 'flag_nao_icms');
    const colFlgNaoPisCof   = await MappingService.getColumnFromTable('TAB_PRODUTO', 'flag_nao_pis_cofins');

    // ── TAB_SECAO / TAB_GRUPO / TAB_SUBGRUPO ─────────────────────────────────
    const colDesSecao       = await MappingService.getColumnFromTable('TAB_SECAO',    'descricao_secao');
    const colCodSecaoSec    = await MappingService.getColumnFromTable('TAB_SECAO',    'codigo_secao');
    const colDesGrupo       = await MappingService.getColumnFromTable('TAB_GRUPO',    'descricao_grupo');
    const colCodGrupoGrp    = await MappingService.getColumnFromTable('TAB_GRUPO',    'codigo_grupo');
    const colCodSecaoGrp    = await MappingService.getColumnFromTable('TAB_SECAO',    'codigo_secao');
    const colDesSubGrupo    = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    const colCodSubGrupoSg  = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colCodGrupoSg     = await MappingService.getColumnFromTable('TAB_GRUPO',    'codigo_grupo');
    const colCodSecaoSg     = await MappingService.getColumnFromTable('TAB_SECAO',    'codigo_secao');

    // ── TAB_PRODUTO_LOJA ─────────────────────────────────────────────────────
    const colCodProdLoja    = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const colCodLojaLoja    = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const colCodNcm         = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_ncm');
    const colCodTribSai     = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_tributacao_saida');
    const colCodTribEnt     = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_tributacao_entrada');
    const colPerIcmsEnt     = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'icms_aliquota_entrada');
    const colPerIcmsSai     = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'icms_aliquota_saida');
    const colPerAliqOut     = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'icms_aliq_outorgada');
    const colPerPisEnt      = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pis_aliquota_entrada');
    const colPerPisSai      = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pis_aliquota_saida');
    const colPerCofEnt      = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cofins_aliquota_entrada');
    const colPerCofSai      = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cofins_aliquota_saida');
    const colValImpIcms     = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'valor_imposto_icms');
    const colValImpPis      = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'valor_imposto_pis');
    const colValImpCofins   = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'valor_imposto_cofins');
    const colValImpCred     = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'valor_imposto_credito_loja');
    const colValVenda       = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const colValCusto       = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');

    const params: any = { codLoja: filters.codLoja || 1, uf: filters.uf || 'SP' };

    let whereExtra = '';
    if (filters.codSecao)    { whereExtra += ` AND p.${colCodSecao} = :codSecao`;       params.codSecao    = filters.codSecao;    }
    if (filters.codGrupo)    { whereExtra += ` AND p.${colCodGrupo} = :codGrupo`;       params.codGrupo    = filters.codGrupo;    }
    if (filters.codSubGrupo) { whereExtra += ` AND p.${colCodSubGrupo} = :codSubGrupo`; params.codSubGrupo = filters.codSubGrupo; }
    if (filters.codSegmento) { whereExtra += ` AND p.${colCodSegmento} = :codSegmento`; params.codSegmento = filters.codSegmento; }

    const sql = `
      SELECT
        p.${colCodProd}                                   AS COD_PRODUTO,
        p.${colDesProd}                                   AS DES_PRODUTO,
        p.${colCodSecao}                                  AS COD_SECAO,
        sec.${colDesSecao}                                AS DES_SECAO,
        p.${colCodGrupo}                                  AS COD_GRUPO,
        grp.${colDesGrupo}                                AS DES_GRUPO,
        p.${colCodSubGrupo}                               AS COD_SUB_GRUPO,
        sg.${colDesSubGrupo}                              AS DES_SUB_GRUPO,
        p.${colCodSegmento}                               AS COD_SEGMENTO,
        seg.DES_SEGMENTO,
        NVL(TO_CHAR(pl.${colCodNcm}), p.${colCodNbm})   AS NCM,
        NVL(pl.${colCodTribSai}, 0)                      AS COD_TRIBUTACAO,
        NVL(pl.${colCodTribEnt}, 0)                      AS COD_TRIB_ENTRADA,
        NVL(pl.${colPerIcmsEnt}, 0)                      AS PER_ICMS_ENTRADA,
        NVL(pl.${colPerIcmsSai}, 0)                      AS PER_ICMS_SAIDA,
        NVL(pl.${colPerAliqOut}, 0)                      AS PER_ALIQ_OUTORG,
        CASE
          WHEN NVL(pl.${colPerIcmsEnt}, 0) > 0 AND NVL(pl.${colPerAliqOut}, 0) > 0
            THEN ROUND((1 - pl.${colPerAliqOut} / pl.${colPerIcmsEnt}) * 100, 2)
          ELSE 0
        END                                               AS PER_REDUCAO_BC,
        NVL(pl.${colPerPisEnt}, 0)                       AS PER_PIS_ENTRADA,
        NVL(pl.${colPerPisSai}, 0)                       AS PER_PIS_SAIDA,
        NVL(pl.${colPerCofEnt}, 0)                       AS PER_COFINS_ENTRADA,
        NVL(pl.${colPerCofSai}, 0)                       AS PER_COFINS_SAIDA,
        NVL(p.${colCstPisCofEnt}, '')                    AS CST_PIS_COF_ENTRADA,
        NVL(p.${colCstPisCofSai}, '')                    AS CST_PIS_COF_SAIDA,
        NVL(p.${colFlgNaoIcms}, 'N')                     AS FLG_NAO_ICMS,
        NVL(p.${colFlgNaoPisCof}, 'N')                   AS FLG_NAO_PIS_COFINS,
        NVL(pl.${colValVenda}, 0)                        AS VAL_VENDA,
        NVL(pl.${colValCusto}, 0)                        AS VAL_CUSTO_REP,
        CASE WHEN NVL(pl.${colValVenda}, 0) > 0
          THEN ROUND((NVL(pl.${colValVenda},0) - NVL(pl.${colValCusto},0)) / pl.${colValVenda} * 100, 2)
          ELSE 0 END                                      AS MARKDOWN_PCT,
        CASE WHEN NVL(pl.${colValVenda}, 0) > 0
          THEN ROUND(
            (NVL(pl.${colValVenda},0)
              - NVL(pl.${colValCusto},0)
              - (NVL(pl.${colValImpIcms},0) + NVL(pl.${colValImpPis},0) + NVL(pl.${colValImpCofins},0))
              + NVL(pl.${colValImpCred},0)
            ) / pl.${colValVenda} * 100, 2)
          ELSE 0 END                                      AS MG_LIQUIDA_PCT,
        NVL(pl.${colFornUltCompra}, 0)                    AS COD_FORNECEDOR,
        NVL(forn.${colFornFantasia}, '')                  AS DES_FORNECEDOR,
        ncm_tab.NUM_NCM                                   AS NCM_COMPLETO,
        bf.NUM_BENEFICIO_FISCAL                            AS BENEFICIO_FISCAL,
        bf.DES_BENEFICIO                                   AS DES_BENEFICIO,
        trib.DES_TRIBUTACAO                                AS DES_TRIBUTACAO,
        trib.COD_SIT_TRIBUTARIA                            AS CST_ICMS
      FROM ${tabProduto} p
      JOIN ${tabProdLoja} pl
        ON pl.${colCodProdLoja} = p.${colCodProd}
        AND pl.${colCodLojaLoja} = :codLoja
      LEFT JOIN ${tabFornecedor} forn ON forn.${colFornCodigo} = pl.${colFornUltCompra}
      LEFT JOIN ${tabNcm} ncm_tab ON ncm_tab.COD_NCM = pl.${colCodNcm}
      LEFT JOIN ${tabNcmUf} ncm_uf ON ncm_uf.COD_NCM = pl.${colCodNcm} AND ncm_uf.DES_SIGLA = :uf
      LEFT JOIN ${tabBenefFiscal} bf ON bf.COD_BENEFICIO_FISCAL = ncm_uf.COD_BENEFICIO_FISCAL
      LEFT JOIN ${tabTributacao} trib ON trib.COD_TRIBUTACAO = pl.${colCodTribSai}
      LEFT JOIN ${tabSecao}    sec ON sec.${colCodSecaoSec}  = p.${colCodSecao}
      LEFT JOIN ${tabGrupo}    grp ON grp.${colCodGrupoGrp}  = p.${colCodGrupo}   AND grp.${colCodSecaoGrp} = p.${colCodSecao}
      LEFT JOIN ${tabSubgrupo} sg  ON sg.${colCodSubGrupoSg} = p.${colCodSubGrupo} AND sg.${colCodGrupoSg}  = p.${colCodGrupo} AND sg.${colCodSecaoSg} = p.${colCodSecao}
      LEFT JOIN ${tabSegmento} seg ON seg.COD_SEGMENTO = p.${colCodSegmento}
      WHERE p.${colStatusProd} = 0
        AND TRIM(p.${colDesProd}) IS NOT NULL
        AND NVL(pl.INATIVO, 'N') = 'N'
        ${whereExtra}
      ORDER BY sec.${colDesSecao}, grp.${colDesGrupo}, sg.${colDesSubGrupo}, p.${colDesProd}
    `;

    const rows = await OracleService.query<any>(sql, params);

    const items: TributacaoItem[] = rows.map((r: any) => {
      const perIcmsEntrada = parseFloat(r.PER_ICMS_ENTRADA) || 0;
      const perIcmsSaida   = parseFloat(r.PER_ICMS_SAIDA)   || 0;
      const perAliqOutorg  = parseFloat(r.PER_ALIQ_OUTORG)  || 0;
      const flgNaoIcms     = r.FLG_NAO_ICMS || 'N';

      const { status, motivo } = classifyTax(perIcmsEntrada, perIcmsSaida, perAliqOutorg, flgNaoIcms);

      return {
        cod_produto:        r.COD_PRODUTO,
        des_produto:        r.DES_PRODUTO || '',
        cod_secao:          r.COD_SECAO,
        des_secao:          r.DES_SECAO       || '',
        cod_grupo:          r.COD_GRUPO,
        des_grupo:          r.DES_GRUPO        || '',
        cod_sub_grupo:      r.COD_SUB_GRUPO,
        des_sub_grupo:      r.DES_SUB_GRUPO   || '',
        cod_segmento:       r.COD_SEGMENTO,
        des_segmento:       r.DES_SEGMENTO    || '',
        ncm:                r.NCM             || '',
        ncm_completo:       r.NCM_COMPLETO    || '',
        beneficio_fiscal:   r.BENEFICIO_FISCAL || '',
        des_beneficio:      r.DES_BENEFICIO   || '',
        des_tributacao:     r.DES_TRIBUTACAO   || '',
        cst_icms:           r.CST_ICMS        || '',
        cod_tributacao:     r.COD_TRIBUTACAO,
        cod_trib_entrada:   r.COD_TRIB_ENTRADA,
        per_icms_entrada:   perIcmsEntrada,
        per_icms_saida:     perIcmsSaida,
        per_aliq_outorg:    perAliqOutorg,
        per_reducao_bc:     parseFloat(r.PER_REDUCAO_BC)    || 0,
        per_pis_entrada:    parseFloat(r.PER_PIS_ENTRADA)   || 0,
        per_pis_saida:      parseFloat(r.PER_PIS_SAIDA)     || 0,
        per_cofins_entrada: parseFloat(r.PER_COFINS_ENTRADA) || 0,
        per_cofins_saida:   parseFloat(r.PER_COFINS_SAIDA)  || 0,
        cst_pis_cof_entrada: (r.CST_PIS_COF_ENTRADA || '').trim(),
        cst_pis_cof_saida:   (r.CST_PIS_COF_SAIDA   || '').trim(),
        flg_nao_icms:       flgNaoIcms,
        flg_nao_pis_cofins: r.FLG_NAO_PIS_COFINS || 'N',
        val_venda:          parseFloat(r.VAL_VENDA)      || 0,
        val_custo_rep:      parseFloat(r.VAL_CUSTO_REP)  || 0,
        markdown_pct:       parseFloat(r.MARKDOWN_PCT)   || 0,
        mg_liquida_pct:     parseFloat(r.MG_LIQUIDA_PCT) || 0,
        cod_fornecedor:     parseInt(r.COD_FORNECEDOR)   || 0,
        des_fornecedor:     r.DES_FORNECEDOR             || '',
        status,
        motivo
      };
    });

    if (!filters.statusFilter || filters.statusFilter === 'TODOS') return items;
    if (filters.statusFilter === 'DIVERGENTES') return items.filter(i => i.status !== 'OK');
    return items.filter(i => i.status === filters.statusFilter);
  }
}
