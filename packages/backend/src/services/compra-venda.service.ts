/**
 * Compra x Venda Service
 * Serviço para buscar dados de Compras e Vendas por Classificação Mercadológica
 * Fonte: Banco Oracle Intersolid
 *
 * FÓRMULAS CONFORME INTERSOLID:
 * - MARK_DOWN = (Vendas - Custo) / Vendas * 100
 * - META (%) = Custo / Vendas * 100
 * - % = Compras / Vendas * 100
 * - Diferença (%) = META - %
 * - Diferença (R$) = Custo - Compras
 *
 * IMPORTANTE - REGRAS DESCOBERTAS:
 * 1. JOIN entre TAB_NF e TAB_NF_ITEM DEVE incluir COD_PARCEIRO
 *    (NUM_NF + NUM_SERIE_NF + COD_PARCEIRO é a chave correta)
 * 2. Usar DTA_ENTRADA (data de entrada) para filtro de compras
 * 3. Tipo Nota Fiscal é filtrado por CFOP no item (ni.CFOP), não TIPO_NF
 *    - Compras: 1101, 1102, 2101, 2102, 1401, 1403, 1407, 2403
 *    - Bonificação: 1910, 2910
 *    - Outras: demais CFOPs (1556, 1949, 5xxx)
 * 4. Produtos Bonificados: verificar em TAB_FORN_PROD_RAT_BONIF
 */

import { OracleService } from './oracle.service';

// Interfaces
export interface SecaoData {
  COD_SECAO: number;
  DES_SECAO: string;
  VAL_META: number;
}

export interface CompraVendaData {
  COD_SECAO: number;
  SECAO: string;
  LOJA: number;
  QTD_COMPRA: number;
  QTD_VENDA: number;
  COMPRAS: number;
  CUSTO_VENDA: number;
  VENDAS: number;
  // Colunas conforme Intersolid:
  MARK_DOWN_PCT: number;    // (Vendas - Custo) / Vendas * 100
  MG_LIQUIDA_PCT: number;   // Lucro Líquido / (Vendas - Imposto) * 100
  COMPRA_PCT: number;       // Compra Seção / Total Compras * 100
  VENDA_PCT: number;        // Venda Seção / Total Vendas * 100
  META_PCT: number;         // Custo / Vendas * 100
  MARGEM_PCT: number;       // VAL_META da seção (meta de margem)
  PCT: number;              // Compras / Vendas * 100
  DIFERENCA_PCT: number;    // META_PCT - PCT
  DIFERENCA_RS: number;     // Custo - Compras
  TOTAL_IMPOSTO: number;    // Soma dos impostos de saída (VAL_IMPOSTO_DEBITO)
  // Colunas de Empréstimo (Decomposição/Receituário/Associação):
  EMPRESTEI: number;        // Valor que PAI/ingredientes emprestaram
  EMPRESTADO: number;       // Valor que FILHOS/compostos tomaram emprestado
  COMPRA_FINAL: number;     // COMPRAS - EMPRESTEI + EMPRESTADO (compra ajustada)
}

export interface CompraVendaFilters {
  dataInicio: string; // DD/MM/YYYY
  dataFim: string;    // DD/MM/YYYY
  codSecao?: number;
  codGrupo?: number;
  codSubGrupo?: number;
  codLoja?: number;
  codComprador?: number;
  tipoVenda?: {
    pdv: boolean;
    nfCliente: boolean;
    vendaBalcao: boolean;
    nfTransferencia: boolean;
  };
  tipoNotaFiscal?: {
    compras: boolean;
    outras: boolean;
    bonificacao: boolean;
  };
  produtosBonificados?: 'com' | 'sem' | 'somente';
  decomposicao?: 'ambos' | 'pai' | 'filhos';
  agrupamento?: 'secao' | 'grupo' | 'subgrupo';
  // Tipos de Empréstimo (quando "filhos" selecionado)
  tipoEmprestimoProducao?: boolean;      // TAB_PRODUTO_PRODUCAO (receita/insumos)
  tipoEmprestimoAssociacao?: boolean;    // TAB_PRODUTO_LOJA (produto associado)
  tipoEmprestimoDecomposicao?: boolean;  // TAB_PRODUTO_DECOMPOSICAO (pai/filhos)
}

export class CompraVendaService {
  /**
   * Busca as seções disponíveis
   */
  static async getSecoes(): Promise<SecaoData[]> {
    const sql = `
      SELECT COD_SECAO, DES_SECAO, VAL_META
      FROM INTERSOLID.TAB_SECAO
      WHERE FLG_INATIVO IS NULL OR FLG_INATIVO = 'N'
      ORDER BY DES_SECAO
    `;

    return OracleService.query<SecaoData>(sql);
  }

  /**
   * Busca os grupos disponíveis
   */
  static async getGrupos(codSecao?: number): Promise<any[]> {
    let sql = `
      SELECT DISTINCT COD_GRUPO, DES_GRUPO
      FROM INTERSOLID.TAB_GRUPO
      WHERE 1=1
    `;

    const params: any = {};

    if (codSecao) {
      sql += ` AND COD_SECAO = :codSecao`;
      params.codSecao = codSecao;
    }

    sql += ` ORDER BY DES_GRUPO`;

    return OracleService.query(sql, params);
  }

  /**
   * Busca os subgrupos disponíveis
   * TAB_SUBGRUPO tem COD_SECAO e COD_GRUPO - filtra diretamente
   */
  static async getSubGrupos(codSecao?: number, codGrupo?: number): Promise<any[]> {
    // Filtra diretamente na TAB_SUBGRUPO por COD_SECAO e COD_GRUPO
    let sql = `
      SELECT DISTINCT COD_SUB_GRUPO, DES_SUB_GRUPO
      FROM INTERSOLID.TAB_SUBGRUPO
      WHERE 1=1
    `;

    const params: any = {};

    // Filtrar por seção E grupo (chave composta)
    if (codSecao) {
      sql += ` AND COD_SECAO = :codSecao`;
      params.codSecao = codSecao;
    }

    if (codGrupo) {
      sql += ` AND COD_GRUPO = :codGrupo`;
      params.codGrupo = codGrupo;
    }

    sql += ` ORDER BY DES_SUB_GRUPO`;

    console.log('📦 getSubGrupos - codSecao:', codSecao, 'codGrupo:', codGrupo);
    console.log('📦 getSubGrupos SQL:', sql);
    console.log('📦 getSubGrupos params:', params);

    const result = await OracleService.query(sql, params);
    console.log('📦 getSubGrupos resultado:', result.length, 'subgrupos');

    return result;
  }

  /**
   * Busca os compradores disponíveis
   */
  static async getCompradores(): Promise<any[]> {
    const sql = `
      SELECT COD_COMPRADOR, DES_COMPRADOR
      FROM INTERSOLID.TAB_COMPRADOR
      ORDER BY DES_COMPRADOR
    `;

    return OracleService.query(sql);
  }

  /**
   * Busca as lojas disponíveis
   */
  static async getLojas(): Promise<any[]> {
    const sql = `
      SELECT COD_LOJA, DES_LOJA
      FROM INTERSOLID.TAB_LOJA
      WHERE FLG_INATIVO IS NULL OR FLG_INATIVO = 'N'
      ORDER BY DES_LOJA
    `;

    return OracleService.query(sql);
  }

  /**
   * Monta os filtros de produto para as subqueries
   */
  private static buildProdutoFilters(filters: CompraVendaFilters, params: any): string {
    const { codSecao, codGrupo, codSubGrupo, codComprador, produtosBonificados } = filters;
    let filterSql = '';

    // Filtro de Seção
    if (codSecao) {
      filterSql += ` AND p.COD_SECAO = :codSecao`;
      params.codSecao = codSecao;
    }

    // Filtro de Grupo
    if (codGrupo) {
      filterSql += ` AND p.COD_GRUPO = :codGrupo`;
      params.codGrupo = codGrupo;
    }

    // Filtro de SubGrupo
    if (codSubGrupo) {
      filterSql += ` AND p.COD_SUB_GRUPO = :codSubGrupo`;
      params.codSubGrupo = codSubGrupo;
    }

    // Filtro de Comprador (via TAB_PRODUTO_COMPRADOR)
    if (codComprador) {
      filterSql += ` AND EXISTS (
        SELECT 1 FROM INTERSOLID.TAB_PRODUTO_COMPRADOR pc
        WHERE pc.COD_PRODUTO = p.COD_PRODUTO
        AND pc.COD_COMPRADOR = :codComprador
      )`;
      params.codComprador = codComprador;
    }

    // Filtro de Produtos Bonificados
    // Este filtro controla a inclusão de notas por CFOP:
    // - "com" = inclui tudo (compras normais + bonificação)
    // - "sem" = só pega notas com CFOP de compra normal (exclui bonificação)
    // - "somente" = só pega notas com CFOP de bonificação
    //
    // NOTA: A filtragem por CFOP é feita pelo método buildTipoNfFilter.
    // O filtro produtosBonificados controla automaticamente o tipoNotaFiscal no frontend.
    // Aqui apenas mantemos compatibilidade com a variável.
    // 'com', 'sem', 'somente' = tratado pelo frontend via tipoNotaFiscal

    // Filtro de Decomposição
    // PAI = Todos os produtos (sem filtro - comportamento padrão)
    // FILHOS = Todos os produtos, mas com valores redistribuídos (cálculo de EMPRESTEI/EMPRESTADO)
    // A redistribuição é feita na query principal, não aqui no filtro de produtos
    // 'pai', 'filhos' ou 'ambos' = todos os produtos, não precisa filtrar

    return filterSql;
  }

  /**
   * Monta o filtro de Tipo Nota Fiscal baseado no CFOP do item
   * - Compras: CFOPs de compra para comercialização (1101, 1102, 2101, 2102, 1401, 1403, 1407, 2403)
   * - Bonificação: CFOPs de bonificação (1910, 2910, 1411, 2411, 5910, 6910, 5911, 6911, 9505)
   * - Outras: Demais CFOPs (1556, 1949, 5xxx, etc)
   *
   * IMPORTANTE: Usar TRIM(ni.CFOP) pois no Oracle os campos CHAR têm espaços em branco no final
   */
  private static buildTipoNfFilter(tipoNotaFiscal?: CompraVendaFilters['tipoNotaFiscal']): string {
    // CFOPs por categoria - CONFORME INTERSOLID
    // Compras: Mercadoria para revenda/comercialização
    // REMOVIDO 1407 (uso/consumo) - usado apenas por USO INTERNO SUPRIMENTOS
    const cfopCompras = ['1101', '1102', '2101', '2102', '1401', '1403', '2403'];
    // Bonificação: Entrada de bonificação, doação, brinde
    const cfopBonificacao = ['1910', '2910', '1411', '2411', '5910', '6910', '5911', '6911', '9505'];
    // Outras: Material de uso/consumo (1407, 1556, 1557), imobilizado, outras entradas

    // Por padrão (quando tipoNotaFiscal é undefined), usa apenas CFOPs de Compras
    if (!tipoNotaFiscal) {
      return `AND TRIM(ni.CFOP) IN ('${cfopCompras.join("','")}')`;
    }

    const { compras, bonificacao, outras } = tipoNotaFiscal;

    // Se todos estão marcados ou nenhum está marcado, não filtra por CFOP
    if ((compras && bonificacao && outras) || (!compras && !bonificacao && !outras)) {
      return ''; // Sem filtro = todos os CFOPs
    }

    // Se apenas "Outras" está marcado, excluir compras e bonificação
    if (outras && !compras && !bonificacao) {
      const cfopsExcluir = [...cfopCompras, ...cfopBonificacao];
      return `AND TRIM(ni.CFOP) NOT IN ('${cfopsExcluir.join("','")}')`;
    }

    // Se "Outras" + algum outro está marcado
    if (outras) {
      // Outras = NOT IN (compras + bonificacao exceto os que estão marcados)
      const cfopsExcluir: string[] = [];
      if (!compras) cfopsExcluir.push(...cfopCompras);
      if (!bonificacao) cfopsExcluir.push(...cfopBonificacao);

      if (cfopsExcluir.length > 0) {
        return `AND TRIM(ni.CFOP) NOT IN ('${cfopsExcluir.join("','")}')`;
      }
      return ''; // Todos incluídos
    }

    // Apenas compras e/ou bonificação (sem outras)
    const cfopsIncluidos: string[] = [];
    if (compras) cfopsIncluidos.push(...cfopCompras);
    if (bonificacao) cfopsIncluidos.push(...cfopBonificacao);

    if (cfopsIncluidos.length > 0) {
      return `AND TRIM(ni.CFOP) IN ('${cfopsIncluidos.join("','")}')`;
    }

    // Se nenhum tipo selecionado, não retorna nada de compras
    return 'AND 1=0';
  }

  /**
   * Monta o filtro de TIPO_SAIDA (Tipo de Venda)
   * TIPO_SAIDA: 0 = PDV, 1 = NF Cliente, 2 = Venda Balcão, 3 = NF Transferência
   */
  private static buildTipoVendaFilter(tipoVenda?: CompraVendaFilters['tipoVenda']): string {
    // Por padrão, considera todos os tipos de venda
    if (!tipoVenda) {
      return '';
    }

    const tiposIncluidos: number[] = [];
    if (tipoVenda.pdv) tiposIncluidos.push(0);
    if (tipoVenda.nfCliente) tiposIncluidos.push(1);
    if (tipoVenda.vendaBalcao) tiposIncluidos.push(2);
    if (tipoVenda.nfTransferencia) tiposIncluidos.push(3);

    if (tiposIncluidos.length > 0 && tiposIncluidos.length < 4) {
      return `AND pv.TIPO_SAIDA IN (${tiposIncluidos.join(',')})`;
    }

    // Se todos ou nenhum selecionado, não filtra
    return '';
  }

  /**
   * Busca dados de Compra x Venda por Seção
   * Implementa TODOS os filtros conforme Intersolid
   */
  static async getCompraVendaPorSecao(filters: CompraVendaFilters): Promise<CompraVendaData[]> {
    const {
      dataInicio, dataFim, codLoja, tipoNotaFiscal, tipoVenda, decomposicao,
      tipoEmprestimoProducao = true,
      tipoEmprestimoAssociacao = true,
      tipoEmprestimoDecomposicao = true
    } = filters;

    const params: any = {
      dataInicio,
      dataFim
    };

    // Construir filtros
    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = this.buildProdutoFilters(filters, params);

    // Flag para calcular empréstimos (só quando filtro "Filhos" está ativo)
    const calcularEmprestimos = decomposicao === 'filhos';
    // Flags individuais para cada tipo de empréstimo
    const calcDecomposicao = calcularEmprestimos && tipoEmprestimoDecomposicao;
    const calcProducao = calcularEmprestimos && tipoEmprestimoProducao;
    const calcAssociacao = calcularEmprestimos && tipoEmprestimoAssociacao;

    // Filtro de loja
    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.COD_LOJA = :codLoja`;
      lojaFilterVendas = ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    // Query principal que combina Compras e Vendas
    const sql = `
      SELECT
        sec.COD_SECAO,
        sec.DES_SECAO as SECAO,
        NVL(c.COD_LOJA, v.COD_LOJA) as LOJA,
        NVL(c.QTD_COMPRA, 0) as QTD_COMPRA,
        NVL(v.QTD_VENDA, 0) as QTD_VENDA,
        NVL(c.VALOR_COMPRAS, 0) as COMPRAS,
        NVL(v.CUSTO_VENDA, 0) as CUSTO_VENDA,
        NVL(v.VALOR_VENDAS, 0) as VENDAS,
        NVL(m.PER_META_VENDA, sec.VAL_META) as MARGEM_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MARK_DOWN_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MG_LUCRO_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NULLIF(NVL(v.VALOR_VENDAS, 0) - NVL(v.TOTAL_IMPOSTO, 0), 0)) * 100, 2)
             ELSE 0
        END as MG_LIQUIDA_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(v.CUSTO_VENDA, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as META_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(c.VALOR_COMPRAS, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as PCT,
        NVL(v.CUSTO_VENDA, 0) - NVL(c.VALOR_COMPRAS, 0) as DIFERENCA_RS,
        NVL(v.TOTAL_IMPOSTO, 0) as TOTAL_IMPOSTO,
        NVL(v.TOTAL_IMPOSTO_CREDITO, 0) as TOTAL_IMPOSTO_CREDITO,
        -- EMPRESTEI/EMPRESTADO: Só calcula quando filtro "Filhos" está ativo
        -- Soma os tipos selecionados: DECOMPOSIÇÃO + PRODUÇÃO + ASSOCIAÇÃO
        ${calcDecomposicao ? 'NVL(emp_pai.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_insumo.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_pai.VALOR_EMPRESTEI, 0)' : '0'} as EMPRESTEI,
        ${calcDecomposicao ? 'NVL(emp_filho.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_final.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_filho.VALOR_EMPRESTADO, 0)' : '0'} as EMPRESTADO
      FROM INTERSOLID.TAB_SECAO sec
      -- Subquery de Compras
      LEFT JOIN (
        SELECT
          p.COD_SECAO,
          nf.COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.VAL_TOTAL) as VALOR_COMPRAS
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p ON ni.COD_ITEM = p.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters}
        GROUP BY p.COD_SECAO, nf.COD_LOJA
      ) c ON sec.COD_SECAO = c.COD_SECAO
      -- Subquery de Vendas
      LEFT JOIN (
        SELECT
          p.COD_SECAO,
          pv.COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM INTERSOLID.TAB_PRODUTO_PDV pv
        JOIN INTERSOLID.TAB_PRODUTO p ON pv.COD_PRODUTO = p.COD_PRODUTO
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters}
        GROUP BY p.COD_SECAO, pv.COD_LOJA
      ) v ON sec.COD_SECAO = v.COD_SECAO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      -- Metas
      LEFT JOIN INTERSOLID.TAB_SECAO_META_LOJA m ON sec.COD_SECAO = m.COD_SECAO AND m.COD_LOJA = NVL(c.COD_LOJA, v.COD_LOJA)
      ${calcDecomposicao ? `
      -- EMPRESTEI (DECOMPOSIÇÃO): Produtos PAI/MATRIZ que emprestam custo para filhos
      -- Ex: CARNE MATRIZ → CARNE DE PRIMEIRA, CARNE DE SEGUNDA
      LEFT JOIN (
        SELECT
          p.COD_SECAO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p ON ni.COD_ITEM = p.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        -- Somente produtos PAI (que têm decomposição cadastrada)
        AND EXISTS (
          SELECT 1 FROM INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d
          WHERE d.COD_PRODUTO = p.COD_PRODUTO
        )
        GROUP BY p.COD_SECAO, nf.COD_LOJA
      ) emp_pai ON sec.COD_SECAO = emp_pai.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (DECOMPOSIÇÃO): Valor que FILHOS receberam do PAI
      -- Usa QTD_DECOMP como percentual (soma 100% para cada matriz)
      LEFT JOIN (
        SELECT
          p_filho.COD_SECAO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p_pai ON ni.COD_ITEM = p_pai.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d ON p_pai.COD_PRODUTO = d.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_filho ON d.COD_PRODUTO_DECOM = p_filho.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY p_filho.COD_SECAO, nf.COD_LOJA
      ) emp_filho ON sec.COD_SECAO = emp_filho.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      -- EMPRESTEI (PRODUÇÃO): Insumos emprestam baseado nas VENDAS dos produtos finais
      -- Fórmula: Σ(QTD_VENDIDA × QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_insumo.COD_SECAO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.COD_PRODUTO
        -- Compras do insumo para calcular custo unitário
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        -- Vendas dos produtos finais que usam este insumo
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        GROUP BY p_insumo.COD_SECAO, compras.COD_LOJA
      ) emp_insumo ON sec.COD_SECAO = emp_insumo.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      -- EMPRESTADO (PRODUÇÃO): Produtos FINAIS recebem baseado nas suas VENDAS × receita × custo unitário
      -- Fórmula: QTD_VENDIDA × Σ(QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_final.COD_SECAO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_final ON pp.COD_PRODUTO = p_final.COD_PRODUTO
        -- Vendas do produto final
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        -- Compras dos insumos para calcular custo unitário
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        GROUP BY p_final.COD_SECAO, vendas.COD_LOJA
      ) emp_final ON sec.COD_SECAO = emp_final.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      -- EMPRESTEI (ASSOCIAÇÃO): Produto BASE empresta para produtos VENDIDOS (que têm COD_ASSOCIADO)
      -- COD_PRODUTO = produto vendido (ex: YAKULT C6), COD_ASSOCIADO = produto base comprado (ex: YAKULT unidade)
      -- Fórmula: Σ(QTD_VENDIDA × QTD_EMBALAGEM_VENDA × CUSTO_UNITÁRIO_BASE)
      LEFT JOIN (
        SELECT
          p_base.COD_SECAO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_base ON pl.COD_ASSOCIADO = p_base.COD_PRODUTO
        -- Compras do produto BASE para calcular custo unitário
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        -- Vendas dos produtos que têm associação
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY p_base.COD_SECAO, compras.COD_LOJA
      ) emp_assoc_pai ON sec.COD_SECAO = emp_assoc_pai.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (ASSOCIAÇÃO): Produtos VENDIDOS recebem custo do produto BASE
      -- Fórmula: QTD_VENDIDA × QTD_EMBALAGEM_VENDA × CUSTO_UNITÁRIO_BASE
      LEFT JOIN (
        SELECT
          p_venda.COD_SECAO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        -- Vendas do produto
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO
        -- Compras do produto BASE para calcular custo unitário
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY p_venda.COD_SECAO, vendas.COD_LOJA
      ) emp_assoc_filho ON sec.COD_SECAO = emp_assoc_filho.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
      ` : ''}
      WHERE (sec.FLG_INATIVO IS NULL OR sec.FLG_INATIVO = 'N')
      AND (c.COD_SECAO IS NOT NULL OR v.COD_SECAO IS NOT NULL)
      ORDER BY VENDAS DESC NULLS LAST
    `;

    const rows = await OracleService.query<any>(sql, params);

    // Calcular totais para percentuais de participação
    const totalCompras = rows.reduce((sum, r) => sum + (r.COMPRAS || 0), 0);
    const totalVendas = rows.reduce((sum, r) => sum + (r.VENDAS || 0), 0);

    // Adicionar cálculos conforme Intersolid:
    // - COMPRA_PCT = Compra da Seção / Total Compras * 100
    // - VENDA_PCT = Venda da Seção / Total Vendas * 100
    // - DIFERENCA_PCT = META_PCT - PCT (Custo/Vendas - Compras/Vendas)
    // - COMPRA_FINAL = COMPRAS - EMPRESTEI + EMPRESTADO
    return rows.map(row => {
      const compraFinal = (row.COMPRAS || 0) - (row.EMPRESTEI || 0) + (row.EMPRESTADO || 0);
      // Recalcular PCT usando COMPRA_FINAL em vez de COMPRAS
      const pctCorrigido = (row.VENDAS || 0) > 0 ? Math.round((compraFinal / row.VENDAS) * 10000) / 100 : 0;
      return {
        ...row,
        PCT: pctCorrigido,
        COMPRA_PCT: totalCompras > 0 ? Math.round((row.COMPRAS / totalCompras) * 10000) / 100 : 0,
        VENDA_PCT: totalVendas > 0 ? Math.round((row.VENDAS / totalVendas) * 10000) / 100 : 0,
        DIFERENCA_PCT: Math.round((row.META_PCT - pctCorrigido) * 100) / 100,
        COMPRA_FINAL: Math.round(compraFinal * 100) / 100
      };
    });
  }

  /**
   * Busca resumo totalizador
   */
  static async getTotais(filters: CompraVendaFilters): Promise<any> {
    const data = await this.getCompraVendaPorSecao(filters);

    const totais = data.reduce((acc, row) => ({
      QTD_COMPRA: acc.QTD_COMPRA + (row.QTD_COMPRA || 0),
      QTD_VENDA: acc.QTD_VENDA + (row.QTD_VENDA || 0),
      COMPRAS: acc.COMPRAS + (row.COMPRAS || 0),
      CUSTO_VENDA: acc.CUSTO_VENDA + (row.CUSTO_VENDA || 0),
      VENDAS: acc.VENDAS + (row.VENDAS || 0),
      DIFERENCA_RS: acc.DIFERENCA_RS + (row.DIFERENCA_RS || 0),
      TOTAL_IMPOSTO: acc.TOTAL_IMPOSTO + (row.TOTAL_IMPOSTO || 0),
      EMPRESTEI: acc.EMPRESTEI + (row.EMPRESTEI || 0),
      EMPRESTADO: acc.EMPRESTADO + (row.EMPRESTADO || 0),
      COMPRA_FINAL: acc.COMPRA_FINAL + (row.COMPRA_FINAL || 0)
    }), {
      QTD_COMPRA: 0,
      QTD_VENDA: 0,
      COMPRAS: 0,
      CUSTO_VENDA: 0,
      VENDAS: 0,
      DIFERENCA_RS: 0,
      TOTAL_IMPOSTO: 0,
      EMPRESTEI: 0,
      EMPRESTADO: 0,
      COMPRA_FINAL: 0
    });

    // Calcular margem total (Mark Down)
    const markDownTotal = totais.VENDAS > 0
      ? ((totais.VENDAS - totais.CUSTO_VENDA) / totais.VENDAS) * 100
      : 0;

    // Calcular Meta total (Custo/Vendas)
    const metaTotal = totais.VENDAS > 0
      ? (totais.CUSTO_VENDA / totais.VENDAS) * 100
      : 0;

    // Calcular % total (Compras/Vendas)
    const pctTotal = totais.VENDAS > 0
      ? (totais.COMPRAS / totais.VENDAS) * 100
      : 0;

    // Calcular Margem Líquida total: Lucro Líquido / (Vendas - Imposto) * 100
    const vendaLiquida = totais.VENDAS - totais.TOTAL_IMPOSTO;
    const lucroLiquido = totais.VENDAS - totais.CUSTO_VENDA - totais.TOTAL_IMPOSTO;
    const mgLiquidaTotal = vendaLiquida > 0
      ? (lucroLiquido / vendaLiquida) * 100
      : 0;

    return {
      ...totais,
      MARK_DOWN_PCT: Math.round(markDownTotal * 100) / 100,
      MG_LIQUIDA_PCT: Math.round(mgLiquidaTotal * 100) / 100,
      META_PCT: Math.round(metaTotal * 100) / 100,
      PCT: Math.round(pctTotal * 100) / 100,
      DIFERENCA_PCT: Math.round((metaTotal - pctTotal) * 100) / 100,
      REGISTROS: data.length
    };
  }

  /**
   * Busca dados de Compra x Venda por GRUPO (drill-down de Seção)
   */
  static async getCompraVendaPorGrupo(filters: CompraVendaFilters & { codSecao: number }): Promise<any[]> {
    const {
      dataInicio, dataFim, codSecao, codLoja, tipoNotaFiscal, tipoVenda, decomposicao,
      tipoEmprestimoProducao = true,
      tipoEmprestimoAssociacao = true,
      tipoEmprestimoDecomposicao = true
    } = filters;

    const params: any = {
      dataInicio,
      dataFim,
      codSecao
    };

    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = this.buildProdutoFilters(filters, params);

    // Flag para calcular empréstimos (só quando filtro "Filhos" está ativo)
    const calcularEmprestimos = decomposicao === 'filhos';
    // Flags individuais para cada tipo de empréstimo
    const calcDecomposicao = calcularEmprestimos && tipoEmprestimoDecomposicao;
    const calcProducao = calcularEmprestimos && tipoEmprestimoProducao;
    const calcAssociacao = calcularEmprestimos && tipoEmprestimoAssociacao;

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.COD_LOJA = :codLoja`;
      lojaFilterVendas = ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    const sql = `
      SELECT
        g.COD_GRUPO,
        g.DES_GRUPO as GRUPO,
        NVL(c.COD_LOJA, v.COD_LOJA) as LOJA,
        NVL(c.QTD_COMPRA, 0) as QTD_COMPRA,
        NVL(v.QTD_VENDA, 0) as QTD_VENDA,
        NVL(c.VALOR_COMPRAS, 0) as COMPRAS,
        NVL(v.CUSTO_VENDA, 0) as CUSTO_VENDA,
        NVL(v.VALOR_VENDAS, 0) as VENDAS,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MARK_DOWN_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MG_LUCRO_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NULLIF(NVL(v.VALOR_VENDAS, 0) - NVL(v.TOTAL_IMPOSTO, 0), 0)) * 100, 2)
             ELSE 0
        END as MG_LIQUIDA_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(v.CUSTO_VENDA, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as META_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(c.VALOR_COMPRAS, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as PCT,
        NVL(v.CUSTO_VENDA, 0) - NVL(c.VALOR_COMPRAS, 0) as DIFERENCA_RS,
        NVL(v.TOTAL_IMPOSTO, 0) as TOTAL_IMPOSTO,
        NVL(v.TOTAL_IMPOSTO_CREDITO, 0) as TOTAL_IMPOSTO_CREDITO,
        ${calcDecomposicao ? 'NVL(emp_pai.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_insumo.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_pai.VALOR_EMPRESTEI, 0)' : '0'} as EMPRESTEI,
        ${calcDecomposicao ? 'NVL(emp_filho.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_final.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_filho.VALOR_EMPRESTADO, 0)' : '0'} as EMPRESTADO
      FROM INTERSOLID.TAB_GRUPO g
      LEFT JOIN (
        SELECT
          p.COD_GRUPO,
          nf.COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.VAL_TOTAL) as VALOR_COMPRAS
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p ON ni.COD_ITEM = p.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        AND p.COD_SECAO = :codSecao
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters}
        GROUP BY p.COD_GRUPO, nf.COD_LOJA
      ) c ON g.COD_GRUPO = c.COD_GRUPO
      LEFT JOIN (
        SELECT
          p.COD_GRUPO,
          pv.COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM INTERSOLID.TAB_PRODUTO_PDV pv
        JOIN INTERSOLID.TAB_PRODUTO p ON pv.COD_PRODUTO = p.COD_PRODUTO
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.COD_SECAO = :codSecao
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters}
        GROUP BY p.COD_GRUPO, pv.COD_LOJA
      ) v ON g.COD_GRUPO = v.COD_GRUPO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      ${calcDecomposicao ? `
      -- EMPRESTEI (DECOMPOSIÇÃO): Produtos PAI/MATRIZ deste grupo que emprestam para filhos
      LEFT JOIN (
        SELECT
          p.COD_GRUPO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p ON ni.COD_ITEM = p.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        AND p.COD_SECAO = :codSecao
        ${tipoNfFilter}
        ${lojaFilterCompras}
        AND EXISTS (
          SELECT 1 FROM INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d
          WHERE d.COD_PRODUTO = p.COD_PRODUTO
        )
        GROUP BY p.COD_GRUPO, nf.COD_LOJA
      ) emp_pai ON g.COD_GRUPO = emp_pai.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (DECOMPOSIÇÃO): Valor que FILHOS deste grupo receberam do PAI
      -- Usa QTD_DECOMP como percentual (soma 100% para cada matriz)
      LEFT JOIN (
        SELECT
          p_filho.COD_GRUPO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p_pai ON ni.COD_ITEM = p_pai.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d ON p_pai.COD_PRODUTO = d.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_filho ON d.COD_PRODUTO_DECOM = p_filho.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        AND p_filho.COD_SECAO = :codSecao
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY p_filho.COD_GRUPO, nf.COD_LOJA
      ) emp_filho ON g.COD_GRUPO = emp_filho.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      -- EMPRESTEI (PRODUÇÃO): Insumos emprestam baseado nas VENDAS dos produtos finais
      -- Fórmula: Σ(QTD_VENDIDA × QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_insumo.COD_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.COD_PRODUTO
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE p_insumo.COD_SECAO = :codSecao
        GROUP BY p_insumo.COD_GRUPO, compras.COD_LOJA
      ) emp_insumo ON g.COD_GRUPO = emp_insumo.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      -- EMPRESTADO (PRODUÇÃO): Produtos FINAIS recebem baseado nas suas VENDAS × receita × custo unitário
      -- Fórmula: QTD_VENDIDA × Σ(QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_final.COD_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_final ON pp.COD_PRODUTO = p_final.COD_PRODUTO
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE p_final.COD_SECAO = :codSecao
        GROUP BY p_final.COD_GRUPO, vendas.COD_LOJA
      ) emp_final ON g.COD_GRUPO = emp_final.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      -- EMPRESTEI (ASSOCIAÇÃO): Produto BASE empresta para produtos VENDIDOS
      LEFT JOIN (
        SELECT
          p_base.COD_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_base ON pl.COD_ASSOCIADO = p_base.COD_PRODUTO
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_base.COD_SECAO = :codSecao
        GROUP BY p_base.COD_GRUPO, compras.COD_LOJA
      ) emp_assoc_pai ON g.COD_GRUPO = emp_assoc_pai.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (ASSOCIAÇÃO): Produtos VENDIDOS recebem custo do BASE
      LEFT JOIN (
        SELECT
          p_venda.COD_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_venda.COD_SECAO = :codSecao
        GROUP BY p_venda.COD_GRUPO, vendas.COD_LOJA
      ) emp_assoc_filho ON g.COD_GRUPO = emp_assoc_filho.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
      ` : ''}
      WHERE g.COD_SECAO = :codSecao
      AND (c.COD_GRUPO IS NOT NULL OR v.COD_GRUPO IS NOT NULL)
      ORDER BY VENDAS DESC NULLS LAST
    `;

    const rows = await OracleService.query<any>(sql, params);

    const totalCompras = rows.reduce((sum, r) => sum + (r.COMPRAS || 0), 0);
    const totalVendas = rows.reduce((sum, r) => sum + (r.VENDAS || 0), 0);

    return rows.map(row => {
      const compraFinal = (row.COMPRAS || 0) - (row.EMPRESTEI || 0) + (row.EMPRESTADO || 0);
      // Recalcular PCT usando COMPRA_FINAL em vez de COMPRAS
      const pctCorrigido = (row.VENDAS || 0) > 0 ? Math.round((compraFinal / row.VENDAS) * 10000) / 100 : 0;
      return {
        ...row,
        PCT: pctCorrigido,
        COMPRA_PCT: totalCompras > 0 ? Math.round((row.COMPRAS / totalCompras) * 10000) / 100 : 0,
        VENDA_PCT: totalVendas > 0 ? Math.round((row.VENDAS / totalVendas) * 10000) / 100 : 0,
        DIFERENCA_PCT: Math.round((row.META_PCT - pctCorrigido) * 100) / 100,
        COMPRA_FINAL: Math.round(compraFinal * 100) / 100
      };
    });
  }

  /**
   * Busca dados de Compra x Venda por SUBGRUPO (drill-down de Grupo)
   */
  static async getCompraVendaPorSubGrupo(filters: CompraVendaFilters & { codSecao: number; codGrupo: number }): Promise<any[]> {
    const {
      dataInicio, dataFim, codSecao, codGrupo, codLoja, tipoNotaFiscal, tipoVenda, decomposicao,
      tipoEmprestimoProducao = true,
      tipoEmprestimoAssociacao = true,
      tipoEmprestimoDecomposicao = true
    } = filters;

    const params: any = {
      dataInicio,
      dataFim,
      codSecao,
      codGrupo
    };

    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = this.buildProdutoFilters(filters, params);

    // Flag para calcular empréstimos (só quando filtro "Filhos" está ativo)
    const calcularEmprestimos = decomposicao === 'filhos';
    // Flags individuais para cada tipo de empréstimo
    const calcDecomposicao = calcularEmprestimos && tipoEmprestimoDecomposicao;
    const calcProducao = calcularEmprestimos && tipoEmprestimoProducao;
    const calcAssociacao = calcularEmprestimos && tipoEmprestimoAssociacao;

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.COD_LOJA = :codLoja`;
      lojaFilterVendas = ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    const sql = `
      SELECT
        sg.COD_SUB_GRUPO,
        sg.DES_SUB_GRUPO as SUBGRUPO,
        NVL(c.COD_LOJA, v.COD_LOJA) as LOJA,
        NVL(c.QTD_COMPRA, 0) as QTD_COMPRA,
        NVL(v.QTD_VENDA, 0) as QTD_VENDA,
        NVL(c.VALOR_COMPRAS, 0) as COMPRAS,
        NVL(v.CUSTO_VENDA, 0) as CUSTO_VENDA,
        NVL(v.VALOR_VENDAS, 0) as VENDAS,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MARK_DOWN_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MG_LUCRO_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NULLIF(NVL(v.VALOR_VENDAS, 0) - NVL(v.TOTAL_IMPOSTO, 0), 0)) * 100, 2)
             ELSE 0
        END as MG_LIQUIDA_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(v.CUSTO_VENDA, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as META_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(c.VALOR_COMPRAS, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as PCT,
        NVL(v.CUSTO_VENDA, 0) - NVL(c.VALOR_COMPRAS, 0) as DIFERENCA_RS,
        NVL(v.TOTAL_IMPOSTO, 0) as TOTAL_IMPOSTO,
        NVL(v.TOTAL_IMPOSTO_CREDITO, 0) as TOTAL_IMPOSTO_CREDITO,
        ${calcDecomposicao ? 'NVL(emp_pai.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_insumo.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_pai.VALOR_EMPRESTEI, 0)' : '0'} as EMPRESTEI,
        ${calcDecomposicao ? 'NVL(emp_filho.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_final.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_filho.VALOR_EMPRESTADO, 0)' : '0'} as EMPRESTADO
      FROM INTERSOLID.TAB_SUBGRUPO sg
      LEFT JOIN (
        SELECT
          p.COD_SUB_GRUPO,
          nf.COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.VAL_TOTAL) as VALOR_COMPRAS
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p ON ni.COD_ITEM = p.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        AND p.COD_SECAO = :codSecao
        AND p.COD_GRUPO = :codGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters}
        GROUP BY p.COD_SUB_GRUPO, nf.COD_LOJA
      ) c ON sg.COD_SUB_GRUPO = c.COD_SUB_GRUPO
      LEFT JOIN (
        SELECT
          p.COD_SUB_GRUPO,
          pv.COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM INTERSOLID.TAB_PRODUTO_PDV pv
        JOIN INTERSOLID.TAB_PRODUTO p ON pv.COD_PRODUTO = p.COD_PRODUTO
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.COD_SECAO = :codSecao
        AND p.COD_GRUPO = :codGrupo
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters}
        GROUP BY p.COD_SUB_GRUPO, pv.COD_LOJA
      ) v ON sg.COD_SUB_GRUPO = v.COD_SUB_GRUPO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      ${calcDecomposicao ? `
      -- EMPRESTEI (DECOMPOSIÇÃO): Produtos PAI/MATRIZ deste subgrupo que emprestam para filhos
      LEFT JOIN (
        SELECT
          p.COD_SUB_GRUPO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p ON ni.COD_ITEM = p.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        AND p.COD_SECAO = :codSecao
        AND p.COD_GRUPO = :codGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        AND EXISTS (
          SELECT 1 FROM INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d
          WHERE d.COD_PRODUTO = p.COD_PRODUTO
        )
        GROUP BY p.COD_SUB_GRUPO, nf.COD_LOJA
      ) emp_pai ON sg.COD_SUB_GRUPO = emp_pai.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (DECOMPOSIÇÃO): Valor que FILHOS deste subgrupo receberam do PAI
      -- Usa QTD_DECOMP como percentual (soma 100% para cada matriz)
      LEFT JOIN (
        SELECT
          p_filho.COD_SUB_GRUPO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO p_pai ON ni.COD_ITEM = p_pai.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d ON p_pai.COD_PRODUTO = d.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_filho ON d.COD_PRODUTO_DECOM = p_filho.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        AND p_filho.COD_SECAO = :codSecao
        AND p_filho.COD_GRUPO = :codGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY p_filho.COD_SUB_GRUPO, nf.COD_LOJA
      ) emp_filho ON sg.COD_SUB_GRUPO = emp_filho.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      -- EMPRESTEI (PRODUÇÃO): Insumos emprestam baseado nas VENDAS dos produtos finais
      -- Fórmula: Σ(QTD_VENDIDA × QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_insumo.COD_SUB_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.COD_PRODUTO
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE p_insumo.COD_SECAO = :codSecao AND p_insumo.COD_GRUPO = :codGrupo
        GROUP BY p_insumo.COD_SUB_GRUPO, compras.COD_LOJA
      ) emp_insumo ON sg.COD_SUB_GRUPO = emp_insumo.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      -- EMPRESTADO (PRODUÇÃO): Produtos FINAIS recebem baseado nas suas VENDAS × receita × custo unitário
      -- Fórmula: QTD_VENDIDA × Σ(QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_final.COD_SUB_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_final ON pp.COD_PRODUTO = p_final.COD_PRODUTO
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE p_final.COD_SECAO = :codSecao AND p_final.COD_GRUPO = :codGrupo
        GROUP BY p_final.COD_SUB_GRUPO, vendas.COD_LOJA
      ) emp_final ON sg.COD_SUB_GRUPO = emp_final.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      -- EMPRESTEI (ASSOCIAÇÃO): Produto BASE empresta para produtos VENDIDOS
      LEFT JOIN (
        SELECT
          p_base.COD_SUB_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_base ON pl.COD_ASSOCIADO = p_base.COD_PRODUTO
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_base.COD_SECAO = :codSecao AND p_base.COD_GRUPO = :codGrupo
        GROUP BY p_base.COD_SUB_GRUPO, compras.COD_LOJA
      ) emp_assoc_pai ON sg.COD_SUB_GRUPO = emp_assoc_pai.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (ASSOCIAÇÃO): Produtos VENDIDOS recebem custo do BASE
      LEFT JOIN (
        SELECT
          p_venda.COD_SUB_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_venda.COD_SECAO = :codSecao AND p_venda.COD_GRUPO = :codGrupo
        GROUP BY p_venda.COD_SUB_GRUPO, vendas.COD_LOJA
      ) emp_assoc_filho ON sg.COD_SUB_GRUPO = emp_assoc_filho.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
      ` : ''}
      WHERE sg.COD_SECAO = :codSecao
      AND sg.COD_GRUPO = :codGrupo
      AND (c.COD_SUB_GRUPO IS NOT NULL OR v.COD_SUB_GRUPO IS NOT NULL)
      ORDER BY VENDAS DESC NULLS LAST
    `;

    const rows = await OracleService.query<any>(sql, params);

    const totalCompras = rows.reduce((sum, r) => sum + (r.COMPRAS || 0), 0);
    const totalVendas = rows.reduce((sum, r) => sum + (r.VENDAS || 0), 0);

    return rows.map(row => {
      const compraFinal = (row.COMPRAS || 0) - (row.EMPRESTEI || 0) + (row.EMPRESTADO || 0);
      // Recalcular PCT usando COMPRA_FINAL em vez de COMPRAS
      const pctCorrigido = (row.VENDAS || 0) > 0 ? Math.round((compraFinal / row.VENDAS) * 10000) / 100 : 0;
      return {
        ...row,
        PCT: pctCorrigido,
        COMPRA_PCT: totalCompras > 0 ? Math.round((row.COMPRAS / totalCompras) * 10000) / 100 : 0,
        VENDA_PCT: totalVendas > 0 ? Math.round((row.VENDAS / totalVendas) * 10000) / 100 : 0,
        DIFERENCA_PCT: Math.round((row.META_PCT - pctCorrigido) * 100) / 100,
        COMPRA_FINAL: Math.round(compraFinal * 100) / 100
      };
    });
  }

  /**
   * Busca dados de Compra x Venda por ITEM/PRODUTO (drill-down de SubGrupo)
   */
  static async getCompraVendaPorItem(filters: CompraVendaFilters & { codSecao: number; codGrupo: number; codSubGrupo: number }): Promise<any[]> {
    const {
      dataInicio, dataFim, codSecao, codGrupo, codSubGrupo, codLoja, tipoNotaFiscal, tipoVenda, decomposicao,
      tipoEmprestimoProducao = true,
      tipoEmprestimoAssociacao = true,
      tipoEmprestimoDecomposicao = true
    } = filters;

    const params: any = {
      dataInicio,
      dataFim,
      codSecao,
      codGrupo,
      codSubGrupo
    };

    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = this.buildProdutoFilters(filters, params);

    // Flag para calcular empréstimos (só quando filtro "Filhos" está ativo)
    const calcularEmprestimos = decomposicao === 'filhos';
    // Flags individuais para cada tipo de empréstimo
    const calcDecomposicao = calcularEmprestimos && tipoEmprestimoDecomposicao;
    const calcProducao = calcularEmprestimos && tipoEmprestimoProducao;
    const calcAssociacao = calcularEmprestimos && tipoEmprestimoAssociacao;

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.COD_LOJA = :codLoja`;
      lojaFilterVendas = ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    const sql = `
      SELECT
        p.COD_PRODUTO,
        p.DES_PRODUTO as PRODUTO,
        NVL(c.COD_LOJA, v.COD_LOJA) as LOJA,
        NVL(c.QTD_COMPRA, 0) as QTD_COMPRA,
        NVL(v.QTD_VENDA, 0) as QTD_VENDA,
        NVL(c.VALOR_COMPRAS, 0) as COMPRAS,
        NVL(v.CUSTO_VENDA, 0) as CUSTO_VENDA,
        NVL(v.VALOR_VENDAS, 0) as VENDAS,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MARK_DOWN_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as MG_LUCRO_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND(((NVL(v.VALOR_VENDAS, 0) - NVL(v.CUSTO_VENDA, 0) - NVL(v.TOTAL_IMPOSTO, 0) + NVL(v.TOTAL_IMPOSTO_CREDITO, 0)) / NULLIF(NVL(v.VALOR_VENDAS, 0) - NVL(v.TOTAL_IMPOSTO, 0), 0)) * 100, 2)
             ELSE 0
        END as MG_LIQUIDA_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(v.CUSTO_VENDA, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as META_PCT,
        CASE WHEN NVL(v.VALOR_VENDAS, 0) > 0
             THEN ROUND((NVL(c.VALOR_COMPRAS, 0) / NVL(v.VALOR_VENDAS, 0)) * 100, 2)
             ELSE 0
        END as PCT,
        NVL(v.CUSTO_VENDA, 0) - NVL(c.VALOR_COMPRAS, 0) as DIFERENCA_RS,
        NVL(v.TOTAL_IMPOSTO, 0) as TOTAL_IMPOSTO,
        NVL(v.TOTAL_IMPOSTO_CREDITO, 0) as TOTAL_IMPOSTO_CREDITO,
        ${calcDecomposicao ? 'NVL(emp_pai.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_insumo.VALOR_EMPRESTEI, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_pai.VALOR_EMPRESTEI, 0)' : '0'} as EMPRESTEI,
        ${calcDecomposicao ? 'NVL(emp_filho.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcProducao ? 'NVL(emp_final.VALOR_EMPRESTADO, 0)' : '0'}
        + ${calcAssociacao ? 'NVL(emp_assoc_filho.VALOR_EMPRESTADO, 0)' : '0'} as EMPRESTADO,
        NVL(est.QTD_EST_ATUAL, 0) as ESTOQUE_ATUAL,
        NVL(est.QTD_COBERTURA, 0) as DIAS_COBERTURA
      FROM INTERSOLID.TAB_PRODUTO p
      LEFT JOIN (
        SELECT
          ni.COD_ITEM,
          nf.COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.VAL_TOTAL) as VALOR_COMPRAS
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO prod ON ni.COD_ITEM = prod.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        AND prod.COD_SECAO = :codSecao
        AND prod.COD_GRUPO = :codGrupo
        AND prod.COD_SUB_GRUPO = :codSubGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters.replace(/p\./g, 'prod.')}
        GROUP BY ni.COD_ITEM, nf.COD_LOJA
      ) c ON p.COD_PRODUTO = c.COD_ITEM
      LEFT JOIN (
        SELECT
          pv.COD_PRODUTO,
          pv.COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM INTERSOLID.TAB_PRODUTO_PDV pv
        JOIN INTERSOLID.TAB_PRODUTO prod ON pv.COD_PRODUTO = prod.COD_PRODUTO
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND prod.COD_SECAO = :codSecao
        AND prod.COD_GRUPO = :codGrupo
        AND prod.COD_SUB_GRUPO = :codSubGrupo
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters.replace(/p\./g, 'prod.')}
        GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
      ) v ON p.COD_PRODUTO = v.COD_PRODUTO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      ${calcDecomposicao ? `
      -- EMPRESTEI (DECOMPOSIÇÃO): Se este produto é PAI de decomposição, mostra quanto emprestou
      LEFT JOIN (
        SELECT
          ni.COD_ITEM as COD_PRODUTO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        AND EXISTS (
          SELECT 1 FROM INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d
          WHERE d.COD_PRODUTO = ni.COD_ITEM
        )
        GROUP BY ni.COD_ITEM, nf.COD_LOJA
      ) emp_pai ON p.COD_PRODUTO = emp_pai.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (DECOMPOSIÇÃO): Se este produto é FILHO de decomposição, mostra quanto recebeu
      -- Usa QTD_DECOMP como percentual (soma 100% para cada matriz)
      LEFT JOIN (
        SELECT
          d.COD_PRODUTO_DECOM as COD_PRODUTO,
          nf.COD_LOJA,
          SUM(ni.VAL_TOTAL * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_NF nf
        JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
          AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
          AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
        JOIN INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d ON ni.COD_ITEM = d.COD_PRODUTO
        WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.TIPO_OPERACAO = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY d.COD_PRODUTO_DECOM, nf.COD_LOJA
      ) emp_filho ON p.COD_PRODUTO = emp_filho.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      -- EMPRESTEI (PRODUÇÃO): Insumo empresta baseado nas VENDAS dos produtos finais
      -- Fórmula: Σ(QTD_VENDIDA × QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          pp.COD_PRODUTO_PRODUCAO as COD_PRODUTO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        GROUP BY pp.COD_PRODUTO_PRODUCAO, compras.COD_LOJA
      ) emp_insumo ON p.COD_PRODUTO = emp_insumo.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      -- EMPRESTADO (PRODUÇÃO): Produto FINAL recebe baseado nas suas VENDAS × receita × custo unitário
      -- Fórmula: QTD_VENDIDA × Σ(QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          pp.COD_PRODUTO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        GROUP BY pp.COD_PRODUTO, vendas.COD_LOJA
      ) emp_final ON p.COD_PRODUTO = emp_final.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      -- EMPRESTEI (ASSOCIAÇÃO): Produto BASE empresta para produtos VENDIDOS
      LEFT JOIN (
        SELECT
          pl.COD_ASSOCIADO as COD_PRODUTO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY pl.COD_ASSOCIADO, compras.COD_LOJA
      ) emp_assoc_pai ON p.COD_PRODUTO = emp_assoc_pai.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (ASSOCIAÇÃO): Produtos VENDIDOS recebem custo do BASE
      LEFT JOIN (
        SELECT
          pl.COD_PRODUTO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_venda ON pl.COD_PRODUTO = p_venda.COD_PRODUTO
        JOIN (
          SELECT pv.COD_PRODUTO, pv.COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO, pv.COD_LOJA
        ) vendas ON pl.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.COD_ITEM, nf.COD_LOJA, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM, nf.COD_LOJA
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY pl.COD_PRODUTO, vendas.COD_LOJA
      ) emp_assoc_filho ON p.COD_PRODUTO = emp_assoc_filho.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
      ` : ''}
      -- ESTOQUE: Busca estoque atual e dias de cobertura da TAB_PRODUTO_LOJA
      LEFT JOIN INTERSOLID.TAB_PRODUTO_LOJA est ON p.COD_PRODUTO = est.COD_PRODUTO
        AND est.COD_LOJA = NVL(c.COD_LOJA, v.COD_LOJA)
      WHERE p.COD_SECAO = :codSecao
      AND p.COD_GRUPO = :codGrupo
      AND p.COD_SUB_GRUPO = :codSubGrupo
      AND (c.COD_ITEM IS NOT NULL OR v.COD_PRODUTO IS NOT NULL
           ${calcDecomposicao ? 'OR emp_pai.COD_PRODUTO IS NOT NULL OR emp_filho.COD_PRODUTO IS NOT NULL' : ''}
           ${calcProducao ? 'OR emp_insumo.COD_PRODUTO IS NOT NULL OR emp_final.COD_PRODUTO IS NOT NULL' : ''}
           ${calcAssociacao ? 'OR emp_assoc_pai.COD_PRODUTO IS NOT NULL OR emp_assoc_filho.COD_PRODUTO IS NOT NULL' : ''})
      ORDER BY p.DES_PRODUTO ASC
    `;

    const rows = await OracleService.query<any>(sql, params);

    const totalCompras = rows.reduce((sum, r) => sum + (r.COMPRAS || 0), 0);
    const totalVendas = rows.reduce((sum, r) => sum + (r.VENDAS || 0), 0);

    return rows.map(row => {
      const compraFinal = (row.COMPRAS || 0) - (row.EMPRESTEI || 0) + (row.EMPRESTADO || 0);
      // Recalcular PCT usando COMPRA_FINAL em vez de COMPRAS
      const pctCorrigido = (row.VENDAS || 0) > 0 ? Math.round((compraFinal / row.VENDAS) * 10000) / 100 : 0;
      return {
        ...row,
        PCT: pctCorrigido,
        COMPRA_PCT: totalCompras > 0 ? Math.round((row.COMPRAS / totalCompras) * 10000) / 100 : 0,
        VENDA_PCT: totalVendas > 0 ? Math.round((row.VENDAS / totalVendas) * 10000) / 100 : 0,
        DIFERENCA_PCT: Math.round((row.META_PCT - pctCorrigido) * 100) / 100,
        COMPRA_FINAL: Math.round(compraFinal * 100) / 100
      };
    });
  }

  /**
   * Busca o detalhamento dos valores de Emprestei/Emprestado
   * Retorna os itens que compõem cada tipo de empréstimo (decomposição, produção, associação)
   */
  static async getDetalheEmprestimo(filters: CompraVendaFilters & {
    nivel: 'secao' | 'grupo' | 'subgrupo' | 'item';
    codSecao?: number;
    codGrupo?: number;
    codSubGrupo?: number;
    codProduto?: number;
    tipo: 'emprestei' | 'emprestado';
  }): Promise<{
    decomposicao: any[];
    producao: any[];
    associacao: any[];
    totalDecomposicao: number;
    totalProducao: number;
    totalAssociacao: number;
    total: number;
  }> {
    const { dataInicio, dataFim, codLoja, tipoNotaFiscal, tipoVenda, nivel, tipo, codSecao, codGrupo, codSubGrupo, codProduto } = filters;

    const params: any = { dataInicio, dataFim };
    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.COD_LOJA = :codLoja`;
      lojaFilterVendas = ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    // Filtro de nível
    let nivelFilter = '';
    if (codSecao) {
      nivelFilter += ` AND p.COD_SECAO = :codSecao`;
      params.codSecao = codSecao;
    }
    if (codGrupo) {
      nivelFilter += ` AND p.COD_GRUPO = :codGrupo`;
      params.codGrupo = codGrupo;
    }
    if (codSubGrupo) {
      nivelFilter += ` AND p.COD_SUB_GRUPO = :codSubGrupo`;
      params.codSubGrupo = codSubGrupo;
    }
    if (codProduto) {
      nivelFilter += ` AND p.COD_PRODUTO = :codProduto`;
      params.codProduto = codProduto;
    }

    const result = {
      decomposicao: [] as any[],
      producao: [] as any[],
      associacao: [] as any[],
      totalDecomposicao: 0,
      totalProducao: 0,
      totalAssociacao: 0,
      total: 0
    };

    // ========== DECOMPOSIÇÃO ==========
    if (tipo === 'emprestei') {
      // EMPRESTEI: Produtos MATRIZ que emprestam para FILHOS
      const sqlDecomp = `
        SELECT
          p_pai.COD_PRODUTO as COD_ORIGEM,
          p_pai.DES_PRODUTO as PRODUTO_ORIGEM,
          sec_pai.DES_SECAO as SECAO_ORIGEM,
          grp_pai.DES_GRUPO as GRUPO_ORIGEM,
          sgp_pai.DES_SUB_GRUPO as SUBGRUPO_ORIGEM,
          p_filho.COD_PRODUTO as COD_DESTINO,
          p_filho.DES_PRODUTO as PRODUTO_DESTINO,
          sec_filho.DES_SECAO as SECAO_DESTINO,
          grp_filho.DES_GRUPO as GRUPO_DESTINO,
          sgp_filho.DES_SUB_GRUPO as SUBGRUPO_DESTINO,
          d.QTD_DECOMP as PERCENTUAL,
          NVL(compras.VAL_TOTAL, 0) * d.QTD_DECOMP / 100 as VALOR
        FROM INTERSOLID.TAB_PRODUTO p_pai
        JOIN INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d ON p_pai.COD_PRODUTO = d.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_filho ON d.COD_PRODUTO_DECOM = p_filho.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_pai ON p_pai.COD_SECAO = sec_pai.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_pai ON p_pai.COD_SECAO = grp_pai.COD_SECAO AND p_pai.COD_GRUPO = grp_pai.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_pai ON p_pai.COD_SECAO = sgp_pai.COD_SECAO AND p_pai.COD_GRUPO = sgp_pai.COD_GRUPO AND p_pai.COD_SUB_GRUPO = sgp_pai.COD_SUB_GRUPO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_filho ON p_filho.COD_SECAO = sec_filho.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_filho ON p_filho.COD_SECAO = grp_filho.COD_SECAO AND p_filho.COD_GRUPO = grp_filho.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_filho ON p_filho.COD_SECAO = sgp_filho.COD_SECAO AND p_filho.COD_GRUPO = sgp_filho.COD_GRUPO AND p_filho.COD_SUB_GRUPO = sgp_filho.COD_SUB_GRUPO
        LEFT JOIN (
          SELECT ni.COD_ITEM, SUM(ni.VAL_TOTAL) as VAL_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM
        ) compras ON p_pai.COD_PRODUTO = compras.COD_ITEM
        WHERE 1=1 ${nivelFilter.replace(/p\./g, 'p_pai.')}
        AND compras.VAL_TOTAL > 0
        ORDER BY VALOR DESC NULLS LAST
      `;
      result.decomposicao = await OracleService.query<any>(sqlDecomp, params);
      result.totalDecomposicao = result.decomposicao.reduce((sum, r) => sum + (r.VALOR || 0), 0);
    } else {
      // EMPRESTADO: Produtos FILHO que recebem de MATRIZ
      const sqlDecomp = `
        SELECT
          p_filho.COD_PRODUTO as COD_DESTINO,
          p_filho.DES_PRODUTO as PRODUTO_DESTINO,
          sec_filho.DES_SECAO as SECAO_DESTINO,
          grp_filho.DES_GRUPO as GRUPO_DESTINO,
          sgp_filho.DES_SUB_GRUPO as SUBGRUPO_DESTINO,
          p_pai.COD_PRODUTO as COD_ORIGEM,
          p_pai.DES_PRODUTO as PRODUTO_ORIGEM,
          sec_pai.DES_SECAO as SECAO_ORIGEM,
          grp_pai.DES_GRUPO as GRUPO_ORIGEM,
          sgp_pai.DES_SUB_GRUPO as SUBGRUPO_ORIGEM,
          d.QTD_DECOMP as PERCENTUAL,
          NVL(compras.VAL_TOTAL, 0) * d.QTD_DECOMP / 100 as VALOR
        FROM INTERSOLID.TAB_PRODUTO p_filho
        JOIN INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d ON p_filho.COD_PRODUTO = d.COD_PRODUTO_DECOM
        JOIN INTERSOLID.TAB_PRODUTO p_pai ON d.COD_PRODUTO = p_pai.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_pai ON p_pai.COD_SECAO = sec_pai.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_pai ON p_pai.COD_SECAO = grp_pai.COD_SECAO AND p_pai.COD_GRUPO = grp_pai.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_pai ON p_pai.COD_SECAO = sgp_pai.COD_SECAO AND p_pai.COD_GRUPO = sgp_pai.COD_GRUPO AND p_pai.COD_SUB_GRUPO = sgp_pai.COD_SUB_GRUPO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_filho ON p_filho.COD_SECAO = sec_filho.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_filho ON p_filho.COD_SECAO = grp_filho.COD_SECAO AND p_filho.COD_GRUPO = grp_filho.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_filho ON p_filho.COD_SECAO = sgp_filho.COD_SECAO AND p_filho.COD_GRUPO = sgp_filho.COD_GRUPO AND p_filho.COD_SUB_GRUPO = sgp_filho.COD_SUB_GRUPO
        LEFT JOIN (
          SELECT ni.COD_ITEM, SUM(ni.VAL_TOTAL) as VAL_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM
        ) compras ON p_pai.COD_PRODUTO = compras.COD_ITEM
        WHERE 1=1 ${nivelFilter.replace(/p\./g, 'p_filho.')}
        AND compras.VAL_TOTAL > 0
        ORDER BY VALOR DESC NULLS LAST
      `;
      result.decomposicao = await OracleService.query<any>(sqlDecomp, params);
      result.totalDecomposicao = result.decomposicao.reduce((sum, r) => sum + (r.VALOR || 0), 0);
    }

    // ========== PRODUÇÃO ==========
    if (tipo === 'emprestei') {
      // EMPRESTEI: Insumos que emprestam para produtos finais (baseado em VENDAS)
      const sqlProd = `
        SELECT
          p_insumo.COD_PRODUTO as COD_ORIGEM,
          p_insumo.DES_PRODUTO as PRODUTO_ORIGEM,
          sec_insumo.DES_SECAO as SECAO_ORIGEM,
          grp_insumo.DES_GRUPO as GRUPO_ORIGEM,
          sgp_insumo.DES_SUB_GRUPO as SUBGRUPO_ORIGEM,
          p_final.COD_PRODUTO as COD_DESTINO,
          p_final.DES_PRODUTO as PRODUTO_DESTINO,
          sec_final.DES_SECAO as SECAO_DESTINO,
          grp_final.DES_GRUPO as GRUPO_DESTINO,
          sgp_final.DES_SUB_GRUPO as SUBGRUPO_DESTINO,
          pp.QTD_PRODUCAO as QTD_RECEITA,
          NVL(vendas.QTD_VENDIDA, 0) * pp.QTD_PRODUCAO * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_final ON pp.COD_PRODUTO = p_final.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_insumo ON p_insumo.COD_SECAO = sec_insumo.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_insumo ON p_insumo.COD_SECAO = grp_insumo.COD_SECAO AND p_insumo.COD_GRUPO = grp_insumo.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_insumo ON p_insumo.COD_SECAO = sgp_insumo.COD_SECAO AND p_insumo.COD_GRUPO = sgp_insumo.COD_GRUPO AND p_insumo.COD_SUB_GRUPO = sgp_insumo.COD_SUB_GRUPO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_final ON p_final.COD_SECAO = sec_final.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_final ON p_final.COD_SECAO = grp_final.COD_SECAO AND p_final.COD_GRUPO = grp_final.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_final ON p_final.COD_SECAO = sgp_final.COD_SECAO AND p_final.COD_GRUPO = sgp_final.COD_GRUPO AND p_final.COD_SUB_GRUPO = sgp_final.COD_SUB_GRUPO
        LEFT JOIN (
          SELECT ni.COD_ITEM, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM
        ) compras ON p_insumo.COD_PRODUTO = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_final.COD_PRODUTO = vendas.COD_PRODUTO
        WHERE 1=1 ${nivelFilter.replace(/p\./g, 'p_insumo.')}
        AND vendas.QTD_VENDIDA > 0
        ORDER BY VALOR DESC NULLS LAST
      `;
      result.producao = await OracleService.query<any>(sqlProd, params);
      result.totalProducao = result.producao.reduce((sum, r) => sum + (r.VALOR || 0), 0);
    } else {
      // EMPRESTADO: Produtos finais que recebem de insumos
      const sqlProd = `
        SELECT
          p_final.COD_PRODUTO as COD_DESTINO,
          p_final.DES_PRODUTO as PRODUTO_DESTINO,
          sec_final.DES_SECAO as SECAO_DESTINO,
          grp_final.DES_GRUPO as GRUPO_DESTINO,
          sgp_final.DES_SUB_GRUPO as SUBGRUPO_DESTINO,
          p_insumo.COD_PRODUTO as COD_ORIGEM,
          p_insumo.DES_PRODUTO as PRODUTO_ORIGEM,
          sec_insumo.DES_SECAO as SECAO_ORIGEM,
          grp_insumo.DES_GRUPO as GRUPO_ORIGEM,
          sgp_insumo.DES_SUB_GRUPO as SUBGRUPO_ORIGEM,
          pp.QTD_PRODUCAO as QTD_RECEITA,
          NVL(vendas.QTD_VENDIDA, 0) * pp.QTD_PRODUCAO * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM INTERSOLID.TAB_PRODUTO_PRODUCAO pp
        JOIN INTERSOLID.TAB_PRODUTO p_final ON pp.COD_PRODUTO = p_final.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_insumo ON p_insumo.COD_SECAO = sec_insumo.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_insumo ON p_insumo.COD_SECAO = grp_insumo.COD_SECAO AND p_insumo.COD_GRUPO = grp_insumo.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_insumo ON p_insumo.COD_SECAO = sgp_insumo.COD_SECAO AND p_insumo.COD_GRUPO = sgp_insumo.COD_GRUPO AND p_insumo.COD_SUB_GRUPO = sgp_insumo.COD_SUB_GRUPO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_final ON p_final.COD_SECAO = sec_final.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_final ON p_final.COD_SECAO = grp_final.COD_SECAO AND p_final.COD_GRUPO = grp_final.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_final ON p_final.COD_SECAO = sgp_final.COD_SECAO AND p_final.COD_GRUPO = sgp_final.COD_GRUPO AND p_final.COD_SUB_GRUPO = sgp_final.COD_SUB_GRUPO
        LEFT JOIN (
          SELECT ni.COD_ITEM, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM
        ) compras ON p_insumo.COD_PRODUTO = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_final.COD_PRODUTO = vendas.COD_PRODUTO
        WHERE 1=1 ${nivelFilter.replace(/p\./g, 'p_final.')}
        AND vendas.QTD_VENDIDA > 0
        ORDER BY VALOR DESC NULLS LAST
      `;
      result.producao = await OracleService.query<any>(sqlProd, params);
      result.totalProducao = result.producao.reduce((sum, r) => sum + (r.VALOR || 0), 0);
    }

    // ========== ASSOCIAÇÃO ==========
    if (tipo === 'emprestei') {
      // EMPRESTEI: Produtos BASE que emprestam para ASSOCIADOS
      const sqlAssoc = `
        SELECT
          p_base.COD_PRODUTO as COD_ORIGEM,
          p_base.DES_PRODUTO as PRODUTO_ORIGEM,
          sec_base.DES_SECAO as SECAO_ORIGEM,
          grp_base.DES_GRUPO as GRUPO_ORIGEM,
          sgp_base.DES_SUB_GRUPO as SUBGRUPO_ORIGEM,
          p_assoc.COD_PRODUTO as COD_DESTINO,
          p_assoc.DES_PRODUTO as PRODUTO_DESTINO,
          sec_assoc.DES_SECAO as SECAO_DESTINO,
          grp_assoc.DES_GRUPO as GRUPO_DESTINO,
          sgp_assoc.DES_SUB_GRUPO as SUBGRUPO_DESTINO,
          NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) as QTD_ASSOC,
          NVL(vendas.QTD_VENDIDA, 0) * NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_base ON pl.COD_ASSOCIADO = p_base.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_assoc ON pl.COD_PRODUTO = p_assoc.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_base ON p_base.COD_SECAO = sec_base.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_base ON p_base.COD_SECAO = grp_base.COD_SECAO AND p_base.COD_GRUPO = grp_base.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_base ON p_base.COD_SECAO = sgp_base.COD_SECAO AND p_base.COD_GRUPO = sgp_base.COD_GRUPO AND p_base.COD_SUB_GRUPO = sgp_base.COD_SUB_GRUPO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_assoc ON p_assoc.COD_SECAO = sec_assoc.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_assoc ON p_assoc.COD_SECAO = grp_assoc.COD_SECAO AND p_assoc.COD_GRUPO = grp_assoc.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_assoc ON p_assoc.COD_SECAO = sgp_assoc.COD_SECAO AND p_assoc.COD_GRUPO = sgp_assoc.COD_GRUPO AND p_assoc.COD_SUB_GRUPO = sgp_assoc.COD_SUB_GRUPO
        LEFT JOIN (
          SELECT ni.COD_ITEM, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM
        ) compras ON p_base.COD_PRODUTO = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_assoc.COD_PRODUTO = vendas.COD_PRODUTO
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        ${nivelFilter.replace(/p\./g, 'p_base.')}
        AND vendas.QTD_VENDIDA > 0
        ORDER BY VALOR DESC NULLS LAST
      `;
      result.associacao = await OracleService.query<any>(sqlAssoc, params);
      result.totalAssociacao = result.associacao.reduce((sum, r) => sum + (r.VALOR || 0), 0);
    } else {
      // EMPRESTADO: Produtos ASSOCIADOS que recebem de BASE
      const sqlAssoc = `
        SELECT
          p_assoc.COD_PRODUTO as COD_DESTINO,
          p_assoc.DES_PRODUTO as PRODUTO_DESTINO,
          sec_assoc.DES_SECAO as SECAO_DESTINO,
          grp_assoc.DES_GRUPO as GRUPO_DESTINO,
          sgp_assoc.DES_SUB_GRUPO as SUBGRUPO_DESTINO,
          p_base.COD_PRODUTO as COD_ORIGEM,
          p_base.DES_PRODUTO as PRODUTO_ORIGEM,
          sec_base.DES_SECAO as SECAO_ORIGEM,
          grp_base.DES_GRUPO as GRUPO_ORIGEM,
          sgp_base.DES_SUB_GRUPO as SUBGRUPO_ORIGEM,
          NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) as QTD_ASSOC,
          NVL(vendas.QTD_VENDIDA, 0) * NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM INTERSOLID.TAB_PRODUTO_LOJA pl
        JOIN INTERSOLID.TAB_PRODUTO p_assoc ON pl.COD_PRODUTO = p_assoc.COD_PRODUTO
        JOIN INTERSOLID.TAB_PRODUTO p_base ON pl.COD_ASSOCIADO = p_base.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_base ON p_base.COD_SECAO = sec_base.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_base ON p_base.COD_SECAO = grp_base.COD_SECAO AND p_base.COD_GRUPO = grp_base.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_base ON p_base.COD_SECAO = sgp_base.COD_SECAO AND p_base.COD_GRUPO = sgp_base.COD_GRUPO AND p_base.COD_SUB_GRUPO = sgp_base.COD_SUB_GRUPO
        LEFT JOIN INTERSOLID.TAB_SECAO sec_assoc ON p_assoc.COD_SECAO = sec_assoc.COD_SECAO
        LEFT JOIN INTERSOLID.TAB_GRUPO grp_assoc ON p_assoc.COD_SECAO = grp_assoc.COD_SECAO AND p_assoc.COD_GRUPO = grp_assoc.COD_GRUPO
        LEFT JOIN INTERSOLID.TAB_SUBGRUPO sgp_assoc ON p_assoc.COD_SECAO = sgp_assoc.COD_SECAO AND p_assoc.COD_GRUPO = sgp_assoc.COD_GRUPO AND p_assoc.COD_SUB_GRUPO = sgp_assoc.COD_SUB_GRUPO
        LEFT JOIN (
          SELECT ni.COD_ITEM, SUM(ni.VAL_TOTAL) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE nf.DTA_ENTRADA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.COD_ITEM
        ) compras ON p_base.COD_PRODUTO = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM INTERSOLID.TAB_PRODUTO_PDV pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_assoc.COD_PRODUTO = vendas.COD_PRODUTO
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        ${nivelFilter.replace(/p\./g, 'p_assoc.')}
        AND vendas.QTD_VENDIDA > 0
        ORDER BY VALOR DESC NULLS LAST
      `;
      result.associacao = await OracleService.query<any>(sqlAssoc, params);
      result.totalAssociacao = result.associacao.reduce((sum, r) => sum + (r.VALOR || 0), 0);
    }

    result.total = result.totalDecomposicao + result.totalProducao + result.totalAssociacao;
    return result;
  }
}
