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
  incluirMovBanco?: string; // 'sim' ou 'nao' - incluir movimentações bancárias (TAB_MOV_BCO)
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

    // 3. Buscar metas do TAB_ORCAMENTO_GERENCIAL (todos os meses do período)
    const paramsMeta: any = {};
    const mesesBinds = mesesPeriodo.map((m, i) => {
      paramsMeta[`m${i}`] = m;
      return `:m${i}`;
    });
    let whereMeta = `WHERE og.DTA_MENSAL IN (${mesesBinds.join(',')})`;
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
    // Regime Caixa: abertos por DTA_VENCIMENTO, quitados por DTA_QUITADA (quando o dinheiro efetivamente entrou/saiu)
    // Regime Competência: todos por DTA_ENTRADA
    const paramsFluxo: any = { dataInicio, dataFim };
    let whereFluxo: string;
    if (filters.regime === 'competencia') {
      whereFluxo = `WHERE f.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND f.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
    } else {
      // Regime Caixa (híbrido): abertos por vencimento, quitados por data de quitação
      whereFluxo = `WHERE (
        (f.FLG_QUITADO = 'N' AND f.DTA_VENCIMENTO >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.DTA_VENCIMENTO <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        OR
        (f.FLG_QUITADO = 'S' AND f.DTA_QUITADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.DTA_QUITADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
      )`;
    }
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

    // 4b. Buscar eventos financeiros (TAB_FLUXO_EVENTO)
    // Eventos como PIS, COFINS, taxas de cartão, descontos, etc. ficam em tabela separada
    // e são mapeados para categorias/subcategorias via TAB_EVENTO_FINANCEIRO
    const paramsEvento: any = { dataInicio, dataFim };
    let whereEvento: string;
    if (filters.regime === 'competencia') {
      whereEvento = `f.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND f.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
    } else {
      whereEvento = `(
        (f.FLG_QUITADO = 'N' AND f.DTA_VENCIMENTO >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.DTA_VENCIMENTO <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        OR
        (f.FLG_QUITADO = 'S' AND f.DTA_QUITADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.DTA_QUITADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
      )`;
    }
    let whereEventoLoja = '';
    if (filters.codLoja) {
      whereEventoLoja = ` AND fe.COD_LOJA = :codLoja`;
      paramsEvento.codLoja = Number(filters.codLoja);
    }

    const eventos = await OracleService.query<any>(`
      SELECT
        CASE WHEN f.TIPO_CONTA = 1 THEN ef.COD_CATEGORIA_REC ELSE ef.COD_CATEGORIA_PAG END as COD_CATEGORIA,
        CASE WHEN f.TIPO_CONTA = 1 THEN ef.COD_SUBCATEGORIA_REC ELSE ef.COD_SUBCATEGORIA_PAG END as COD_SUBCATEGORIA,
        SUM(CASE WHEN f.FLG_QUITADO = 'N' THEN fe.VAL_EVENTO ELSE 0 END) as VAL_ABERTO,
        SUM(CASE WHEN f.FLG_QUITADO = 'S' THEN fe.VAL_EVENTO ELSE 0 END) as VAL_QUITADO,
        SUM(fe.VAL_EVENTO) as VAL_REALIZADO,
        COUNT(*) as QTD
      FROM ${schema}.TAB_FLUXO_EVENTO fe
      JOIN ${schema}.TAB_FLUXO f ON f.NUM_REGISTRO = fe.NUM_REGISTRO
                                  AND f.TIPO_CONTA = fe.TIPO_CONTA
                                  AND f.TIPO_PARCEIRO = fe.TIPO_PARCEIRO
                                  AND f.COD_PARCEIRO = fe.COD_PARCEIRO
                                  AND f.COD_LOJA = fe.COD_LOJA
      JOIN ${schema}.TAB_EVENTO_FINANCEIRO ef ON ef.COD_EVENTO = fe.COD_EVENTO
      WHERE ${whereEvento}${whereEventoLoja}
      GROUP BY
        CASE WHEN f.TIPO_CONTA = 1 THEN ef.COD_CATEGORIA_REC ELSE ef.COD_CATEGORIA_PAG END,
        CASE WHEN f.TIPO_CONTA = 1 THEN ef.COD_SUBCATEGORIA_REC ELSE ef.COD_SUBCATEGORIA_PAG END
    `, paramsEvento);

    // 5. Montar mapas para lookup rápido
    const metaMap = new Map<string, any>();
    for (const m of metas) {
      metaMap.set(`${m.COD_CATEGORIA}_${m.COD_SUBCATEGORIA}`, m);
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
    // Pagamentos como PIS, COFINS, ICMS, DARF ficam em movimentações bancárias
    // TIPO_SITUACAO: 0=Aberto, 1=Quitado
    // FLG_ESTORNO='N' para ignorar estornos
    if (filters.incluirMovBanco !== 'nao') {
      const paramsMovBco: any = { dataInicio, dataFim };
      let whereMovBco: string;
      if (filters.regime === 'competencia') {
        whereMovBco = `WHERE m.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
          AND m.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
      } else {
        // Regime Caixa: usar DTA_QUITADA para quitados, DTA_ENTRADA para abertos
        whereMovBco = `WHERE (
          (m.TIPO_SITUACAO = 0 AND m.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND m.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
          OR
          (m.TIPO_SITUACAO = 1 AND NVL(m.DTA_QUITADA, m.DTA_ENTRADA) >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND NVL(m.DTA_QUITADA, m.DTA_ENTRADA) <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        )`;
      }
      if (filters.codLoja) {
        whereMovBco += ` AND m.COD_LOJA = :codLoja`;
        paramsMovBco.codLoja = Number(filters.codLoja);
      }
      whereMovBco += ` AND m.FLG_ESTORNO = 'N' AND m.COD_CATEGORIA IS NOT NULL`;

      const movBco = await OracleService.query<any>(`
        SELECT m.COD_CATEGORIA, m.COD_SUBCATEGORIA,
               SUM(CASE WHEN m.TIPO_SITUACAO = 0 THEN m.VAL_DOCTO ELSE 0 END) as VAL_ABERTO,
               SUM(CASE WHEN m.TIPO_SITUACAO = 1 THEN m.VAL_DOCTO ELSE 0 END) as VAL_QUITADO,
               SUM(m.VAL_DOCTO) as VAL_REALIZADO,
               COUNT(*) as QTD
        FROM ${schema}.TAB_MOV_BCO m
        ${whereMovBco}
        GROUP BY m.COD_CATEGORIA, m.COD_SUBCATEGORIA
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
        // Tab específica: mostrar apenas categorias daquele tipo
        if (cat.TIPO_FLUXO !== Number(filters.tipoFluxo)) continue;
      } else {
        // Tab Geral: excluir apenas "TRANSFERENCIA ENTRE CONTAS" (COD_CATEGORIA=19)
        // Outras categorias com TIPO_FLUXO=4 (Verbas Comerciais, Nota Devolução, etc.) devem aparecer
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
    const params: any = {
      codCategoria: filters.codCategoria,
      dataInicio: filters.dataInicio,
      dataFim: filters.dataFim,
    };

    // Mesma lógica híbrida: Regime Caixa usa DTA_VENCIMENTO para abertos e DTA_QUITADA para quitados
    let whereDate: string;
    let orderDate: string;
    if (filters.regime === 'competencia') {
      whereDate = `f.DTA_ENTRADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.DTA_ENTRADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999`;
      orderDate = 'f.DTA_ENTRADA';
    } else {
      // Regime Caixa híbrido
      whereDate = `(
        (f.FLG_QUITADO = 'N' AND f.DTA_VENCIMENTO >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.DTA_VENCIMENTO <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
        OR
        (f.FLG_QUITADO = 'S' AND f.DTA_QUITADA >= TO_DATE(:dataInicio, 'YYYY-MM-DD') AND f.DTA_QUITADA <= TO_DATE(:dataFim, 'YYYY-MM-DD') + 0.99999)
      )`;
      orderDate = 'NVL(f.DTA_QUITADA, f.DTA_VENCIMENTO)';
    }

    let where = `WHERE f.COD_CATEGORIA = :codCategoria AND ${whereDate}`;

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
      ORDER BY ${orderDate} DESC, f.NUM_REGISTRO DESC
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
