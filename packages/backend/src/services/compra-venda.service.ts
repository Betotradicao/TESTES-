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
import { MappingService } from './mapping.service';

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
    const schema = await MappingService.getSchema();
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

    // Resolver colunas dinamicamente
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const colValMeta = await MappingService.getColumnFromTable('TAB_SECAO', 'meta');

    const sql = `
      SELECT ${colCodSecao} as COD_SECAO, ${colDesSecao} as DES_SECAO, ${colValMeta} as VAL_META
      FROM ${tabSecao}
      WHERE FLG_INATIVO IS NULL OR FLG_INATIVO = 'N'
      ORDER BY ${colDesSecao}
    `;

    return OracleService.query<SecaoData>(sql);
  }

  /**
   * Busca os grupos disponíveis
   */
  static async getGrupos(codSecao?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;

    // Resolver colunas dinamicamente
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const colCodSecaoGrupo = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');

    let sql = `
      SELECT DISTINCT ${colCodGrupo} as COD_GRUPO, ${colDesGrupo} as DES_GRUPO
      FROM ${tabGrupo}
      WHERE 1=1
    `;

    const params: any = {};

    if (codSecao) {
      sql += ` AND ${colCodSecaoGrupo} = :codSecao`;
      params.codSecao = codSecao;
    }

    sql += ` ORDER BY ${colDesGrupo}`;

    return OracleService.query(sql, params);
  }

  /**
   * Busca os subgrupos disponíveis
   * TAB_SUBGRUPO tem COD_SECAO e COD_GRUPO - filtra diretamente
   */
  static async getSubGrupos(codSecao?: number, codGrupo?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;

    // Resolver colunas dinamicamente
    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    const colCodSecaoSG = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colCodGrupoSG = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');

    // Filtra diretamente na TAB_SUBGRUPO por COD_SECAO e COD_GRUPO
    let sql = `
      SELECT DISTINCT ${colCodSubGrupo} as COD_SUB_GRUPO, ${colDesSubGrupo} as DES_SUB_GRUPO
      FROM ${tabSubgrupo}
      WHERE 1=1
    `;

    const params: any = {};

    // Filtrar por seção E grupo (chave composta)
    if (codSecao) {
      sql += ` AND ${colCodSecaoSG} = :codSecao`;
      params.codSecao = codSecao;
    }

    if (codGrupo) {
      sql += ` AND ${colCodGrupoSG} = :codGrupo`;
      params.codGrupo = codGrupo;
    }

    sql += ` ORDER BY ${colDesSubGrupo}`;

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
    const schema = await MappingService.getSchema();
    const tabComprador = `${schema}.${await MappingService.getRealTableName('TAB_COMPRADOR')}`;

    // Resolver colunas dinamicamente
    const colCodComprador = await MappingService.getColumnFromTable('TAB_COMPRADOR', 'codigo_comprador');
    const colDesComprador = await MappingService.getColumnFromTable('TAB_COMPRADOR', 'descricao_comprador');

    const sql = `
      SELECT ${colCodComprador} as COD_COMPRADOR, ${colDesComprador} as DES_COMPRADOR
      FROM ${tabComprador}
      ORDER BY ${colDesComprador}
    `;

    return OracleService.query(sql);
  }

  /**
   * Busca as lojas disponíveis
   */
  static async getLojas(): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabLoja = `${schema}.${await MappingService.getRealTableName('TAB_LOJA')}`;

    // Resolver colunas dinamicamente
    const colCodLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja');
    const colDesLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'descricao_loja');
    const colFlgDesativada = await MappingService.getColumnFromTable('TAB_LOJA', 'flag_desativada');

    // TAB_LOJA usa FLG_DESATIVADA (não FLG_INATIVO)
    const sql = `
      SELECT ${colCodLoja} as COD_LOJA, ${colDesLoja} as DES_LOJA
      FROM ${tabLoja}
      WHERE ${colFlgDesativada} IS NULL OR ${colFlgDesativada} = 'N'
      ORDER BY ${colDesLoja}
    `;

    return OracleService.query(sql);
  }

  /**
   * Monta os filtros de produto para as subqueries
   */
  private static async buildProdutoFilters(filters: CompraVendaFilters, params: any, tabProdutoComprador?: string): Promise<string> {
    const { codSecao, codGrupo, codSubGrupo, codComprador, produtosBonificados } = filters;
    let filterSql = '';

    // Resolver colunas dinamicamente
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colCodCompradorPC = await MappingService.getColumnFromTable('TAB_COMPRADOR', 'codigo_comprador');

    // Filtro de Seção
    if (codSecao) {
      filterSql += ` AND p.${colCodSecaoProd} = :codSecao`;
      params.codSecao = codSecao;
    }

    // Filtro de Grupo
    if (codGrupo) {
      filterSql += ` AND p.${colCodGrupoProd} = :codGrupo`;
      params.codGrupo = codGrupo;
    }

    // Filtro de SubGrupo
    if (codSubGrupo) {
      filterSql += ` AND p.${colCodSubGrupoProd} = :codSubGrupo`;
      params.codSubGrupo = codSubGrupo;
    }

    // Filtro de Comprador (via TAB_PRODUTO_COMPRADOR)
    if (codComprador && tabProdutoComprador) {
      filterSql += ` AND EXISTS (
        SELECT 1 FROM ${tabProdutoComprador} pc
        WHERE pc.${colCodProduto} = p.${colCodProduto}
        AND pc.${colCodCompradorPC} = :codComprador
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

    // Obter schema e nomes das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabSecaoMetaLoja = `${schema}.${await MappingService.getRealTableName('TAB_SECAO_META_LOJA')}`;
    const tabProdutoDecomposicao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_DECOMPOSICAO')}`;
    const tabProdutoProducao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PRODUCAO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabProdutoComprador = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_COMPRADOR')}`;

    // Resolver colunas dinamicamente
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const colValMeta = await MappingService.getColumnFromTable('TAB_SECAO', 'meta');
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const colSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const colDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const colCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const colTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const colNumNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const colSerieNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const colCodParceiroItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const colCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');
    const colQtdEntrada = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'quantidade_entrada');
    const colValCustoItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_custo');
    const colValTotalItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');
    const colCodLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja');

    const params: any = {
      dataInicio,
      dataFim
    };

    // Construir filtros
    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = await this.buildProdutoFilters(filters, params, tabProdutoComprador);

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
      lojaFilterCompras = ` AND nf.${colCodLoja} = :codLoja`;
      lojaFilterVendas = ` AND pv.${colCodLoja} = :codLoja`;
      params.codLoja = codLoja;
    }

    // Query principal que combina Compras e Vendas
    const sql = `
      SELECT
        sec.${colCodSecao} as COD_SECAO,
        sec.${colDesSecao} as SECAO,
        NVL(c.COD_LOJA, v.COD_LOJA) as LOJA,
        NVL(c.QTD_COMPRA, 0) as QTD_COMPRA,
        NVL(v.QTD_VENDA, 0) as QTD_VENDA,
        NVL(c.VALOR_COMPRAS, 0) as COMPRAS,
        NVL(v.CUSTO_VENDA, 0) as CUSTO_VENDA,
        NVL(v.VALOR_VENDAS, 0) as VENDAS,
        NVL(m.PER_META_VENDA, sec.${colValMeta}) as MARGEM_PCT,
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
      FROM ${tabSecao} sec
      -- Subquery de Compras
      LEFT JOIN (
        SELECT
          p.${colCodSecaoProd} as COD_SECAO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.${colValTotalItem}) as VALOR_COMPRAS
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p ON ni.${colCodItem} = p.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters}
        GROUP BY p.${colCodSecaoProd}, nf.${colCodLoja}
      ) c ON sec.${colCodSecao} = c.COD_SECAO
      -- Subquery de Vendas
      LEFT JOIN (
        SELECT
          p.${colCodSecaoProd} as COD_SECAO,
          pv.${colCodLoja} as COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM ${tabProdutoPdv} pv
        JOIN ${tabProduto} p ON pv.${colCodProduto} = p.${colCodProduto}
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters}
        GROUP BY p.${colCodSecaoProd}, pv.${colCodLoja}
      ) v ON sec.${colCodSecao} = v.COD_SECAO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      -- Metas
      LEFT JOIN ${tabSecaoMetaLoja} m ON sec.${colCodSecao} = m.${colCodSecao} AND m.${colCodLoja} = NVL(c.COD_LOJA, v.COD_LOJA)
      ${calcDecomposicao ? `
      -- EMPRESTEI (DECOMPOSIÇÃO): Produtos PAI/MATRIZ que emprestam custo para filhos
      -- Ex: CARNE MATRIZ → CARNE DE PRIMEIRA, CARNE DE SEGUNDA
      LEFT JOIN (
        SELECT
          p.${colCodSecaoProd} as COD_SECAO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem}) as VALOR_EMPRESTEI
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p ON ni.${colCodItem} = p.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        -- Somente produtos PAI (que têm decomposição cadastrada)
        AND EXISTS (
          SELECT 1 FROM ${tabProdutoDecomposicao} d
          WHERE d.${colCodProduto} = p.${colCodProduto}
        )
        GROUP BY p.${colCodSecaoProd}, nf.${colCodLoja}
      ) emp_pai ON sec.${colCodSecao} = emp_pai.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (DECOMPOSIÇÃO): Valor que FILHOS receberam do PAI
      -- Usa QTD_DECOMP como percentual (soma 100% para cada matriz)
      LEFT JOIN (
        SELECT
          p_filho.${colCodSecaoProd} as COD_SECAO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem} * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p_pai ON ni.${colCodItem} = p_pai.${colCodProduto}
        JOIN ${tabProdutoDecomposicao} d ON p_pai.${colCodProduto} = d.${colCodProduto}
        JOIN ${tabProduto} p_filho ON d.COD_PRODUTO_DECOM = p_filho.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY p_filho.${colCodSecaoProd}, nf.${colCodLoja}
      ) emp_filho ON sec.${colCodSecao} = emp_filho.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      -- EMPRESTEI (PRODUÇÃO): Insumos emprestam baseado nas VENDAS dos produtos finais
      -- Fórmula: Σ(QTD_VENDIDA × QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_insumo.${colCodSecaoProd} as COD_SECAO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.${colCodProduto}
        -- Compras do insumo para calcular custo unitário
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        -- Vendas dos produtos finais que usam este insumo
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        GROUP BY p_insumo.${colCodSecaoProd}, compras.COD_LOJA
      ) emp_insumo ON sec.${colCodSecao} = emp_insumo.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      -- EMPRESTADO (PRODUÇÃO): Produtos FINAIS recebem baseado nas suas VENDAS × receita × custo unitário
      -- Fórmula: QTD_VENDIDA × Σ(QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_final.${colCodSecaoProd} as COD_SECAO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_final ON pp.COD_PRODUTO = p_final.${colCodProduto}
        -- Vendas do produto final
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        -- Compras dos insumos para calcular custo unitário
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        GROUP BY p_final.${colCodSecaoProd}, vendas.COD_LOJA
      ) emp_final ON sec.${colCodSecao} = emp_final.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      -- EMPRESTEI (ASSOCIAÇÃO): Produto BASE empresta para produtos VENDIDOS (que têm COD_ASSOCIADO)
      -- COD_PRODUTO = produto vendido (ex: YAKULT C6), COD_ASSOCIADO = produto base comprado (ex: YAKULT unidade)
      -- Fórmula: Σ(QTD_VENDIDA × QTD_EMBALAGEM_VENDA × CUSTO_UNITÁRIO_BASE)
      LEFT JOIN (
        SELECT
          p_base.${colCodSecaoProd} as COD_SECAO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        JOIN ${tabProduto} p_base ON pl.COD_ASSOCIADO = p_base.${colCodProduto}
        -- Compras do produto BASE para calcular custo unitário
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        -- Vendas dos produtos que têm associação
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY p_base.${colCodSecaoProd}, compras.COD_LOJA
      ) emp_assoc_pai ON sec.${colCodSecao} = emp_assoc_pai.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (ASSOCIAÇÃO): Produtos VENDIDOS recebem custo do produto BASE
      -- Fórmula: QTD_VENDIDA × QTD_EMBALAGEM_VENDA × CUSTO_UNITÁRIO_BASE
      LEFT JOIN (
        SELECT
          p_venda.${colCodSecaoProd} as COD_SECAO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        -- Vendas do produto
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO
        -- Compras do produto BASE para calcular custo unitário
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY p_venda.${colCodSecaoProd}, vendas.COD_LOJA
      ) emp_assoc_filho ON sec.${colCodSecao} = emp_assoc_filho.COD_SECAO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
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

    // Obter schema e nomes das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoDecomposicao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_DECOMPOSICAO')}`;
    const tabProdutoProducao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PRODUCAO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabProdutoComprador = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_COMPRADOR')}`;

    // Resolver colunas dinamicamente
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const colSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const colDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const colCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const colTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const colNumNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const colSerieNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const colCodParceiroItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const colCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');
    const colValTotalItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');
    const colCodLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja');

    const params: any = {
      dataInicio,
      dataFim,
      codSecao
    };

    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = await this.buildProdutoFilters(filters, params, tabProdutoComprador);

    // Flag para calcular empréstimos (só quando filtro "Filhos" está ativo)
    const calcularEmprestimos = decomposicao === 'filhos';
    // Flags individuais para cada tipo de empréstimo
    const calcDecomposicao = calcularEmprestimos && tipoEmprestimoDecomposicao;
    const calcProducao = calcularEmprestimos && tipoEmprestimoProducao;
    const calcAssociacao = calcularEmprestimos && tipoEmprestimoAssociacao;

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.${colCodLoja} = :codLoja`;
      lojaFilterVendas = ` AND pv.${colCodLoja} = :codLoja`;
      params.codLoja = codLoja;
    }

    const sql = `
      SELECT
        g.${colCodGrupo} as COD_GRUPO,
        g.${colDesGrupo} as GRUPO,
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
      FROM ${tabGrupo} g
      LEFT JOIN (
        SELECT
          p.${colCodGrupoProd} as COD_GRUPO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.${colValTotalItem}) as VALOR_COMPRAS
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p ON ni.${colCodItem} = p.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        AND p.${colCodSecaoProd} = :codSecao
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters}
        GROUP BY p.${colCodGrupoProd}, nf.${colCodLoja}
      ) c ON g.${colCodGrupo} = c.COD_GRUPO
      LEFT JOIN (
        SELECT
          p.${colCodGrupoProd} as COD_GRUPO,
          pv.${colCodLoja} as COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM ${tabProdutoPdv} pv
        JOIN ${tabProduto} p ON pv.${colCodProduto} = p.${colCodProduto}
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.${colCodSecaoProd} = :codSecao
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters}
        GROUP BY p.${colCodGrupoProd}, pv.${colCodLoja}
      ) v ON g.${colCodGrupo} = v.COD_GRUPO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      ${calcDecomposicao ? `
      -- EMPRESTEI (DECOMPOSIÇÃO): Produtos PAI/MATRIZ deste grupo que emprestam para filhos
      LEFT JOIN (
        SELECT
          p.${colCodGrupoProd} as COD_GRUPO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem}) as VALOR_EMPRESTEI
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p ON ni.${colCodItem} = p.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        AND p.${colCodSecaoProd} = :codSecao
        ${tipoNfFilter}
        ${lojaFilterCompras}
        AND EXISTS (
          SELECT 1 FROM ${tabProdutoDecomposicao} d
          WHERE d.${colCodProduto} = p.${colCodProduto}
        )
        GROUP BY p.${colCodGrupoProd}, nf.${colCodLoja}
      ) emp_pai ON g.${colCodGrupo} = emp_pai.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (DECOMPOSIÇÃO): Valor que FILHOS deste grupo receberam do PAI
      -- Usa QTD_DECOMP como percentual (soma 100% para cada matriz)
      LEFT JOIN (
        SELECT
          p_filho.${colCodGrupoProd} as COD_GRUPO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem} * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p_pai ON ni.${colCodItem} = p_pai.${colCodProduto}
        JOIN ${tabProdutoDecomposicao} d ON p_pai.${colCodProduto} = d.${colCodProduto}
        JOIN ${tabProduto} p_filho ON d.COD_PRODUTO_DECOM = p_filho.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        AND p_filho.${colCodSecaoProd} = :codSecao
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY p_filho.${colCodGrupoProd}, nf.${colCodLoja}
      ) emp_filho ON g.${colCodGrupo} = emp_filho.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      -- EMPRESTEI (PRODUÇÃO): Insumos emprestam baseado nas VENDAS dos produtos finais
      -- Fórmula: Σ(QTD_VENDIDA × QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_insumo.${colCodGrupoProd} as COD_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.${colCodProduto}
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE p_insumo.${colCodSecaoProd} = :codSecao
        GROUP BY p_insumo.${colCodGrupoProd}, compras.COD_LOJA
      ) emp_insumo ON g.${colCodGrupo} = emp_insumo.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      -- EMPRESTADO (PRODUÇÃO): Produtos FINAIS recebem baseado nas suas VENDAS × receita × custo unitário
      -- Fórmula: QTD_VENDIDA × Σ(QTD_NA_RECEITA × CUSTO_UNITÁRIO_INSUMO)
      LEFT JOIN (
        SELECT
          p_final.${colCodGrupoProd} as COD_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_final ON pp.COD_PRODUTO = p_final.${colCodProduto}
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE p_final.${colCodSecaoProd} = :codSecao
        GROUP BY p_final.${colCodGrupoProd}, vendas.COD_LOJA
      ) emp_final ON g.${colCodGrupo} = emp_final.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      -- EMPRESTEI (ASSOCIAÇÃO): Produto BASE empresta para produtos VENDIDOS
      LEFT JOIN (
        SELECT
          p_base.${colCodGrupoProd} as COD_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        JOIN ${tabProduto} p_base ON pl.COD_ASSOCIADO = p_base.${colCodProduto}
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_base.${colCodSecaoProd} = :codSecao
        GROUP BY p_base.${colCodGrupoProd}, compras.COD_LOJA
      ) emp_assoc_pai ON g.${colCodGrupo} = emp_assoc_pai.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      -- EMPRESTADO (ASSOCIAÇÃO): Produtos VENDIDOS recebem custo do BASE
      LEFT JOIN (
        SELECT
          p_venda.${colCodGrupoProd} as COD_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_venda.${colCodSecaoProd} = :codSecao
        GROUP BY p_venda.${colCodGrupoProd}, vendas.COD_LOJA
      ) emp_assoc_filho ON g.${colCodGrupo} = emp_assoc_filho.COD_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
      ` : ''}
      WHERE g.${colCodSecao} = :codSecao
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

    // Obter schema e nomes das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoDecomposicao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_DECOMPOSICAO')}`;
    const tabProdutoProducao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PRODUCAO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabProdutoComprador = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_COMPRADOR')}`;

    // Resolver colunas dinamicamente
    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const colSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const colDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const colCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const colTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const colNumNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const colSerieNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const colCodParceiroItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const colCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');
    const colValTotalItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');
    const colCodLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja');

    const params: any = {
      dataInicio,
      dataFim,
      codSecao,
      codGrupo
    };

    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = await this.buildProdutoFilters(filters, params, tabProdutoComprador);

    // Flag para calcular empréstimos (só quando filtro "Filhos" está ativo)
    const calcularEmprestimos = decomposicao === 'filhos';
    // Flags individuais para cada tipo de empréstimo
    const calcDecomposicao = calcularEmprestimos && tipoEmprestimoDecomposicao;
    const calcProducao = calcularEmprestimos && tipoEmprestimoProducao;
    const calcAssociacao = calcularEmprestimos && tipoEmprestimoAssociacao;

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.${colCodLoja} = :codLoja`;
      lojaFilterVendas = ` AND pv.${colCodLoja} = :codLoja`;
      params.codLoja = codLoja;
    }

    const sql = `
      SELECT
        sg.${colCodSubGrupo} as COD_SUB_GRUPO,
        sg.${colDesSubGrupo} as SUBGRUPO,
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
      FROM ${tabSubgrupo} sg
      LEFT JOIN (
        SELECT
          p.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.${colValTotalItem}) as VALOR_COMPRAS
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p ON ni.${colCodItem} = p.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        AND p.${colCodSecaoProd} = :codSecao
        AND p.${colCodGrupoProd} = :codGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters}
        GROUP BY p.${colCodSubGrupoProd}, nf.${colCodLoja}
      ) c ON sg.${colCodSubGrupo} = c.COD_SUB_GRUPO
      LEFT JOIN (
        SELECT
          p.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          pv.${colCodLoja} as COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM ${tabProdutoPdv} pv
        JOIN ${tabProduto} p ON pv.${colCodProduto} = p.${colCodProduto}
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND p.${colCodSecaoProd} = :codSecao
        AND p.${colCodGrupoProd} = :codGrupo
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters}
        GROUP BY p.${colCodSubGrupoProd}, pv.${colCodLoja}
      ) v ON sg.${colCodSubGrupo} = v.COD_SUB_GRUPO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      ${calcDecomposicao ? `
      LEFT JOIN (
        SELECT
          p.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem}) as VALOR_EMPRESTEI
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p ON ni.${colCodItem} = p.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        AND p.${colCodSecaoProd} = :codSecao
        AND p.${colCodGrupoProd} = :codGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        AND EXISTS (
          SELECT 1 FROM ${tabProdutoDecomposicao} d
          WHERE d.${colCodProduto} = p.${colCodProduto}
        )
        GROUP BY p.${colCodSubGrupoProd}, nf.${colCodLoja}
      ) emp_pai ON sg.${colCodSubGrupo} = emp_pai.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      LEFT JOIN (
        SELECT
          p_filho.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem} * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} p_pai ON ni.${colCodItem} = p_pai.${colCodProduto}
        JOIN ${tabProdutoDecomposicao} d ON p_pai.${colCodProduto} = d.${colCodProduto}
        JOIN ${tabProduto} p_filho ON d.COD_PRODUTO_DECOM = p_filho.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        AND p_filho.${colCodSecaoProd} = :codSecao
        AND p_filho.${colCodGrupoProd} = :codGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY p_filho.${colCodSubGrupoProd}, nf.${colCodLoja}
      ) emp_filho ON sg.${colCodSubGrupo} = emp_filho.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      LEFT JOIN (
        SELECT
          p_insumo.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.${colCodProduto}
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE p_insumo.${colCodSecaoProd} = :codSecao AND p_insumo.${colCodGrupoProd} = :codGrupo
        GROUP BY p_insumo.${colCodSubGrupoProd}, compras.COD_LOJA
      ) emp_insumo ON sg.${colCodSubGrupo} = emp_insumo.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      LEFT JOIN (
        SELECT
          p_final.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_final ON pp.COD_PRODUTO = p_final.${colCodProduto}
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE p_final.${colCodSecaoProd} = :codSecao AND p_final.${colCodGrupoProd} = :codGrupo
        GROUP BY p_final.${colCodSubGrupoProd}, vendas.COD_LOJA
      ) emp_final ON sg.${colCodSubGrupo} = emp_final.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      LEFT JOIN (
        SELECT
          p_base.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        JOIN ${tabProduto} p_base ON pl.COD_ASSOCIADO = p_base.${colCodProduto}
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_base.${colCodSecaoProd} = :codSecao AND p_base.${colCodGrupoProd} = :codGrupo
        GROUP BY p_base.${colCodSubGrupoProd}, compras.COD_LOJA
      ) emp_assoc_pai ON sg.${colCodSubGrupo} = emp_assoc_pai.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      LEFT JOIN (
        SELECT
          p_venda.${colCodSubGrupoProd} as COD_SUB_GRUPO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL AND p_venda.${colCodSecaoProd} = :codSecao AND p_venda.${colCodGrupoProd} = :codGrupo
        GROUP BY p_venda.${colCodSubGrupoProd}, vendas.COD_LOJA
      ) emp_assoc_filho ON sg.${colCodSubGrupo} = emp_assoc_filho.COD_SUB_GRUPO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
      ` : ''}
      WHERE sg.${colCodSecao} = :codSecao
      AND sg.${colCodGrupo} = :codGrupo
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

    // Obter schema e nomes das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoDecomposicao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_DECOMPOSICAO')}`;
    const tabProdutoProducao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PRODUCAO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabProdutoComprador = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_COMPRADOR')}`;

    // Resolver colunas dinamicamente
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const colSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const colDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const colCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const colTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const colNumNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const colSerieNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const colCodParceiroItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const colCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');
    const colValTotalItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');
    const colCodLoja = await MappingService.getColumnFromTable('TAB_LOJA', 'codigo_loja');

    const params: any = {
      dataInicio,
      dataFim,
      codSecao,
      codGrupo,
      codSubGrupo
    };

    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);
    const produtoFilters = await this.buildProdutoFilters(filters, params, tabProdutoComprador);

    // Flag para calcular empréstimos (só quando filtro "Filhos" está ativo)
    const calcularEmprestimos = decomposicao === 'filhos';
    // Flags individuais para cada tipo de empréstimo
    const calcDecomposicao = calcularEmprestimos && tipoEmprestimoDecomposicao;
    const calcProducao = calcularEmprestimos && tipoEmprestimoProducao;
    const calcAssociacao = calcularEmprestimos && tipoEmprestimoAssociacao;

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.${colCodLoja} = :codLoja`;
      lojaFilterVendas = ` AND pv.${colCodLoja} = :codLoja`;
      params.codLoja = codLoja;
    }

    const sql = `
      SELECT
        p.${colCodProduto} as COD_PRODUTO,
        p.${colDesProduto} as PRODUTO,
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
      FROM ${tabProduto} p
      LEFT JOIN (
        SELECT
          ni.${colCodItem} as COD_ITEM,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.QTD_TOTAL) as QTD_COMPRA,
          SUM(ni.${colValTotalItem}) as VALOR_COMPRAS
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProduto} prod ON ni.${colCodItem} = prod.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        AND prod.${colCodSecaoProd} = :codSecao
        AND prod.${colCodGrupoProd} = :codGrupo
        AND prod.${colCodSubGrupoProd} = :codSubGrupo
        ${tipoNfFilter}
        ${lojaFilterCompras}
        ${produtoFilters.replace(/p\./g, 'prod.')}
        GROUP BY ni.${colCodItem}, nf.${colCodLoja}
      ) c ON p.${colCodProduto} = c.COD_ITEM
      LEFT JOIN (
        SELECT
          pv.${colCodProduto} as COD_PRODUTO,
          pv.${colCodLoja} as COD_LOJA,
          SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDA,
          SUM(pv.VAL_TOTAL_PRODUTO) as VALOR_VENDAS,
          SUM(pv.VAL_CUSTO_REP * pv.QTD_TOTAL_PRODUTO) as CUSTO_VENDA,
          SUM(NVL(pv.VAL_IMPOSTO_DEBITO, 0)) as TOTAL_IMPOSTO,
          SUM(NVL(pv.VAL_IMPOSTO_CREDITO, 0)) as TOTAL_IMPOSTO_CREDITO
        FROM ${tabProdutoPdv} pv
        JOIN ${tabProduto} prod ON pv.${colCodProduto} = prod.${colCodProduto}
        WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND prod.${colCodSecaoProd} = :codSecao
        AND prod.${colCodGrupoProd} = :codGrupo
        AND prod.${colCodSubGrupoProd} = :codSubGrupo
        ${tipoVendaFilter}
        ${lojaFilterVendas}
        ${produtoFilters.replace(/p\./g, 'prod.')}
        GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
      ) v ON p.${colCodProduto} = v.COD_PRODUTO AND (c.COD_LOJA = v.COD_LOJA OR c.COD_LOJA IS NULL OR v.COD_LOJA IS NULL)
      ${calcDecomposicao ? `
      LEFT JOIN (
        SELECT
          ni.${colCodItem} as COD_PRODUTO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem}) as VALOR_EMPRESTEI
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        AND EXISTS (
          SELECT 1 FROM ${tabProdutoDecomposicao} d
          WHERE d.${colCodProduto} = ni.${colCodItem}
        )
        GROUP BY ni.${colCodItem}, nf.${colCodLoja}
      ) emp_pai ON p.${colCodProduto} = emp_pai.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_pai.COD_LOJA OR emp_pai.COD_LOJA IS NULL)
      LEFT JOIN (
        SELECT
          d.COD_PRODUTO_DECOM as COD_PRODUTO,
          nf.${colCodLoja} as COD_LOJA,
          SUM(ni.${colValTotalItem} * d.QTD_DECOMP / 100) as VALOR_EMPRESTADO
        FROM ${tabNf} nf
        JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
          AND nf.${colSerieNf} = ni.${colSerieNfItem}
          AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
        JOIN ${tabProdutoDecomposicao} d ON ni.${colCodItem} = d.${colCodProduto}
        WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
        AND nf.${colTipoOperacao} = 0
        ${tipoNfFilter}
        ${lojaFilterCompras}
        GROUP BY d.COD_PRODUTO_DECOM, nf.${colCodLoja}
      ) emp_filho ON p.${colCodProduto} = emp_filho.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_filho.COD_LOJA OR emp_filho.COD_LOJA IS NULL)
      ` : ''}
      ${calcProducao ? `
      LEFT JOIN (
        SELECT
          pp.COD_PRODUTO_PRODUCAO as COD_PRODUTO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoProducao} pp
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        GROUP BY pp.COD_PRODUTO_PRODUCAO, compras.COD_LOJA
      ) emp_insumo ON p.${colCodProduto} = emp_insumo.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_insumo.COD_LOJA OR emp_insumo.COD_LOJA IS NULL)
      LEFT JOIN (
        SELECT
          pp.COD_PRODUTO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * pp.QTD_PRODUCAO *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoProducao} pp
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pp.COD_PRODUTO = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pp.COD_PRODUTO_PRODUCAO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        GROUP BY pp.COD_PRODUTO, vendas.COD_LOJA
      ) emp_final ON p.${colCodProduto} = emp_final.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_final.COD_LOJA OR emp_final.COD_LOJA IS NULL)
      ` : ''}
      ${calcAssociacao ? `
      LEFT JOIN (
        SELECT
          pl.COD_ASSOCIADO as COD_PRODUTO,
          compras.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTEI
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO AND compras.COD_LOJA = vendas.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY pl.COD_ASSOCIADO, compras.COD_LOJA
      ) emp_assoc_pai ON p.${colCodProduto} = emp_assoc_pai.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_pai.COD_LOJA OR emp_assoc_pai.COD_LOJA IS NULL)
      LEFT JOIN (
        SELECT
          pl.${colCodProduto} as COD_PRODUTO,
          vendas.COD_LOJA,
          SUM(
            vendas.QTD_VENDIDA * NVL(p_venda.QTD_EMBALAGEM_VENDA, 1) *
            (compras.VAL_TOTAL / NULLIF(compras.QTD_TOTAL, 0))
          ) as VALOR_EMPRESTADO
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_venda ON pl.${colCodProduto} = p_venda.${colCodProduto}
        JOIN (
          SELECT pv.${colCodProduto} as COD_PRODUTO, pv.${colCodLoja} as COD_LOJA, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.${colCodProduto}, pv.${colCodLoja}
        ) vendas ON pl.${colCodProduto} = vendas.COD_PRODUTO
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, nf.${colCodLoja} as COD_LOJA, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem} AND nf.${colSerieNf} = ni.${colSerieNfItem} AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}, nf.${colCodLoja}
        ) compras ON pl.COD_ASSOCIADO = compras.COD_ITEM AND vendas.COD_LOJA = compras.COD_LOJA
        WHERE pl.COD_ASSOCIADO IS NOT NULL
        GROUP BY pl.${colCodProduto}, vendas.COD_LOJA
      ) emp_assoc_filho ON p.${colCodProduto} = emp_assoc_filho.COD_PRODUTO AND (NVL(c.COD_LOJA, v.COD_LOJA) = emp_assoc_filho.COD_LOJA OR emp_assoc_filho.COD_LOJA IS NULL)
      ` : ''}
      -- ESTOQUE: Busca estoque atual e dias de cobertura da TAB_PRODUTO_LOJA
      LEFT JOIN ${tabProdutoLoja} est ON p.${colCodProduto} = est.${colCodProduto}
        AND est.${colCodLoja} = NVL(c.COD_LOJA, v.COD_LOJA)
      WHERE p.${colCodSecaoProd} = :codSecao
      AND p.${colCodGrupoProd} = :codGrupo
      AND p.${colCodSubGrupoProd} = :codSubGrupo
      AND (c.COD_ITEM IS NOT NULL OR v.COD_PRODUTO IS NOT NULL
           ${calcDecomposicao ? 'OR emp_pai.COD_PRODUTO IS NOT NULL OR emp_filho.COD_PRODUTO IS NOT NULL' : ''}
           ${calcProducao ? 'OR emp_insumo.COD_PRODUTO IS NOT NULL OR emp_final.COD_PRODUTO IS NOT NULL' : ''}
           ${calcAssociacao ? 'OR emp_assoc_pai.COD_PRODUTO IS NOT NULL OR emp_assoc_filho.COD_PRODUTO IS NOT NULL' : ''})
      ORDER BY p.${colDesProduto} ASC
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

    // Obter schema e nomes das tabelas dinamicamente
    const schema = await MappingService.getSchema();
    const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
    const tabNf = `${schema}.${await MappingService.getRealTableName('TAB_NF')}`;
    const tabNfItem = `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM')}`;
    const tabProdutoPdv = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PDV')}`;
    const tabProdutoDecomposicao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_DECOMPOSICAO')}`;
    const tabProdutoProducao = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_PRODUCAO')}`;
    const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
    const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
    const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
    const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;

    // Resolver nomes das colunas dinamicamente
    const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
    const colCodSubGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
    const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const colCodGrupoGrp = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao');
    const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
    const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
    const colCodSecaoSG = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao');
    const colCodGrupoSG = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo');
    const colNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf');
    const colSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'serie_nf');
    const colDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada');
    const colCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_parceiro');
    const colTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao');
    const colCodLojaNf = await MappingService.getColumnFromTable('TAB_NF', 'codigo_loja');
    const colNumNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf');
    const colSerieNfItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'serie_nf');
    const colCodParceiroItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_parceiro');
    const colCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_item');
    const colValTotalItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total');
    const colCodProdutoPL = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');

    const params: any = { dataInicio, dataFim };
    const tipoNfFilter = this.buildTipoNfFilter(tipoNotaFiscal);
    const tipoVendaFilter = this.buildTipoVendaFilter(tipoVenda);

    let lojaFilterCompras = '';
    let lojaFilterVendas = '';
    if (codLoja) {
      lojaFilterCompras = ` AND nf.${colCodLojaNf} = :codLoja`;
      lojaFilterVendas = ` AND pv.COD_LOJA = :codLoja`;
      params.codLoja = codLoja;
    }

    // Filtro de nível
    let nivelFilter = '';
    if (codSecao) {
      nivelFilter += ` AND p.${colCodSecaoProd} = :codSecao`;
      params.codSecao = codSecao;
    }
    if (codGrupo) {
      nivelFilter += ` AND p.${colCodGrupoProd} = :codGrupo`;
      params.codGrupo = codGrupo;
    }
    if (codSubGrupo) {
      nivelFilter += ` AND p.${colCodSubGrupoProd} = :codSubGrupo`;
      params.codSubGrupo = codSubGrupo;
    }
    if (codProduto) {
      nivelFilter += ` AND p.${colCodProduto} = :codProduto`;
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
          p_pai.${colCodProduto} as COD_ORIGEM,
          p_pai.${colDesProduto} as PRODUTO_ORIGEM,
          sec_pai.${colDesSecao} as SECAO_ORIGEM,
          grp_pai.${colDesGrupo} as GRUPO_ORIGEM,
          sgp_pai.${colDesSubGrupo} as SUBGRUPO_ORIGEM,
          p_filho.${colCodProduto} as COD_DESTINO,
          p_filho.${colDesProduto} as PRODUTO_DESTINO,
          sec_filho.${colDesSecao} as SECAO_DESTINO,
          grp_filho.${colDesGrupo} as GRUPO_DESTINO,
          sgp_filho.${colDesSubGrupo} as SUBGRUPO_DESTINO,
          d.QTD_DECOMP as PERCENTUAL,
          NVL(compras.VAL_TOTAL, 0) * d.QTD_DECOMP / 100 as VALOR
        FROM ${tabProduto} p_pai
        JOIN ${tabProdutoDecomposicao} d ON p_pai.${colCodProduto} = d.COD_PRODUTO
        JOIN ${tabProduto} p_filho ON d.COD_PRODUTO_DECOM = p_filho.${colCodProduto}
        LEFT JOIN ${tabSecao} sec_pai ON p_pai.${colCodSecaoProd} = sec_pai.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_pai ON p_pai.${colCodSecaoProd} = grp_pai.${colCodGrupoGrp} AND p_pai.${colCodGrupoProd} = grp_pai.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_pai ON p_pai.${colCodSecaoProd} = sgp_pai.${colCodSecaoSG} AND p_pai.${colCodGrupoProd} = sgp_pai.${colCodGrupoSG} AND p_pai.${colCodSubGrupoProd} = sgp_pai.${colCodSubGrupo}
        LEFT JOIN ${tabSecao} sec_filho ON p_filho.${colCodSecaoProd} = sec_filho.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_filho ON p_filho.${colCodSecaoProd} = grp_filho.${colCodGrupoGrp} AND p_filho.${colCodGrupoProd} = grp_filho.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_filho ON p_filho.${colCodSecaoProd} = sgp_filho.${colCodSecaoSG} AND p_filho.${colCodGrupoProd} = sgp_filho.${colCodGrupoSG} AND p_filho.${colCodSubGrupoProd} = sgp_filho.${colCodSubGrupo}
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, SUM(ni.${colValTotalItem}) as VAL_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
            AND nf.${colSerieNf} = ni.${colSerieNfItem}
            AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}
        ) compras ON p_pai.${colCodProduto} = compras.COD_ITEM
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
          p_filho.${colCodProduto} as COD_DESTINO,
          p_filho.${colDesProduto} as PRODUTO_DESTINO,
          sec_filho.${colDesSecao} as SECAO_DESTINO,
          grp_filho.${colDesGrupo} as GRUPO_DESTINO,
          sgp_filho.${colDesSubGrupo} as SUBGRUPO_DESTINO,
          p_pai.${colCodProduto} as COD_ORIGEM,
          p_pai.${colDesProduto} as PRODUTO_ORIGEM,
          sec_pai.${colDesSecao} as SECAO_ORIGEM,
          grp_pai.${colDesGrupo} as GRUPO_ORIGEM,
          sgp_pai.${colDesSubGrupo} as SUBGRUPO_ORIGEM,
          d.QTD_DECOMP as PERCENTUAL,
          NVL(compras.VAL_TOTAL, 0) * d.QTD_DECOMP / 100 as VALOR
        FROM ${tabProduto} p_filho
        JOIN ${tabProdutoDecomposicao} d ON p_filho.${colCodProduto} = d.COD_PRODUTO_DECOM
        JOIN ${tabProduto} p_pai ON d.COD_PRODUTO = p_pai.${colCodProduto}
        LEFT JOIN ${tabSecao} sec_pai ON p_pai.${colCodSecaoProd} = sec_pai.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_pai ON p_pai.${colCodSecaoProd} = grp_pai.${colCodGrupoGrp} AND p_pai.${colCodGrupoProd} = grp_pai.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_pai ON p_pai.${colCodSecaoProd} = sgp_pai.${colCodSecaoSG} AND p_pai.${colCodGrupoProd} = sgp_pai.${colCodGrupoSG} AND p_pai.${colCodSubGrupoProd} = sgp_pai.${colCodSubGrupo}
        LEFT JOIN ${tabSecao} sec_filho ON p_filho.${colCodSecaoProd} = sec_filho.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_filho ON p_filho.${colCodSecaoProd} = grp_filho.${colCodGrupoGrp} AND p_filho.${colCodGrupoProd} = grp_filho.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_filho ON p_filho.${colCodSecaoProd} = sgp_filho.${colCodSecaoSG} AND p_filho.${colCodGrupoProd} = sgp_filho.${colCodGrupoSG} AND p_filho.${colCodSubGrupoProd} = sgp_filho.${colCodSubGrupo}
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, SUM(ni.${colValTotalItem}) as VAL_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
            AND nf.${colSerieNf} = ni.${colSerieNfItem}
            AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}
        ) compras ON p_pai.${colCodProduto} = compras.COD_ITEM
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
          p_insumo.${colCodProduto} as COD_ORIGEM,
          p_insumo.${colDesProduto} as PRODUTO_ORIGEM,
          sec_insumo.${colDesSecao} as SECAO_ORIGEM,
          grp_insumo.${colDesGrupo} as GRUPO_ORIGEM,
          sgp_insumo.${colDesSubGrupo} as SUBGRUPO_ORIGEM,
          p_final.${colCodProduto} as COD_DESTINO,
          p_final.${colDesProduto} as PRODUTO_DESTINO,
          sec_final.${colDesSecao} as SECAO_DESTINO,
          grp_final.${colDesGrupo} as GRUPO_DESTINO,
          sgp_final.${colDesSubGrupo} as SUBGRUPO_DESTINO,
          pp.QTD_PRODUCAO as QTD_RECEITA,
          NVL(vendas.QTD_VENDIDA, 0) * pp.QTD_PRODUCAO * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.${colCodProduto}
        JOIN ${tabProduto} p_final ON pp.COD_PRODUTO = p_final.${colCodProduto}
        LEFT JOIN ${tabSecao} sec_insumo ON p_insumo.${colCodSecaoProd} = sec_insumo.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_insumo ON p_insumo.${colCodSecaoProd} = grp_insumo.${colCodGrupoGrp} AND p_insumo.${colCodGrupoProd} = grp_insumo.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_insumo ON p_insumo.${colCodSecaoProd} = sgp_insumo.${colCodSecaoSG} AND p_insumo.${colCodGrupoProd} = sgp_insumo.${colCodGrupoSG} AND p_insumo.${colCodSubGrupoProd} = sgp_insumo.${colCodSubGrupo}
        LEFT JOIN ${tabSecao} sec_final ON p_final.${colCodSecaoProd} = sec_final.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_final ON p_final.${colCodSecaoProd} = grp_final.${colCodGrupoGrp} AND p_final.${colCodGrupoProd} = grp_final.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_final ON p_final.${colCodSecaoProd} = sgp_final.${colCodSecaoSG} AND p_final.${colCodGrupoProd} = sgp_final.${colCodGrupoSG} AND p_final.${colCodSubGrupoProd} = sgp_final.${colCodSubGrupo}
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
            AND nf.${colSerieNf} = ni.${colSerieNfItem}
            AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}
        ) compras ON p_insumo.${colCodProduto} = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_final.${colCodProduto} = vendas.COD_PRODUTO
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
          p_final.${colCodProduto} as COD_DESTINO,
          p_final.${colDesProduto} as PRODUTO_DESTINO,
          sec_final.${colDesSecao} as SECAO_DESTINO,
          grp_final.${colDesGrupo} as GRUPO_DESTINO,
          sgp_final.${colDesSubGrupo} as SUBGRUPO_DESTINO,
          p_insumo.${colCodProduto} as COD_ORIGEM,
          p_insumo.${colDesProduto} as PRODUTO_ORIGEM,
          sec_insumo.${colDesSecao} as SECAO_ORIGEM,
          grp_insumo.${colDesGrupo} as GRUPO_ORIGEM,
          sgp_insumo.${colDesSubGrupo} as SUBGRUPO_ORIGEM,
          pp.QTD_PRODUCAO as QTD_RECEITA,
          NVL(vendas.QTD_VENDIDA, 0) * pp.QTD_PRODUCAO * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM ${tabProdutoProducao} pp
        JOIN ${tabProduto} p_final ON pp.COD_PRODUTO = p_final.${colCodProduto}
        JOIN ${tabProduto} p_insumo ON pp.COD_PRODUTO_PRODUCAO = p_insumo.${colCodProduto}
        LEFT JOIN ${tabSecao} sec_insumo ON p_insumo.${colCodSecaoProd} = sec_insumo.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_insumo ON p_insumo.${colCodSecaoProd} = grp_insumo.${colCodGrupoGrp} AND p_insumo.${colCodGrupoProd} = grp_insumo.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_insumo ON p_insumo.${colCodSecaoProd} = sgp_insumo.${colCodSecaoSG} AND p_insumo.${colCodGrupoProd} = sgp_insumo.${colCodGrupoSG} AND p_insumo.${colCodSubGrupoProd} = sgp_insumo.${colCodSubGrupo}
        LEFT JOIN ${tabSecao} sec_final ON p_final.${colCodSecaoProd} = sec_final.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_final ON p_final.${colCodSecaoProd} = grp_final.${colCodGrupoGrp} AND p_final.${colCodGrupoProd} = grp_final.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_final ON p_final.${colCodSecaoProd} = sgp_final.${colCodSecaoSG} AND p_final.${colCodGrupoProd} = sgp_final.${colCodGrupoSG} AND p_final.${colCodSubGrupoProd} = sgp_final.${colCodSubGrupo}
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
            AND nf.${colSerieNf} = ni.${colSerieNfItem}
            AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}
        ) compras ON p_insumo.${colCodProduto} = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_final.${colCodProduto} = vendas.COD_PRODUTO
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
          p_base.${colCodProduto} as COD_ORIGEM,
          p_base.${colDesProduto} as PRODUTO_ORIGEM,
          sec_base.${colDesSecao} as SECAO_ORIGEM,
          grp_base.${colDesGrupo} as GRUPO_ORIGEM,
          sgp_base.${colDesSubGrupo} as SUBGRUPO_ORIGEM,
          p_assoc.${colCodProduto} as COD_DESTINO,
          p_assoc.${colDesProduto} as PRODUTO_DESTINO,
          sec_assoc.${colDesSecao} as SECAO_DESTINO,
          grp_assoc.${colDesGrupo} as GRUPO_DESTINO,
          sgp_assoc.${colDesSubGrupo} as SUBGRUPO_DESTINO,
          NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) as QTD_ASSOC,
          NVL(vendas.QTD_VENDIDA, 0) * NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_base ON pl.COD_ASSOCIADO = p_base.${colCodProduto}
        JOIN ${tabProduto} p_assoc ON pl.${colCodProdutoPL} = p_assoc.${colCodProduto}
        LEFT JOIN ${tabSecao} sec_base ON p_base.${colCodSecaoProd} = sec_base.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_base ON p_base.${colCodSecaoProd} = grp_base.${colCodGrupoGrp} AND p_base.${colCodGrupoProd} = grp_base.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_base ON p_base.${colCodSecaoProd} = sgp_base.${colCodSecaoSG} AND p_base.${colCodGrupoProd} = sgp_base.${colCodGrupoSG} AND p_base.${colCodSubGrupoProd} = sgp_base.${colCodSubGrupo}
        LEFT JOIN ${tabSecao} sec_assoc ON p_assoc.${colCodSecaoProd} = sec_assoc.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_assoc ON p_assoc.${colCodSecaoProd} = grp_assoc.${colCodGrupoGrp} AND p_assoc.${colCodGrupoProd} = grp_assoc.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_assoc ON p_assoc.${colCodSecaoProd} = sgp_assoc.${colCodSecaoSG} AND p_assoc.${colCodGrupoProd} = sgp_assoc.${colCodGrupoSG} AND p_assoc.${colCodSubGrupoProd} = sgp_assoc.${colCodSubGrupo}
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
            AND nf.${colSerieNf} = ni.${colSerieNfItem}
            AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}
        ) compras ON p_base.${colCodProduto} = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_assoc.${colCodProduto} = vendas.COD_PRODUTO
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
          p_assoc.${colCodProduto} as COD_DESTINO,
          p_assoc.${colDesProduto} as PRODUTO_DESTINO,
          sec_assoc.${colDesSecao} as SECAO_DESTINO,
          grp_assoc.${colDesGrupo} as GRUPO_DESTINO,
          sgp_assoc.${colDesSubGrupo} as SUBGRUPO_DESTINO,
          p_base.${colCodProduto} as COD_ORIGEM,
          p_base.${colDesProduto} as PRODUTO_ORIGEM,
          sec_base.${colDesSecao} as SECAO_ORIGEM,
          grp_base.${colDesGrupo} as GRUPO_ORIGEM,
          sgp_base.${colDesSubGrupo} as SUBGRUPO_ORIGEM,
          NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) as QTD_ASSOC,
          NVL(vendas.QTD_VENDIDA, 0) * NVL(p_assoc.QTD_EMBALAGEM_VENDA, 1) * (NVL(compras.VAL_TOTAL, 0) / NULLIF(compras.QTD_TOTAL, 0)) as VALOR
        FROM ${tabProdutoLoja} pl
        JOIN ${tabProduto} p_assoc ON pl.${colCodProdutoPL} = p_assoc.${colCodProduto}
        JOIN ${tabProduto} p_base ON pl.COD_ASSOCIADO = p_base.${colCodProduto}
        LEFT JOIN ${tabSecao} sec_base ON p_base.${colCodSecaoProd} = sec_base.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_base ON p_base.${colCodSecaoProd} = grp_base.${colCodGrupoGrp} AND p_base.${colCodGrupoProd} = grp_base.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_base ON p_base.${colCodSecaoProd} = sgp_base.${colCodSecaoSG} AND p_base.${colCodGrupoProd} = sgp_base.${colCodGrupoSG} AND p_base.${colCodSubGrupoProd} = sgp_base.${colCodSubGrupo}
        LEFT JOIN ${tabSecao} sec_assoc ON p_assoc.${colCodSecaoProd} = sec_assoc.${colCodSecao}
        LEFT JOIN ${tabGrupo} grp_assoc ON p_assoc.${colCodSecaoProd} = grp_assoc.${colCodGrupoGrp} AND p_assoc.${colCodGrupoProd} = grp_assoc.${colCodGrupo}
        LEFT JOIN ${tabSubgrupo} sgp_assoc ON p_assoc.${colCodSecaoProd} = sgp_assoc.${colCodSecaoSG} AND p_assoc.${colCodGrupoProd} = sgp_assoc.${colCodGrupoSG} AND p_assoc.${colCodSubGrupoProd} = sgp_assoc.${colCodSubGrupo}
        LEFT JOIN (
          SELECT ni.${colCodItem} as COD_ITEM, SUM(ni.${colValTotalItem}) as VAL_TOTAL, SUM(ni.QTD_TOTAL) as QTD_TOTAL
          FROM ${tabNf} nf
          JOIN ${tabNfItem} ni ON nf.${colNumNf} = ni.${colNumNfItem}
            AND nf.${colSerieNf} = ni.${colSerieNfItem}
            AND nf.${colCodParceiro} = ni.${colCodParceiroItem}
          WHERE nf.${colDtaEntrada} BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          AND nf.${colTipoOperacao} = 0
          ${tipoNfFilter}
          ${lojaFilterCompras}
          GROUP BY ni.${colCodItem}
        ) compras ON p_base.${colCodProduto} = compras.COD_ITEM
        LEFT JOIN (
          SELECT pv.COD_PRODUTO, SUM(pv.QTD_TOTAL_PRODUTO) as QTD_VENDIDA
          FROM ${tabProdutoPdv} pv
          WHERE pv.DTA_SAIDA BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY')
          ${tipoVendaFilter}
          ${lojaFilterVendas}
          GROUP BY pv.COD_PRODUTO
        ) vendas ON p_assoc.${colCodProduto} = vendas.COD_PRODUTO
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
