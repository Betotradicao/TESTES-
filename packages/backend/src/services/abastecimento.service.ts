/**
 * Abastecimento Service
 * Serviço para Prioridade de Reposição - identifica produtos que entraram via NF
 * ontem e hoje e classifica prioridade de abastecimento nas gôndolas.
 *
 * Prioridades:
 * 1 - Curva A (itens de alta rotatividade)
 * 2 - Ruptura (estoque zerado no mês)
 * 3 - Pré-Ruptura (estoque <= estoque mínimo calculado)
 * 4 - Demais itens
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { RuptureSurveyService } from './rupture-survey.service';

export class AbastecimentoService {

  /**
   * Busca produtos que entraram via NF na data informada,
   * classifica prioridade de abastecimento.
   */
  static async getPrioridadeReposicao(codLoja: string, dataEntrada?: string): Promise<any> {
    // Calcular data (horário Brasil)
    const now = new Date();
    const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hoje = new Date(brDate);

    const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    // Data de entrada: usa parâmetro recebido ou ontem por padrão
    const dataFiltro = dataEntrada || (() => {
      const ontem = new Date(brDate);
      ontem.setDate(ontem.getDate() - 1);
      return `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, '0')}-${String(ontem.getDate()).padStart(2, '0')}`;
    })();

    // Início do mês atual (para ruptura)
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

    console.log(`📦 [ABASTECIMENTO] Buscando produtos NF de ${dataFiltro}, loja ${codLoja}`);

    // --- Resolver tabelas via MappingService ---
    const schema = await MappingService.getSchema();
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubGrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

    // --- Resolver colunas TAB_NF ---
    const nfNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const nfSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const nfDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const nfCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const nfTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const nfCodLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja');

    // --- Resolver colunas TAB_NF_ITEM ---
    const niNumNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const niSerieNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const niCodParceiro = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const niCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');
    const niValCusto = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_custo');

    // --- Resolver colunas TAB_PRODUTO ---
    const prCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const prDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const prCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const prCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const prCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const prCodSubGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const prTipoEspecie = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_especie');

    // --- Resolver colunas TAB_PRODUTO_LOJA ---
    const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const plEstoqueAtual = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
    const plPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
    const plMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
    const plVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media');
    const plCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
    const plCodFornUlt = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra');

    // --- Resolver colunas TAB_SECAO ---
    const secCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const secDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

    // --- Resolver colunas TAB_GRUPO ---
    const grCodSecao = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao');
    const grCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const grDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');

    // --- Resolver colunas TAB_SUBGRUPO ---
    const sgCodSecao = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao');
    const sgCodGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo');
    const sgCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const sgDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');

    // --- Resolver colunas TAB_FORNECEDOR ---
    const fornCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
    const fornDesRazao = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');

    // Colunas de freq_visita e prazo são hardcoded (padrão usado em products.controller.ts e outros)
    const fornFreqVisita = 'NUM_FREQ_VISITA';
    const fornPrazo = 'NUM_PRAZO';

    // --- Query principal: Produtos que entraram via NF ontem e hoje ---
    const query = `
      SELECT DISTINCT
        ni.${niCodItem} AS COD_PRODUTO,
        p.${prDesProduto} AS DESCRICAO,
        p.${prCodBarras} AS COD_BARRAS,
        s.${secDesSecao} AS SECAO,
        g.${grDesGrupo} AS GRUPO,
        sg.${sgDesSubGrupo} AS SUBGRUPO,
        f.${fornDesRazao} AS FORNECEDOR,
        TRIM(pl.${plCurva}) AS CURVA,
        NVL(pl.${plEstoqueAtual}, 0) AS ESTOQUE_ATUAL,
        NVL(pl.${plPrecoVenda}, 0) AS PRECO_VENDA,
        NVL(pl.${plMargem}, 0) AS MARGEM,
        NVL(pl.${plVendaMedia}, 0) AS VENDA_MEDIA,
        NVL(ni.${niValCusto}, 0) AS CUSTO_NF,
        nf.${nfDtaEntrada} AS DATA_ENTRADA,
        nf.${nfNumNf} AS NUMERO_NF,
        NVL(f.${fornFreqVisita}, 7) AS FREQ_VISITA,
        NVL(f.${fornPrazo}, 3) AS PRAZO,
        CASE p.${prTipoEspecie}
          WHEN 0 THEN 'MERCADORIA'
          WHEN 2 THEN 'SERVICO'
          WHEN 3 THEN 'IMOBILIZADO'
          WHEN 4 THEN 'INSUMO'
          ELSE 'OUTROS'
        END AS TIPO_ESPECIE
      FROM ${tabNf} nf
      INNER JOIN ${tabNfItem} ni ON nf.${nfNumNf} = ni.${niNumNf}
        AND nf.${nfSerieNf} = ni.${niSerieNf}
        AND nf.${nfCodParceiro} = ni.${niCodParceiro}
      INNER JOIN ${tabProduto} p ON ni.${niCodItem} = p.${prCodProduto}
      INNER JOIN ${tabProdutoLoja} pl ON p.${prCodProduto} = pl.${plCodProduto} AND pl.${plCodLoja} = :codLoja
      LEFT JOIN ${tabSecao} s ON p.${prCodSecao} = s.${secCodSecao}
      LEFT JOIN ${tabGrupo} g ON p.${prCodSecao} = g.${grCodSecao} AND p.${prCodGrupo} = g.${grCodGrupo}
      LEFT JOIN ${tabSubGrupo} sg ON p.${prCodSecao} = sg.${sgCodSecao} AND p.${prCodGrupo} = sg.${sgCodGrupo} AND p.${prCodSubGrupo} = sg.${sgCodSubGrupo}
      LEFT JOIN ${tabFornecedor} f ON pl.${plCodFornUlt} = f.${fornCodForn}
      WHERE nf.${nfTipoOperacao} = 0
      AND nf.${nfCodLoja} = :codLoja
      AND nf.${nfDtaEntrada} >= TO_DATE(:dataFiltro, 'YYYY-MM-DD')
      AND nf.${nfDtaEntrada} < TO_DATE(:dataFiltro, 'YYYY-MM-DD') + 1
      ORDER BY NVL(pl.${plVendaMedia}, 0) DESC
    `;


    const produtosNf = await OracleService.query<any>(query, {
      codLoja,
      dataFiltro,
    });

    console.log(`📦 [ABASTECIMENTO] Encontrados ${produtosNf.length} produtos via NF`);

    if (produtosNf.length === 0) {
      return {
        resumo: { total: 0, prioridade1: 0, prioridade2: 0, prioridade3: 0, prioridade4: 0 },
        itens: [],
      };
    }

    // --- Buscar itens em ruptura (estoque zero no mês atual) ---
    let rupturaSet = new Set<string>();
    try {
      const rupturaResult = await RuptureSurveyService.getAutomaticRuptureResults({
        data_inicio: inicioMes,
        data_fim: dataHoje,
        codLoja,
        considerarProducao: false,
      });
      if (rupturaResult.itens_ruptura) {
        for (const item of rupturaResult.itens_ruptura) {
          rupturaSet.add(String(item.codigo));
        }
      }
      console.log(`📦 [ABASTECIMENTO] ${rupturaSet.size} itens em ruptura no mês`);
    } catch (e) {
      console.error('⚠️ [ABASTECIMENTO] Erro ao buscar rupturas:', e);
    }

    // --- Agrupar por produto (somar custo, juntar NFs) ---
    const agrupado = new Map<string, any>();
    for (const row of produtosNf) {
      const codigo = String(row.COD_PRODUTO);
      const custoLinha = parseFloat(row.CUSTO_NF) || 0;
      const nfNum = String(row.NUMERO_NF || '');

      if (agrupado.has(codigo)) {
        const existing = agrupado.get(codigo);
        existing.custo_total += custoLinha;
        if (nfNum && !existing.nfs.has(nfNum)) {
          existing.nfs.add(nfNum);
        }
      } else {
        agrupado.set(codigo, {
          ...row,
          custo_total: custoLinha,
          nfs: new Set(nfNum ? [nfNum] : []),
        });
      }
    }

    console.log(`📦 [ABASTECIMENTO] ${produtosNf.length} linhas agrupadas em ${agrupado.size} produtos únicos`);

    // --- Classificar prioridade ---
    const itens = Array.from(agrupado.values()).map((row: any) => {
      const codigo = String(row.COD_PRODUTO);
      const curva = (row.CURVA || '').trim().toUpperCase();
      const estoqueAtual = parseFloat(row.ESTOQUE_ATUAL) || 0;
      const vendaMedia = parseFloat(row.VENDA_MEDIA) || 0;
      const freqVisita = parseFloat(row.FREQ_VISITA) || 7;
      const prazo = parseFloat(row.PRAZO) || 3;

      // Fórmula pré-ruptura: CEIL((freqVisita + prazo) × vendaMedia)
      const estoqueMinimo = Math.ceil((freqVisita + prazo) * vendaMedia);

      let prioridade = 4;
      let motivo = 'Demais itens';

      // Pré-ruptura (prioridade 3) - verificar primeiro, depois sobrescrever com maiores
      if (vendaMedia > 0 && estoqueAtual <= estoqueMinimo) {
        prioridade = 3;
        motivo = `Pré-Ruptura (Est: ${estoqueAtual} ≤ Mín: ${estoqueMinimo})`;
      }

      // Ruptura (prioridade 2) - sobrescreve pré-ruptura
      if (rupturaSet.has(codigo)) {
        prioridade = 2;
        motivo = 'Ruptura Sistêmica (estoque zerado no mês)';
      }

      // Curva A (prioridade 1) - maior prioridade
      if (curva === 'A') {
        prioridade = 1;
        motivo = 'Curva A';
      }

      return {
        codigo,
        codigo_barras: row.COD_BARRAS || '',
        descricao: row.DESCRICAO || '',
        fornecedor: row.FORNECEDOR || '',
        secao: row.SECAO || '',
        grupo: row.GRUPO || '',
        subgrupo: row.SUBGRUPO || '',
        curva: curva || '-',
        custo: row.custo_total,
        preco_venda: parseFloat(row.PRECO_VENDA) || 0,
        margem: parseFloat(row.MARGEM) || 0,
        estoque_atual: estoqueAtual,
        venda_media: vendaMedia,
        prioridade,
        motivo_prioridade: motivo,
        tipo_especie: row.TIPO_ESPECIE || 'MERCADORIA',
        numero_nf: Array.from(row.nfs).join(', '),
        data_entrada: row.DATA_ENTRADA || null,
      };
    });

    // Ordenar por prioridade (1→4), depois por venda_media desc
    itens.sort((a: any, b: any) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
      return b.venda_media - a.venda_media;
    });

    // Calcular resumo
    const resumo = {
      total: itens.length,
      prioridade1: itens.filter((i: any) => i.prioridade === 1).length,
      prioridade2: itens.filter((i: any) => i.prioridade === 2).length,
      prioridade3: itens.filter((i: any) => i.prioridade === 3).length,
      prioridade4: itens.filter((i: any) => i.prioridade === 4).length,
    };

    console.log(`📦 [ABASTECIMENTO] Resumo: P1=${resumo.prioridade1}, P2=${resumo.prioridade2}, P3=${resumo.prioridade3}, P4=${resumo.prioridade4}`);

    return { resumo, itens };
  }
}
