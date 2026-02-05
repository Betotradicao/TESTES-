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

          const result = await OracleService.query<any>(`
            SELECT
              p.COD_PRODUTO,
              p.DES_PRODUTO,
              s.DES_SECAO,
              NVL(pl.VAL_CUSTO_REP, 0) as VAL_CUSTO_REP,
              NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
              NVL(pl.VAL_MARGEM_FIXA, pl.VAL_MARGEM) as VAL_MARGEM_REF,
              NVL(pl.QTD_EST_ATUAL, 0) as QTD_ESTOQUE,
              NVL(pl.VAL_VENDA_MEDIA, 0) as VAL_VENDA_MEDIA,
              p.FLG_ENVIA_BALANCA as FLG_BALANCA,
              TO_CHAR(pl.DTA_ULT_MOV_VENDA, 'YYYY-MM-DD') as DTA_ULT_MOV_VENDA,
              CASE p.TIPO_EVENTO
                WHEN 0 THEN 'DIRETA'
                WHEN 1 THEN 'DECOMPOSICAO'
                WHEN 2 THEN 'COMPOSICAO'
                WHEN 3 THEN 'PRODUCAO'
                ELSE 'OUTROS'
              END as TIPO_EVENTO
            FROM INTERSOLID.TAB_PRODUTO p
            INNER JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON p.COD_PRODUTO = pl.COD_PRODUTO
            LEFT JOIN INTERSOLID.TAB_SECAO s ON p.COD_SECAO = s.COD_SECAO
            WHERE pl.COD_LOJA = 1
            AND p.COD_PRODUTO IN (${placeholders})
            ORDER BY p.DES_PRODUTO
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
          const result = await OracleService.query<{ DES_SECAO: string }>(`
            SELECT COD_SECAO, DES_SECAO
            FROM INTERSOLID.TAB_SECAO
            ORDER BY DES_SECAO
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
          let query = `
            SELECT DISTINCT g.COD_GRUPO, g.DES_GRUPO
            FROM INTERSOLID.TAB_GRUPO g
          `;

          if (section) {
            query += `
              INNER JOIN INTERSOLID.TAB_SECAO s ON g.COD_SECAO = s.COD_SECAO
              WHERE UPPER(s.DES_SECAO) = :sectionUpper
              AND NVL(g.FLG_INATIVO, 'N') = 'N'
            `;
          } else {
            query += `WHERE NVL(g.FLG_INATIVO, 'N') = 'N'`;
          }

          query += ` ORDER BY g.DES_GRUPO`;

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
          let query = `
            SELECT DISTINCT sg.COD_SUB_GRUPO, sg.DES_SUB_GRUPO, sg.COD_GRUPO
            FROM INTERSOLID.TAB_SUBGRUPO sg
          `;

          if (codGrupo) {
            query += ` WHERE sg.COD_GRUPO = :codGrupo AND NVL(sg.FLG_INATIVO, 'N') = 'N'`;
          } else {
            query += ` WHERE NVL(sg.FLG_INATIVO, 'N') = 'N'`;
          }

          query += ` ORDER BY sg.DES_SUB_GRUPO`;

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
          const result = await OracleService.query<any>(`
            SELECT
              p.COD_PRODUTO,
              p.DES_PRODUTO,
              s.DES_SECAO,
              NVL(pl.VAL_CUSTO_REP, 0) as VAL_CUSTO_REP,
              NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
              NVL(pl.VAL_MARGEM, 0) as VAL_MARGEM_REF,
              NVL(pl.QTD_EST_ATUAL, 0) as QTD_ESTOQUE,
              NVL(pl.VAL_VENDA_MEDIA, 0) as VAL_VENDA_MEDIA,
              p.FLG_ENVIA_BALANCA as FLG_BALANCA,
              TO_CHAR(pl.DTA_ULT_MOV_VENDA, 'YYYYMMDD') as DTA_ULT_MOV_VENDA,
              CASE p.TIPO_EVENTO
                WHEN 0 THEN 'DIRETA'
                WHEN 1 THEN 'DECOMPOSICAO'
                WHEN 2 THEN 'COMPOSICAO'
                WHEN 3 THEN 'PRODUCAO'
                ELSE 'OUTROS'
              END as TIPO_EVENTO,
              NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X') as CURVA,
              p.COD_INFO_NUTRICIONAL,
              pl.COD_INFO_RECEITA,
              p.COD_GRUPO,
              p.COD_SUB_GRUPO,
              (SELECT MAX(g.DES_GRUPO) FROM INTERSOLID.TAB_GRUPO g WHERE g.COD_GRUPO = p.COD_GRUPO AND g.COD_SECAO = p.COD_SECAO) as DES_GRUPO,
              (SELECT MAX(sg.DES_SUB_GRUPO) FROM INTERSOLID.TAB_SUBGRUPO sg WHERE sg.COD_SUB_GRUPO = p.COD_SUB_GRUPO AND sg.COD_GRUPO = p.COD_GRUPO AND sg.COD_SECAO = p.COD_SECAO) as DES_SUB_GRUPO
            FROM INTERSOLID.TAB_PRODUTO p
            INNER JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON p.COD_PRODUTO = pl.COD_PRODUTO
            LEFT JOIN INTERSOLID.TAB_SECAO s ON p.COD_SECAO = s.COD_SECAO
            WHERE pl.COD_LOJA = 1
            AND UPPER(s.DES_SECAO) = :sectionUpper
            AND NVL(pl.INATIVO, 'N') = 'N'
            AND NVL(pl.FORA_LINHA, 'N') = 'N'
            ORDER BY p.DES_PRODUTO
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

          const query = `
            SELECT
              TO_CHAR(p.COD_PRODUTO) as COD_PRODUTO,
              TO_CHAR(pl.DTA_ULT_MOV_VENDA, 'YYYY-MM-DD') as DTA_ULT_MOV_VENDA
            FROM INTERSOLID.TAB_PRODUTO p
            LEFT JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON p.COD_PRODUTO = pl.COD_PRODUTO AND pl.COD_LOJA = :loja
            WHERE TO_CHAR(p.COD_PRODUTO) IN (${placeholders})
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

        // Busca mapeamentos dinâmicos
        const estCodProdutoCol = await MappingService.getColumn('estoque', 'cod_produto', 'COD_PRODUTO');
        const estQuantidadeCol = await MappingService.getColumn('estoque', 'quantidade', 'QTD_AJUSTE');
        const estDataMovCol = await MappingService.getColumn('estoque', 'data_movimento', 'DTA_AJUSTE');
        const prodCodigoCol = await MappingService.getColumn('produtos', 'codigo', 'COD_PRODUTO');
        const prodEanCol = await MappingService.getColumn('produtos', 'ean', 'COD_BARRA_PRINCIPAL');

        const queryMesAnterior = `
          SELECT
            TO_CHAR(p.${prodCodigoCol}) as COD_PRODUTO,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0))) as VALOR_PERDA,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0))) as QTD_PERDA
          FROM INTERSOLID.TAB_AJUSTE_ESTOQUE ae
          JOIN INTERSOLID.TAB_PRODUTO p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
          WHERE ae.COD_LOJA = :loja
          AND ae.${estDataMovCol} >= TO_DATE(:dtIni, 'YYYY-MM-DD')
          AND ae.${estDataMovCol} <= TO_DATE(:dtFim, 'YYYY-MM-DD')
          AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
          AND ae.${estQuantidadeCol} < 0
          GROUP BY p.${prodCodigoCol}
        `;

        const queryMesAtual = `
          SELECT
            TO_CHAR(p.${prodCodigoCol}) as COD_PRODUTO,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0))) as VALOR_PERDA,
            SUM(ABS(NVL(ae.${estQuantidadeCol}, 0))) as QTD_PERDA
          FROM INTERSOLID.TAB_AJUSTE_ESTOQUE ae
          JOIN INTERSOLID.TAB_PRODUTO p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
          WHERE ae.COD_LOJA = :loja
          AND ae.${estDataMovCol} >= TO_DATE(:dtIni, 'YYYY-MM-DD')
          AND ae.${estDataMovCol} <= TO_DATE(:dtFim, 'YYYY-MM-DD')
          AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
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

      const result = await OracleService.query<any>(`
        SELECT
          COD_INFO_RECEITA,
          DES_INFO_RECEITA,
          DETALHAMENTO,
          USUARIO,
          TO_CHAR(DTA_CADASTRO, 'DD/MM/YYYY') as DTA_CADASTRO,
          TO_CHAR(DTA_ALTERACAO, 'DD/MM/YYYY') as DTA_ALTERACAO
        FROM INTERSOLID.TAB_INFO_RECEITA
        WHERE COD_INFO_RECEITA = :codReceita
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

      const result = await OracleService.query<any>(`
        SELECT
          COD_INFO_NUTRICIONAL,
          DES_INFO_NUTRICIONAL,
          PORCAO,
          UNIDADE_PORCAO,
          VALOR_CALORICO,
          CARBOIDRATO,
          PROTEINA,
          GORDURA_TOTAL,
          GORDURA_SATURADA,
          GORDURA_TRANS,
          COLESTEROL,
          FIBRA_ALIMENTAR,
          CALCIO,
          FERRO,
          SODIO,
          USUARIO,
          TO_CHAR(DTA_CADASTRO, 'DD/MM/YYYY') as DTA_CADASTRO,
          TO_CHAR(DTA_ALTERACAO, 'DD/MM/YYYY') as DTA_ALTERACAO
        FROM INTERSOLID.TAB_INFO_NUTRICIONAL
        WHERE COD_INFO_NUTRICIONAL = :codNutricional
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
