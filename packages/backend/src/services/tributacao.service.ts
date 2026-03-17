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
}

function classifyTax(
  perIcmsEntrada: number,
  perIcmsSaida: number,
  perAliqOutorg: number,
  flgNaoIcms: string
): { status: 'OK' | 'ATENCAO' | 'ALERTA'; motivo: string } {
  // Produto isento de ICMS em ambas as pontas
  if (flgNaoIcms === 'S' || (perIcmsEntrada === 0 && perIcmsSaida === 0)) {
    return { status: 'OK', motivo: '' };
  }

  const diff = Math.abs(perIcmsEntrada - perIcmsSaida);

  // Taxas iguais
  if (diff < 0.01) {
    return { status: 'OK', motivo: '' };
  }

  // Entrada = 0 mas saída > 0 → está debitando sem creditar → ALERTA
  if (perIcmsEntrada === 0 && perIcmsSaida > 0) {
    return {
      status: 'ALERTA',
      motivo: `Entrada 0% e saída ${perIcmsSaida}% — sem crédito de ICMS`
    };
  }

  // Entrada > 0 e saída = 0 → pode ser isento na saída
  if (perIcmsEntrada > 0 && perIcmsSaida === 0) {
    return {
      status: 'ATENCAO',
      motivo: `Entrada ${perIcmsEntrada}% e saída isenta/0%`
    };
  }

  // Ambos > 0 mas diferentes
  if (perIcmsEntrada !== perIcmsSaida) {
    // Alíquota outorgada explica a diferença? (outorgado ≈ saída)
    if (perAliqOutorg > 0 && Math.abs(perAliqOutorg - perIcmsSaida) < 0.01) {
      return { status: 'OK', motivo: `Redução BC aplicada — outorgado ${perAliqOutorg}%` };
    }
    // Também: se a diferença se justifica por uma redução típica (33,33% ou 20%)
    // ex: 18 * (1 - 1/3) = 12  →  OK com redução de 1/3
    const reductions = [1/3, 0.2, 0.25, 0.4, 0.5];
    for (const r of reductions) {
      const effective = Math.round(perIcmsEntrada * (1 - r) * 100) / 100;
      if (Math.abs(effective - perIcmsSaida) < 0.5) {
        return { status: 'OK', motivo: `Redução de BC de ${Math.round(r * 100)}% — ${perIcmsEntrada}% → ${perIcmsSaida}%` };
      }
    }
    // Entrada < saída → pagando mais imposto do que credita → ALERTA
    if (perIcmsEntrada < perIcmsSaida) {
      return {
        status: 'ALERTA',
        motivo: `Entrada ${perIcmsEntrada}% < Saída ${perIcmsSaida}% — débito maior que crédito`
      };
    }
    // Entrada > saída sem redução justificada → ATENÇÃO
    return {
      status: 'ATENCAO',
      motivo: `Entrada ${perIcmsEntrada}% ≠ Saída ${perIcmsSaida}% sem redução de BC cadastrada`
    };
  }

  return { status: 'OK', motivo: '' };
}

export class TributacaoService {
  static async getProdutosTributacao(filters: TributacaoFilters): Promise<TributacaoItem[]> {
    const schema = await MappingService.getSchema();
    const tabProduto    = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdLoja   = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabSecao      = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabGrupo      = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubgrupo   = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    let tabSegmento     = `${schema}.TAB_SEGMENTO`;
    try { tabSegmento   = `${schema}.${await MappingService.getRealTableName('TAB_SEGMENTO')}`; } catch {}

    const params: any = { codLoja: filters.codLoja || 1 };

    let whereExtra = '';
    if (filters.codSecao)    { whereExtra += ` AND p.COD_SECAO = :codSecao`;       params.codSecao    = filters.codSecao;    }
    if (filters.codGrupo)    { whereExtra += ` AND p.COD_GRUPO = :codGrupo`;       params.codGrupo    = filters.codGrupo;    }
    if (filters.codSubGrupo) { whereExtra += ` AND p.COD_SUB_GRUPO = :codSubGrupo`; params.codSubGrupo = filters.codSubGrupo; }
    if (filters.codSegmento) { whereExtra += ` AND p.COD_SEGMENTO = :codSegmento`; params.codSegmento = filters.codSegmento; }

    const sql = `
      SELECT
        p.COD_PRODUTO,
        p.DES_PRODUTO,
        p.COD_SECAO,
        sec.DES_SECAO,
        p.COD_GRUPO,
        grp.DES_GRUPO,
        p.COD_SUB_GRUPO,
        sg.DES_SUB_GRUPO,
        p.COD_SEGMENTO,
        seg.DES_SEGMENTO,
        NVL(TO_CHAR(pl.COD_NCM), p.COD_NBM) AS NCM,
        NVL(pl.COD_TRIBUTACAO, 0)       AS COD_TRIBUTACAO,
        NVL(pl.COD_TRIB_ENTRADA, 0)     AS COD_TRIB_ENTRADA,
        NVL(pl.PER_ICMS_ENTRADA, 0)     AS PER_ICMS_ENTRADA,
        NVL(pl.PER_ICMS_SAIDA, 0)       AS PER_ICMS_SAIDA,
        NVL(pl.PER_ALIQ_OUTORG, 0)      AS PER_ALIQ_OUTORG,
        CASE
          WHEN NVL(pl.PER_ICMS_ENTRADA, 0) > 0 AND NVL(pl.PER_ALIQ_OUTORG, 0) > 0
            THEN ROUND((1 - pl.PER_ALIQ_OUTORG / pl.PER_ICMS_ENTRADA) * 100, 2)
          ELSE 0
        END                             AS PER_REDUCAO_BC,
        NVL(pl.PER_PIS_ENTRADA, 0)      AS PER_PIS_ENTRADA,
        NVL(pl.PER_PIS, 0)              AS PER_PIS_SAIDA,
        NVL(pl.PER_COFINS_ENTRADA, 0)   AS PER_COFINS_ENTRADA,
        NVL(pl.PER_COFINS, 0)           AS PER_COFINS_SAIDA,
        NVL(p.CST_PIS_COF_ENTRADA, '')  AS CST_PIS_COF_ENTRADA,
        NVL(p.CST_PIS_COF_SAIDA, '')    AS CST_PIS_COF_SAIDA,
        NVL(p.FLG_NAO_ICMS, 'N')        AS FLG_NAO_ICMS,
        NVL(p.FLG_NAO_PIS_COFINS, 'N')  AS FLG_NAO_PIS_COFINS,
        NVL(pl.VAL_VENDA, 0)            AS VAL_VENDA,
        NVL(pl.VAL_CUSTO_REP, 0)        AS VAL_CUSTO_REP,
        CASE WHEN NVL(pl.VAL_VENDA, 0) > 0
          THEN ROUND((NVL(pl.VAL_VENDA,0) - NVL(pl.VAL_CUSTO_REP,0)) / pl.VAL_VENDA * 100, 2)
          ELSE 0 END                    AS MARKDOWN_PCT,
        CASE WHEN NVL(pl.VAL_VENDA, 0) > 0
          THEN ROUND(
            (NVL(pl.VAL_VENDA,0)
              - NVL(pl.VAL_CUSTO_REP,0)
              - (NVL(pl.VAL_IMP_ICMS,0) + NVL(pl.VAL_IMP_PIS,0) + NVL(pl.VAL_IMP_COFINS,0))
              + NVL(pl.VAL_IMPOSTO_CREDITO,0)
            ) / pl.VAL_VENDA * 100, 2)
          ELSE 0 END                    AS MG_LIQUIDA_PCT
      FROM ${tabProduto} p
      JOIN ${tabProdLoja} pl
        ON pl.COD_PRODUTO = p.COD_PRODUTO
        AND pl.COD_LOJA = :codLoja
      LEFT JOIN ${tabSecao}    sec ON sec.COD_SECAO    = p.COD_SECAO
      LEFT JOIN ${tabGrupo}    grp ON grp.COD_GRUPO    = p.COD_GRUPO    AND grp.COD_SECAO   = p.COD_SECAO
      LEFT JOIN ${tabSubgrupo} sg  ON sg.COD_SUB_GRUPO = p.COD_SUB_GRUPO AND sg.COD_GRUPO   = p.COD_GRUPO AND sg.COD_SECAO = p.COD_SECAO
      LEFT JOIN ${tabSegmento} seg ON seg.COD_SEGMENTO = p.COD_SEGMENTO
      WHERE p.STATUS = 0
        AND TRIM(p.DES_PRODUTO) IS NOT NULL
        ${whereExtra}
      ORDER BY sec.DES_SECAO, grp.DES_GRUPO, sg.DES_SUB_GRUPO, p.DES_PRODUTO
    `;

    const rows = await OracleService.query<any>(sql, params);

    const items: TributacaoItem[] = rows.map((r: any) => {
      const perIcmsEntrada  = parseFloat(r.PER_ICMS_ENTRADA)  || 0;
      const perIcmsSaida    = parseFloat(r.PER_ICMS_SAIDA)    || 0;
      const perAliqOutorg   = parseFloat(r.PER_ALIQ_OUTORG)   || 0;
      const flgNaoIcms      = r.FLG_NAO_ICMS || 'N';

      const { status, motivo } = classifyTax(perIcmsEntrada, perIcmsSaida, perAliqOutorg, flgNaoIcms);

      return {
        cod_produto:       r.COD_PRODUTO,
        des_produto:       r.DES_PRODUTO || '',
        cod_secao:         r.COD_SECAO,
        des_secao:         r.DES_SECAO  || '',
        cod_grupo:         r.COD_GRUPO,
        des_grupo:         r.DES_GRUPO  || '',
        cod_sub_grupo:     r.COD_SUB_GRUPO,
        des_sub_grupo:     r.DES_SUB_GRUPO || '',
        cod_segmento:      r.COD_SEGMENTO,
        des_segmento:      r.DES_SEGMENTO || '',
        ncm:               r.NCM || '',
        cod_tributacao:    r.COD_TRIBUTACAO,
        cod_trib_entrada:  r.COD_TRIB_ENTRADA,
        per_icms_entrada:  perIcmsEntrada,
        per_icms_saida:    perIcmsSaida,
        per_aliq_outorg:   perAliqOutorg,
        per_reducao_bc:    parseFloat(r.PER_REDUCAO_BC) || 0,
        per_pis_entrada:   parseFloat(r.PER_PIS_ENTRADA)  || 0,
        per_pis_saida:     parseFloat(r.PER_PIS_SAIDA)    || 0,
        per_cofins_entrada: parseFloat(r.PER_COFINS_ENTRADA) || 0,
        per_cofins_saida:  parseFloat(r.PER_COFINS_SAIDA) || 0,
        cst_pis_cof_entrada: (r.CST_PIS_COF_ENTRADA || '').trim(),
        cst_pis_cof_saida:   (r.CST_PIS_COF_SAIDA   || '').trim(),
        flg_nao_icms:      flgNaoIcms,
        flg_nao_pis_cofins: r.FLG_NAO_PIS_COFINS || 'N',
        val_venda:         parseFloat(r.VAL_VENDA)       || 0,
        val_custo_rep:     parseFloat(r.VAL_CUSTO_REP)   || 0,
        markdown_pct:      parseFloat(r.MARKDOWN_PCT)    || 0,
        mg_liquida_pct:    parseFloat(r.MG_LIQUIDA_PCT)  || 0,
        status,
        motivo
      };
    });

    // Filtro de status no backend
    if (!filters.statusFilter || filters.statusFilter === 'TODOS') return items;
    if (filters.statusFilter === 'DIVERGENTES') return items.filter(i => i.status !== 'OK');
    return items.filter(i => i.status === filters.statusFilter);
  }
}
