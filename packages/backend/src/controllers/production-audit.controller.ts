import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { ProductionAudit } from '../entities/ProductionAudit';
import { ProductionAuditItem } from '../entities/ProductionAuditItem';
import { Product } from '../entities/Product';
import { Not, IsNull } from 'typeorm';
import { ConfigurationService } from '../services/configuration.service';
import { CacheService } from '../services/cache.service';
import { ProductionPDFService } from '../services/production-pdf.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';
import * as fs from 'fs';

/**
 * Helper: Resolve mapeamentos de colunas compartilhados entre os métodos de produção.
 * Agrupa todas as chamadas MappingService.getColumnFromTable em um único lugar
 * para reutilização e consistência.
 */
async function getProductionAuditMappings() {
  // --- TAB_PRODUTO ---
  const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
  const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
  const colCodSecaoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');
  const colCodGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo');
  const colCodSubGrupoProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo');
  const colPesavel = await MappingService.getColumnFromTable('TAB_PRODUTO', 'pesavel');
  const colTipoEvento = await MappingService.getColumnFromTable('TAB_PRODUTO', 'tipo_evento');
  const colCodInfoNutricional = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_info_nutricional');

  // --- TAB_SECAO ---
  const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
  const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

  // --- TAB_GRUPO ---
  const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
  const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
  const colGrpCodSecao = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao');
  const colGrpFlgInativo = await MappingService.getColumnFromTable('TAB_GRUPO', 'flag_inativo');

  // --- TAB_SUBGRUPO ---
  const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
  const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
  const colSgCodGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo');
  const colSgCodSecao = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao');
  const colSgFlgInativo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'flag_inativo');

  // --- TAB_PRODUTO_LOJA ---
  const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
  const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
  const plPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo');
  const plPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
  const plMargemFixa = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa');
  const plMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
  const plEstoqueAtual = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
  const plVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media');
  const plDataUltimaVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_venda');
  const plCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
  const plForaLinha = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'fora_linha');
  const plInativo = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
  const plCodInfoReceita = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_info_receita');

  return {
    // TAB_PRODUTO
    colCodProduto, colDesProduto, colCodSecaoProd, colCodGrupoProd, colCodSubGrupoProd,
    colPesavel, colTipoEvento, colCodInfoNutricional,
    // TAB_SECAO
    colCodSecao, colDesSecao,
    // TAB_GRUPO
    colCodGrupo, colDesGrupo, colGrpCodSecao, colGrpFlgInativo,
    // TAB_SUBGRUPO
    colCodSubGrupo, colDesSubGrupo, colSgCodGrupo, colSgCodSecao, colSgFlgInativo,
    // TAB_PRODUTO_LOJA
    plCodProduto, plCodLoja, plPrecoCusto, plPrecoVenda, plMargemFixa, plMargem,
    plEstoqueAtual, plVendaMedia, plDataUltimaVenda, plCurva, plForaLinha,
    plInativo, plCodInfoReceita,
  };
}

export class ProductionAuditController {
  /**
   * Listar todas as auditorias de produção
   */
  static async getAudits(req: AuthRequest, res: Response) {
    try {
      const codLoja = req.query.codLoja ? parseInt(req.query.codLoja as string) : undefined;
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      // Filtrar por loja se especificado
      const whereCondition: any = {};
      if (codLoja) {
        whereCondition.cod_loja = codLoja;
      }

      const audits = await auditRepository.find({
        where: whereCondition,
        relations: ['user', 'employee', 'items'],
        order: {
          audit_date: 'DESC',
        },
      });

      res.json(audits);
    } catch (error) {
      console.error('Get production audits error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Obter uma auditoria específica por ID
   */
  static async getAuditById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      const audit = await auditRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['user', 'employee', 'items'],
      });

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      res.json(audit);
    } catch (error) {
      console.error('Get production audit error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Obter auditoria por data
   */
  static async getAuditByDate(req: AuthRequest, res: Response) {
    try {
      const { date } = req.params;
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      const audit = await auditRepository.findOne({
        where: { audit_date: new Date(date) },
        relations: ['user', 'employee', 'items'],
      });

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found for this date' });
      }

      res.json(audit);
    } catch (error) {
      console.error('Get production audit by date error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Listar produtos ativos disponíveis para auditoria (com filtros opcionais)
   * Busca dados do Oracle e enriquece com informações locais
   */
  static async getBakeryProducts(req: AuthRequest, res: Response) {
    try {
      const productRepository = AppDataSource.getRepository(Product);

      // Get active products from database with section info
      const activeProducts = await productRepository.find({
        where: { active: true },
        select: ['erp_product_id', 'peso_medio_kg', 'production_days', 'section_name', 'foto_referencia'],
      });

      // Get ALL products with photos (regardless of active status)
      const productsWithPhotos = await productRepository.find({
        where: { foto_referencia: Not(IsNull()) },
        select: ['erp_product_id', 'foto_referencia'],
      });

      // Create a separate map for photos
      const photoMap = new Map(
        productsWithPhotos.map((p: any) => [p.erp_product_id, p.foto_referencia])
      );

      // Map active products with peso_medio_kg, production_days and foto_referencia
      const activeProductsMap = new Map(
        activeProducts.map((p: any) => [p.erp_product_id, { peso_medio_kg: p.peso_medio_kg, production_days: p.production_days, section_name: p.section_name, foto_referencia: p.foto_referencia }])
      );

      // Get list of active product codes for Oracle IN clause
      const activeProductCodes = activeProducts.map((p: any) => p.erp_product_id);

      if (activeProductCodes.length === 0) {
        console.log('⚠️ Nenhum produto ativo cadastrado');
        return res.json([]);
      }

      console.log('🔗 Buscando produtos ativos do Oracle...');

      // Busca produtos do Oracle (apenas os que estão ativos no banco local)
      const oracleProducts = await CacheService.executeWithCache(
        'oracle-bakery-products',
        async () => {
          // Criar placeholders para IN clause
          const placeholders = activeProductCodes.map((_, i) => `:p${i}`).join(',');
          const params: any = {};
          activeProductCodes.forEach((code, i) => {
            params[`p${i}`] = code;
          });

          // Obter schema e tabelas dinamicamente
          const schema = await MappingService.getSchema();
          const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
          const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
          const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

          // Resolver colunas via MappingService
          const m = await getProductionAuditMappings();

          const result = await OracleService.query<any>(`
            SELECT
              p.${m.colCodProduto},
              p.${m.colDesProduto},
              s.${m.colDesSecao},
              NVL(pl.${m.plPrecoCusto}, 0) as VAL_CUSTO_REP,
              NVL(pl.${m.plPrecoVenda}, 0) as VAL_VENDA,
              NVL(pl.${m.plMargemFixa}, pl.${m.plMargem}) as VAL_MARGEM_REF,
              NVL(pl.${m.plEstoqueAtual}, 0) as QTD_ESTOQUE,
              NVL(pl.${m.plVendaMedia}, 0) as VAL_VENDA_MEDIA,
              p.${m.colPesavel} as FLG_BALANCA,
              TO_CHAR(pl.${m.plDataUltimaVenda}, 'YYYY-MM-DD') as DTA_ULT_MOV_VENDA,
              CASE p.${m.colTipoEvento}
                WHEN 0 THEN 'DIRETA'
                WHEN 1 THEN 'DECOMPOSICAO'
                WHEN 2 THEN 'COMPOSICAO'
                WHEN 3 THEN 'PRODUCAO'
                ELSE 'OUTROS'
              END as TIPO_EVENTO
            FROM ${tabProduto} p
            INNER JOIN ${tabProdutoLoja} pl ON p.${m.colCodProduto} = pl.${m.plCodProduto}
            LEFT JOIN ${tabSecao} s ON p.${m.colCodSecaoProd} = s.${m.colCodSecao}
            WHERE pl.${m.plCodLoja} = 1
            AND p.${m.colCodProduto} IN (${placeholders})
            ORDER BY p.${m.colDesProduto}
          `, params);
          return result;
        }
      );

      // Mapear produtos Oracle para formato esperado
      const allProducts = oracleProducts.map((product: any) => {
        const productData = activeProductsMap.get(product.COD_PRODUTO);
        const pesoMedio = productData?.peso_medio_kg ? parseFloat(productData.peso_medio_kg) : null;
        const productionDays = productData?.production_days || 1;

        // Campos financeiros
        const custo = parseFloat(product.VAL_CUSTO_REP) || 0;
        const precoVenda = parseFloat(product.VAL_VENDA) || 0;
        const margemRef = parseFloat(product.VAL_MARGEM_REF) || 0;
        const margemReal = precoVenda > 0 ? ((precoVenda - custo) / precoVenda) * 100 : 0;

        // Venda média em kg (do Oracle)
        const vendaMediaKg = parseFloat(product.VAL_VENDA_MEDIA) || 0;
        const vendaMediaUnd = pesoMedio && pesoMedio > 0 ? vendaMediaKg / pesoMedio : 0;

        return {
          codigo: product.COD_PRODUTO,
          descricao: product.DES_PRODUTO,
          desReduzida: product.DES_PRODUTO?.substring(0, 20) || '',
          peso_medio_kg: pesoMedio,
          production_days: productionDays,
          vendaMedia: vendaMediaKg,
          vendaMediaUnd: vendaMediaUnd,
          pesavel: product.FLG_BALANCA === 'S',
          tipoEvento: product.TIPO_EVENTO || 'DIRETA',
          desSecao: product.DES_SECAO || productData?.section_name || 'SEM SEÇÃO',
          estoque: parseFloat(product.QTD_ESTOQUE) || 0,
          custo: custo,
          precoVenda: precoVenda,
          margemRef: margemRef,
          margemReal: margemReal,
          foto_referencia: photoMap.get(product.COD_PRODUTO) || productData?.foto_referencia || null,
          dtaUltMovVenda: product.DTA_ULT_MOV_VENDA || null,
        };
      });

      console.log('✅ Total produtos ativos:', allProducts.length);

      res.json(allProducts);
    } catch (error) {
      console.error('Get bakery products error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Listar todas as seções únicas do Oracle (sem filtrar por ativos)
   * GET /api/production/erp-sections
   */
  static async getErpSections(req: AuthRequest, res: Response) {
    try {
      console.log('🔗 Buscando seções do Oracle...');

      // Busca seções únicas diretamente do banco Oracle (mesma query do HortiFrut)
      const sections = await CacheService.executeWithCache(
        'oracle-production-sections',
        async () => {
          // Obter schema e tabela dinamicamente
          const schema = await MappingService.getSchema();
          const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

          // Resolver colunas via MappingService
          const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
          const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

          const result = await OracleService.query<{ DES_SECAO: string }>(`
            SELECT ${colCodSecao}, ${colDesSecao}
            FROM ${tabSecao}
            ORDER BY ${colDesSecao}
          `);
          return result.map(r => r.DES_SECAO);
        }
      );

      console.log('✅ Total seções encontradas:', sections.length);
      res.json(sections);
    } catch (error) {
      console.error('Get Oracle sections error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Listar todos os grupos do Oracle (com opção de filtrar por seção)
   * GET /api/production/erp-grupos?section=PADARIA
   */
  static async getErpGrupos(req: AuthRequest, res: Response) {
    try {
      const { section } = req.query;
      console.log('🔗 Buscando grupos do Oracle...', section ? `(seção: ${section})` : '');

      const cacheKey = section ? `oracle-grupos-${String(section).toUpperCase()}` : 'oracle-grupos-all';

      const grupos = await CacheService.executeWithCache(
        cacheKey,
        async () => {
          // Obter schema e tabelas dinamicamente
          const schema = await MappingService.getSchema();
          const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
          const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

          // Resolver colunas via MappingService
          const colCodGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo');
          const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo');
          const colGrpCodSecao = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao');
          const colGrpFlgInativo = await MappingService.getColumnFromTable('TAB_GRUPO', 'flag_inativo');
          const colCodSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
          const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

          let query = `
            SELECT DISTINCT g.${colCodGrupo}, g.${colDesGrupo}
            FROM ${tabGrupo} g
          `;

          if (section) {
            query += `
              INNER JOIN ${tabSecao} s ON g.${colGrpCodSecao} = s.${colCodSecao}
              WHERE UPPER(s.${colDesSecao}) = :sectionUpper
              AND NVL(g.${colGrpFlgInativo}, 'N') = 'N'
            `;
          } else {
            query += `WHERE NVL(g.${colGrpFlgInativo}, 'N') = 'N'`;
          }

          query += ` ORDER BY g.${colDesGrupo}`;

          const params = section ? { sectionUpper: String(section).toUpperCase() } : {};
          const result = await OracleService.query<{ COD_GRUPO: number; DES_GRUPO: string }>(query, params);
          return result.map(r => ({ codigo: r.COD_GRUPO, descricao: r.DES_GRUPO }));
        }
      );

      console.log('✅ Total grupos encontrados:', grupos.length);
      res.json(grupos);
    } catch (error) {
      console.error('Get Oracle grupos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Listar todos os subgrupos do Oracle (com opção de filtrar por grupo)
   * GET /api/production/erp-subgrupos?codGrupo=1
   */
  static async getErpSubgrupos(req: AuthRequest, res: Response) {
    try {
      const { codGrupo } = req.query;
      console.log('🔗 Buscando subgrupos do Oracle...', codGrupo ? `(grupo: ${codGrupo})` : '');

      const cacheKey = codGrupo ? `oracle-subgrupos-${codGrupo}` : 'oracle-subgrupos-all';

      const subgrupos = await CacheService.executeWithCache(
        cacheKey,
        async () => {
          // Obter schema e tabela dinamicamente
          const schema = await MappingService.getSchema();
          const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;

          // Resolver colunas via MappingService
          const colCodSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo');
          const colDesSubGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo');
          const colSgCodGrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo');
          const colSgFlgInativo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'flag_inativo');

          let query = `
            SELECT DISTINCT sg.${colCodSubGrupo}, sg.${colDesSubGrupo}, sg.${colSgCodGrupo}
            FROM ${tabSubgrupo} sg
          `;

          if (codGrupo) {
            query += ` WHERE sg.${colSgCodGrupo} = :codGrupo AND NVL(sg.${colSgFlgInativo}, 'N') = 'N'`;
          } else {
            query += ` WHERE NVL(sg.${colSgFlgInativo}, 'N') = 'N'`;
          }

          query += ` ORDER BY sg.${colDesSubGrupo}`;

          const params = codGrupo ? { codGrupo: parseInt(String(codGrupo)) } : {};
          const result = await OracleService.query<{ COD_SUB_GRUPO: number; DES_SUB_GRUPO: string; COD_GRUPO: number }>(query, params);
          return result.map(r => ({ codigo: r.COD_SUB_GRUPO, descricao: r.DES_SUB_GRUPO, codGrupo: r.COD_GRUPO }));
        }
      );

      console.log('✅ Total subgrupos encontrados:', subgrupos.length);
      res.json(subgrupos);
    } catch (error) {
      console.error('Get Oracle subgrupos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Listar todos os produtos de uma seção do Oracle (sem filtrar por ativos)
   * GET /api/production/erp-products-by-section?section=PADARIA
   */
  static async getErpProductsBySection(req: AuthRequest, res: Response) {
    try {
      const { section } = req.query;

      if (!section) {
        return res.status(400).json({ error: 'Parâmetro section é obrigatório' });
      }

      const productRepository = AppDataSource.getRepository(Product);

      // Get ALL products from database (regardless of active status) to get peso_medio_kg and responsible
      const allLocalProducts = await productRepository.find({
        select: ['erp_product_id', 'peso_medio_kg', 'production_days', 'section_name', 'foto_referencia', 'active', 'responsible_id'],
        relations: ['responsible'],
      });

      // Create map for all local product data (peso médio, production_days, etc)
      const localProductsMap = new Map(
        allLocalProducts.map((p: any) => [p.erp_product_id, {
          peso_medio_kg: p.peso_medio_kg,
          production_days: p.production_days,
          section_name: p.section_name,
          foto_referencia: p.foto_referencia,
          active: p.active,
          responsible_id: p.responsible_id,
          responsible_name: p.responsible?.name || null
        }])
      );

      console.log('🔗 Buscando produtos da seção:', section, 'do Oracle...');

      // Busca produtos do Oracle por seção (com cache)
      const oracleProducts = await CacheService.executeWithCache(
        `oracle-products-section-${String(section).toUpperCase()}`,
        async () => {
          // Obter schema e tabelas dinamicamente
          const schema = await MappingService.getSchema();
          const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
          const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;
          const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
          const tabGrupo = `${schema}.${await MappingService.getRealTableName('TAB_GRUPO')}`;
          const tabSubgrupo = `${schema}.${await MappingService.getRealTableName('TAB_SUBGRUPO')}`;

          // Resolver colunas via MappingService
          const m = await getProductionAuditMappings();

          const result = await OracleService.query<any>(`
            SELECT
              p.${m.colCodProduto},
              p.${m.colDesProduto},
              s.${m.colDesSecao},
              NVL(pl.${m.plPrecoCusto}, 0) as VAL_CUSTO_REP,
              NVL(pl.${m.plPrecoVenda}, 0) as VAL_VENDA,
              NVL(pl.${m.plMargem}, 0) as VAL_MARGEM_REF,
              NVL(pl.${m.plEstoqueAtual}, 0) as QTD_ESTOQUE,
              NVL(pl.${m.plVendaMedia}, 0) as VAL_VENDA_MEDIA,
              p.${m.colPesavel} as FLG_BALANCA,
              TO_CHAR(pl.${m.plDataUltimaVenda}, 'YYYYMMDD') as DTA_ULT_MOV_VENDA,
              CASE p.${m.colTipoEvento}
                WHEN 0 THEN 'DIRETA'
                WHEN 1 THEN 'DECOMPOSICAO'
                WHEN 2 THEN 'COMPOSICAO'
                WHEN 3 THEN 'PRODUCAO'
                ELSE 'OUTROS'
              END as TIPO_EVENTO,
              NVL(TRIM(pl.${m.plCurva}), 'X') as CURVA,
              p.${m.colCodInfoNutricional} as COD_INFO_NUTRICIONAL,
              pl.${m.plCodInfoReceita} as COD_INFO_RECEITA,
              p.${m.colCodGrupoProd},
              p.${m.colCodSubGrupoProd},
              (SELECT MAX(g.${m.colDesGrupo}) FROM ${tabGrupo} g WHERE g.${m.colCodGrupo} = p.${m.colCodGrupoProd} AND g.${m.colGrpCodSecao} = p.${m.colCodSecaoProd}) as DES_GRUPO,
              (SELECT MAX(sg.${m.colDesSubGrupo}) FROM ${tabSubgrupo} sg WHERE sg.${m.colCodSubGrupo} = p.${m.colCodSubGrupoProd} AND sg.${m.colSgCodGrupo} = p.${m.colCodGrupoProd} AND sg.${m.colSgCodSecao} = p.${m.colCodSecaoProd}) as DES_SUB_GRUPO
            FROM ${tabProduto} p
            INNER JOIN ${tabProdutoLoja} pl ON p.${m.colCodProduto} = pl.${m.plCodProduto}
            LEFT JOIN ${tabSecao} s ON p.${m.colCodSecaoProd} = s.${m.colCodSecao}
            WHERE pl.${m.plCodLoja} = 1
            AND UPPER(s.${m.colDesSecao}) = :sectionUpper
            AND NVL(pl.${m.plInativo}, 'N') = 'N'
            AND NVL(pl.${m.plForaLinha}, 'N') = 'N'
            ORDER BY p.${m.colDesProduto}
          `, { sectionUpper: String(section).toUpperCase() });
          return result;
        }
      );

      // Debug: verificar campos de receita/nutricional
      const produtosComInfo = oracleProducts.filter((p: any) => p.COD_INFO_NUTRICIONAL || p.COD_INFO_RECEITA);
      console.log(`📋 Produtos com info nutricional/receita: ${produtosComInfo.length}/${oracleProducts.length}`);
      if (produtosComInfo.length > 0) {
        console.log('📋 Exemplo:', {
          cod: produtosComInfo[0].COD_PRODUTO,
          nutri: produtosComInfo[0].COD_INFO_NUTRICIONAL,
          receita: produtosComInfo[0].COD_INFO_RECEITA
        });
      }

      // Mapear produtos Oracle para formato esperado
      const allProducts = oracleProducts.map((product: any) => {
        const productData = localProductsMap.get(product.COD_PRODUTO);
        const isActive = productData?.active || false;
        const pesoMedio = productData?.peso_medio_kg ? parseFloat(productData.peso_medio_kg) : null;
        const productionDays = productData?.production_days || 1;

        // Campos financeiros
        const custo = parseFloat(product.VAL_CUSTO_REP) || 0;
        const precoVenda = parseFloat(product.VAL_VENDA) || 0;
        const margemRef = parseFloat(product.VAL_MARGEM_REF) || 0;
        const margemReal = precoVenda > 0 ? ((precoVenda - custo) / precoVenda) * 100 : 0;

        // Venda média em kg (do Oracle)
        const vendaMediaKg = parseFloat(product.VAL_VENDA_MEDIA) || 0;
        const vendaMediaUnd = pesoMedio && pesoMedio > 0 ? vendaMediaKg / pesoMedio : 0;

        return {
          codigo: product.COD_PRODUTO,
          descricao: product.DES_PRODUTO,
          desReduzida: product.DES_PRODUTO?.substring(0, 20) || '',
          peso_medio_kg: pesoMedio,
          production_days: productionDays,
          vendaMedia: vendaMediaKg,
          vendaMediaUnd: vendaMediaUnd,
          pesavel: product.FLG_BALANCA === 'S',
          tipoEvento: product.TIPO_EVENTO || 'DIRETA',
          desSecao: product.DES_SECAO,
          estoque: parseFloat(product.QTD_ESTOQUE) || 0,
          custo: custo,
          precoVenda: precoVenda,
          margemRef: margemRef,
          margemReal: margemReal,
          foto_referencia: productData?.foto_referencia || null,
          dtaUltMovVenda: product.DTA_ULT_MOV_VENDA || null,
          isActive: isActive,
          curva: product.CURVA || 'X',
          responsible_id: productData?.responsible_id || null,
          responsible_name: productData?.responsible_name || null,
          codInfoNutricional: product.COD_INFO_NUTRICIONAL || null,
          codInfoReceita: product.COD_INFO_RECEITA || null,
          codGrupo: product.COD_GRUPO || null,
          codSubgrupo: product.COD_SUB_GRUPO || null,
          desGrupo: product.DES_GRUPO || null,
          desSubgrupo: product.DES_SUB_GRUPO || null,
        };
      });

      console.log('✅ Total produtos da seção', section, ':', allProducts.length);

      res.json(allProducts);
    } catch (error) {
      console.error('Get Oracle products by section error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Criar ou atualizar auditoria de produção
   */
  static async createOrUpdateAudit(req: AuthRequest, res: Response) {
    try {
      const { audit_date, items, codLoja } = req.body;
      const userId = req.userId;
      const userType = req.user?.type;
      const codLojaNum = codLoja ? parseInt(codLoja) : null;

      if (!audit_date || !items || !Array.isArray(items)) {
        return res.status(400).json({
          error: 'Missing required fields: audit_date, items'
        });
      }

      const auditRepository = AppDataSource.getRepository(ProductionAudit);
      const itemRepository = AppDataSource.getRepository(ProductionAuditItem);

      // Check if audit already exists for this date
      let audit = await auditRepository.findOne({
        where: { audit_date: new Date(audit_date) },
        relations: ['items'],
      });

      if (audit) {
        // Update existing audit
        if (userType === 'employee') {
          audit.employee_id = userId!;
          audit.user_id = null;
        } else {
          audit.user_id = userId!;
          audit.employee_id = null;
        }
        audit.status = 'in_progress';

        // Delete existing items
        if (audit.items && audit.items.length > 0) {
          await itemRepository.remove(audit.items);
        }
      } else {
        // Create new audit
        if (userType === 'employee') {
          audit = auditRepository.create({
            audit_date: new Date(audit_date),
            employee_id: userId!,
            user_id: null,
            status: 'in_progress',
            cod_loja: codLojaNum,
          });
        } else {
          audit = auditRepository.create({
            audit_date: new Date(audit_date),
            user_id: userId!,
            employee_id: null,
            status: 'in_progress',
            cod_loja: codLojaNum,
          });
        }
      }

      await auditRepository.save(audit);

      // Create audit items
      const auditItems = items.map((item: any) => {
        const quantity_kg = item.quantity_units * (item.unit_weight_kg || 0);
        const production_days = item.production_days || 1; // Dias de produção por item
        const suggested_production_kg = Math.max(
          0,
          (item.avg_sales_kg || 0) * production_days - quantity_kg
        );
        const suggested_production_units = item.unit_weight_kg
          ? Math.ceil(suggested_production_kg / item.unit_weight_kg)
          : 0;

        return itemRepository.create({
          audit_id: audit!.id,
          product_code: item.product_code,
          product_name: item.product_name,
          quantity_units: item.quantity_units,
          unit_weight_kg: item.unit_weight_kg,
          quantity_kg,
          production_days,
          avg_sales_kg: item.avg_sales_kg,
          suggested_production_kg,
          suggested_production_units,
        });
      });

      await itemRepository.save(auditItems);

      // Reload audit with items
      const savedAudit = await auditRepository.findOne({
        where: { id: audit.id },
        relations: ['items', 'user'],
      });

      res.json(savedAudit);
    } catch (error) {
      console.error('Create/Update production audit error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Finalizar auditoria (marcar como completed)
   */
  static async completeAudit(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      const audit = await auditRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      audit.status = 'completed';
      await auditRepository.save(audit);

      res.json({ message: 'Audit completed successfully', audit });
    } catch (error) {
      console.error('Complete production audit error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Deletar auditoria
   */
  static async deleteAudit(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      const audit = await auditRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      await auditRepository.remove(audit);

      res.json({ message: 'Audit deleted successfully' });
    } catch (error) {
      console.error('Delete production audit error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Salvar um item individual da auditoria (criar auditoria se não existir)
   */
  static async saveItem(req: AuthRequest, res: Response) {
    try {
      const { audit_date, item, codLoja } = req.body;
      const userId = req.userId;
      const userType = req.user?.type;
      const codLojaNum = codLoja ? parseInt(codLoja) : null;

      if (!audit_date || !item) {
        return res.status(400).json({
          error: 'Missing required fields: audit_date, item'
        });
      }

      const auditRepository = AppDataSource.getRepository(ProductionAudit);
      const itemRepository = AppDataSource.getRepository(ProductionAuditItem);

      // Usar a data exata enviada pelo frontend (YYYY-MM-DD) + meio-dia UTC para evitar problemas de timezone
      // Exemplo: "2026-01-21" -> "2026-01-21T12:00:00.000Z"
      const auditDateObj = new Date(`${audit_date}T12:00:00.000Z`);
      console.log('📅 saveItem - audit_date recebido:', audit_date, '-> Date:', auditDateObj.toISOString());

      // Check if audit already exists for this date (buscar por range de datas no mesmo dia UTC)
      const startOfDay = new Date(`${audit_date}T00:00:00.000Z`);
      const endOfDay = new Date(`${audit_date}T23:59:59.999Z`);

      let audit = await auditRepository
        .createQueryBuilder('audit')
        .leftJoinAndSelect('audit.items', 'items')
        .where('audit.audit_date >= :startOfDay', { startOfDay })
        .andWhere('audit.audit_date <= :endOfDay', { endOfDay })
        .getOne();

      if (!audit) {
        // Create new audit usando a data correta (meio-dia para evitar timezone)
        console.log('📅 Criando nova auditoria para:', auditDateObj.toISOString());
        if (userType === 'employee') {
          audit = auditRepository.create({
            audit_date: auditDateObj,
            employee_id: userId!,
            user_id: null,
            status: 'in_progress',
            cod_loja: codLojaNum,
          });
        } else {
          audit = auditRepository.create({
            audit_date: auditDateObj,
            user_id: userId!,
            employee_id: null,
            status: 'in_progress',
            cod_loja: codLojaNum,
          });
        }
        await auditRepository.save(audit);
        console.log('📅 Auditoria criada com ID:', audit.id, '(cod_loja:', codLojaNum, ')');
      } else {
        console.log('📅 Auditoria existente encontrada com ID:', audit.id);
      }

      // Check if item already exists
      let existingItem = await itemRepository.findOne({
        where: {
          audit_id: audit.id,
          product_code: item.product_code
        }
      });

      // Calculate values
      const quantity_kg = item.quantity_units * (item.unit_weight_kg || 0);
      const production_days = item.production_days || 1;
      const suggested_production_kg = Math.max(
        0,
        (item.avg_sales_kg || 0) * production_days - quantity_kg
      );
      const suggested_production_units = item.unit_weight_kg
        ? Math.ceil(suggested_production_kg / item.unit_weight_kg)
        : 0;

      if (existingItem) {
        // Update existing item
        existingItem.quantity_units = item.quantity_units;
        existingItem.unit_weight_kg = item.unit_weight_kg;
        existingItem.quantity_kg = quantity_kg;
        existingItem.production_days = production_days;
        existingItem.avg_sales_kg = item.avg_sales_kg;
        existingItem.suggested_production_kg = suggested_production_kg;
        existingItem.suggested_production_units = suggested_production_units;
        existingItem.last_sale_date = item.last_sale_date || null;
        existingItem.days_without_sale = item.days_without_sale || null;
        existingItem.curva = item.curva || null;
        existingItem.avg_sales_units = item.avg_sales_units || null;
        await itemRepository.save(existingItem);
      } else {
        // Create new item
        const newItem = itemRepository.create({
          audit_id: audit.id,
          product_code: item.product_code,
          product_name: item.product_name,
          quantity_units: item.quantity_units,
          unit_weight_kg: item.unit_weight_kg,
          quantity_kg,
          production_days,
          avg_sales_kg: item.avg_sales_kg,
          suggested_production_kg,
          suggested_production_units,
          last_sale_date: item.last_sale_date || null,
          days_without_sale: item.days_without_sale || null,
          curva: item.curva || null,
          avg_sales_units: item.avg_sales_units || null,
        });
        await itemRepository.save(newItem);
      }

      // Reload audit with items
      const savedAudit = await auditRepository.findOne({
        where: { id: audit.id },
        relations: ['items', 'user'],
      });

      res.json({ message: 'Item saved successfully', audit: savedAudit });
    } catch (error) {
      console.error('Save production audit item error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Remover um item individual da auditoria
   */
  static async deleteItem(req: AuthRequest, res: Response) {
    try {
      const { id, productCode } = req.params;
      const auditRepository = AppDataSource.getRepository(ProductionAudit);
      const itemRepository = AppDataSource.getRepository(ProductionAuditItem);

      const audit = await auditRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      const item = await itemRepository.findOne({
        where: {
          audit_id: audit.id,
          product_code: productCode
        }
      });

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      await itemRepository.remove(item);

      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Delete production audit item error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Gerar PDF e enviar para WhatsApp
   */
  static async sendToWhatsApp(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      const audit = await auditRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['user', 'items'],
      });

      if (!audit) {
        return res.status(404).json({ error: 'Audit not found' });
      }

      if (!audit.items || audit.items.length === 0) {
        return res.status(400).json({ error: 'Audit has no items' });
      }

      // Buscar dados do Oracle para enriquecer os itens com última venda
      let erpProductsMap = new Map<string, any>();
      try {
        const codLoja = audit.cod_loja || 1;
        const productCodes = audit.items.map(item => item.product_code).filter(Boolean);

        if (productCodes.length > 0) {
          const placeholders = productCodes.map((_, i) => `:cod${i}`).join(',');
          const binds: any = { loja: codLoja };
          productCodes.forEach((code, i) => {
            binds[`cod${i}`] = code;
          });

          // Obter schema e tabelas dinamicamente
          const schema = await MappingService.getSchema();
          const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
          const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

          // Resolver colunas via MappingService
          const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
          const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
          const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
          const plDataUltimaVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_venda');

          const query = `
            SELECT
              TO_CHAR(p.${colCodProduto}) as COD_PRODUTO,
              TO_CHAR(pl.${plDataUltimaVenda}, 'YYYY-MM-DD') as DTA_ULT_MOV_VENDA
            FROM ${tabProduto} p
            LEFT JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${plCodProduto} AND pl.${plCodLoja} = :loja
            WHERE TO_CHAR(p.${colCodProduto}) IN (${placeholders})
          `;

          const results = await OracleService.query<any>(query, binds);
          erpProductsMap = new Map(results.map((p: any) => [p.COD_PRODUTO, { dtaUltMovVenda: p.DTA_ULT_MOV_VENDA }]));
        }
      } catch (erpError) {
        console.warn('⚠️ Não foi possível buscar dados do Oracle para enriquecer PDF:', erpError);
      }

      // Enriquecer itens com dados do Oracle (última venda)
      const enrichedItems = audit.items.map(item => {
        const erpProduct = erpProductsMap.get(item.product_code);
        return {
          ...item,
          last_sale_date: item.last_sale_date || erpProduct?.dtaUltMovVenda || null,
        };
      });

      // Buscar dados de perdas mensais do Oracle para incluir no PDF
      let perdasMensais: Record<string, { mesAnterior: number; mesAtual: number; qtdMesAnterior: number; qtdMesAtual: number }> = {};
      try {
        console.log('📊 Buscando perdas mensais para o PDF...');
        const hoje = new Date();
        const primeiroDiaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const dataMesAnteriorInicio = formatDate(primeiroDiaMesAnterior);
        const dataMesAnteriorFim = formatDate(ultimoDiaMesAnterior);
        const dataMesAtualInicio = formatDate(primeiroDiaMesAtual);
        const dataMesAtualFim = formatDate(hoje);

        // Busca mapeamentos dinâmicos (schema e tabelas)
        const schema = await MappingService.getSchema();
        const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE')}`;
        const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;

        const estCodProdutoCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_produto');
        const estQuantidadeCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'quantidade');
        const estDataMovCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'data_ajuste');
        const estCodLojaCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_loja');
        const estValCustoRepCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'valor_custo_reposicao');
        const estFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'flag_cancelado');
        const prodCodigoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');

        const queryMesAnterior = `
          SELECT
            TO_CHAR(p.${prodCodigoCol}) as COD_PRODUTO,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.${estValCustoRepCol}, 0))) as VALOR_PERDA,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0))) as QTD_PERDA
          FROM ${tabAjusteEstoque} ae
          JOIN ${tabProduto} p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
          WHERE ae.${estCodLojaCol} = :loja
          AND ae.${estDataMovCol} >= TO_DATE(:dtIni, 'YYYY-MM-DD')
          AND ae.${estDataMovCol} <= TO_DATE(:dtFim, 'YYYY-MM-DD')
          AND (ae.${estFlgCanceladoCol} IS NULL OR ae.${estFlgCanceladoCol} != 'S')
          AND ae.${estQuantidadeCol} < 0
          GROUP BY p.${prodCodigoCol}
        `;

        const queryMesAtual = `
          SELECT
            TO_CHAR(p.${prodCodigoCol}) as COD_PRODUTO,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.${estValCustoRepCol}, 0))) as VALOR_PERDA,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0))) as QTD_PERDA
          FROM ${tabAjusteEstoque} ae
          JOIN ${tabProduto} p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
          WHERE ae.${estCodLojaCol} = :loja
          AND ae.${estDataMovCol} >= TO_DATE(:dtIni, 'YYYY-MM-DD')
          AND ae.${estDataMovCol} <= TO_DATE(:dtFim, 'YYYY-MM-DD')
          AND (ae.${estFlgCanceladoCol} IS NULL OR ae.${estFlgCanceladoCol} != 'S')
          AND ae.${estQuantidadeCol} < 0
          GROUP BY p.${prodCodigoCol}
        `;

        const [perdasAnterior, perdasAtual] = await Promise.all([
          OracleService.query(queryMesAnterior, { loja: 1, dtIni: dataMesAnteriorInicio, dtFim: dataMesAnteriorFim }),
          OracleService.query(queryMesAtual, { loja: 1, dtIni: dataMesAtualInicio, dtFim: dataMesAtualFim }),
        ]);

        // Indexar perdas por código do produto
        perdasAnterior.forEach((p: any) => {
          const codigo = String(p.COD_PRODUTO);
          if (!perdasMensais[codigo]) {
            perdasMensais[codigo] = { mesAnterior: 0, mesAtual: 0, qtdMesAnterior: 0, qtdMesAtual: 0 };
          }
          perdasMensais[codigo].mesAnterior = parseFloat(p.VALOR_PERDA) || 0;
          perdasMensais[codigo].qtdMesAnterior = parseFloat(p.QTD_PERDA) || 0;
        });

        perdasAtual.forEach((p: any) => {
          const codigo = String(p.COD_PRODUTO);
          if (!perdasMensais[codigo]) {
            perdasMensais[codigo] = { mesAnterior: 0, mesAtual: 0, qtdMesAnterior: 0, qtdMesAtual: 0 };
          }
          perdasMensais[codigo].mesAtual = parseFloat(p.VALOR_PERDA) || 0;
          perdasMensais[codigo].qtdMesAtual = parseFloat(p.QTD_PERDA) || 0;
        });

        console.log(`📊 Perdas encontradas para ${Object.keys(perdasMensais).length} produtos`);
      } catch (perdasError) {
        console.warn('⚠️ Não foi possível buscar dados de perdas para o PDF:', perdasError);
      }

      // Gerar PDF com dados de perdas
      console.log('🥖 Gerando PDF de produção...');
      const pdfPath = await ProductionPDFService.generateProductionPDF(audit, enrichedItems as any, perdasMensais);

      // Calcular estatísticas
      const totalProducts = audit.items.length;
      const withSuggestion = audit.items.filter(item =>
        (item.suggested_production_units || 0) > 0
      ).length;
      const withoutSuggestion = totalProducts - withSuggestion;

      // Buscar nome do grupo configurado
      const groupName = await ConfigurationService.get('whatsapp_group_producao_name', 'Grupo Padrão');

      // Enviar para WhatsApp
      const auditDate = new Date(audit.audit_date).toLocaleDateString('pt-BR');
      const success = await WhatsAppService.sendProductionReport(
        pdfPath,
        auditDate,
        totalProducts,
        withSuggestion,
        withoutSuggestion
      );

      // Salvar informações do envio
      if (success) {
        audit.sent_whatsapp = true;
        audit.sent_at = new Date();
        audit.whatsapp_group_name = groupName;
        await auditRepository.save(audit);
      }

      // Limpar arquivo temporário
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log(`🗑️  Arquivo temporário removido: ${pdfPath}`);
      }

      if (success) {
        res.json({ message: 'Relatório enviado para WhatsApp com sucesso' });
      } else {
        res.status(500).json({ error: 'Falha ao enviar relatório para WhatsApp' });
      }
    } catch (error) {
      console.error('Send production report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Limpar cache de produtos (força recarregar do Oracle)
   */
  static async clearCache(req: AuthRequest, res: Response) {
    try {
      await CacheService.clearCache();
      console.log('🗑️ Cache de produção limpo manualmente');
      res.json({ message: 'Cache limpo com sucesso' });
    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({ error: 'Erro ao limpar cache' });
    }
  }

  /**
   * Atualizar responsável de um produto
   * PATCH /api/production/products/:productCode/responsible
   */
  static async updateProductResponsible(req: AuthRequest, res: Response) {
    try {
      const { productCode } = req.params;
      const { responsible_id } = req.body;

      const productRepository = AppDataSource.getRepository(Product);

      // Buscar produto pelo código ERP
      let product = await productRepository.findOne({
        where: { erp_product_id: productCode }
      });

      if (!product) {
        // Se não existe, criar produto com dados mínimos
        product = productRepository.create({
          erp_product_id: productCode,
          description: productCode, // Será atualizado depois
          responsible_id: responsible_id || null
        });
      } else {
        // Atualizar responsável
        product.responsible_id = responsible_id || null;
      }

      await productRepository.save(product);

      console.log(`✅ Responsável do produto ${productCode} atualizado para: ${responsible_id || 'nenhum'}`);

      res.json({
        success: true,
        message: 'Responsável atualizado com sucesso',
        product: {
          erp_product_id: product.erp_product_id,
          responsible_id: product.responsible_id
        }
      });
    } catch (error) {
      console.error('Update product responsible error:', error);
      res.status(500).json({ error: 'Erro ao atualizar responsável' });
    }
  }

  /**
   * Buscar detalhes de uma receita pelo código
   * GET /api/production/receita/:codReceita
   */
  static async getReceitaDetails(req: AuthRequest, res: Response) {
    try {
      const { codReceita } = req.params;

      // Obter schema e tabela dinamicamente
      const schema = await MappingService.getSchema();
      const tabInfoReceita = `${schema}.${await MappingService.getRealTableName('TAB_INFO_RECEITA')}`;

      // Colunas TAB_INFO_RECEITA via MappingService
      const colCodInfoReceita = await MappingService.getColumnFromTable('TAB_INFO_RECEITA', 'codigo_receita');
      const colDesInfoReceita = await MappingService.getColumnFromTable('TAB_INFO_RECEITA', 'descricao_receita');
      const colDetalhamento = await MappingService.getColumnFromTable('TAB_INFO_RECEITA', 'detalhamento');
      const colUsuarioReceita = await MappingService.getColumnFromTable('TAB_INFO_RECEITA', 'usuario');
      const colDtaCadastroReceita = await MappingService.getColumnFromTable('TAB_INFO_RECEITA', 'data_cadastro');
      const colDtaAlteracaoReceita = await MappingService.getColumnFromTable('TAB_INFO_RECEITA', 'data_alteracao');

      const result = await OracleService.query<any>(`
        SELECT
          ${colCodInfoReceita},
          ${colDesInfoReceita},
          ${colDetalhamento},
          ${colUsuarioReceita},
          TO_CHAR(${colDtaCadastroReceita}, 'DD/MM/YYYY') as DTA_CADASTRO,
          TO_CHAR(${colDtaAlteracaoReceita}, 'DD/MM/YYYY') as DTA_ALTERACAO
        FROM ${tabInfoReceita}
        WHERE ${colCodInfoReceita} = :codReceita
      `, { codReceita: parseInt(codReceita) });

      if (result.length === 0) {
        return res.status(404).json({ error: 'Receita não encontrada' });
      }

      const receita = result[0];
      res.json({
        codigo: receita.COD_INFO_RECEITA,
        descricao: receita.DES_INFO_RECEITA,
        detalhamento: receita.DETALHAMENTO,
        usuario: receita.USUARIO,
        dataCadastro: receita.DTA_CADASTRO,
        dataAlteracao: receita.DTA_ALTERACAO
      });
    } catch (error) {
      console.error('Get receita details error:', error);
      res.status(500).json({ error: 'Erro ao buscar receita' });
    }
  }

  /**
   * Buscar detalhes de informação nutricional pelo código
   * GET /api/production/nutricional/:codNutricional
   */
  static async getNutricionalDetails(req: AuthRequest, res: Response) {
    try {
      const { codNutricional } = req.params;

      // Obter schema e tabela dinamicamente
      const schema = await MappingService.getSchema();
      const tabInfoNutricional = `${schema}.${await MappingService.getRealTableName('TAB_INFO_NUTRICIONAL')}`;

      // Colunas TAB_INFO_NUTRICIONAL via MappingService
      const colCodInfoNutri = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'codigo_nutricional');
      const colDesInfoNutri = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'descricao_nutricional');
      const colPorcao = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'porcao');
      const colUnidadePorcao = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'unidade_porcao');
      const colValorCalorico = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'valor_calorico');
      const colCarboidrato = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'carboidrato');
      const colProteina = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'proteina');
      const colGorduraTotal = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'gordura_total');
      const colGorduraSaturada = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'gordura_saturada');
      const colGorduraTrans = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'gordura_trans');
      const colColesterol = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'colesterol');
      const colFibraAlimentar = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'fibra_alimentar');
      const colCalcio = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'calcio');
      const colFerro = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'ferro');
      const colSodio = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'sodio');
      const colUsuarioNutri = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'usuario');
      const colDtaCadastroNutri = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'data_cadastro');
      const colDtaAlteracaoNutri = await MappingService.getColumnFromTable('TAB_INFO_NUTRICIONAL', 'data_alteracao');

      const result = await OracleService.query<any>(`
        SELECT
          ${colCodInfoNutri},
          ${colDesInfoNutri},
          ${colPorcao},
          ${colUnidadePorcao},
          ${colValorCalorico},
          ${colCarboidrato},
          ${colProteina},
          ${colGorduraTotal},
          ${colGorduraSaturada},
          ${colGorduraTrans},
          ${colColesterol},
          ${colFibraAlimentar},
          ${colCalcio},
          ${colFerro},
          ${colSodio},
          ${colUsuarioNutri},
          TO_CHAR(${colDtaCadastroNutri}, 'DD/MM/YYYY') as DTA_CADASTRO,
          TO_CHAR(${colDtaAlteracaoNutri}, 'DD/MM/YYYY') as DTA_ALTERACAO
        FROM ${tabInfoNutricional}
        WHERE ${colCodInfoNutri} = :codNutricional
      `, { codNutricional: parseInt(codNutricional) });

      if (result.length === 0) {
        return res.status(404).json({ error: 'Informação nutricional não encontrada' });
      }

      const nutri = result[0];
      res.json({
        codigo: nutri.COD_INFO_NUTRICIONAL,
        descricao: nutri.DES_INFO_NUTRICIONAL,
        porcao: nutri.PORCAO,
        unidadePorcao: nutri.UNIDADE_PORCAO || 'g',
        valorCalorico: nutri.VALOR_CALORICO || 0,
        carboidrato: nutri.CARBOIDRATO || 0,
        proteina: nutri.PROTEINA || 0,
        gorduraTotal: nutri.GORDURA_TOTAL || 0,
        gorduraSaturada: nutri.GORDURA_SATURADA || 0,
        gorduraTrans: nutri.GORDURA_TRANS || 0,
        colesterol: nutri.COLESTEROL || 0,
        fibraAlimentar: nutri.FIBRA_ALIMENTAR || 0,
        calcio: nutri.CALCIO || 0,
        ferro: nutri.FERRO || 0,
        sodio: nutri.SODIO || 0,
        usuario: nutri.USUARIO,
        dataCadastro: nutri.DTA_CADASTRO,
        dataAlteracao: nutri.DTA_ALTERACAO
      });
    } catch (error) {
      console.error('Get nutricional details error:', error);
      res.status(500).json({ error: 'Erro ao buscar informação nutricional' });
    }
  }
}
