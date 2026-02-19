/**
 * Demonstrativo de Caixa Service
 * Orçamento Gerencial - consulta TAB_ORCAMENTO_GERENCIAL + TAB_FLUXO + TAB_CATEGORIA + TAB_SUBCATEGORIA
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';

interface DemonstrativoFilters {
  dataInicio?: string;   // formato "YYYY-MM-DD"
  dataFim?: string;      // formato "YYYY-MM-DD"
  codLoja?: string;
  regime?: string;       // 'caixa' ou 'competencia'
  tipoFluxo?: string;    // filtro por tab: '', '1', '2', '3', '4'
}

export class DemonstrativoCaixaService {

  /**
   * Busca dados completos do demonstrativo: categorias + subcategorias + metas + valores reais
   */
  static async getDados(filters: DemonstrativoFilters): Promise<any> {
    const schema = await MappingService.getSchema();

    // Determina período
    const hoje = new Date();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    const anoAtual = String(hoje.getFullYear());
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    // Defaults: dia 01 do mês até ontem
    const dataInicio = filters.dataInicio || `${anoAtual}-${mesAtual}-01`;
    const dataFim = filters.dataFim || `${anoAtual}-${mesAtual}-${String(Math.max(1, hoje.getDate() - 1)).padStart(2, '0')}`;

    // Derivar mesAno para query de metas (usa mês da dataInicio)
    const partsInicio = dataInicio.split('-');
    const mes = partsInicio[1];
    const ano = partsInicio[0];
    const mesAno = `${mes}${ano}`;

    // 1. Buscar categorias ativas ordenadas
    const categorias = await OracleService.query<any>(`
      SELECT COD_CATEGORIA, DES_CATEGORIA, TIPO_CATEGORIA, NUM_ORDEM, TIPO_FLUXO
      FROM ${schema}.TAB_CATEGORIA
      WHERE NVL(FLG_INATIVO, 'N') = 'N'
      ORDER BY NUM_ORDEM
    `);

    // 2. Buscar subcategorias ativas
    const subcategorias = await OracleService.query<any>(`
      SELECT COD_CATEGORIA, COD_SUBCATEGORIA, DES_SUBCATEGORIA, NUM_ORDEM,
             NVL(FLG_IGNORA_ORCTO, 'N') as FLG_IGNORA_ORCTO
      FROM ${schema}.TAB_SUBCATEGORIA
      WHERE NVL(FLG_INATIVO, 'N') = 'N'
        AND DES_SUBCATEGORIA NOT LIKE '##%'
        AND DES_SUBCATEGORIA NOT LIKE '###%'
        AND DES_SUBCATEGORIA NOT LIKE '####%'
        AND DES_SUBCATEGORIA NOT LIKE '*%'
      ORDER BY COD_CATEGORIA, NUM_ORDEM, COD_SUBCATEGORIA
    `);

    // 3. Buscar metas do TAB_ORCAMENTO_GERENCIAL
    const paramsMeta: any = { mesAno };
    let whereMeta = `WHERE og.DTA_MENSAL = :mesAno`;
    if (filters.codLoja) {
      whereMeta += ` AND og.COD_LOJA = :codLoja`;
      paramsMeta.codLoja = Number(filters.codLoja);
    }

    const metas = await OracleService.query<any>(`
      SELECT og.COD_CATEGORIA, og.COD_SUBCATEGORIA,
             SUM(og.VAL_PREVISAO) as META,
             SUM(og.VAL_ABERTO) as ORC_ABERTO,
             SUM(og.VAL_QUITADO) as ORC_QUITADO,
             SUM(og.VAL_REALIZADO) as ORC_REALIZADO
      FROM ${schema}.TAB_ORCAMENTO_GERENCIAL og
      ${whereMeta}
      GROUP BY og.COD_CATEGORIA, og.COD_SUBCATEGORIA
    `, paramsMeta);

    // 4. Buscar valores reais do TAB_FLUXO
    const paramsFluxo: any = { dataInicio, dataFim };
    const campoData = filters.regime === 'competencia' ? 'f.DTA_ENTRADA' : 'f.DTA_VENCIMENTO';
    let whereFluxo = `WHERE ${campoData} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
      AND ${campoData} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
    if (filters.codLoja) {
      whereFluxo += ` AND f.COD_LOJA = :codLoja`;
      paramsFluxo.codLoja = Number(filters.codLoja);
    }

    const fluxo = await OracleService.query<any>(`
      SELECT f.COD_CATEGORIA, f.COD_SUBCATEGORIA,
             SUM(CASE WHEN f.FLG_QUITADO = 'N' THEN f.VAL_PARCELA ELSE 0 END) as VAL_ABERTO,
             SUM(CASE WHEN f.FLG_QUITADO = 'S' THEN f.VAL_PARCELA ELSE 0 END) as VAL_QUITADO,
             SUM(f.VAL_PARCELA) as VAL_REALIZADO,
             COUNT(*) as QTD
      FROM ${schema}.TAB_FLUXO f
      ${whereFluxo}
      GROUP BY f.COD_CATEGORIA, f.COD_SUBCATEGORIA
    `, paramsFluxo);

    // 5. Montar mapas para lookup rápido
    const metaMap = new Map<string, any>();
    for (const m of metas) {
      metaMap.set(`${m.COD_CATEGORIA}_${m.COD_SUBCATEGORIA}`, m);
    }

    const fluxoMap = new Map<string, any>();
    for (const f of fluxo) {
      fluxoMap.set(`${f.COD_CATEGORIA}_${f.COD_SUBCATEGORIA}`, f);
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
      if (filters.tipoFluxo && filters.tipoFluxo !== '' && cat.TIPO_FLUXO !== Number(filters.tipoFluxo)) {
        continue;
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
    const schema = await MappingService.getSchema();
    return OracleService.query(`
      SELECT COD_CATEGORIA, DES_CATEGORIA, TIPO_CATEGORIA, NUM_ORDEM, TIPO_FLUXO
      FROM ${schema}.TAB_CATEGORIA
      WHERE NVL(FLG_INATIVO, 'N') = 'N'
      ORDER BY NUM_ORDEM
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
    const schema = await MappingService.getSchema();
    const campoData = filters.regime === 'competencia' ? 'f.DTA_ENTRADA' : 'f.DTA_VENCIMENTO';
    const params: any = {
      codCategoria: filters.codCategoria,
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
    };

    let where = `WHERE f.COD_CATEGORIA = :codCategoria
      AND ${campoData} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
      AND ${campoData} <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;

    if (filters.codSubcategoria != null) {
      where += ` AND f.COD_SUBCATEGORIA = :codSubcategoria`;
      params.codSubcategoria = filters.codSubcategoria;
    }
    if (filters.codLoja) {
      where += ` AND f.COD_LOJA = :codLoja`;
      params.codLoja = Number(filters.codLoja);
    }
    if (filters.status === 'aberto') {
      where += ` AND f.FLG_QUITADO = 'N'`;
    } else if (filters.status === 'quitado') {
      where += ` AND f.FLG_QUITADO = 'S'`;
    }

    const titulos = await OracleService.query<any>(`
      SELECT f.NUM_REGISTRO, f.FLG_QUITADO, f.COD_LOJA, f.TIPO_CONTA,
             f.DES_PARCEIRO, f.NUM_DOCTO, f.NUM_NF, f.NUM_SERIE_NF,
             f.COD_PARCEIRO, f.VAL_PARCELA, f.NUM_PARCELA, f.QTD_PARCELA,
             f.DTA_VENCIMENTO, f.DTA_ENTRADA, f.DTA_QUITADA, f.DTA_EMISSAO,
             f.COD_ENTIDADE, f.COD_CATEGORIA, f.COD_SUBCATEGORIA,
             f.DES_OBSERVACAO,
             e.DES_ENTIDADE
      FROM ${schema}.TAB_FLUXO f
      LEFT JOIN ${schema}.TAB_ENTIDADE e ON e.COD_ENTIDADE = f.COD_ENTIDADE
      ${where}
      ORDER BY ${campoData} DESC, f.NUM_REGISTRO DESC
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
    const schema = await MappingService.getSchema();

    const itens = await OracleService.query<any>(`
      SELECT ni.COD_ITEM, p.DES_PRODUTO, ni.QTD_TOTAL, ni.VAL_CUSTO,
             ni.VAL_TOTAL_ITEM
      FROM ${schema}.TAB_NF nf
      JOIN ${schema}.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
                                    AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
                                    AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
      LEFT JOIN ${schema}.TAB_PRODUTO p ON ni.COD_ITEM = p.COD_PRODUTO
      WHERE nf.NUM_NF = :numNf
        AND nf.NUM_SERIE_NF = :numSerieNf
        AND nf.COD_PARCEIRO = :codParceiro
      ORDER BY ni.COD_ITEM
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
