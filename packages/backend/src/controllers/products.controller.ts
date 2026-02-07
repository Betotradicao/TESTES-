import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';
import { ProductActivationHistory } from '../entities/ProductActivationHistory';
import { AuthRequest } from '../middleware/auth';
import { CacheService } from '../services/cache.service';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';
import * as path from 'path';

// MIGRAÇÃO COMPLETA: Todos os métodos que buscavam da API Intersolid
// agora buscam diretamente do banco Oracle

export class ProductsController {
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
      desFornecedorCol
    ] = await Promise.all([
      // Campos de TAB_PRODUTO (V2 - lê do mapeamento configurado)
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras', 'COD_BARRA_PRINCIPAL'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida', 'DES_REDUZIDA'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'embalagem', 'DES_EMBALAGEM'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'qtd_embalagem_venda', 'QTD_EMBALAGEM_VENDA'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'qtd_embalagem_compra', 'QTD_EMBALAGEM_COMPRA'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'pesavel', 'FLG_ENVIA_BALANCA'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_especie', 'TIPO_ESPECIE'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_evento', 'TIPO_EVENTO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'data_cadastro', 'DTA_CADASTRO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao', 'COD_SECAO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo', 'COD_GRUPO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo', 'COD_SUB_GRUPO'),
      // Campos de TAB_PRODUTO_LOJA (V2)
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo', 'VAL_CUSTO_REP'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_oferta', 'VAL_OFERTA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem', 'VAL_MARGEM'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa', 'VAL_MARGEM_FIXA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media', 'VAL_VENDA_MEDIA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura', 'QTD_COBERTURA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pedido_compra', 'QTD_PEDIDO_COMPRA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_compra', 'DTA_ULT_COMPRA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'qtd_ultima_compra', 'QTD_ULT_COMPRA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_minimo', 'QTD_EST_MINIMO'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_venda', 'DTA_ULT_MOV_VENDA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA'),
      MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra', 'COD_FORN_ULT_COMPRA'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'inativo', 'INATIVO'),
      // Campos de seção/grupo/subgrupo (V2)
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_secao', 'DES_SECAO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_grupo', 'DES_GRUPO'),
      MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_subgrupo', 'DES_SUB_GRUPO'),
      // Campos de fornecedor (V2)
      MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR')
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
      desFornecedorCol
    };
  }
  /**
   * Buscar produtos diretamente do Oracle
   * MIGRADO: Antes usava API Intersolid, agora busca direto do banco Oracle
   * GET /api/products?codLoja=1
   */
  static async getProducts(req: AuthRequest, res: Response) {
    try {
      const { codLoja } = req.query;
      const loja = codLoja ? parseInt(codLoja as string) : 1;

      console.log('📦 [ORACLE] Buscando produtos do Oracle para loja:', loja);

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
        desFornecedorCol
      } = await ProductsController.getProdutosMappings();

      console.log(`📋 [MAPEAMENTO] Campo codigo usando coluna: ${codigoCol}`);
      console.log(`📋 [MAPEAMENTO] Campo embalagem usando coluna: ${embalagemCol}`);

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
      ]);

      // Query completa para buscar produtos com todas as informações necessárias
      // Usa cache de 5 minutos para melhorar performance
      const cacheKey = `oracle-products-loja-${loja}`;

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
            LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${codFornUltCompraCol} = f.COD_FORNECEDOR
            WHERE pl.COD_LOJA = :codLoja
            AND NVL(pl.${inativoCol}, 'N') = 'N'
            ORDER BY p.${descricaoCol}
          `;

          return await OracleService.query(sql, { codLoja: loja });
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
        // Buscar produto do Oracle
        console.log(`[ACTIVATE] Buscando produto ${id} do Oracle...`);

        // Obter schema e tabelas dinamicamente
        const schema = await MappingService.getSchema();
        const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
          MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
          MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
          MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
          MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
          MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO'),
          MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
        ]);

        const sql = `
          SELECT
            p.COD_PRODUTO,
            p.COD_BARRA_PRINCIPAL as EAN,
            p.DES_PRODUTO,
            p.DES_REDUZIDA,
            p.COD_SECAO,
            s.DES_SECAO,
            p.COD_GRUPO,
            g.DES_GRUPO,
            p.COD_SUB_GRUPO,
            sg.DES_SUB_GRUPO,
            pl.COD_FORN_ULT_COMPRA as COD_FORN,
            f.DES_FORNECEDOR as RAZAO_FORN,
            CASE WHEN p.FLG_ENVIA_BALANCA = 'S' THEN 'S' ELSE 'N' END as PESAVEL
          FROM ${schema}.${tabProduto} p
          INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.COD_PRODUTO = pl.COD_PRODUTO
          LEFT JOIN ${schema}.${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
          LEFT JOIN ${schema}.${tabGrupo} g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
          LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.COD_SECAO = sg.COD_SECAO AND p.COD_GRUPO = sg.COD_GRUPO AND p.COD_SUB_GRUPO = sg.COD_SUB_GRUPO
          LEFT JOIN ${schema}.${tabFornecedor} f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
          WHERE p.COD_PRODUTO = :codProduto
          AND pl.COD_LOJA = :codLoja
          AND ROWNUM = 1
        `;

        const rows = await OracleService.query(sql, { codProduto: id, codLoja: loja });

        if (rows.length === 0) {
          console.error(`[ACTIVATE] Product ${id} not found in Oracle`);
          return res.status(404).json({ error: 'Product not found in Oracle' });
        }

        const erpProduct = rows[0];

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
        // Buscar produto do Oracle
        console.log(`[PESO_MEDIO] Buscando produto ${id} do Oracle...`);

        // Obter schema e tabelas dinamicamente
        const schema = await MappingService.getSchema();
        const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
          MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
          MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
          MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
          MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
          MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO'),
          MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
        ]);

        const sql = `
          SELECT
            p.COD_PRODUTO,
            p.COD_BARRA_PRINCIPAL as EAN,
            p.DES_PRODUTO,
            p.DES_REDUZIDA,
            p.COD_SECAO,
            s.DES_SECAO,
            p.COD_GRUPO,
            g.DES_GRUPO,
            p.COD_SUB_GRUPO,
            sg.DES_SUB_GRUPO,
            pl.COD_FORN_ULT_COMPRA as COD_FORN,
            f.DES_FORNECEDOR as RAZAO_FORN,
            CASE WHEN p.FLG_ENVIA_BALANCA = 'S' THEN 'S' ELSE 'N' END as PESAVEL
          FROM ${schema}.${tabProduto} p
          INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.COD_PRODUTO = pl.COD_PRODUTO
          LEFT JOIN ${schema}.${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
          LEFT JOIN ${schema}.${tabGrupo} g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
          LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.COD_SECAO = sg.COD_SECAO AND p.COD_GRUPO = sg.COD_GRUPO AND p.COD_SUB_GRUPO = sg.COD_SUB_GRUPO
          LEFT JOIN ${schema}.${tabFornecedor} f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
          WHERE p.COD_PRODUTO = :codProduto
          AND pl.COD_LOJA = :codLoja
          AND ROWNUM = 1
        `;

        const rows = await OracleService.query(sql, { codProduto: id, codLoja: loja });

        if (rows.length === 0) {
          return res.status(404).json({ error: 'Product not found in Oracle' });
        }

        const erpProduct = rows[0];

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
        // Obter schema e tabelas dinamicamente
        const schema = await MappingService.getSchema();
        const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
          MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
          MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
          MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
          MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
          MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO'),
          MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
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
              p.COD_PRODUTO,
              p.COD_BARRA_PRINCIPAL as EAN,
              p.DES_PRODUTO,
              p.DES_REDUZIDA,
              p.COD_SECAO,
              s.DES_SECAO,
              p.COD_GRUPO,
              g.DES_GRUPO,
              p.COD_SUB_GRUPO,
              sg.DES_SUB_GRUPO,
              pl.COD_FORN_ULT_COMPRA as COD_FORN,
              f.DES_FORNECEDOR as RAZAO_FORN,
              CASE WHEN p.FLG_ENVIA_BALANCA = 'S' THEN 'S' ELSE 'N' END as PESAVEL
            FROM ${schema}.${tabProduto} p
            INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.COD_PRODUTO = pl.COD_PRODUTO
            LEFT JOIN ${schema}.${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
            LEFT JOIN ${schema}.${tabGrupo} g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
            LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.COD_SECAO = sg.COD_SECAO AND p.COD_GRUPO = sg.COD_GRUPO AND p.COD_SUB_GRUPO = sg.COD_SUB_GRUPO
            LEFT JOIN ${schema}.${tabFornecedor} f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
            WHERE p.COD_PRODUTO IN (${placeholders})
            AND pl.COD_LOJA = :codLoja
          `;

          const rows = await OracleService.query(sql, params);
          rows.forEach((row: any) => {
            oracleProductsMap.set(String(row.COD_PRODUTO), row);
          });
        }

        console.log(`[BULK-ORACLE] ${oracleProductsMap.size} produtos encontrados no Oracle`);
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

      // Obter schema e tabela dinamicamente
      const schema = await MappingService.getSchema();
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO');

      const sql = `
        SELECT DES_SECAO
        FROM ${schema}.${tabSecao}
        WHERE DES_SECAO IS NOT NULL
        ORDER BY DES_SECAO
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
      // Obter schema e tabela dinamicamente
      const schema = await MappingService.getSchema();
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO');

      const sql = `
        SELECT COD_SECAO, DES_SECAO
        FROM ${schema}.${tabSecao}
        ORDER BY COD_SECAO
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

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO')
      ]);

      // Query para buscar produtos com informações completas
      // VAL_MARGEM_FIXA = margem de referência, VAL_MARGEM = margem atual
      const sql = `
        SELECT
          p.COD_PRODUTO,
          p.COD_BARRA_PRINCIPAL,
          p.DES_PRODUTO,
          s.DES_SECAO,
          g.DES_GRUPO,
          TRIM(pl.DES_RANK_PRODLOJA) as CURVA,
          NVL(pl.VAL_CUSTO_REP, 0) as VAL_CUSTO_REP,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
          NVL(pl.VAL_MARGEM, 0) as VAL_MARGEM,
          NVL(pl.VAL_MARGEM_FIXA, pl.VAL_MARGEM) as VAL_MARGEM_REF
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.COD_PRODUTO = pl.COD_PRODUTO
        LEFT JOIN ${schema}.${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN ${schema}.${tabGrupo} g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        WHERE pl.COD_LOJA = :codLoja
        AND UPPER(s.DES_SECAO) LIKE :sectionFilter
        AND NVL(pl.INATIVO, 'N') = 'N'
        ORDER BY p.DES_PRODUTO
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

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO')
      ]);

      const sql = `
        SELECT
          p.COD_PRODUTO,
          p.COD_BARRA_PRINCIPAL as EAN,
          p.DES_PRODUTO,
          s.DES_SECAO,
          g.DES_GRUPO,
          sg.DES_SUB_GRUPO,
          TRIM(pl.DES_RANK_PRODLOJA) as CURVA,
          NVL(pl.VAL_CUSTO_REP, 0) as VAL_CUSTO_REP,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
          NVL(pl.VAL_MARGEM, 0) as VAL_MARGEM,
          NVL(pl.VAL_MARGEM_FIXA, pl.VAL_MARGEM) as VAL_MARGEM_REF
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.COD_PRODUTO = pl.COD_PRODUTO
        LEFT JOIN ${schema}.${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN ${schema}.${tabGrupo} g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.COD_SECAO = sg.COD_SECAO AND p.COD_GRUPO = sg.COD_GRUPO AND p.COD_SUB_GRUPO = sg.COD_SUB_GRUPO
        WHERE pl.COD_LOJA = :codLoja
        AND UPPER(s.DES_SECAO) LIKE :sectionFilter
        AND NVL(pl.INATIVO, 'N') = 'N'
        ORDER BY p.DES_PRODUTO
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

      // Montar query Oracle
      let whereConditions: string[] = [];
      const params: any = {};

      // Filtro de loja (default = 1)
      const loja = codLoja ? parseInt(codLoja as string) : 1;
      whereConditions.push('pl.COD_LOJA = :codLoja');
      params.codLoja = loja;

      // Filtro de dias sem venda
      if (diasSemVenda) {
        const dias = parseInt(diasSemVenda as string);
        if (!isNaN(dias) && dias > 0) {
          whereConditions.push(`(pl.DTA_ULT_MOV_VENDA IS NULL OR pl.DTA_ULT_MOV_VENDA <= SYSDATE - :diasSemVenda)`);
          params.diasSemVenda = dias;
        }
      }

      // Filtro de curvas
      if (curvas && curvas !== 'TODOS') {
        const curvasArray = (curvas as string).split(',').map(c => c.trim().toUpperCase());
        whereConditions.push(`pl.DES_RANK_PRODLOJA IN (${curvasArray.map((_, i) => `:curva${i}`).join(', ')})`);
        curvasArray.forEach((curva, i) => {
          params[`curva${i}`] = curva;
        });
      }

      // Filtro de seções
      if (secoes) {
        const secoesArray = (secoes as string).split(',').map(s => s.trim().toUpperCase());
        const secaoConditions = secoesArray.map((_, i) => `UPPER(s.DES_SECAO) LIKE :secao${i}`);
        whereConditions.push(`(${secaoConditions.join(' OR ')})`);
        secoesArray.forEach((secao, i) => {
          params[`secao${i}`] = `%${secao}%`;
        });
      }

      // Filtrar apenas produtos ativos
      whereConditions.push(`NVL(pl.INATIVO, 'N') = 'N'`);
      whereConditions.push(`p.COD_PRODUTO IS NOT NULL`);

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
      ]);

      const sql = `
        SELECT
          p.COD_BARRA_PRINCIPAL as CODIGO_BARRAS,
          p.COD_PRODUTO as ERP_PRODUCT_ID,
          p.DES_PRODUTO as DESCRICAO,
          TRIM(pl.DES_RANK_PRODLOJA) as CURVA,
          NVL(pl.QTD_EST_ATUAL, 0) as ESTOQUE_ATUAL,
          NVL(pl.QTD_COBERTURA, 0) as COBERTURA_DIAS,
          g.DES_GRUPO as GRUPO,
          s.DES_SECAO as SECAO,
          pl.COD_FORN_ULT_COMPRA as COD_FORNECEDOR,
          f.DES_FORNECEDOR as FORNECEDOR,
          NVL(pl.VAL_MARGEM, 0) as MARGEM_LUCRO,
          1 as QTD_EMBALAGEM,
          NVL(pl.VAL_VENDA, 0) as VALOR_VENDA,
          NVL(pl.VAL_CUSTO_REP, 0) as CUSTO_COM_IMPOSTO,
          NVL(pl.VAL_VENDA_MEDIA, 0) as VENDA_MEDIA_DIA,
          CASE WHEN NVL(pl.QTD_PEDIDO_COMPRA, 0) > 0 THEN 'Sim' ELSE 'Nao' END as TEM_PEDIDO,
          pl.DTA_ULT_MOV_VENDA as DTA_ULT_VENDA,
          CASE
            WHEN pl.DTA_ULT_MOV_VENDA IS NULL THEN 9999
            ELSE TRUNC(SYSDATE - pl.DTA_ULT_MOV_VENDA)
          END as DIAS_SEM_VENDA
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.COD_PRODUTO = pl.COD_PRODUTO
        LEFT JOIN ${schema}.${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN ${schema}.${tabGrupo} g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        LEFT JOIN ${schema}.${tabFornecedor} f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
        ${whereClause}
        ORDER BY DIAS_SEM_VENDA DESC, pl.DES_RANK_PRODLOJA ASC
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
        h.DTA_ULT_ALT_PRECO_VENDA >= TO_DATE(:dataInicio, 'YYYY-MM-DD')
        AND h.DTA_ULT_ALT_PRECO_VENDA < TO_DATE(:dataFim, 'YYYY-MM-DD') + 1
      )`);

      // Filtro de loja
      whereConditions.push(`h.COD_LOJA = :codLoja`);

      // Filtro de tipo de oferta
      if (tipoOferta === 'com_oferta') {
        whereConditions.push(`pl.VAL_OFERTA IS NOT NULL AND pl.VAL_OFERTA > 0 AND TRUNC(SYSDATE) <= NVL(pl.DTA_VALIDA_OFERTA, TRUNC(SYSDATE))`);
      } else if (tipoOferta === 'sem_oferta') {
        whereConditions.push(`(pl.VAL_OFERTA IS NULL OR pl.VAL_OFERTA = 0 OR TRUNC(SYSDATE) > NVL(pl.DTA_VALIDA_OFERTA, TRUNC(SYSDATE) - 1))`);
      }

      // Filtro de seções (opcional)
      if (secoes && typeof secoes === 'string') {
        const secoesArray = secoes.split(',').map(s => s.trim().toUpperCase());
        const secaoConditions = secoesArray.map((_, i) => `UPPER(s.DES_SECAO) LIKE :secao${i}`);
        whereConditions.push(`(${secaoConditions.join(' OR ')})`);
        secoesArray.forEach((secao, i) => {
          params[`secao${i}`] = `%${secao}%`;
        });
      }

      // Filtrar apenas produtos com preço válido
      whereConditions.push(`p.COD_PRODUTO IS NOT NULL`);
      whereConditions.push(`pl.VAL_VENDA IS NOT NULL`);

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabProdutoHistorico, tabSecao, tabGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_PRODUTO_HISTORICO', 'TAB_PRODUTO_HISTORICO'),
        MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
      ]);

      // Query usando TAB_PRODUTO_HISTORICO para pegar DTA_ULT_ALT_PRECO_VENDA
      // e VAL_VENDA_ANT (preço anterior) / VAL_VENDA_PDV (preço no PDV)
      const sql = `
        SELECT
          p.COD_BARRA_PRINCIPAL as CODIGO_BARRAS,
          p.COD_PRODUTO as ERP_PRODUCT_ID,
          p.DES_PRODUTO as DESCRICAO,
          s.DES_SECAO as SECAO,
          g.DES_GRUPO as GRUPO,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
          NVL(h.VAL_VENDA_ANT, 0) as VAL_VENDA_ANTERIOR,
          NVL(h.VAL_VENDA_PDV, 0) as VAL_VENDA_PDV,
          NVL(pl.VAL_OFERTA, 0) as VAL_OFERTA,
          pl.DTA_VALIDA_OFERTA,
          h.DTA_ULT_ALT_PRECO_VENDA as DTA_ALTERACAO,
          h.DTA_CARGA_PDV,
          NVL(pl.VAL_MARGEM, 0) as VAL_MARGEM,
          f.DES_FORNECEDOR as FORNECEDOR,
          CASE
            WHEN pl.VAL_OFERTA IS NOT NULL AND pl.VAL_OFERTA > 0
                 AND TRUNC(SYSDATE) <= NVL(pl.DTA_VALIDA_OFERTA, TRUNC(SYSDATE))
            THEN 'S'
            ELSE 'N'
          END as EM_OFERTA
        FROM ${schema}.${tabProdutoHistorico} h
        JOIN ${schema}.${tabProduto} p ON h.COD_PRODUTO = p.COD_PRODUTO
        JOIN ${schema}.${tabProdutoLoja} pl ON h.COD_PRODUTO = pl.COD_PRODUTO AND h.COD_LOJA = pl.COD_LOJA
        LEFT JOIN ${schema}.${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
        LEFT JOIN ${schema}.${tabGrupo} g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
        LEFT JOIN ${schema}.${tabFornecedor} f ON pl.COD_FORN_ULT_COMPRA = f.COD_FORNECEDOR
        ${whereClause}
        ORDER BY s.DES_SECAO ASC NULLS LAST, p.DES_PRODUTO ASC
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
        desFornecedorCol
      } = await ProductsController.getProdutosMappings();

      console.log(`📋 [MAPEAMENTO] Campo codigo usando coluna: ${codigoCol}`);
      console.log(`📋 [MAPEAMENTO] Campo embalagem usando coluna: ${embalagemCol}`);

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO'),
        MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
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
          NVL(p.${qtdEmbalagemCompraCol}, 1) as QTD_EMBALAGEM_COMPRA
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${codigoCol} = pl.${codigoCol}
        LEFT JOIN ${schema}.${tabSecao} s ON p.${codSecaoCol} = s.${codSecaoCol}
        LEFT JOIN ${schema}.${tabGrupo} g ON p.${codSecaoCol} = g.${codSecaoCol} AND p.${codGrupoCol} = g.${codGrupoCol}
        LEFT JOIN ${schema}.${tabSubGrupo} sg ON p.${codSecaoCol} = sg.${codSecaoCol} AND p.${codGrupoCol} = sg.${codGrupoCol} AND p.${codSubGrupoCol} = sg.${codSubGrupoCol}
        LEFT JOIN ${schema}.${tabFornecedor} f ON pl.${codFornUltCompraCol} = f.COD_FORNECEDOR
        WHERE pl.COD_LOJA = :codLoja
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
          tipoEvento: row.TIPO_EVENTO || 'DIRETA',
          dtaCadastro: row.DTA_CADASTRO || null,
          qtdEmbalagem: parseFloat(row.QTD_EMBALAGEM_VENDA) || 1,
          desEmbalagem: row.DES_EMBALAGEM || '',
          qtdEmbalagemCompra: parseFloat(row.QTD_EMBALAGEM_COMPRA) || 1,
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

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabNf, tabNfItem, tabFornecedor] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_NF', 'TAB_NF'),
        MappingService.getRealTableName('TAB_NF_ITEM', 'TAB_NF_ITEM'),
        MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')
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
            SELECT COD_PRODUTO FROM ${schema}.${tabProduto}
            WHERE COD_BARRAS = :ean AND ROWNUM = 1
          `;
          searchParams = { ean: id };
        } else if (descricao) {
          // Buscar por descrição - primeiro tentar exata, depois parcial
          searchSql = `
            SELECT COD_PRODUTO FROM ${schema}.${tabProduto}
            WHERE UPPER(DES_PRODUTO) LIKE UPPER(:descricao) AND ROWNUM = 1
          `;
          // Usar % para busca parcial se a descrição tiver mais de 10 caracteres
          const descricaoStr = descricao as string;
          searchParams = { descricao: descricaoStr.length > 10 ? `%${descricaoStr.substring(0, 30)}%` : descricaoStr };
        } else {
          // Tentar buscar por descrição usando o id como texto
          searchSql = `
            SELECT COD_PRODUTO FROM ${schema}.${tabProduto}
            WHERE UPPER(DES_PRODUTO) LIKE UPPER(:descricao) AND ROWNUM = 1
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
            TO_CHAR(nf.DTA_ENTRADA, 'DD/MM/YYYY') as DATA_COMPRA,
            nf.DTA_ENTRADA,
            f.DES_FORNECEDOR as FORNECEDOR,
            f.DES_FANTASIA as FANTASIA_FORN,
            NVL(ni.VAL_CUSTO_SCRED, 0) as CUSTO_UNITARIO,
            ni.QTD_ENTRADA as QUANTIDADE,
            ni.VAL_TOTAL as VALOR_TOTAL,
            nf.NUM_NF as NUMERO_NF,
            nf.NUM_SERIE_NF as SERIE_NF,
            TRUNC(SYSDATE - nf.DTA_ENTRADA) as DIAS_DESDE_COMPRA
          FROM ${schema}.${tabNf} nf
          JOIN ${schema}.${tabNfItem} ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          LEFT JOIN ${schema}.${tabFornecedor} f ON nf.COD_PARCEIRO = f.COD_FORNECEDOR
          WHERE ni.COD_ITEM = :codProduto
            AND nf.TIPO_OPERACAO = 0
          ORDER BY nf.DTA_ENTRADA DESC
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
        MappingService.getRealTableName('TAB_NF', 'TAB_NF'),
        MappingService.getRealTableName('SNFETNE', 'SNFETNE'),
        MappingService.getRealTableName('SNFETNEF', 'SNFETNEF')
      ]);

      // 1. Buscar a chave de acesso da NF na TAB_NF
      const nfSql = `
        SELECT NUM_CHAVE_ACESSO, NUM_NF, NUM_SERIE_NF
        FROM ${schema}.${tabNf}
        WHERE NUM_NF = :numNf
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
        SELECT ID_NOTA
        FROM ${schema}.${snfetne}
        WHERE NR_CHAVE = :chave
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
        SELECT DF_DANFE
        FROM ${schema}.${snfetnef}
        WHERE ID_NOTA = :idNota
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

      // Obter schema e tabelas dinamicamente
      const schema = await MappingService.getSchema();
      const [tabProduto, tabProdutoLoja, tabSecao, tabGrupo, tabSubGrupo] = await Promise.all([
        MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO'),
        MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA'),
        MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO'),
        MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO'),
        MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO')
      ]);

      let whereConditions: string[] = [`NVL(pl.INATIVO, 'N') = 'N'`];
      const oracleParams: Record<string, any> = {};

      if (search) {
        whereConditions.push(`(UPPER(p.DES_PRODUTO) LIKE UPPER(:search) OR p.COD_PRODUTO LIKE :search OR p.COD_BARRA_PRINCIPAL LIKE :search)`);
        oracleParams.search = `%${search}%`;
      }

      if (secao) {
        whereConditions.push(`s.DES_SECAO = :secao`);
        oracleParams.secao = secao;
      }

      if (grupo) {
        whereConditions.push(`g.DES_GRUPO = :grupo`);
        oracleParams.grupo = grupo;
      }

      if (subgrupo) {
        whereConditions.push(`sg.DES_SUB_GRUPO = :subgrupo`);
        oracleParams.subgrupo = subgrupo;
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Query para contar total - JOIN com TAB_PRODUTO_LOJA para filtrar ativos
      const countQuery = `
        SELECT COUNT(*) as TOTAL
        FROM ${schema}.${tabProduto} p
        JOIN ${schema}.${tabProdutoLoja} pl ON pl.COD_PRODUTO = p.COD_PRODUTO AND pl.COD_LOJA = 1
        LEFT JOIN ${schema}.${tabSecao} s ON s.COD_SECAO = p.COD_SECAO
        LEFT JOIN ${schema}.${tabGrupo} g ON g.COD_GRUPO = p.COD_GRUPO AND g.COD_SECAO = p.COD_SECAO
        LEFT JOIN ${schema}.${tabSubGrupo} sg ON sg.COD_SUB_GRUPO = p.COD_SUB_GRUPO AND sg.COD_GRUPO = p.COD_GRUPO AND sg.COD_SECAO = p.COD_SECAO
        ${whereClause}
      `;

      // Query para buscar produtos com paginação
      const productsQuery = `
        SELECT * FROM (
          SELECT
            p.COD_PRODUTO,
            p.COD_BARRA_PRINCIPAL,
            p.DES_PRODUTO,
            s.DES_SECAO,
            g.DES_GRUPO,
            sg.DES_SUB_GRUPO,
            ROW_NUMBER() OVER (ORDER BY p.DES_PRODUTO) as RN
          FROM ${schema}.${tabProduto} p
          JOIN ${schema}.${tabProdutoLoja} pl ON pl.COD_PRODUTO = p.COD_PRODUTO AND pl.COD_LOJA = 1
          LEFT JOIN ${schema}.${tabSecao} s ON s.COD_SECAO = p.COD_SECAO
          LEFT JOIN ${schema}.${tabGrupo} g ON g.COD_GRUPO = p.COD_GRUPO AND g.COD_SECAO = p.COD_SECAO
          LEFT JOIN ${schema}.${tabSubGrupo} sg ON sg.COD_SUB_GRUPO = p.COD_SUB_GRUPO AND sg.COD_GRUPO = p.COD_GRUPO AND sg.COD_SECAO = p.COD_SECAO
          ${whereClause}
        ) WHERE RN > :offset AND RN <= :maxRow
      `;

      // Parâmetros separados: countParams não tem offset/maxRow, productsParams tem tudo
      const countParams = { ...oracleParams };
      const productsParams = { ...oracleParams, offset, maxRow: offset + limitNum };

      // Query para buscar seções (para o filtro)
      const secoesQuery = `
        SELECT DISTINCT s.DES_SECAO
        FROM ${schema}.${tabSecao} s
        WHERE s.DES_SECAO IS NOT NULL
        ORDER BY s.DES_SECAO
      `;

      // Query para buscar grupos filtrados pela seção
      let gruposQuery = `
        SELECT DISTINCT g.DES_GRUPO
        FROM ${schema}.${tabGrupo} g
        JOIN ${schema}.${tabSecao} s ON s.COD_SECAO = g.COD_SECAO
        WHERE g.DES_GRUPO IS NOT NULL
      `;
      const gruposParams: Record<string, any> = {};
      if (secao) {
        gruposQuery += ` AND s.DES_SECAO = :secaoGrupo`;
        gruposParams.secaoGrupo = secao;
      }
      gruposQuery += ` ORDER BY g.DES_GRUPO`;

      // Query para buscar subgrupos filtrados
      let subgruposQuery = `
        SELECT DISTINCT sg.DES_SUB_GRUPO
        FROM ${schema}.${tabSubGrupo} sg
        JOIN ${schema}.${tabGrupo} g ON g.COD_GRUPO = sg.COD_GRUPO AND g.COD_SECAO = sg.COD_SECAO
        JOIN ${schema}.${tabSecao} s ON s.COD_SECAO = sg.COD_SECAO
        WHERE sg.DES_SUB_GRUPO IS NOT NULL
      `;
      const subgruposParams: Record<string, any> = {};
      if (secao) {
        subgruposQuery += ` AND s.DES_SECAO = :secaoSub`;
        subgruposParams.secaoSub = secao;
      }
      if (grupo) {
        subgruposQuery += ` AND g.DES_GRUPO = :grupoSub`;
        subgruposParams.grupoSub = grupo;
      }
      subgruposQuery += ` ORDER BY sg.DES_SUB_GRUPO`;

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
}