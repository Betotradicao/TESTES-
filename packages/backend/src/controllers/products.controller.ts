import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { ProductActivationHistory } from '../entities/ProductActivationHistory';
import { AuthRequest } from '../middleware/auth';
import { CacheService } from '../services/cache.service';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
import { PostgresErpService } from '../services/postgres-erp.service';
import * as path from 'path';

// MIGRAÇÃO COMPLETA: Todos os métodos que buscavam da API Intersolid
// agora buscam diretamente do banco Oracle

export class ProductsController {
  /**
   * Helper para buscar mapeamentos básicos de produto (lookup por ID)
   * Usado em activateProduct, updatePesoMedio, bulkActivateProducts
   */
  private static async getBasicProductMappings() {
    const [
      codigoCol,
      eanCol,
      descricaoCol,
      descReduzidaCol,
      codSecaoCol,
      desSecaoCol,
      codGrupoCol,
      desGrupoCol,
      codSubGrupoCol,
      desSubGrupoCol,
      codFornUltCompraCol,
      codFornecedorCol,
      desFornecedorCol,
      pesavelCol,
      codLojaCol,
      inativoCol
    ] = await Promise.all([
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao'),
      MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo'),
      MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo'),
      MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra'),
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor'),
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'pesavel'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo')
    ]);
    return {
      codigoCol, eanCol, descricaoCol, descReduzidaCol,
      codSecaoCol, desSecaoCol, codGrupoCol, desGrupoCol,
      codSubGrupoCol, desSubGrupoCol,
      codFornUltCompraCol, codFornecedorCol, desFornecedorCol,
      pesavelCol, codLojaCol, inativoCol
    };
  }

  /**
   * Helper para buscar mapeamentos de seção/grupo/subgrupo
   * Usado em getSections, getSectionsOracle, getProductsBySectionOracle, etc.
   */
  private static async getSectionMappings() {
    const [
      codSecaoCol,
      desSecaoCol,
      codGrupoCol,
      desGrupoCol,
      codSubGrupoCol,
      desSubGrupoCol
    ] = await Promise.all([
      MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao'),
      MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao'),
      MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo'),
      MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo'),
      MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo'),
      MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo')
    ]);
    return { codSecaoCol, desSecaoCol, codGrupoCol, desGrupoCol, codSubGrupoCol, desSubGrupoCol };
  }

  /**
   * Helper para buscar mapeamentos de TAB_PRODUTO_LOJA usados em buscas de estoque/margem/ruptura
   */
  private static async getProdutoLojaMappings() {
    const [
      plCodigoCol,
      custoRepCol,
      valorVendaCol,
      valorOfertaCol,
      estoqueAtualCol,
      margemCol,
      margemFixaCol,
      vendaMediaCol,
      coberturaCol,
      pedidoCompraCol,
      dataUltCompraCol,
      qtdUltCompraCol,
      estoqueMinCol,
      dataUltVendaCol,
      curvaCol,
      codFornUltCompraCol,
      codLojaCol,
      inativoCol
    ] = await Promise.all([
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_oferta'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pedido_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'qtd_ultima_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_minimo'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_venda'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo')
    ]);
    return {
      plCodigoCol, custoRepCol, valorVendaCol, valorOfertaCol,
      estoqueAtualCol, margemCol, margemFixaCol, vendaMediaCol,
      coberturaCol, pedidoCompraCol, dataUltCompraCol, qtdUltCompraCol,
      estoqueMinCol, dataUltVendaCol, curvaCol, codFornUltCompraCol,
      codLojaCol, inativoCol
    };
  }

  /**
   * Helper para buscar todos os mapeamentos de produtos
   * Inclui campos de TAB_PRODUTO e TAB_PRODUTO_LOJA
   */
  private static async getProdutosMappings() {
    const [
      // Campos de TAB_PRODUTO
      codigoCol,
      eanCol,
      descricaoCol,
      descReduzidaCol,
      embalagemCol,
      qtdEmbalagemVendaCol,
      qtdEmbalagemCompraCol,
      pesavelCol,
      tipoEspecieCol,
      tipoEventoCol,
      dataCadastroCol,
      codSecaoCol,
      codGrupoCol,
      codSubGrupoCol,
      // Campos de TAB_PRODUTO_LOJA
      custoRepCol,
      valorVendaCol,
      valorOfertaCol,
      estoqueAtualCol,
      margemCol,
      margemFixaCol,
      vendaMediaCol,
      coberturaCol,
      pedidoCompraCol,
      dataUltCompraCol,
      qtdUltCompraCol,
      estoqueMinCol,
      dataUltVendaCol,
      curvaCol,
      codFornUltCompraCol,
      inativoCol,
      // Campos de seção/grupo/subgrupo
      desSecaoCol,
      desGrupoCol,
      desSubGrupoCol,
      // Campos de fornecedor
      codFornecedorCol,
      desFornecedorCol,
      // Campo de loja
      codLojaCol
    ] = await Promise.all([
      // Campos de TAB_PRODUTO (V2 - lê do mapeamento configurado)
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'embalagem'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'qtd_embalagem_venda'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'qtd_embalagem_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'pesavel'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_especie'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_evento'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'data_cadastro'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo'),
      // Campos de TAB_PRODUTO_LOJA (V2)
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_oferta'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pedido_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'qtd_ultima_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_minimo'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_venda'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'inativo'),
      // Campos de seção/grupo/subgrupo (V2)
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_secao'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_grupo'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_subgrupo'),
      // Campos de fornecedor (V2)
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor'),
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social'),
      // Campo de loja (V2)
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja')
    ]);
    return {
      // Campos de TAB_PRODUTO
      codigoCol,
      eanCol,
      descricaoCol,
      descReduzidaCol,
      embalagemCol,
      qtdEmbalagemVendaCol,
      qtdEmbalagemCompraCol,
      pesavelCol,
      tipoEspecieCol,
      tipoEventoCol,
      dataCadastroCol,
      codSecaoCol,
      codGrupoCol,
      codSubGrupoCol,
      // Campos de TAB_PRODUTO_LOJA
      custoRepCol,
      valorVendaCol,
      valorOfertaCol,
      estoqueAtualCol,
      margemCol,
      margemFixaCol,
      vendaMediaCol,
      coberturaCol,
      pedidoCompraCol,
      dataUltCompraCol,
      qtdUltCompraCol,
      estoqueMinCol,
      dataUltVendaCol,
      curvaCol,
      codFornUltCompraCol,
      inativoCol,
      // Campos de seção/grupo/subgrupo
      desSecaoCol,
      desGrupoCol,
      desSubGrupoCol,
      // Campos de fornecedor
      codFornecedorCol,
      desFornecedorCol,
      // Campo de loja
      codLojaCol
    };
  }
  /**
   * Detecta o tipo do banco da conexao ativa
   * Retorna 'oracle' (default) ou 'postgresql'
   */
  private static async detectActiveDbType(): Promise<'oracle' | 'postgresql' | 'other'> {
    try {
      const repo = AppDataSource.getRepository(DatabaseConnection);
      let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
      if (!conn) {
        conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
      }
      if (!conn) {
        conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
      }
      if (!conn) return 'oracle';
      if (conn.type === DatabaseType.POSTGRESQL) return 'postgresql';
      if (conn.type === DatabaseType.ORACLE) return 'oracle';
      return 'other';
    } catch {
      return 'oracle';
    }
  }

  /**
   * Helper PostgreSQL: busca um ou varios produtos do ERP PostgreSQL (RP INFO etc)
   * Retorna no MESMO formato que as queries Oracle (chaves COD_PRODUTO, DES_PRODUTO, etc)
   * pra permitir reuso direto pelos metodos activate/peso-medio/bulk-activate.
   *
   * RP INFO so tem 2 niveis (departamento+grupo), entao COD_SUB_GRUPO/DES_SUB_GRUPO vem null.
   */
  private static async fetchProductsFromPostgresErp(productIds: string[], loja: number): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    if (productIds.length === 0) return result;

    // Resolver tabelas e colunas
    const schema = await MappingService.getSchema();
    const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
    const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA');
    const tabSecao = await MappingService.getRealTableName('TAB_SECAO');
    const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO');
    const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR');

    const codigoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const eanCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const descricaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const descReduzidaCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida');
    const pesavelCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'pesavel');
    const codSecaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
    const codGrupoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');

    const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
    const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
    const plCodFornUlt = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra');

    const desSecaoCol = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
    const secaoCodCol = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const desGrupoCol = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
    const grupoCodCol = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');

    const desFornecedorCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'nome_fantasia');
    const codFornecedorCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');

    // Em batches de 500 (limite IN do Postgres tambem)
    const BATCH = 500;
    for (let i = 0; i < productIds.length; i += BATCH) {
      const batchIds = productIds.slice(i, i + BATCH);
      const placeholders = batchIds.map((_, idx) => `$${idx + 2}`).join(', ');
      const params: any[] = [loja, ...batchIds];

      const sql = `
        SELECT
          p.${codigoCol} as cod_produto,
          p.${eanCol} as ean,
          p.${descricaoCol} as des_produto,
          p.${descReduzidaCol} as des_reduzida,
          p.${codSecaoCol} as cod_secao,
          s.${desSecaoCol} as des_secao,
          p.${codGrupoCol} as cod_grupo,
          g.${desGrupoCol} as des_grupo,
          null as cod_sub_grupo,
          null as des_sub_grupo,
          pl.${plCodFornUlt} as cod_forn,
          f.${desFornecedorCol} as razao_forn,
          CASE WHEN p.${pesavelCol} = 'S' THEN 'S' ELSE 'N' END as pesavel
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${codigoCol} = pl.${plCodProduto}
        LEFT JOIN ${schema}.${tabSecao} s ON p.${codSecaoCol} = s.${secaoCodCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON p.${codGrupoCol} = g.${grupoCodCol}
        LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${plCodFornUlt} = f.${codFornecedorCol}
        WHERE pl.${plCodLoja}::int = $1::int
        AND p.${codigoCol}::text IN (${placeholders})
      `;

      const rows = await PostgresErpService.query<any>(sql, params);
      rows.forEach((row: any) => {
        // Normaliza pra chaves UPPERCASE igual ao retorno do Oracle
        result.set(String(row.cod_produto), {
          COD_PRODUTO: row.cod_produto,
          EAN: row.ean,
          DES_PRODUTO: row.des_produto,
          DES_REDUZIDA: row.des_reduzida,
          COD_SECAO: row.cod_secao,
          DES_SECAO: row.des_secao,
          COD_GRUPO: row.cod_grupo,
          DES_GRUPO: row.des_grupo,
          COD_SUB_GRUPO: row.cod_sub_grupo,
          DES_SUB_GRUPO: row.des_sub_grupo,
          COD_FORN: row.cod_forn,
          RAZAO_FORN: row.razao_forn,
          PESAVEL: row.pesavel
        });
      });
    }

    return result;
  }

  /**
   * Buscar produtos diretamente do Oracle/PostgreSQL
   * MIGRADO: Antes usava API Intersolid, agora busca direto do banco
   * Oracle: Tradicao, SuperVital (Intersolid)
   * PostgreSQL: Nunes (RP INFO)
   * GET /api/products?codLoja=1
   */
  static async getProducts(req: AuthRequest, res: Response) {
    try {
      // Detecta tipo do banco e bifurca caminho
      const dbType = await ProductsController.detectActiveDbType();
      if (dbType === 'postgresql') {
        return await ProductsController.getProductsPostgres(req, res);
      }
      // Caminho Oracle (default) - codigo original sem alteracoes

      const { codLoja } = req.query;
      const loja = codLoja ? parseInt(codLoja as string) : null;

      console.log('📦 [ORACLE] Buscando produtos do Oracle para loja:', loja || 'TODAS');

      // Busca mapeamentos dinâmicos para os campos
      const {
        codigoCol,
        eanCol,
        descricaoCol,
        descReduzidaCol,
        embalagemCol,
        qtdEmbalagemVendaCol,
        qtdEmbalagemCompraCol,
        pesavelCol,
        tipoEspecieCol,
        tipoEventoCol,
        dataCadastroCol,
        codSecaoCol,
        codGrupoCol,
        codSubGrupoCol,
        custoRepCol,
        valorVendaCol,
        valorOfertaCol,
        estoqueAtualCol,
        margemCol,
        vendaMediaCol,
        coberturaCol,
        pedidoCompraCol,
        dataUltCompraCol,
        qtdUltCompraCol,
        estoqueMinCol,
        dataUltVendaCol,
        curvaCol,
        codFornUltCompraCol,
        inativoCol,
        desSecaoCol,
        desGrupoCol,
        desSubGrupoCol,
        codFornecedorCol,
        desFornecedorCol,
        codLojaCol
      } = await ProductsController.getProdutosMappings();

      console.log(`📋 [MAPEAMENTO] Campo codigo usando coluna: ${codigoCol}`);
      console.log(`📋 [MAPEAMENTO] Campo embalagem usando coluna: ${embalagemCol}`);

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR')
      ]);

      // Query completa para buscar produtos com todas as informações necessárias
      // Usa cache de 5 minutos para melhorar performance
      const cacheKey = `oracle-products-loja-${loja || 'todas'}`;

      const rows = await CacheService.executeWithCache(
        cacheKey,
        async () => {
          console.log('📊 [ORACLE] Cache miss - executando query no Oracle...');

          const sql = `
            SELECT
              p.${codigoCol} as CODIGO,
              p.${eanCol} as EAN,
              p.${descricaoCol} as DESCRICAO,
              p.${descReduzidaCol} as DES_REDUZIDA,
              NVL(pl.${custoRepCol}, 0) as VAL_CUSTO_REP,
              NVL(pl.${valorVendaCol}, 0) as VAL_VENDA,
              NVL(pl.${valorVendaCol}, 0) as VAL_VENDA_LOJA,
              NVL(pl.${valorOfertaCol}, 0) as VAL_OFERTA,
              NVL(pl.${estoqueAtualCol}, 0) as ESTOQUE,
              s.${desSecaoCol} as DES_SECAO,
              g.${desGrupoCol} as DES_GRUPO,
              sg.${desSubGrupoCol} as DES_SUBGRUPO,
              f.${desFornecedorCol} as FANTASIA_FORN,
              NVL(pl.${margemCol}, 0) as MARGEM_REF,
              NVL(pl.${margemCol}, 0) as VAL_MARGEM,
              NVL(pl.${vendaMediaCol}, 0) as VENDA_MEDIA,
              NVL(pl.${coberturaCol}, 0) as DIAS_COBERTURA,
              NVL(pl.${pedidoCompraCol}, 0) as QTD_PEDIDO_COMPRA,
              TO_CHAR(pl.${dataUltCompraCol}, 'DD/MM/YYYY') as DTA_ULT_COMPRA,
              NVL(pl.${qtdUltCompraCol}, 0) as QTD_ULT_COMPRA,
              NVL(pl.${estoqueMinCol}, 0) as QTD_EST_MINIMO,
              TO_CHAR(pl.${dataUltVendaCol}, 'YYYYMMDD') as DTA_ULT_MOV_VENDA,
              NVL(TRIM(pl.${curvaCol}), 'X') as CURVA,
              CASE p.${tipoEspecieCol}
                WHEN 0 THEN 'MERCADORIA'
                WHEN 2 THEN 'SERVICO'
                WHEN 3 THEN 'IMOBILIZADO'
                WHEN 4 THEN 'INSUMO'
                ELSE 'OUTROS'
              END as TIPO_ESPECIE,
              CASE p.${tipoEventoCol}
                WHEN 0 THEN 'Direta'
                WHEN 1 THEN 'Decomposição'
                WHEN 2 THEN 'Composição'
                WHEN 3 THEN 'Produção'
                ELSE 'Outros'
              END as TIPO_EVENTO,
              p.${dataCadastroCol} as DTA_CADASTRO,
              NVL(p.${qtdEmbalagemVendaCol}, 1) as QTD_EMBALAGEM_VENDA,
              p.${embalagemCol} as DES_EMBALAGEM,
              NVL(p.${qtdEmbalagemCompraCol}, 1) as QTD_EMBALAGEM_COMPRA,
              CASE WHEN p.${pesavelCol} = 'S' THEN 'S' ELSE 'N' END as PESAVEL
            FROM ${schema}.${tabProduto} p
            INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${codigoCol} = pl.${codigoCol}
            LEFT JOIN ${schema}.${tabSecao} s ON p.${codSecaoCol} = s.${codSecaoCol}
            LEFT JOIN ${schema}.${tabGrupo} g ON p.${codSecaoCol} = g.${codSecaoCol} AND p.${codGrupoCol} = g.${codGrupoCol}
            LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.${codSecaoCol} = sg.${codSecaoCol} AND p.${codGrupoCol} = sg.${codGrupoCol} AND p.${codSubGrupoCol} = sg.${codSubGrupoCol}
            LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${codFornUltCompraCol} = f.${codFornecedorCol}
            WHERE ${loja ? `pl.${codLojaCol} = :codLoja AND` : ''} NVL(pl.${inativoCol}, 'N') = 'N'
            ORDER BY p.${descricaoCol}
          `;

          return await OracleService.query(sql, loja ? { codLoja: loja } : {});
        }
      );

      // Buscar produtos ativos do banco local para enriquecer
      const productRepository = AppDataSource.getRepository(Product);
      const activeProducts = await productRepository.find({
        select: ['erp_product_id', 'active', 'peso_medio_kg', 'production_days', 'foto_referencia']
      });

      const productsMap = new Map(
        activeProducts.map(p => [p.erp_product_id, {
          active: p.active,
          peso_medio_kg: p.peso_medio_kg,
          production_days: p.production_days,
          foto_referencia: p.foto_referencia
        }])
      );

      // Mapear para o formato esperado pelo frontend (compatível com o antigo)
      const enrichedProducts = rows.map((row: any) => {
        const dbProduct = productsMap.get(String(row.CODIGO));
        return {
          codigo: String(row.CODIGO),
          ean: row.EAN || '',
          descricao: row.DESCRICAO || '',
          desReduzida: row.DES_REDUZIDA || '',
          valCustoRep: parseFloat(row.VAL_CUSTO_REP) || 0,
          valvendaloja: parseFloat(row.VAL_VENDA_LOJA) || 0,
          valvenda: parseFloat(row.VAL_VENDA) || 0,
          valOferta: parseFloat(row.VAL_OFERTA) || 0,
          estoque: parseFloat(row.ESTOQUE) || 0,
          desSecao: row.DES_SECAO || '',
          desGrupo: row.DES_GRUPO || '',
          desSubGrupo: row.DES_SUBGRUPO || '',
          fantasiaForn: row.FANTASIA_FORN || '',
          margemRef: parseFloat(row.MARGEM_REF) || 0,
          vendaMedia: parseFloat(row.VENDA_MEDIA) || 0,
          diasCobertura: parseInt(row.DIAS_COBERTURA) || 0,
          dtaUltCompra: row.DTA_ULT_COMPRA || null,
          qtdUltCompra: parseFloat(row.QTD_ULT_COMPRA) || 0,
          qtdPedidoCompra: parseFloat(row.QTD_PEDIDO_COMPRA) || 0,
          estoqueMinimo: parseFloat(row.QTD_EST_MINIMO) || 0,
          dtaUltMovVenda: row.DTA_ULT_MOV_VENDA || null,
          curva: row.CURVA || '',
          tipoEspecie: row.TIPO_ESPECIE || 'MERCADORIA',
          tipoEvento: row.TIPO_EVENTO || 'Direta',
          dtaCadastro: row.DTA_CADASTRO || null,
          pesavel: row.PESAVEL || 'N',
          // Campos do banco local PostgreSQL
          active: dbProduct?.active || false,
          peso_medio_kg: dbProduct?.peso_medio_kg || null,
          production_days: dbProduct?.production_days || 1,
          foto_referencia: dbProduct?.foto_referencia || null
        };
      });

      console.log(`✅ [ORACLE] ${enrichedProducts.length} produtos encontrados`);

      res.json({
        data: enrichedProducts,
        total: enrichedProducts.length
      });

    } catch (error: any) {
      console.error('❌ [ORACLE] Get products error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Ativar/Desativar produto
   * MIGRADO: Agora busca do Oracle ao invés da API Intersolid
   */
  static async activateProduct(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // This is the ERP product ID (codigo)
      const { active, codLoja } = req.body;
      const loja = codLoja || 1;

      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Active field must be a boolean' });
      }

      const productRepository = AppDataSource.getRepository(Product);
      const historyRepository = AppDataSource.getRepository(ProductActivationHistory);

      // Check if product exists in our database
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        // Detecta tipo do banco (Oracle ou PostgreSQL)
        const dbType = await ProductsController.detectActiveDbType();
        let erpProduct: any = null;

        if (dbType === 'postgresql') {
          // Caminho PostgreSQL (Nunes / RP INFO)
          console.log(`[ACTIVATE] Buscando produto ${id} do PostgreSQL ERP...`);
          const map = await ProductsController.fetchProductsFromPostgresErp([id], loja);
          erpProduct = map.get(String(id)) || null;
          if (!erpProduct) {
            console.error(`[ACTIVATE] Product ${id} not found in PostgreSQL ERP`);
            return res.status(404).json({ error: 'Product not found in ERP' });
          }
        } else {
          // Caminho Oracle (Tradicao / SuperVital / Intersolid) - codigo original
          console.log(`[ACTIVATE] Buscando produto ${id} do Oracle...`);

          // Obter mapeamentos dinâmicos
          const m = await ProductsController.getBasicProductMappings();

          // Obter schema e tabelas dinamicamente
          const schema = await MappingService.getSchema();
          const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
            MappingService.getRealTableName('TAB_PRODUTO'),
            MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
            MappingService.getRealTableName('TAB_SECAO'),
            MappingService.getRealTableName('TAB_GRUPO'),
            MappingService.getRealTableName('TAB_SUBGRUPO'),
            MappingService.getRealTableName('TAB_FORNECEDOR')
          ]);

          const sql = `
            SELECT
              p.${m.codigoCol} as COD_PRODUTO,
              p.${m.eanCol} as EAN,
              p.${m.descricaoCol} as DES_PRODUTO,
              p.${m.descReduzidaCol} as DES_REDUZIDA,
              p.${m.codSecaoCol} as COD_SECAO,
              s.${m.desSecaoCol} as DES_SECAO,
              p.${m.codGrupoCol} as COD_GRUPO,
              g.${m.desGrupoCol} as DES_GRUPO,
              p.${m.codSubGrupoCol} as COD_SUB_GRUPO,
              sg.${m.desSubGrupoCol} as DES_SUB_GRUPO,
              pl.${m.codFornUltCompraCol} as COD_FORN,
              f.${m.desFornecedorCol} as RAZAO_FORN,
              CASE WHEN p.${m.pesavelCol} = 'S' THEN 'S' ELSE 'N' END as PESAVEL
            FROM ${schema}.${tabProduto} p
            INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${m.codigoCol} = pl.${m.codigoCol}
            LEFT JOIN ${schema}.${tabSecao} s ON p.${m.codSecaoCol} = s.${m.codSecaoCol}
            LEFT JOIN ${schema}.${tabGrupo} g ON p.${m.codSecaoCol} = g.${m.codSecaoCol} AND p.${m.codGrupoCol} = g.${m.codGrupoCol}
            LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.${m.codSecaoCol} = sg.${m.codSecaoCol} AND p.${m.codGrupoCol} = sg.${m.codGrupoCol} AND p.${m.codSubGrupoCol} = sg.${m.codSubGrupoCol}
            LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${m.codFornUltCompraCol} = f.${m.codFornecedorCol}
            WHERE p.${m.codigoCol} = :codProduto
            AND pl.${m.codLojaCol} = :codLoja
            AND ROWNUM = 1
          `;

          const rows = await OracleService.query(sql, { codProduto: id, codLoja: loja });

          if (rows.length === 0) {
            console.error(`[ACTIVATE] Product ${id} not found in Oracle`);
            return res.status(404).json({ error: 'Product not found in Oracle' });
          }

          erpProduct = rows[0];
        }

        // Create new product
        product = productRepository.create({
          erp_product_id: String(erpProduct.COD_PRODUTO),
          description: erpProduct.DES_PRODUTO,
          short_description: erpProduct.DES_REDUZIDA || null,
          ean: erpProduct.EAN || null,
          weighable: erpProduct.PESAVEL === 'S',
          section_code: erpProduct.COD_SECAO ? Number(erpProduct.COD_SECAO) : null,
          section_name: erpProduct.DES_SECAO || null,
          group_code: erpProduct.COD_GRUPO ? Number(erpProduct.COD_GRUPO) : null,
          group_name: erpProduct.DES_GRUPO || null,
          subgroup_code: erpProduct.COD_SUB_GRUPO ? Number(erpProduct.COD_SUB_GRUPO) : null,
          subgroup_name: erpProduct.DES_SUB_GRUPO || null,
          supplier_code: erpProduct.COD_FORN ? Number(erpProduct.COD_FORN) : null,
          supplier_name: erpProduct.RAZAO_FORN || null,
          active
        });

        console.log(`[ACTIVATE] Produto ${id} encontrado no Oracle: ${erpProduct.DES_PRODUTO}`);
      } else {
        // Update existing product
        product.active = active;
      }

      // Save product
      await productRepository.save(product);

      // Create history entry
      const history = historyRepository.create({
        user_id: req.user!.id,
        product_id: product.id,
        active
      });
      await historyRepository.save(history);

      res.json({
        message: `Product ${active ? 'activated' : 'deactivated'} successfully`,
        product: {
          id: product.id,
          erp_product_id: product.erp_product_id,
          description: product.description,
          active: product.active
        }
      });

    } catch (error: any) {
      console.error('Activate product error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Atualizar peso médio do produto
   * MIGRADO: Agora busca do Oracle ao invés da API Intersolid
   */
  static async updatePesoMedio(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID (codigo)
      const { peso_medio_kg, codLoja } = req.body;
      const loja = codLoja || 1;

      if (typeof peso_medio_kg !== 'number' || peso_medio_kg < 0) {
        return res.status(400).json({ error: 'peso_medio_kg must be a positive number' });
      }

      const productRepository = AppDataSource.getRepository(Product);

      // Find or create product
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        // Detecta tipo do banco
        const dbType = await ProductsController.detectActiveDbType();
        let erpProduct: any = null;

        if (dbType === 'postgresql') {
          // Caminho PostgreSQL (Nunes / RP INFO)
          console.log(`[PESO_MEDIO] Buscando produto ${id} do PostgreSQL ERP...`);
          const map = await ProductsController.fetchProductsFromPostgresErp([id], loja);
          erpProduct = map.get(String(id)) || null;
          if (!erpProduct) {
            return res.status(404).json({ error: 'Product not found in ERP' });
          }
        } else {
          // Caminho Oracle - codigo original
          console.log(`[PESO_MEDIO] Buscando produto ${id} do Oracle...`);

          // Obter mapeamentos dinâmicos
          const m = await ProductsController.getBasicProductMappings();

          // Obter schema e tabelas dinamicamente
          const schema = await MappingService.getSchema();
          const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
            MappingService.getRealTableName('TAB_PRODUTO'),
            MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
            MappingService.getRealTableName('TAB_SECAO'),
            MappingService.getRealTableName('TAB_GRUPO'),
            MappingService.getRealTableName('TAB_SUBGRUPO'),
            MappingService.getRealTableName('TAB_FORNECEDOR')
          ]);

          const sql = `
            SELECT
              p.${m.codigoCol} as COD_PRODUTO,
              p.${m.eanCol} as EAN,
              p.${m.descricaoCol} as DES_PRODUTO,
              p.${m.descReduzidaCol} as DES_REDUZIDA,
              p.${m.codSecaoCol} as COD_SECAO,
              s.${m.desSecaoCol} as DES_SECAO,
              p.${m.codGrupoCol} as COD_GRUPO,
              g.${m.desGrupoCol} as DES_GRUPO,
              p.${m.codSubGrupoCol} as COD_SUB_GRUPO,
              sg.${m.desSubGrupoCol} as DES_SUB_GRUPO,
              pl.${m.codFornUltCompraCol} as COD_FORN,
              f.${m.desFornecedorCol} as RAZAO_FORN,
              CASE WHEN p.${m.pesavelCol} = 'S' THEN 'S' ELSE 'N' END as PESAVEL
            FROM ${schema}.${tabProduto} p
            INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${m.codigoCol} = pl.${m.codigoCol}
            LEFT JOIN ${schema}.${tabSecao} s ON p.${m.codSecaoCol} = s.${m.codSecaoCol}
            LEFT JOIN ${schema}.${tabGrupo} g ON p.${m.codSecaoCol} = g.${m.codSecaoCol} AND p.${m.codGrupoCol} = g.${m.codGrupoCol}
            LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.${m.codSecaoCol} = sg.${m.codSecaoCol} AND p.${m.codGrupoCol} = sg.${m.codGrupoCol} AND p.${m.codSubGrupoCol} = sg.${m.codSubGrupoCol}
            LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${m.codFornUltCompraCol} = f.${m.codFornecedorCol}
            WHERE p.${m.codigoCol} = :codProduto
            AND pl.${m.codLojaCol} = :codLoja
            AND ROWNUM = 1
          `;

          const rows = await OracleService.query(sql, { codProduto: id, codLoja: loja });

          if (rows.length === 0) {
            return res.status(404).json({ error: 'Product not found in Oracle' });
          }

          erpProduct = rows[0];
        }

        // Create new product
        product = productRepository.create({
          erp_product_id: String(erpProduct.COD_PRODUTO),
          description: erpProduct.DES_PRODUTO,
          short_description: erpProduct.DES_REDUZIDA || null,
          ean: erpProduct.EAN || null,
          weighable: erpProduct.PESAVEL === 'S',
          section_code: erpProduct.COD_SECAO ? Number(erpProduct.COD_SECAO) : null,
          section_name: erpProduct.DES_SECAO || null,
          group_code: erpProduct.COD_GRUPO ? Number(erpProduct.COD_GRUPO) : null,
          group_name: erpProduct.DES_GRUPO || null,
          subgroup_code: erpProduct.COD_SUB_GRUPO ? Number(erpProduct.COD_SUB_GRUPO) : null,
          subgroup_name: erpProduct.DES_SUB_GRUPO || null,
          supplier_code: erpProduct.COD_FORN ? Number(erpProduct.COD_FORN) : null,
          supplier_name: erpProduct.RAZAO_FORN || null,
          active: false,
          peso_medio_kg
        });
      } else {
        // Update existing product
        product.peso_medio_kg = peso_medio_kg;
      }

      await productRepository.save(product);

      res.json({
        message: 'Peso médio atualizado com sucesso',
        product: {
          erp_product_id: product.erp_product_id,
          peso_medio_kg: product.peso_medio_kg
        }
      });

    } catch (error: any) {
      console.error('Update peso medio error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  static async updateProductionDays(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID (codigo)
      const { production_days } = req.body;

      if (typeof production_days !== 'number' || production_days < 1) {
        return res.status(400).json({ error: 'production_days must be a number >= 1' });
      }

      const productRepository = AppDataSource.getRepository(Product);

      // Find product
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found. Activate it first.' });
      }

      // Update production days
      product.production_days = production_days;
      await productRepository.save(product);

      res.json({
        message: 'Dias de produção atualizados com sucesso',
        product: {
          erp_product_id: product.erp_product_id,
          production_days: product.production_days
        }
      });

    } catch (error) {
      console.error('Update production days error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Ativação/Desativação em massa de produtos
   * MIGRADO: Agora busca do Oracle ao invés da API Intersolid
   * Otimizado para buscar todos os produtos necessários em uma única query
   */
  static async bulkActivateProducts(req: AuthRequest, res: Response) {
    try {
      const { productIds, active, codLoja } = req.body;
      const loja = codLoja || 1;

      if (!Array.isArray(productIds) || typeof active !== 'boolean') {
        return res.status(400).json({
          error: 'Invalid request. Provide productIds array and active boolean'
        });
      }

      if (productIds.length === 0) {
        return res.status(400).json({ error: 'No products selected' });
      }

      const productRepository = AppDataSource.getRepository(Product);
      const historyRepository = AppDataSource.getRepository(ProductActivationHistory);

      const results: any[] = [];
      const errors: any[] = [];

      console.log(`[BULK-ORACLE] Processing ${productIds.length} products...`);

      // 1. Buscar produtos que já existem no PostgreSQL local
      const existingProducts = await productRepository
        .createQueryBuilder('p')
        .where('p.erp_product_id IN (:...ids)', { ids: productIds })
        .getMany();

      const existingMap = new Map(existingProducts.map(p => [p.erp_product_id, p]));
      const missingIds = productIds.filter(id => !existingMap.has(id));

      console.log(`[BULK-ORACLE] ${existingProducts.length} já existem, ${missingIds.length} precisam ser buscados do Oracle`);

      // 2. Buscar produtos faltantes do Oracle (em uma única query)
      let oracleProductsMap = new Map<string, any>();

      if (missingIds.length > 0) {
        // Detecta tipo do banco
        const dbType = await ProductsController.detectActiveDbType();

        if (dbType === 'postgresql') {
          // Caminho PostgreSQL (Nunes / RP INFO) - usa helper
          console.log(`[BULK-PG] Buscando ${missingIds.length} produtos do PostgreSQL ERP...`);
          oracleProductsMap = await ProductsController.fetchProductsFromPostgresErp(missingIds, loja);
          console.log(`[BULK-PG] ${oracleProductsMap.size} produtos encontrados no PostgreSQL ERP`);
        } else {
          // Caminho Oracle - codigo original
          // Obter mapeamentos dinâmicos
          const m = await ProductsController.getBasicProductMappings();

          // Obter schema e tabelas dinamicamente
          const schema = await MappingService.getSchema();
          const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
            MappingService.getRealTableName('TAB_PRODUTO'),
            MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
            MappingService.getRealTableName('TAB_SECAO'),
            MappingService.getRealTableName('TAB_GRUPO'),
            MappingService.getRealTableName('TAB_SUBGRUPO'),
            MappingService.getRealTableName('TAB_FORNECEDOR')
          ]);

          // Dividir em batches de 500 para evitar limite do Oracle IN clause
          const ORACLE_BATCH_SIZE = 500;
          for (let i = 0; i < missingIds.length; i += ORACLE_BATCH_SIZE) {
            const batchIds = missingIds.slice(i, i + ORACLE_BATCH_SIZE);

            // Construir placeholders para a query
            const placeholders = batchIds.map((_, idx) => `:id${idx}`).join(', ');
            const params: any = { codLoja: loja };
            batchIds.forEach((id, idx) => { params[`id${idx}`] = id; });

            const sql = `
              SELECT
                p.${m.codigoCol} as COD_PRODUTO,
                p.${m.eanCol} as EAN,
                p.${m.descricaoCol} as DES_PRODUTO,
                p.${m.descReduzidaCol} as DES_REDUZIDA,
                p.${m.codSecaoCol} as COD_SECAO,
                s.${m.desSecaoCol} as DES_SECAO,
                p.${m.codGrupoCol} as COD_GRUPO,
                g.${m.desGrupoCol} as DES_GRUPO,
                p.${m.codSubGrupoCol} as COD_SUB_GRUPO,
                sg.${m.desSubGrupoCol} as DES_SUB_GRUPO,
                pl.${m.codFornUltCompraCol} as COD_FORN,
                f.${m.desFornecedorCol} as RAZAO_FORN,
                CASE WHEN p.${m.pesavelCol} = 'S' THEN 'S' ELSE 'N' END as PESAVEL
              FROM ${schema}.${tabProduto} p
              INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${m.codigoCol} = pl.${m.codigoCol}
              LEFT JOIN ${schema}.${tabSecao} s ON p.${m.codSecaoCol} = s.${m.codSecaoCol}
              LEFT JOIN ${schema}.${tabGrupo} g ON p.${m.codSecaoCol} = g.${m.codSecaoCol} AND p.${m.codGrupoCol} = g.${m.codGrupoCol}
              LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.${m.codSecaoCol} = sg.${m.codSecaoCol} AND p.${m.codGrupoCol} = sg.${m.codGrupoCol} AND p.${m.codSubGrupoCol} = sg.${m.codSubGrupoCol}
              LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${m.codFornUltCompraCol} = f.${m.codFornecedorCol}
              WHERE p.${m.codigoCol} IN (${placeholders})
              AND pl.${m.codLojaCol} = :codLoja
            `;

            const rows = await OracleService.query(sql, params);
            rows.forEach((row: any) => {
              oracleProductsMap.set(String(row.COD_PRODUTO), row);
            });
          }

          console.log(`[BULK-ORACLE] ${oracleProductsMap.size} produtos encontrados no Oracle`);
        }
      }

      // 3. Processar todos os produtos
      const BATCH_SIZE = 50;
      for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
        const batch = productIds.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (productId) => {
          try {
            let product = existingMap.get(productId);

            if (!product) {
              // Criar produto a partir do Oracle
              const erpProduct = oracleProductsMap.get(productId);

              if (!erpProduct) {
                return { productId, error: 'Product not found in Oracle' };
              }

              product = productRepository.create({
                erp_product_id: String(erpProduct.COD_PRODUTO),
                description: erpProduct.DES_PRODUTO,
                short_description: erpProduct.DES_REDUZIDA || null,
                ean: erpProduct.EAN || null,
                weighable: erpProduct.PESAVEL === 'S',
                section_code: erpProduct.COD_SECAO ? Number(erpProduct.COD_SECAO) : null,
                section_name: erpProduct.DES_SECAO || null,
                group_code: erpProduct.COD_GRUPO ? Number(erpProduct.COD_GRUPO) : null,
                group_name: erpProduct.DES_GRUPO || null,
                subgroup_code: erpProduct.COD_SUB_GRUPO ? Number(erpProduct.COD_SUB_GRUPO) : null,
                subgroup_name: erpProduct.DES_SUB_GRUPO || null,
                supplier_code: erpProduct.COD_FORN ? Number(erpProduct.COD_FORN) : null,
                supplier_name: erpProduct.RAZAO_FORN || null,
                active
              });
            } else {
              product.active = active;
            }

            await productRepository.save(product);

            const history = historyRepository.create({
              user_id: req.user!.id,
              product_id: product.id,
              active
            });
            await historyRepository.save(history);

            return {
              productId,
              success: true,
              description: product.description
            };

          } catch (error) {
            console.error(`Error processing product ${productId}:`, error);
            return { productId, error: 'Internal processing error' };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const productResult = result.value;
            if ('success' in productResult && productResult.success) {
              results.push(productResult);
            } else if ('error' in productResult) {
              errors.push(productResult);
            }
          } else {
            errors.push({
              productId: batch[index],
              error: 'Promise execution failed'
            });
          }
        });
      }

      console.log(`[BULK-ORACLE] Completed. Success: ${results.length}, Errors: ${errors.length}`);

      res.json({
        message: `Bulk ${active ? 'activation' : 'deactivation'} completed`,
        processed: results.length,
        errorCount: errors.length,
        results,
        errors
      });

    } catch (error: any) {
      console.error('Bulk activate products error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Upload de foto e análise automática por IA
   * POST /api/products/:id/upload-photo
   */
  static async uploadAndAnalyzePhoto(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID
      const file = req.file; // Multer file (em memória)

      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Importar serviço do MinIO
      const { minioService } = await import('../services/minio.service');

      // Salvar foto no produto
      const productRepository = AppDataSource.getRepository(Product);
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        // Criar produto se não existir
        product = productRepository.create({
          erp_product_id: id,
          description: `Produto ${id}`, // Campo obrigatório
          active: false
        });
      }

      // Gerar nome único para o arquivo
      const ext = file.originalname.split('.').pop() || 'jpg';
      const fileName = `products/${id}-${Date.now()}.${ext}`;

      // Upload para MinIO
      const fotoUrl = await minioService.uploadFile(fileName, file.buffer, file.mimetype);

      // Atualizar produto com URL da foto
      product.foto_referencia = fotoUrl;
      await productRepository.save(product);

      console.log(`✅ Foto salva no MinIO para produto ${id}: ${fotoUrl}`);

      res.json({
        message: 'Foto enviada com sucesso',
        foto_url: fotoUrl
      });

    } catch (error) {
      console.error('Upload photo error:', error);
      res.status(500).json({ error: 'Erro ao processar imagem' });
    }
  }

  /**
   * Atualizar características de IA do produto
   * PUT /api/products/:id/ai-characteristics
   */
  static async updateAICharacteristics(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        coloracao,
        formato,
        gordura_visivel,
        presenca_osso,
        peso_min_kg,
        peso_max_kg,
        posicao_balcao
      } = req.body;

      const productRepository = AppDataSource.getRepository(Product);
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Atualizar campos
      if (coloracao !== undefined) product.coloracao = coloracao;
      if (formato !== undefined) product.formato = formato;
      if (gordura_visivel !== undefined) product.gordura_visivel = gordura_visivel;
      if (presenca_osso !== undefined) product.presenca_osso = presenca_osso;
      if (peso_min_kg !== undefined) product.peso_min_kg = peso_min_kg;
      if (peso_max_kg !== undefined) product.peso_max_kg = peso_max_kg;
      if (posicao_balcao !== undefined) product.posicao_balcao = posicao_balcao;

      await productRepository.save(product);

      res.json({
        message: 'Características atualizadas com sucesso',
        product: {
          erp_product_id: product.erp_product_id,
          coloracao: product.coloracao,
          formato: product.formato,
          gordura_visivel: product.gordura_visivel,
          presenca_osso: product.presenca_osso,
          peso_min_kg: product.peso_min_kg,
          peso_max_kg: product.peso_max_kg,
          posicao_balcao: product.posicao_balcao
        }
      });

    } catch (error) {
      console.error('Update AI characteristics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Captura foto da câmera do DVR e analisa com YOLO
   * POST /api/products/:id/capture-from-camera
   */
  static async captureFromCamera(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID
      const { cameraId = 15 } = req.body; // Default: câmera 15 (balança)

      console.log(`📸 Capturando foto da câmera ${cameraId} para produto ${id}...`);

      // Importar serviço DVR
      const { dvrSnapshotService } = await import('../services/dvr-snapshot.service');

      // Capturar e analisar
      const { imagePath, analysis } = await dvrSnapshotService.captureAndAnalyze(cameraId);

      // Salvar no produto
      const productRepository = AppDataSource.getRepository(Product);
      let product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Atualizar produto com dados da análise
      const filename = path.basename(imagePath);
      product.foto_referencia = `/uploads/dvr-snapshots/${filename}`;
      product.coloracao = analysis.coloracao;
      product.formato = analysis.formato;
      product.gordura_visivel = analysis.gordura_visivel;
      product.presenca_osso = analysis.presenca_osso;

      await productRepository.save(product);

      console.log(`✅ Foto capturada e analisada para produto ${id}`);

      res.json({
        message: 'Foto capturada e analisada com sucesso',
        foto_url: product.foto_referencia,
        analysis: {
          coloracao: analysis.coloracao,
          coloracao_rgb: analysis.coloracao_rgb,
          formato: analysis.formato,
          gordura_visivel: analysis.gordura_visivel,
          presenca_osso: analysis.presenca_osso,
          confianca: analysis.confianca
        }
      });

    } catch (error: any) {
      console.error('❌ Erro ao capturar foto da câmera:', error);
      res.status(500).json({
        error: error.message || 'Erro ao capturar foto da câmera'
      });
    }
  }

  /**
   * Listar seções únicas dos produtos
   * MIGRADO: Agora busca do Oracle ao invés da API Intersolid
   * GET /api/products/sections
   */
  static async getSections(req: AuthRequest, res: Response) {
    try {
      console.log('📦 [ORACLE] Buscando seções do Oracle...');

      // Obter mapeamentos dinâmicos
      const desSecaoCol = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

      // Obter schema e tabela dinamicamente
      const schema = await MappingService.getSchema();
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO');

      const sql = `
        SELECT ${desSecaoCol} as DES_SECAO
        FROM ${schema}.${tabSecao}
        WHERE ${desSecaoCol} IS NOT NULL
        ORDER BY ${desSecaoCol}
      `;

      const rows = await OracleService.query(sql);

      // Retorna array de strings (nomes das seções) para manter compatibilidade
      const sections = rows.map((row: any) => row.DES_SECAO).filter(Boolean);

      console.log(`✅ [ORACLE] ${sections.length} seções encontradas`);

      res.json(sections);

    } catch (error: any) {
      console.error('Get sections error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar seções do Oracle com código e nome
   * GET /api/products/sections-oracle
   */
  static async getSectionsOracle(req: AuthRequest, res: Response) {
    try {
      // Obter mapeamentos dinâmicos
      const codSecaoCol = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
      const desSecaoCol = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

      // Obter schema e tabela dinamicamente
      const schema = await MappingService.getSchema();
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO');

      const sql = `
        SELECT ${codSecaoCol} as COD_SECAO, ${desSecaoCol} as DES_SECAO
        FROM ${schema}.${tabSecao}
        ORDER BY ${codSecaoCol}
      `;

      const rows = await OracleService.query(sql);

      // Retorna array de objetos com código e nome
      const sections = rows.map((row: any) => ({
        codigo: row.COD_SECAO,
        nome: row.DES_SECAO
      }));

      res.json(sections);
    } catch (error) {
      console.error('Get sections Oracle error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Buscar produtos filtrados por seção do Oracle
   * GET /api/products/by-section-oracle?section=HORT FRUTI&codLoja=1
   */
  static async getProductsBySectionOracle(req: AuthRequest, res: Response) {
    try {
      const { section, codLoja } = req.query;

      if (!section) {
        return res.status(400).json({ error: 'Parâmetro section é obrigatório' });
      }

      const loja = codLoja ? parseInt(codLoja as string) : 1;

      console.log('📦 Buscando produtos por seção do Oracle:', { section, loja });

      // Obter mapeamentos dinâmicos
      const bm = await ProductsController.getBasicProductMappings();
      const plm = await ProductsController.getProdutoLojaMappings();

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO')
      ]);

      // Query para buscar produtos com informações completas
      // VAL_MARGEM_FIXA = margem de referência, VAL_MARGEM = margem atual
      const sql = `
        SELECT
          p.${bm.codigoCol} as COD_PRODUTO,
          p.${bm.eanCol} as COD_BARRA_PRINCIPAL,
          p.${bm.descricaoCol} as DES_PRODUTO,
          s.${bm.desSecaoCol} as DES_SECAO,
          g.${bm.desGrupoCol} as DES_GRUPO,
          TRIM(pl.${plm.curvaCol}) as CURVA,
          NVL(pl.${plm.custoRepCol}, 0) as VAL_CUSTO_REP,
          NVL(pl.${plm.valorVendaCol}, 0) as VAL_VENDA,
          NVL(pl.${plm.margemCol}, 0) as VAL_MARGEM,
          NVL(pl.${plm.margemFixaCol}, pl.${plm.margemCol}) as VAL_MARGEM_REF
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${bm.codigoCol} = pl.${plm.plCodigoCol}
        LEFT JOIN ${schema}.${tabSecao} s ON p.${bm.codSecaoCol} = s.${bm.codSecaoCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON p.${bm.codSecaoCol} = g.${bm.codSecaoCol} AND p.${bm.codGrupoCol} = g.${bm.codGrupoCol}
        WHERE pl.${plm.codLojaCol} = :codLoja
        AND UPPER(s.${bm.desSecaoCol}) LIKE :sectionFilter
        AND NVL(pl.${plm.inativoCol}, 'N') = 'N'
        ORDER BY p.${bm.descricaoCol}
      `;

      const params = {
        codLoja: loja,
        sectionFilter: `%${String(section).toUpperCase()}%`
      };

      const rows = await OracleService.query(sql, params);

      // Mapear para formato esperado pelo HortFrut
      const items = rows.map((row: any) => ({
        barcode: row.COD_BARRA_PRINCIPAL || String(row.COD_PRODUTO),
        productName: row.DES_PRODUTO || '',
        curve: row.CURVA || '',
        currentCost: parseFloat(row.VAL_CUSTO_REP) || 0,
        currentSalePrice: parseFloat(row.VAL_VENDA) || 0,
        referenceMargin: parseFloat(row.VAL_MARGEM_REF) || 0,
        currentMargin: parseFloat(row.VAL_MARGEM) || 0,
        section: row.DES_SECAO || '',
        productGroup: row.DES_GRUPO || '',
        subGroup: ''
      }));

      console.log(`✅ ${items.length} produtos encontrados na seção "${section}"`);

      res.json({
        section: section,
        total: items.length,
        items
      });

    } catch (error: any) {
      console.error('Get products by section Oracle error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar produtos filtrados por seção
   * MIGRADO: Agora busca do Oracle ao invés da API Intersolid
   * GET /api/products/by-section?section=HORTIFRUTI&codLoja=1
   */
  static async getProductsBySection(req: AuthRequest, res: Response) {
    try {
      const { section, codLoja } = req.query;
      const loja = codLoja ? parseInt(codLoja as string) : 1;

      if (!section) {
        return res.status(400).json({ error: 'Parâmetro section é obrigatório' });
      }

      console.log('📦 [ORACLE] Buscando produtos por seção:', { section, loja });

      // Obter mapeamentos dinâmicos
      const bm = await ProductsController.getBasicProductMappings();
      const plm = await ProductsController.getProdutoLojaMappings();

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO')
      ]);

      const sql = `
        SELECT
          p.${bm.codigoCol} as COD_PRODUTO,
          p.${bm.eanCol} as EAN,
          p.${bm.descricaoCol} as DES_PRODUTO,
          s.${bm.desSecaoCol} as DES_SECAO,
          g.${bm.desGrupoCol} as DES_GRUPO,
          sg.${bm.desSubGrupoCol} as DES_SUB_GRUPO,
          TRIM(pl.${plm.curvaCol}) as CURVA,
          NVL(pl.${plm.custoRepCol}, 0) as VAL_CUSTO_REP,
          NVL(pl.${plm.valorVendaCol}, 0) as VAL_VENDA,
          NVL(pl.${plm.margemCol}, 0) as VAL_MARGEM,
          NVL(pl.${plm.margemFixaCol}, pl.${plm.margemCol}) as VAL_MARGEM_REF
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${bm.codigoCol} = pl.${plm.plCodigoCol}
        LEFT JOIN ${schema}.${tabSecao} s ON p.${bm.codSecaoCol} = s.${bm.codSecaoCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON p.${bm.codSecaoCol} = g.${bm.codSecaoCol} AND p.${bm.codGrupoCol} = g.${bm.codGrupoCol}
        LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.${bm.codSecaoCol} = sg.${bm.codSecaoCol} AND p.${bm.codGrupoCol} = sg.${bm.codGrupoCol} AND p.${bm.codSubGrupoCol} = sg.${bm.codSubGrupoCol}
        WHERE pl.${plm.codLojaCol} = :codLoja
        AND UPPER(s.${bm.desSecaoCol}) LIKE :sectionFilter
        AND NVL(pl.${plm.inativoCol}, 'N') = 'N'
        ORDER BY p.${bm.descricaoCol}
      `;

      const params = {
        codLoja: loja,
        sectionFilter: `%${String(section).toUpperCase()}%`
      };

      const rows = await OracleService.query(sql, params);

      // Mapear para formato esperado pelo HortFrut
      const items = rows.map((row: any) => ({
        barcode: row.EAN || String(row.COD_PRODUTO),
        productName: row.DES_PRODUTO || '',
        curve: row.CURVA || '',
        currentCost: parseFloat(row.VAL_CUSTO_REP) || 0,
        currentSalePrice: parseFloat(row.VAL_VENDA) || 0,
        referenceMargin: parseFloat(row.VAL_MARGEM_REF) || 0,
        currentMargin: parseFloat(row.VAL_MARGEM) || 0,
        section: row.DES_SECAO || '',
        productGroup: row.DES_GRUPO || '',
        subGroup: row.DES_SUB_GRUPO || ''
      }));

      console.log(`✅ [ORACLE] ${items.length} produtos encontrados na seção "${section}"`);

      res.json({
        section: section,
        total: items.length,
        items
      });

    } catch (error: any) {
      console.error('Get products by section error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar produtos para pesquisa de ruptura com filtros
   * GET /api/products/for-rupture?diasSemVenda=7&curvas=A,B,C&secoes=MERCEARIA,BEBIDAS&codLoja=1
   * Busca diretamente do banco Oracle
   */
  static async getProductsForRupture(req: AuthRequest, res: Response) {
    try {
      const { diasSemVenda, curvas, secoes, codLoja } = req.query;

      // Importar OracleService
      const { OracleService } = await import('../services/oracle.service');

      // Obter mapeamentos dinâmicos
      const bm = await ProductsController.getBasicProductMappings();
      const plm = await ProductsController.getProdutoLojaMappings();

      // Montar query Oracle
      let whereConditions: string[] = [];
      const params: any = {};

      // Filtro de loja (default = 1)
      const loja = codLoja ? parseInt(codLoja as string) : 1;
      whereConditions.push(`pl.${plm.codLojaCol} = :codLoja`);
      params.codLoja = loja;

      // Filtro de dias sem venda
      if (diasSemVenda) {
        const dias = parseInt(diasSemVenda as string);
        if (!isNaN(dias) && dias > 0) {
          whereConditions.push(`(pl.${plm.dataUltVendaCol} IS NULL OR pl.${plm.dataUltVendaCol} <= SYSDATE - :diasSemVenda)`);
          params.diasSemVenda = dias;
        }
      }

      // Filtro de curvas
      if (curvas && curvas !== 'TODOS') {
        const curvasArray = (curvas as string).split(',').map(c => c.trim().toUpperCase());
        whereConditions.push(`pl.${plm.curvaCol} IN (${curvasArray.map((_, i) => `:curva${i}`).join(', ')})`);
        curvasArray.forEach((curva, i) => {
          params[`curva${i}`] = curva;
        });
      }

      // Filtro de seções
      if (secoes) {
        const secoesArray = (secoes as string).split(',').map(s => s.trim().toUpperCase());
        const secaoConditions = secoesArray.map((_, i) => `UPPER(s.${bm.desSecaoCol}) LIKE :secao${i}`);
        whereConditions.push(`(${secaoConditions.join(' OR ')})`);
        secoesArray.forEach((secao, i) => {
          params[`secao${i}`] = `%${secao}%`;
        });
      }

      // Filtrar apenas produtos ativos
      whereConditions.push(`NVL(pl.${plm.inativoCol}, 'N') = 'N'`);
      whereConditions.push(`p.${bm.codigoCol} IS NOT NULL`);

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR')
      ]);

      const sql = `
        SELECT
          p.${bm.eanCol} as CODIGO_BARRAS,
          p.${bm.codigoCol} as ERP_PRODUCT_ID,
          p.${bm.descricaoCol} as DESCRICAO,
          TRIM(pl.${plm.curvaCol}) as CURVA,
          NVL(pl.${plm.estoqueAtualCol}, 0) as ESTOQUE_ATUAL,
          NVL(pl.${plm.coberturaCol}, 0) as COBERTURA_DIAS,
          g.${bm.desGrupoCol} as GRUPO,
          s.${bm.desSecaoCol} as SECAO,
          pl.${plm.codFornUltCompraCol} as COD_FORNECEDOR,
          f.${bm.desFornecedorCol} as FORNECEDOR,
          NVL(pl.${plm.margemCol}, 0) as MARGEM_LUCRO,
          1 as QTD_EMBALAGEM,
          NVL(pl.${plm.valorVendaCol}, 0) as VALOR_VENDA,
          NVL(pl.${plm.custoRepCol}, 0) as CUSTO_COM_IMPOSTO,
          NVL(pl.${plm.vendaMediaCol}, 0) as VENDA_MEDIA_DIA,
          CASE WHEN NVL(pl.${plm.pedidoCompraCol}, 0) > 0 THEN 'Sim' ELSE 'Nao' END as TEM_PEDIDO,
          pl.${plm.dataUltVendaCol} as DTA_ULT_VENDA,
          CASE
            WHEN pl.${plm.dataUltVendaCol} IS NULL THEN 9999
            ELSE TRUNC(SYSDATE - pl.${plm.dataUltVendaCol})
          END as DIAS_SEM_VENDA
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${bm.codigoCol} = pl.${plm.plCodigoCol}
        LEFT JOIN ${schema}.${tabSecao} s ON p.${bm.codSecaoCol} = s.${bm.codSecaoCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON p.${bm.codSecaoCol} = g.${bm.codSecaoCol} AND p.${bm.codGrupoCol} = g.${bm.codGrupoCol}
        LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${plm.codFornUltCompraCol} = f.${bm.codFornecedorCol}
        ${whereClause}
        ORDER BY DIAS_SEM_VENDA DESC, pl.${plm.curvaCol} ASC
      `;

      console.log('📊 Buscando produtos para ruptura do Oracle...');
      console.log('Filtros:', { diasSemVenda, curvas, secoes, codLoja: loja });

      const rows = await OracleService.query(sql, params);

      // Mapear para formato esperado
      const items = rows.map((row: any) => ({
        codigo_barras: row.CODIGO_BARRAS || String(row.ERP_PRODUCT_ID),
        erp_product_id: String(row.ERP_PRODUCT_ID),
        descricao: row.DESCRICAO || '',
        curva: row.CURVA || '',
        estoque_atual: row.ESTOQUE_ATUAL || 0,
        cobertura_dias: row.COBERTURA_DIAS || 0,
        grupo: row.GRUPO || '',
        secao: row.SECAO || '',
        fornecedor: row.FORNECEDOR || '',
        margem_lucro: row.MARGEM_LUCRO || 0,
        qtd_embalagem: 1,
        valor_venda: row.VALOR_VENDA || 0,
        custo_com_imposto: row.CUSTO_COM_IMPOSTO || 0,
        venda_media_dia: row.VENDA_MEDIA_DIA || 0,
        tem_pedido: row.TEM_PEDIDO || 'Nao',
        dias_sem_venda: row.DIAS_SEM_VENDA === 9999 ? null : row.DIAS_SEM_VENDA,
        dta_ult_venda: row.DTA_ULT_VENDA
      }));

      console.log(`✅ ${items.length} produtos encontrados`);

      res.json({
        total: items.length,
        filtros: {
          diasSemVenda: diasSemVenda || null,
          curvas: curvas || 'TODOS',
          secoes: secoes || null,
          codLoja: loja
        },
        items
      });

    } catch (error: any) {
      console.error('Get products for rupture error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar produtos para auditoria de etiquetas (alteração de preço de VENDA)
   * GET /api/products/for-label-audit
   * Filtros: dataInicio, dataFim, tipoOferta (todos, com_oferta, sem_oferta), secoes
   *
   * Usa TAB_PRODUTO_HISTORICO.DTA_ULT_ALT_PRECO_VENDA para buscar alterações
   * específicas do preço de venda (não confundir com DTA_ALTERACAO_PRECO que
   * captura outras alterações também)
   */
  static async getProductsForLabelAudit(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, tipoOferta, secoes, codLoja } = req.query;

      // Validar datas
      if (!dataInicio || !dataFim) {
        return res.status(400).json({ error: 'Data início e data fim são obrigatórias' });
      }

      // Loja padrão = 1
      const loja = codLoja || 1;

      // Obter mapeamentos dinâmicos
      const bm = await ProductsController.getBasicProductMappings();
      const plm = await ProductsController.getProdutoLojaMappings();

      // Mapeamentos de TAB_PRODUTO_HISTORICO - colunas específicas dessa tabela
      // (não existem no TABLE_CATALOG padrão, mantém hardcoded com comentário)
      const hCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_HISTORICO', 'codigo_produto');
      const hCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_HISTORICO', 'codigo_loja');
      // Colunas específicas de TAB_PRODUTO_HISTORICO - hardcoded (sem mapeamento no TABLE_CATALOG)
      const hDtaUltAltPrecoVenda = 'DTA_ULT_ALT_PRECO_VENDA';
      const hValVendaAnt = 'VAL_VENDA_ANT';
      const hValVendaPdv = 'VAL_VENDA_PDV';
      const hDtaCargaPdv = 'DTA_CARGA_PDV';
      // Coluna DTA_VALIDA_OFERTA em TAB_PRODUTO_LOJA - hardcoded (sem mapeamento no TABLE_CATALOG)
      const plDtaValidaOferta = 'DTA_VALIDA_OFERTA';

      // Construir WHERE dinâmico
      const whereConditions: string[] = [];
      const params: any = {
        dataInicio: dataInicio,
        dataFim: dataFim,
        codLoja: loja
      };

      // Filtro de data de alteração de preço de VENDA usando TAB_PRODUTO_HISTORICO
      // DTA_ULT_ALT_PRECO_VENDA é a coluna correta para capturar alterações de preço de venda
      whereConditions.push(`(
        h.${hDtaUltAltPrecoVenda} >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND h.${hDtaUltAltPrecoVenda} < TO_DATE(:dataFim, 'YYYY-MM-DD') + 1
      )`);

      // Filtro de loja
      whereConditions.push(`h.${hCodLojaCol} = :codLoja`);

      // Filtro de tipo de oferta
      if (tipoOferta === 'com_oferta') {
        whereConditions.push(`pl.${plm.valorOfertaCol} IS NOT NULL AND pl.${plm.valorOfertaCol} > 0 AND TRUNC(SYSDATE) <= NVL(pl.${plDtaValidaOferta}, TRUNC(SYSDATE))`);
      } else if (tipoOferta === 'sem_oferta') {
        whereConditions.push(`(pl.${plm.valorOfertaCol} IS NULL OR pl.${plm.valorOfertaCol} = 0 OR TRUNC(SYSDATE) > NVL(pl.${plDtaValidaOferta}, TRUNC(SYSDATE) - 1))`);
      }

      // Filtro de seções (opcional)
      if (secoes && typeof secoes === 'string') {
        const secoesArray = secoes.split(',').map(s => s.trim().toUpperCase());
        const secaoConditions = secoesArray.map((_, i) => `UPPER(s.${bm.desSecaoCol}) LIKE :secao${i}`);
        whereConditions.push(`(${secaoConditions.join(' OR ')})`);
        secoesArray.forEach((secao, i) => {
          params[`secao${i}`] = `%${secao}%`;
        });
      }

      // Filtrar apenas produtos com preço válido
      whereConditions.push(`p.${bm.codigoCol} IS NOT NULL`);
      whereConditions.push(`pl.${plm.valorVendaCol} IS NOT NULL`);

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabProdutoHistorico, tabSecao, tabGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_PRODUTO_HISTORICO'),
        MappingService.getRealTableName('TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR')
      ]);

      // Query usando TAB_PRODUTO_HISTORICO para pegar DTA_ULT_ALT_PRECO_VENDA
      // e VAL_VENDA_ANT (preço anterior) / VAL_VENDA_PDV (preço no PDV)
      const sql = `
        SELECT
          p.${bm.eanCol} as CODIGO_BARRAS,
          p.${bm.codigoCol} as ERP_PRODUCT_ID,
          p.${bm.descricaoCol} as DESCRICAO,
          s.${bm.desSecaoCol} as SECAO,
          g.${bm.desGrupoCol} as GRUPO,
          NVL(pl.${plm.valorVendaCol}, 0) as VAL_VENDA,
          NVL(h.${hValVendaAnt}, 0) as VAL_VENDA_ANTERIOR,
          NVL(h.${hValVendaPdv}, 0) as VAL_VENDA_PDV,
          NVL(pl.${plm.valorOfertaCol}, 0) as VAL_OFERTA,
          pl.${plDtaValidaOferta} as DTA_VALIDA_OFERTA,
          h.${hDtaUltAltPrecoVenda} as DTA_ALTERACAO,
          h.${hDtaCargaPdv} as DTA_CARGA_PDV,
          NVL(pl.${plm.margemCol}, 0) as VAL_MARGEM,
          f.${bm.desFornecedorCol} as FORNECEDOR,
          CASE
            WHEN pl.${plm.valorOfertaCol} IS NOT NULL AND pl.${plm.valorOfertaCol} > 0
                 AND TRUNC(SYSDATE) <= NVL(pl.${plDtaValidaOferta}, TRUNC(SYSDATE))
            THEN 'S'
            ELSE 'N'
          END as EM_OFERTA
        FROM ${schema}.${tabProdutoHistorico} h
        JOIN ${schema}.${tabProduto} p ON h.${hCodProdutoCol} = p.${bm.codigoCol}
        JOIN ${schema}.${tabProdutoLoja} pl ON h.${hCodProdutoCol} = pl.${plm.plCodigoCol} AND h.${hCodLojaCol} = pl.${plm.codLojaCol}
        LEFT JOIN ${schema}.${tabSecao} s ON p.${bm.codSecaoCol} = s.${bm.codSecaoCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON p.${bm.codSecaoCol} = g.${bm.codSecaoCol} AND p.${bm.codGrupoCol} = g.${bm.codGrupoCol}
        LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${plm.codFornUltCompraCol} = f.${bm.codFornecedorCol}
        ${whereClause}
        ORDER BY s.${bm.desSecaoCol} ASC NULLS LAST, p.${bm.descricaoCol} ASC
      `;

      console.log('📊 Buscando produtos para auditoria de etiquetas do Oracle...');
      console.log('Filtros:', { dataInicio, dataFim, tipoOferta, secoes, codLoja: loja });

      const rows = await OracleService.query(sql, params);

      // Mapear para formato esperado
      const items = rows.map((row: any) => ({
        codigo_barras: row.CODIGO_BARRAS || String(row.ERP_PRODUCT_ID),
        erp_product_id: String(row.ERP_PRODUCT_ID),
        descricao: row.DESCRICAO || '',
        secao: row.SECAO || '',
        grupo: row.GRUPO || '',
        valor_venda: row.VAL_VENDA || 0,
        valor_venda_anterior: row.VAL_VENDA_ANTERIOR || 0,
        valor_venda_pdv: row.VAL_VENDA_PDV || 0,
        valor_oferta: row.VAL_OFERTA || 0,
        em_oferta: row.EM_OFERTA === 'S',
        dta_valida_oferta: row.DTA_VALIDA_OFERTA,
        dta_alteracao: row.DTA_ALTERACAO,
        dta_carga_pdv: row.DTA_CARGA_PDV,
        margem_lucro: row.VAL_MARGEM || 0,
        fornecedor: row.FORNECEDOR || '',
        // Para auditoria de etiquetas, o valor esperado na etiqueta é o preço atual
        etiqueta: row.VAL_OFERTA > 0 && row.EM_OFERTA === 'S'
          ? `R$ ${Number(row.VAL_OFERTA).toFixed(2)}`
          : `R$ ${Number(row.VAL_VENDA).toFixed(2)}`
      }));

      console.log(`✅ ${items.length} produtos encontrados com alteração de preço de venda`);

      res.json({
        total: items.length,
        filtros: {
          dataInicio,
          dataFim,
          tipoOferta: tipoOferta || 'todos',
          secoes: secoes || null,
          codLoja: loja
        },
        items
      });

    } catch (error: any) {
      console.error('Get products for label audit error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Excluir foto do produto
   * DELETE /api/products/:id/photo
   */
  static async deletePhoto(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params; // ERP product ID

      const productRepository = AppDataSource.getRepository(Product);
      const product = await productRepository.findOne({
        where: { erp_product_id: id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      if (!product.foto_referencia) {
        return res.status(400).json({ error: 'Produto não possui foto' });
      }

      // Tentar deletar o arquivo físico (não bloqueia se falhar)
      try {
        const fs = await import('fs/promises');
        const filePath = path.join(process.cwd(), 'public', product.foto_referencia);
        await fs.unlink(filePath);
        console.log(`🗑️ Arquivo de foto deletado: ${filePath}`);
      } catch (fileError) {
        console.warn('⚠️ Não foi possível deletar o arquivo físico da foto:', fileError);
      }

      // Limpar referência da foto e características de IA no banco
      product.foto_referencia = undefined;
      product.coloracao = undefined;
      product.formato = undefined;
      product.gordura_visivel = undefined;
      product.presenca_osso = undefined;

      await productRepository.save(product);

      console.log(`✅ Foto excluída do produto ${id}`);

      res.json({
        message: 'Foto excluída com sucesso'
      });

    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ error: 'Erro ao excluir foto' });
    }
  }

  /**
   * Buscar TODOS os produtos diretamente do Oracle
   * GET /api/products/oracle?codLoja=1
   * Usado pela tela de Prevenção Estoque e Margem
   */
  static async getProductsOracle(req: AuthRequest, res: Response) {
    try {
      const { codLoja } = req.query;
      const loja = codLoja ? parseInt(codLoja as string) : 1;

      console.log('📦 Buscando todos os produtos do Oracle para loja:', loja);

      // Busca mapeamentos dinâmicos para os campos
      const {
        codigoCol,
        eanCol,
        descricaoCol,
        descReduzidaCol,
        embalagemCol,
        qtdEmbalagemVendaCol,
        qtdEmbalagemCompraCol,
        tipoEspecieCol,
        tipoEventoCol,
        dataCadastroCol,
        codSecaoCol,
        codGrupoCol,
        codSubGrupoCol,
        custoRepCol,
        valorVendaCol,
        valorOfertaCol,
        estoqueAtualCol,
        margemCol,
        vendaMediaCol,
        coberturaCol,
        pedidoCompraCol,
        dataUltCompraCol,
        qtdUltCompraCol,
        estoqueMinCol,
        dataUltVendaCol,
        curvaCol,
        codFornUltCompraCol,
        inativoCol,
        desSecaoCol,
        desGrupoCol,
        desSubGrupoCol,
        codFornecedorCol,
        desFornecedorCol,
        codLojaCol
      } = await ProductsController.getProdutosMappings();

      console.log(`📋 [MAPEAMENTO] Campo codigo usando coluna: ${codigoCol}`);
      console.log(`📋 [MAPEAMENTO] Campo embalagem usando coluna: ${embalagemCol}`);

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR')
      ]);

      // Query completa para buscar produtos com todas as informações necessárias
      const sql = `
        SELECT
          p.${codigoCol} as CODIGO,
          p.${eanCol} as EAN,
          p.${descricaoCol} as DESCRICAO,
          p.${descReduzidaCol} as DES_REDUZIDA,
          NVL(pl.${custoRepCol}, 0) as VAL_CUSTO_REP,
          NVL(pl.${valorVendaCol}, 0) as VAL_VENDA,
          NVL(pl.${valorVendaCol}, 0) as VAL_VENDA_LOJA,
          NVL(pl.${valorOfertaCol}, 0) as VAL_OFERTA,
          NVL(pl.${estoqueAtualCol}, 0) as ESTOQUE,
          s.${desSecaoCol} as DES_SECAO,
          g.${desGrupoCol} as DES_GRUPO,
          sg.${desSubGrupoCol} as DES_SUBGRUPO,
          f.${desFornecedorCol} as FANTASIA_FORN,
          NVL(f.NUM_FREQ_VISITA, 0) as NUM_FREQ_VISITA,
          NVL(f.NUM_PRAZO, 0) as NUM_PRAZO,
          NVL(pl.${margemCol}, 0) as MARGEM_REF,
          NVL(pl.${margemCol}, 0) as VAL_MARGEM,
          NVL(pl.${vendaMediaCol}, 0) as VENDA_MEDIA,
          NVL(pl.${coberturaCol}, 0) as DIAS_COBERTURA,
          NVL(pl.${pedidoCompraCol}, 0) as QTD_PEDIDO_COMPRA,
          TO_CHAR(pl.${dataUltCompraCol}, 'DD/MM/YYYY') as DTA_ULT_COMPRA,
          NVL(pl.${qtdUltCompraCol}, 0) as QTD_ULT_COMPRA,
          NVL(pl.${estoqueMinCol}, 0) as QTD_EST_MINIMO,
          TO_CHAR(pl.${dataUltVendaCol}, 'YYYYMMDD') as DTA_ULT_MOV_VENDA,
          NVL(TRIM(pl.${curvaCol}), 'X') as CURVA,
          CASE p.${tipoEspecieCol}
            WHEN 0 THEN 'MERCADORIA'
            WHEN 2 THEN 'SERVICO'
            WHEN 3 THEN 'IMOBILIZADO'
            WHEN 4 THEN 'INSUMO'
            ELSE 'OUTROS'
          END as TIPO_ESPECIE,
          CASE p.${tipoEventoCol}
            WHEN 0 THEN 'Direta'
            WHEN 1 THEN 'Decomposição'
            WHEN 2 THEN 'Composição'
            WHEN 3 THEN 'Produção'
            ELSE 'Outros'
          END as TIPO_EVENTO,
          p.${dataCadastroCol} as DTA_CADASTRO,
          NVL(p.${qtdEmbalagemVendaCol}, 1) as QTD_EMBALAGEM_VENDA,
          p.${embalagemCol} as DES_EMBALAGEM,
          NVL(p.${qtdEmbalagemCompraCol}, 1) as QTD_EMBALAGEM_COMPRA,
          NVL(pl.VAL_PESQUISA_MEDIA, 0) as VAL_PESQUISA_MEDIA,
          NVL(pl.VAL_PESQUISA_OFERTA, 0) as VAL_PESQUISA_OFERTA,
          pl.DES_PESQUISA_CONCORRENTE as DES_PESQUISA_CONCORRENTE
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${codigoCol} = pl.${codigoCol}
        LEFT JOIN ${schema}.${tabSecao} s ON p.${codSecaoCol} = s.${codSecaoCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON p.${codSecaoCol} = g.${codSecaoCol} AND p.${codGrupoCol} = g.${codGrupoCol}
        LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.${codSecaoCol} = sg.${codSecaoCol} AND p.${codGrupoCol} = sg.${codGrupoCol} AND p.${codSubGrupoCol} = sg.${codSubGrupoCol}
        LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${codFornUltCompraCol} = f.${codFornecedorCol}
        WHERE pl.${codLojaCol} = :codLoja
        AND NVL(pl.${inativoCol}, 'N') = 'N'
        ORDER BY p.${descricaoCol}
      `;

      const rows = await OracleService.query(sql, { codLoja: loja });

      // Buscar produtos ativos do banco local para enriquecer
      const productRepository = AppDataSource.getRepository(Product);
      const activeProducts = await productRepository.find({
        select: ['erp_product_id', 'active', 'peso_medio_kg', 'production_days', 'foto_referencia']
      });

      const productsMap = new Map(
        activeProducts.map(p => [p.erp_product_id, {
          active: p.active,
          peso_medio_kg: p.peso_medio_kg,
          production_days: p.production_days,
          foto_referencia: p.foto_referencia
        }])
      );

      // Mapear para o formato esperado pelo frontend
      const items = rows.map((row: any) => {
        const dbProduct = productsMap.get(String(row.CODIGO));
        return {
          codigo: String(row.CODIGO),
          ean: row.EAN || '',
          descricao: row.DESCRICAO || '',
          desReduzida: row.DES_REDUZIDA || '',
          valCustoRep: parseFloat(row.VAL_CUSTO_REP) || 0,
          valvendaloja: parseFloat(row.VAL_VENDA_LOJA) || 0,
          valvenda: parseFloat(row.VAL_VENDA) || 0,
          valOferta: parseFloat(row.VAL_OFERTA) || 0,
          estoque: parseFloat(row.ESTOQUE) || 0,
          desSecao: row.DES_SECAO || '',
          desGrupo: row.DES_GRUPO || '',
          desSubGrupo: row.DES_SUBGRUPO || '',
          fantasiaForn: row.FANTASIA_FORN || '',
          numFreqVisita: parseInt(row.NUM_FREQ_VISITA) || 0,
          numPrazo: parseInt(row.NUM_PRAZO) || 0,
          margemRef: parseFloat(row.MARGEM_REF) || 0,
          vendaMedia: parseFloat(row.VENDA_MEDIA) || 0,
          diasCobertura: parseInt(row.DIAS_COBERTURA) || 0,
          dtaUltCompra: row.DTA_ULT_COMPRA || null,
          qtdUltCompra: parseFloat(row.QTD_ULT_COMPRA) || 0,
          qtdPedidoCompra: parseFloat(row.QTD_PEDIDO_COMPRA) || 0,
          dtaUltMovVenda: row.DTA_ULT_MOV_VENDA || null,
          curva: row.CURVA || '',
          tipoEspecie: row.TIPO_ESPECIE || 'MERCADORIA',
          tipoEvento: row.TIPO_EVENTO || 'DIRETA',
          dtaCadastro: row.DTA_CADASTRO || null,
          qtdEmbalagem: parseFloat(row.QTD_EMBALAGEM_VENDA) || 1,
          desEmbalagem: row.DES_EMBALAGEM || '',
          qtdEmbalagemCompra: parseFloat(row.QTD_EMBALAGEM_COMPRA) || 1,
          valPesquisaMedia: parseFloat(row.VAL_PESQUISA_MEDIA) || 0,
          valPesquisaOferta: parseFloat(row.VAL_PESQUISA_OFERTA) || 0,
          desPesquisaConcorrente: row.DES_PESQUISA_CONCORRENTE || '',
          // Campos do banco local
          active: dbProduct?.active || false,
          peso_medio_kg: dbProduct?.peso_medio_kg || null,
          production_days: dbProduct?.production_days || 1,
          foto_referencia: dbProduct?.foto_referencia || null
        };
      });

      console.log(`✅ ${items.length} produtos encontrados no Oracle`);

      res.json({
        data: items,
        total: items.length
      });

    } catch (error: any) {
      console.error('Get products Oracle error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar histórico de compras de um produto
   * GET /api/products/:id/purchase-history?limit=10&descricao=NOME_PRODUTO
   * Retorna as últimas compras com: data, fornecedor, preço e quantidade
   * Aceita código do produto OU descrição (busca o código primeiro)
   */
  static async getPurchaseHistory(req: AuthRequest, res: Response) {
    try {
      let { id } = req.params; // COD_PRODUTO ou código de barras
      const { limit, descricao } = req.query;
      const maxResults = limit ? parseInt(limit as string) : 10;

      console.log(`📜 Buscando histórico de compras do produto ${id}...`);

      // Obter mapeamentos dinâmicos
      const pCodigoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const pEanCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
      const pDescricaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const fCodFornecedorCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
      const fDesFornecedorCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
      // Colunas de TAB_NF e TAB_NF_ITEM - hardcoded (sem mapeamento no TABLE_CATALOG)
      const nfDtaEntrada = 'DTA_ENTRADA';
      const nfNumNf = 'NUM_NF';
      const nfNumSerieNf = 'NUM_SERIE_NF';
      const nfCodParceiro = 'COD_PARCEIRO';
      const nfTipoOperacao = 'TIPO_OPERACAO';
      const niValCustoScred = 'VAL_CUSTO_SCRED';
      const niQtdEntrada = 'QTD_ENTRADA';
      const niValTotal = 'VAL_TOTAL';
      const niCodItem = 'COD_ITEM';
      const niCodParceiro = 'COD_PARCEIRO';
      // Coluna DES_FANTASIA de TAB_FORNECEDOR - hardcoded (sem mapeamento no TABLE_CATALOG)
      const fDesFantasia = 'DES_FANTASIA';
      // Coluna COD_BARRAS de TAB_PRODUTO - hardcoded (diferente de COD_BARRA_PRINCIPAL)
      const pCodBarras = 'COD_BARRAS';

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabNf, tabNfItem, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_NF'),
        MappingService.getRealTableName('TAB_NF_ITEM'),
        MappingService.getRealTableName('TAB_FORNECEDOR')
      ]);

      // Se foi passada descrição ou o ID não parece ser um código numérico válido,
      // tentar buscar o código do produto pelo nome ou EAN
      let codProdutoFinal = id;

      // Verificar se o ID parece ser um código de barras (13+ dígitos) ou descrição
      const isEAN = /^\d{13,}$/.test(id);
      const isNumericCode = /^\d{1,10}$/.test(id);

      if (!isNumericCode || isEAN || descricao) {
        console.log(`🔍 Buscando código do produto por ${isEAN ? 'EAN' : 'descrição'}...`);

        let searchSql: string;
        let searchParams: any;

        if (isEAN) {
          // Buscar por código de barras (EAN)
          searchSql = `
            SELECT ${pCodigoCol} as COD_PRODUTO FROM ${schema}.${tabProduto}
            WHERE ${pCodBarras} = :ean AND ROWNUM = 1
          `;
          searchParams = { ean: id };
        } else if (descricao) {
          // Buscar por descrição - primeiro tentar exata, depois parcial
          searchSql = `
            SELECT ${pCodigoCol} as COD_PRODUTO FROM ${schema}.${tabProduto}
            WHERE UPPER(${pDescricaoCol}) LIKE UPPER(:descricao) AND ROWNUM = 1
          `;
          // Usar % para busca parcial se a descrição tiver mais de 10 caracteres
          const descricaoStr = descricao as string;
          searchParams = { descricao: descricaoStr.length > 10 ? `%${descricaoStr.substring(0, 30)}%` : descricaoStr };
        } else {
          // Tentar buscar por descrição usando o id como texto
          searchSql = `
            SELECT ${pCodigoCol} as COD_PRODUTO FROM ${schema}.${tabProduto}
            WHERE UPPER(${pDescricaoCol}) LIKE UPPER(:descricao) AND ROWNUM = 1
          `;
          searchParams = { descricao: `%${id}%` };
        }

        const searchResult = await OracleService.query(searchSql, searchParams);

        if (searchResult.length > 0) {
          codProdutoFinal = searchResult[0].COD_PRODUTO;
          console.log(`✅ Código encontrado: ${codProdutoFinal}`);
        } else {
          console.log(`⚠️ Produto não encontrado no Oracle, tentando com ID original: ${id}`);
        }
      }

      // Query para buscar as últimas compras do produto
      // Usando TAB_NF (notas fiscais) e TAB_NF_ITEM (itens)
      // TIPO_OPERACAO = 0 é entrada (compra)
      // CUSTO_UNITARIO = ni.VAL_CUSTO_SCRED (custo de reposição unitário histórico da compra)
      const sql = `
        SELECT * FROM (
          SELECT
            TO_CHAR(nf.${nfDtaEntrada}, 'DD/MM/YYYY') as DATA_COMPRA,
            nf.${nfDtaEntrada},
            f.${fDesFornecedorCol} as FORNECEDOR,
            f.${fDesFantasia} as FANTASIA_FORN,
            NVL(ni.${niValCustoScred}, 0) as CUSTO_UNITARIO,
            ni.${niQtdEntrada} as QUANTIDADE,
            ni.${niValTotal} as VALOR_TOTAL,
            nf.${nfNumNf} as NUMERO_NF,
            nf.${nfNumSerieNf} as SERIE_NF,
            TRUNC(SYSDATE - nf.${nfDtaEntrada}) as DIAS_DESDE_COMPRA
          FROM ${schema}.${tabNf} nf
          JOIN ${schema}.${tabNfItem} ni ON nf.${nfNumNf} = ni.${nfNumNf}
            AND nf.${nfNumSerieNf} = ni.${nfNumSerieNf}
            AND nf.${nfCodParceiro} = ni.${niCodParceiro}
          LEFT JOIN ${schema}.${tabFornecedor} f ON nf.${nfCodParceiro} = f.${fCodFornecedorCol}
          WHERE ni.${niCodItem} = :codProduto
            AND nf.${nfTipoOperacao} = 0
          ORDER BY nf.${nfDtaEntrada} DESC
        ) WHERE ROWNUM <= :maxResults
      `;

      const rows = await OracleService.query(sql, {
        codProduto: codProdutoFinal,
        maxResults
      });

      // Mapear para formato esperado
      const historico = rows.map((row: any) => ({
        data: row.DATA_COMPRA || '',
        dataCompra: row.DTA_ENTRADA,
        fornecedor: row.FANTASIA_FORN || row.FORNECEDOR || 'Não informado',
        custoReposicao: parseFloat(row.CUSTO_UNITARIO) || 0,
        quantidade: parseFloat(row.QUANTIDADE) || 0,
        valorTotal: parseFloat(row.VALOR_TOTAL) || 0,
        numeroNF: row.NUMERO_NF || '',
        serieNF: row.SERIE_NF || '',
        diasDesdeCompra: parseInt(row.DIAS_DESDE_COMPRA) || 0
      }));

      console.log(`✅ ${historico.length} compras encontradas para produto ${id}`);

      res.json({
        codProduto: id,
        total: historico.length,
        historico
      });

    } catch (error: any) {
      console.error('Get purchase history error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Buscar DANFE (PDF da Nota Fiscal) pelo número da NF
   * GET /api/products/nf/:numNf/danfe
   * Retorna o PDF da nota fiscal armazenado no Oracle
   */
  static async getDanfe(req: AuthRequest, res: Response) {
    try {
      const { numNf } = req.params;

      if (!numNf) {
        return res.status(400).json({ error: 'Número da NF é obrigatório' });
      }

      console.log(`📄 Buscando DANFE da NF ${numNf}...`);

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabNf, snfetne, snfetnef] = await Promise.all([
        MappingService.getRealTableName('TAB_NF'),
        MappingService.getRealTableName('SNFETNE'),
        MappingService.getRealTableName('SNFETNEF')
      ]);

      // Colunas de TAB_NF, SNFETNE, SNFETNEF - hardcoded (sem mapeamento no TABLE_CATALOG)
      const nfNumChaveAcesso = 'NUM_CHAVE_ACESSO';
      const nfNumNf = 'NUM_NF';
      const nfNumSerieNf = 'NUM_SERIE_NF';
      const sneIdNota = 'ID_NOTA';
      const sneNrChave = 'NR_CHAVE';
      const snfDfDanfe = 'DF_DANFE';

      // 1. Buscar a chave de acesso da NF na TAB_NF
      const nfSql = `
        SELECT ${nfNumChaveAcesso} as NUM_CHAVE_ACESSO, ${nfNumNf} as NUM_NF, ${nfNumSerieNf} as NUM_SERIE_NF
        FROM ${schema}.${tabNf}
        WHERE ${nfNumNf} = :numNf
        AND ROWNUM = 1
      `;

      const nfResult = await OracleService.query(nfSql, { numNf: parseInt(numNf) });

      if (nfResult.length === 0) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
      }

      const chaveAcesso = nfResult[0].NUM_CHAVE_ACESSO;

      if (!chaveAcesso) {
        return res.status(404).json({ error: 'Nota fiscal não possui chave de acesso' });
      }

      console.log(`🔑 Chave de acesso encontrada: ${chaveAcesso}`);

      // 2. Buscar o ID_NOTA na SNFETNE usando a chave
      const snfetneSql = `
        SELECT ${sneIdNota} as ID_NOTA
        FROM ${schema}.${snfetne}
        WHERE ${sneNrChave} = :chave
        AND ROWNUM = 1
      `;

      const snfetneResult = await OracleService.query(snfetneSql, { chave: chaveAcesso });

      if (snfetneResult.length === 0) {
        return res.status(404).json({ error: 'XML da nota não encontrado no sistema' });
      }

      const idNota = snfetneResult[0].ID_NOTA;
      console.log(`📋 ID da nota encontrado: ${idNota}`);

      // 3. Buscar o PDF (DANFE) na SNFETNEF
      const danfeSql = `
        SELECT ${snfDfDanfe} as DF_DANFE
        FROM ${schema}.${snfetnef}
        WHERE ${sneIdNota} = :idNota
        AND ROWNUM = 1
      `;

      console.log(`🔍 Buscando DANFE na SNFETNEF para ID_NOTA: ${idNota}...`);
      const danfeResult = await OracleService.queryWithBlob(danfeSql, { idNota });
      console.log(`📊 Resultado da query SNFETNEF: ${danfeResult.length} registros`);

      if (danfeResult.length === 0) {
        console.log(`❌ Nenhum registro encontrado em SNFETNEF para ID_NOTA ${idNota}`);
        return res.status(404).json({ error: 'DANFE não encontrado para esta nota' });
      }

      if (!danfeResult[0].DF_DANFE) {
        console.log(`❌ Registro encontrado mas DF_DANFE está vazio/null`);
        return res.status(404).json({ error: 'DANFE está vazio para esta nota' });
      }

      const pdfBuffer = danfeResult[0].DF_DANFE;

      console.log(`✅ DANFE encontrado! Tamanho: ${pdfBuffer.length} bytes`);

      // 4. Retornar o PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="DANFE_${numNf}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);

    } catch (error: any) {
      console.error('Get DANFE error:', error);
      res.status(500).json({ error: error.message || 'Erro ao buscar DANFE' });
    }
  }

  /**
   * Lista produtos para configuração de peculiaridades (sem_exposicao)
   * Busca produtos do Oracle e combina com peculiaridades do PostgreSQL
   */
  static async getPeculiaridades(req: AuthRequest, res: Response) {
    try {
      const { search, secao, grupo, subgrupo, page = 1, limit = 50 } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Filtro base: apenas produtos ATIVOS no Oracle (TAB_PRODUTO_LOJA.INATIVO = 'N')
      // COD_LOJA = 1 é a loja padrão
      console.log('🔥🔥🔥 [PECULIARIDADES] V3 NEW CODE - Timestamp:', new Date().toISOString());
      console.log('🔥 [PECULIARIDADES] Params: search=', search, 'secao=', secao, 'grupo=', grupo, 'subgrupo=', subgrupo);

      // Obter mapeamentos dinâmicos
      const bm = await ProductsController.getBasicProductMappings();
      const sm = await ProductsController.getSectionMappings();

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO')
      ]);

      let whereConditions: string[] = [`NVL(pl.${bm.inativoCol}, 'N') = 'N'`];
      const oracleParams: Record<string, any> = {};

      if (search) {
        whereConditions.push(`(UPPER(p.${bm.descricaoCol}) LIKE UPPER(:search) OR p.${bm.codigoCol} LIKE :search OR p.${bm.eanCol} LIKE :search)`);
        oracleParams.search = `%${search}%`;
      }

      if (secao) {
        whereConditions.push(`s.${sm.desSecaoCol} = :secao`);
        oracleParams.secao = secao;
      }

      if (grupo) {
        whereConditions.push(`g.${sm.desGrupoCol} = :grupo`);
        oracleParams.grupo = grupo;
      }

      if (subgrupo) {
        whereConditions.push(`sg.${sm.desSubGrupoCol} = :subgrupo`);
        oracleParams.subgrupo = subgrupo;
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Query para contar total - JOIN com TAB_PRODUTO_LOJA para filtrar ativos
      const countQuery = `
        SELECT COUNT(*) as TOTAL
        FROM ${schema}.${tabProduto} p
        JOIN ${schema}.${tabProdutoLoja} pl ON pl.${bm.codigoCol} = p.${bm.codigoCol} AND pl.${bm.codLojaCol} = 1
        LEFT JOIN ${schema}.${tabSecao} s ON s.${sm.codSecaoCol} = p.${bm.codSecaoCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON g.${sm.codGrupoCol} = p.${bm.codGrupoCol} AND g.${sm.codSecaoCol} = p.${bm.codSecaoCol}
        LEFT JOIN ${schema}.${tabSubGrupo} sg ON sg.${sm.codSubGrupoCol} = p.${bm.codSubGrupoCol} AND sg.${sm.codGrupoCol} = p.${bm.codGrupoCol} AND sg.${sm.codSecaoCol} = p.${bm.codSecaoCol}
        ${whereClause}
      `;

      // Query para buscar produtos com paginação
      const productsQuery = `
        SELECT * FROM (
          SELECT
            p.${bm.codigoCol} as COD_PRODUTO,
            p.${bm.eanCol} as COD_BARRA_PRINCIPAL,
            p.${bm.descricaoCol} as DES_PRODUTO,
            s.${sm.desSecaoCol} as DES_SECAO,
            g.${sm.desGrupoCol} as DES_GRUPO,
            sg.${sm.desSubGrupoCol} as DES_SUB_GRUPO,
            ROW_NUMBER() OVER (ORDER BY p.${bm.descricaoCol}) as RN
          FROM ${schema}.${tabProduto} p
          JOIN ${schema}.${tabProdutoLoja} pl ON pl.${bm.codigoCol} = p.${bm.codigoCol} AND pl.${bm.codLojaCol} = 1
          LEFT JOIN ${schema}.${tabSecao} s ON s.${sm.codSecaoCol} = p.${bm.codSecaoCol}
          LEFT JOIN ${schema}.${tabGrupo} g ON g.${sm.codGrupoCol} = p.${bm.codGrupoCol} AND g.${sm.codSecaoCol} = p.${bm.codSecaoCol}
          LEFT JOIN ${schema}.${tabSubGrupo} sg ON sg.${sm.codSubGrupoCol} = p.${bm.codSubGrupoCol} AND sg.${sm.codGrupoCol} = p.${bm.codGrupoCol} AND sg.${sm.codSecaoCol} = p.${bm.codSecaoCol}
          ${whereClause}
        ) WHERE RN > :offset AND RN <= :maxRow
      `;

      // Parâmetros separados: countParams não tem offset/maxRow, productsParams tem tudo
      const countParams = { ...oracleParams };
      const productsParams = { ...oracleParams, offset, maxRow: offset + limitNum };

      // Query para buscar seções (para o filtro)
      const secoesQuery = `
        SELECT DISTINCT s.${sm.desSecaoCol} as DES_SECAO
        FROM ${schema}.${tabSecao} s
        WHERE s.${sm.desSecaoCol} IS NOT NULL
        ORDER BY s.${sm.desSecaoCol}
      `;

      // Query para buscar grupos filtrados pela seção
      let gruposQuery = `
        SELECT DISTINCT g.${sm.desGrupoCol} as DES_GRUPO
        FROM ${schema}.${tabGrupo} g
        JOIN ${schema}.${tabSecao} s ON s.${sm.codSecaoCol} = g.${sm.codSecaoCol}
        WHERE g.${sm.desGrupoCol} IS NOT NULL
      `;
      const gruposParams: Record<string, any> = {};
      if (secao) {
        gruposQuery += ` AND s.${sm.desSecaoCol} = :secaoGrupo`;
        gruposParams.secaoGrupo = secao;
      }
      gruposQuery += ` ORDER BY g.${sm.desGrupoCol}`;

      // Query para buscar subgrupos filtrados
      let subgruposQuery = `
        SELECT DISTINCT sg.${sm.desSubGrupoCol} as DES_SUB_GRUPO
        FROM ${schema}.${tabSubGrupo} sg
        JOIN ${schema}.${tabGrupo} g ON g.${sm.codGrupoCol} = sg.${sm.codGrupoCol} AND g.${sm.codSecaoCol} = sg.${sm.codSecaoCol}
        JOIN ${schema}.${tabSecao} s ON s.${sm.codSecaoCol} = sg.${sm.codSecaoCol}
        WHERE sg.${sm.desSubGrupoCol} IS NOT NULL
      `;
      const subgruposParams: Record<string, any> = {};
      if (secao) {
        subgruposQuery += ` AND s.${sm.desSecaoCol} = :secaoSub`;
        subgruposParams.secaoSub = secao;
      }
      if (grupo) {
        subgruposQuery += ` AND g.${sm.desGrupoCol} = :grupoSub`;
        subgruposParams.grupoSub = grupo;
      }
      subgruposQuery += ` ORDER BY sg.${sm.desSubGrupoCol}`;

      // Executar queries Oracle
      const [countResult, productsResult, gruposResult, subgruposResult] = await Promise.all([
        OracleService.query<any>(countQuery, countParams),
        OracleService.query<any>(productsQuery, productsParams),
        OracleService.query<any>(gruposQuery, gruposParams),
        OracleService.query<any>(subgruposQuery, subgruposParams)
      ]);

      const total = countResult[0]?.TOTAL || 0;
      const oracleProducts = productsResult || [];
      console.log('📦 [PECULIARIDADES] Total:', total, 'Produtos retornados:', oracleProducts.length);

      // Buscar peculiaridades do PostgreSQL para os produtos encontrados
      const productCodes = oracleProducts.map((p: any) => p.COD_PRODUTO);
      const productRepository = AppDataSource.getRepository(Product);

      let peculiaridadesMap: Record<string, { sem_exposicao: boolean; grupo_similar: number | null }> = {};

      if (productCodes.length > 0) {
        const peculiaridades = await productRepository
          .createQueryBuilder('p')
          .select(['p.erp_product_id', 'p.sem_exposicao', 'p.grupo_similar'])
          .where('p.erp_product_id IN (:...codes)', { codes: productCodes })
          .getMany();

        peculiaridades.forEach(p => {
          peculiaridadesMap[p.erp_product_id] = {
            sem_exposicao: p.sem_exposicao || false,
            grupo_similar: p.grupo_similar
          };
        });
      }

      // Combinar dados Oracle com peculiaridades
      const products = oracleProducts.map((p: any) => ({
        erp_product_id: p.COD_PRODUTO,
        ean: p.COD_BARRA_PRINCIPAL,
        description: p.DES_PRODUTO,
        section_name: p.DES_SECAO,
        group_name: p.DES_GRUPO,
        subgroup_name: p.DES_SUB_GRUPO,
        sem_exposicao: peculiaridadesMap[p.COD_PRODUTO]?.sem_exposicao || false,
        grupo_similar: peculiaridadesMap[p.COD_PRODUTO]?.grupo_similar || null
      }));

      res.json({
        products,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        grupos: gruposResult.map((g: any) => g.DES_GRUPO).filter(Boolean),
        subgrupos: subgruposResult.map((s: any) => s.DES_SUB_GRUPO).filter(Boolean)
      });

    } catch (error: any) {
      console.error('Get peculiaridades error:', error);
      res.status(500).json({ error: error.message || 'Erro ao buscar peculiaridades' });
    }
  }

  /**
   * Atualiza peculiaridades (sem_exposicao) em lote
   */
  static async updatePeculiaridades(req: AuthRequest, res: Response) {
    try {
      const { products } = req.body;

      if (!Array.isArray(products)) {
        return res.status(400).json({ error: 'products deve ser um array' });
      }

      const productRepository = AppDataSource.getRepository(Product);

      let updated = 0;
      let errors: string[] = [];

      for (const item of products) {
        try {
          const { erp_product_id, sem_exposicao, grupo_similar } = item;

          if (!erp_product_id) continue;

          const product = await productRepository.findOne({
            where: { erp_product_id: String(erp_product_id) }
          });

          if (product) {
            product.sem_exposicao = Boolean(sem_exposicao);
            // grupo_similar pode ser null para remover o grupo
            product.grupo_similar = grupo_similar !== undefined && grupo_similar !== ''
              ? Number(grupo_similar)
              : null;
            await productRepository.save(product);
            updated++;
          }
        } catch (err: any) {
          errors.push(`Erro no produto ${item.erp_product_id}: ${err.message}`);
        }
      }

      res.json({
        message: `${updated} produtos atualizados`,
        updated,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error: any) {
      console.error('Update peculiaridades error:', error);
      res.status(500).json({ error: error.message || 'Erro ao atualizar peculiaridades' });
    }
  }

  /**
   * Retorna lista de produtos marcados como sem_exposicao
   */
  static async getProductsSemExposicao(req: AuthRequest, res: Response) {
    try {
      const productRepository = AppDataSource.getRepository(Product);

      const products = await productRepository.find({
        where: { sem_exposicao: true, active: true },
        select: ['erp_product_id', 'ean', 'description']
      });

      res.json({
        products: products.map(p => p.erp_product_id),
        details: products
      });

    } catch (error: any) {
      console.error('Get products sem exposicao error:', error);
      res.status(500).json({ error: error.message || 'Erro ao buscar produtos sem exposição' });
    }
  }

  /**
   * Retorna produtos similares (mesmo grupo_similar)
   * Usado na verificação de ruptura para mostrar alternativas
   */
  static async getProductsSimilares(req: AuthRequest, res: Response) {
    try {
      const { erp_product_id } = req.params;

      const productRepository = AppDataSource.getRepository(Product);

      // Primeiro, buscar o produto para obter seu grupo_similar
      const product = await productRepository.findOne({
        where: { erp_product_id },
        select: ['grupo_similar', 'erp_product_id']
      });

      if (!product || !product.grupo_similar) {
        return res.json({ similares: [], grupo_similar: null });
      }

      // Buscar todos os produtos do mesmo grupo (exceto o próprio produto)
      const similares = await productRepository.find({
        where: {
          grupo_similar: product.grupo_similar,
          active: true
        },
        select: ['erp_product_id', 'ean', 'description', 'section_name', 'grupo_similar']
      });

      // Filtrar o produto atual da lista
      const outrosSimilares = similares.filter(p => p.erp_product_id !== erp_product_id);

      res.json({
        grupo_similar: product.grupo_similar,
        similares: outrosSimilares
      });

    } catch (error: any) {
      console.error('Get products similares error:', error);
      res.status(500).json({ error: error.message || 'Erro ao buscar produtos similares' });
    }
  }

  /**
   * Retorna todos os grupos similares com seus produtos
   * Útil para listar todos os grupos configurados
   */
  static async getGruposSimilares(req: AuthRequest, res: Response) {
    try {
      const productRepository = AppDataSource.getRepository(Product);

      const products = await productRepository
        .createQueryBuilder('p')
        .select(['p.erp_product_id', 'p.description', 'p.grupo_similar'])
        .where('p.grupo_similar IS NOT NULL')
        .andWhere('p.active = :active', { active: true })
        .orderBy('p.grupo_similar', 'ASC')
        .addOrderBy('p.description', 'ASC')
        .getMany();

      // Agrupar por grupo_similar
      const grupos: Record<number, any[]> = {};
      for (const p of products) {
        if (p.grupo_similar) {
          if (!grupos[p.grupo_similar]) {
            grupos[p.grupo_similar] = [];
          }
          grupos[p.grupo_similar].push({
            erp_product_id: p.erp_product_id,
            description: p.description
          });
        }
      }

      res.json({ grupos });

    } catch (error: any) {
      console.error('Get grupos similares error:', error);
      res.status(500).json({ error: error.message || 'Erro ao buscar grupos similares' });
    }
  }

  /**
   * Buscar produtos com queda de vendas comparando período atual vs ano passado
   * GET /api/products/queda-vendas?codLoja=1
   *
   * Compara vendas do dia 1 até hoje do mês atual com o mesmo período do mês passado.
   * Retorna mapa de código produto → { vendasAtual, vendasPassado, percentualQueda }
   */
  static async getQuedaVendas(req: AuthRequest, res: Response) {
    try {
      const { codLoja } = req.query;
      const loja = codLoja ? parseInt(codLoja as string) : 1;

      // Calcular períodos
      const hoje = new Date();
      const diaHoje = hoje.getDate();
      const mesAtual = hoje.getMonth() + 1;
      const anoAtual = hoje.getFullYear();

      // Mês passado
      const mesPassado = mesAtual === 1 ? 12 : mesAtual - 1;
      const anoMesPassado = mesAtual === 1 ? anoAtual - 1 : anoAtual;

      // Ajustar dia para não ultrapassar último dia do mês passado
      const ultimoDiaMesPassado = new Date(anoMesPassado, mesPassado, 0).getDate();
      const diaAjustado = Math.min(diaHoje, ultimoDiaMesPassado);

      const pad = (n: number) => String(n).padStart(2, '0');
      const iniAtual = `01/${pad(mesAtual)}/${anoAtual}`;
      const fimAtual = `${pad(diaHoje)}/${pad(mesAtual)}/${anoAtual}`;
      const iniPassado = `01/${pad(mesPassado)}/${anoMesPassado}`;
      const fimPassado = `${pad(diaAjustado)}/${pad(mesPassado)}/${anoMesPassado}`;

      console.log(`📉 [QUEDA VENDAS] Período atual: ${iniAtual} a ${fimAtual}`);
      console.log(`📉 [QUEDA VENDAS] Período passado: ${iniPassado} a ${fimPassado}`);

      // Obter mapeamentos via MappingService
      const schema = await MappingService.getSchema();
      const [
        tabProdutoPdv,
        colCodProdutoPdv,
        colDtaSaida,
        colValTotalProduto,
        colCodLojaPdv
      ] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO_PDV'),
        MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto'),
        MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda'),
        MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'valor_total'),
        MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_loja')
      ]);

      const sql = `
        SELECT
          pv.${colCodProdutoPdv} as COD_PRODUTO,
          SUM(CASE WHEN pv.${colDtaSaida} BETWEEN TO_DATE(:iniAtual, 'DD/MM/YYYY') AND TO_DATE(:fimAtual, 'DD/MM/YYYY')
               THEN pv.${colValTotalProduto} ELSE 0 END) as VENDAS_ATUAL,
          SUM(CASE WHEN pv.${colDtaSaida} BETWEEN TO_DATE(:iniPassado, 'DD/MM/YYYY') AND TO_DATE(:fimPassado, 'DD/MM/YYYY')
               THEN pv.${colValTotalProduto} ELSE 0 END) as VENDAS_PASSADO
        FROM ${schema}.${tabProdutoPdv} pv
        WHERE (
          pv.${colDtaSaida} BETWEEN TO_DATE(:iniAtual2, 'DD/MM/YYYY') AND TO_DATE(:fimAtual2, 'DD/MM/YYYY')
          OR pv.${colDtaSaida} BETWEEN TO_DATE(:iniPassado2, 'DD/MM/YYYY') AND TO_DATE(:fimPassado2, 'DD/MM/YYYY')
        )
        AND pv.${colCodLojaPdv} = :codLoja
        GROUP BY pv.${colCodProdutoPdv}
        HAVING SUM(CASE WHEN pv.${colDtaSaida} BETWEEN TO_DATE(:iniPassado3, 'DD/MM/YYYY') AND TO_DATE(:fimPassado3, 'DD/MM/YYYY')
                    THEN pv.${colValTotalProduto} ELSE 0 END) > 0
      `;

      const rows = await OracleService.query(sql, {
        iniAtual, fimAtual, iniPassado, fimPassado,
        iniAtual2: iniAtual, fimAtual2: fimAtual, iniPassado2: iniPassado, fimPassado2: fimPassado,
        iniPassado3: iniPassado, fimPassado3: fimPassado,
        codLoja: loja
      });

      // Montar mapa de resultados
      const resultado: Record<string, { vendasAtual: number; vendasPassado: number; percentualQueda: number }> = {};
      for (const row of rows as any[]) {
        const cod = String(row.COD_PRODUTO).trim();
        const atual = parseFloat(row.VENDAS_ATUAL) || 0;
        const passado = parseFloat(row.VENDAS_PASSADO) || 0;
        const queda = passado > 0 ? ((passado - atual) / passado) * 100 : 0;
        resultado[cod] = {
          vendasAtual: Math.round(atual * 100) / 100,
          vendasPassado: Math.round(passado * 100) / 100,
          percentualQueda: Math.round(queda * 10) / 10
        };
      }

      const totalComQueda = Object.values(resultado).filter(r => r.percentualQueda > 0).length;
      console.log(`📉 [QUEDA VENDAS] ${rows.length} produtos comparados, ${totalComQueda} com queda`);

      res.json({
        periodoAtual: { inicio: iniAtual, fim: fimAtual },
        periodoPassado: { inicio: iniPassado, fim: fimPassado },
        produtos: resultado
      });

    } catch (error: any) {
      console.error('Get queda vendas error:', error);
      res.status(500).json({ error: error.message || 'Erro ao buscar queda de vendas' });
    }
  }

  // ============================================================
  // POSTGRESQL ERP IMPLEMENTATION
  // Caminho separado pra ERPs em PostgreSQL (ex: RP INFO no Nunes)
  // Nao afeta o caminho Oracle (Tradicao/SuperVital).
  // ============================================================

  /**
   * Buscar produtos diretamente do PostgreSQL ERP (ex: RP INFO)
   * Usado pra clientes com banco PostgreSQL como Nunes
   */
  static async getProductsPostgres(req: AuthRequest, res: Response) {
    try {
      const { codLoja } = req.query;
      const loja = codLoja ? parseInt(codLoja as string) : null;

      console.log('📦 [POSTGRES] Buscando produtos do PostgreSQL ERP para loja:', loja || 'TODAS');

      // Resolver tabelas e colunas via MappingService
      const schema = await MappingService.getSchema();
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA');
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO');
      const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO');
      const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR');

      // Colunas TAB_PRODUTO
      const codigoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const eanCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
      const descricaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const descReduzidaCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida');
      const embalagemCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'embalagem');
      const qtdEmbalagemVendaCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'qtd_embalagem_venda');
      const pesavelCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'pesavel');
      const codSecaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
      const codGrupoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
      const dataCadastroCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'data_cadastro');

      // Colunas TAB_PRODUTO_LOJA
      const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
      const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const plPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
      const plPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
      const plEstoqueAtual = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
      const plMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
      const plCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
      const plInativo = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
      const plCodFornUlt = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra');

      // Colunas TAB_SECAO e TAB_GRUPO
      const desSecaoCol = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');
      const secaoCodCol = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
      const desGrupoCol = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
      const grupoCodCol = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');

      // Colunas TAB_FORNECEDOR
      const desFornecedorCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'nome_fantasia');
      const codFornecedorCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');

      // Cache de 5 minutos
      const cacheKey = `pg-products-loja-${loja || 'todas'}`;

      const rows = await CacheService.executeWithCache(
        cacheKey,
        async () => {
          console.log('📊 [POSTGRES] Cache miss - executando query no PostgreSQL ERP...');

          // Query PostgreSQL com COALESCE em vez de NVL, $1 em vez de :codLoja
          // RP INFO so tem 2 niveis (departamento + grupo), nao tem subgrupo
          // DISTINCT ON garante 1 linha por produto mesmo quando ha multiplas lojas
          // (sem filtro de loja, o INNER JOIN com tab_produto_loja produziria N linhas por produto)
          let sql = `
            SELECT DISTINCT ON (p.${codigoCol})
              p.${codigoCol} as codigo,
              p.${eanCol} as ean,
              p.${descricaoCol} as descricao,
              p.${descReduzidaCol} as des_reduzida,
              COALESCE(pl.${plPrecoCusto}, 0) as val_custo_rep,
              COALESCE(pl.${plPrecoVenda}, 0) as val_venda,
              COALESCE(pl.${plPrecoVenda}, 0) as val_venda_loja,
              0 as val_oferta,
              COALESCE(pl.${plEstoqueAtual}, 0) as estoque,
              s.${desSecaoCol} as des_secao,
              g.${desGrupoCol} as des_grupo,
              '' as des_subgrupo,
              f.${desFornecedorCol} as fantasia_forn,
              COALESCE(pl.${plMargem}, 0) as margem_ref,
              COALESCE(pl.${plMargem}, 0) as val_margem,
              0 as venda_media,
              0 as dias_cobertura,
              0 as qtd_pedido_compra,
              null as dta_ult_compra,
              0 as qtd_ult_compra,
              0 as qtd_est_minimo,
              null as dta_ult_mov_venda,
              COALESCE(NULLIF(TRIM(pl.${plCurva}::text), ''), 'X') as curva,
              'MERCADORIA' as tipo_especie,
              'Direta' as tipo_evento,
              p.${dataCadastroCol} as dta_cadastro,
              COALESCE(p.${qtdEmbalagemVendaCol}, 1) as qtd_embalagem_venda,
              p.${embalagemCol} as des_embalagem,
              1 as qtd_embalagem_compra,
              CASE WHEN p.${pesavelCol} = 'S' THEN 'S' ELSE 'N' END as pesavel
            FROM ${schema}.${tabProduto} p
            INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${codigoCol} = pl.${plCodProduto}
            LEFT JOIN ${schema}.${tabSecao} s ON p.${codSecaoCol} = s.${secaoCodCol}
            LEFT JOIN ${schema}.${tabGrupo} g ON p.${codGrupoCol} = g.${grupoCodCol}
            LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${plCodFornUlt} = f.${codFornecedorCol}
            WHERE COALESCE(pl.${plInativo}, 'N') = 'N'
          `;

          const params: any[] = [];
          if (loja) {
            // RP INFO armazena codigo_loja como varchar zero-padded ('001', '002'),
            // entao cast pra int dos dois lados pra comparar com o int vindo do frontend.
            sql += ` AND pl.${plCodLoja}::int = $1::int`;
            params.push(loja);
          }
          // ORDER BY tem que comecar com p.codigo pra DISTINCT ON funcionar.
          // Ordena depois por descricao na camada Node se necessario.
          sql += ` ORDER BY p.${codigoCol}, p.${descricaoCol}`;

          return await PostgresErpService.query(sql, params);
        }
      );

      // Buscar produtos ativos do banco local pra enriquecer
      const productRepository = AppDataSource.getRepository(Product);
      const activeProducts = await productRepository.find({
        select: ['erp_product_id', 'active', 'peso_medio_kg', 'production_days', 'foto_referencia']
      });

      const productsMap = new Map(
        activeProducts.map(p => [p.erp_product_id, {
          active: p.active,
          peso_medio_kg: p.peso_medio_kg,
          production_days: p.production_days,
          foto_referencia: p.foto_referencia
        }])
      );

      // Mapear pro formato esperado pelo frontend (mesmo do Oracle)
      const enrichedProducts = rows.map((row: any) => {
        const dbProduct = productsMap.get(String(row.codigo));
        return {
          codigo: String(row.codigo),
          ean: row.ean || '',
          descricao: row.descricao || '',
          desReduzida: row.des_reduzida || '',
          valCustoRep: parseFloat(row.val_custo_rep) || 0,
          valvendaloja: parseFloat(row.val_venda_loja) || 0,
          valvenda: parseFloat(row.val_venda) || 0,
          valOferta: parseFloat(row.val_oferta) || 0,
          estoque: parseFloat(row.estoque) || 0,
          desSecao: row.des_secao || '',
          desGrupo: row.des_grupo || '',
          desSubGrupo: row.des_subgrupo || '',
          fantasiaForn: row.fantasia_forn || '',
          margemRef: parseFloat(row.margem_ref) || 0,
          vendaMedia: parseFloat(row.venda_media) || 0,
          diasCobertura: parseInt(row.dias_cobertura) || 0,
          dtaUltCompra: row.dta_ult_compra || null,
          qtdUltCompra: parseFloat(row.qtd_ult_compra) || 0,
          qtdPedidoCompra: parseFloat(row.qtd_pedido_compra) || 0,
          estoqueMinimo: parseFloat(row.qtd_est_minimo) || 0,
          dtaUltMovVenda: row.dta_ult_mov_venda || null,
          curva: row.curva || 'X',
          tipoEspecie: row.tipo_especie || 'MERCADORIA',
          tipoEvento: row.tipo_evento || 'Direta',
          dtaCadastro: row.dta_cadastro || null,
          pesavel: row.pesavel || 'N',
          // Campos do banco local PostgreSQL (do nosso sistema)
          active: dbProduct?.active || false,
          peso_medio_kg: dbProduct?.peso_medio_kg || null,
          production_days: dbProduct?.production_days || 1,
          foto_referencia: dbProduct?.foto_referencia || null
        };
      });

      // Re-ordena por descricao (DISTINCT ON forcou ORDER BY codigo no SQL)
      enrichedProducts.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));

      console.log(`✅ [POSTGRES] ${enrichedProducts.length} produtos encontrados`);

      res.json({
        data: enrichedProducts,
        total: enrichedProducts.length
      });

    } catch (error: any) {
      console.error('❌ [POSTGRES] Get products error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}