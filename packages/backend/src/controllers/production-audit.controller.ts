import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { ProductionAudit } from '../entities/ProductionAudit';
import { ProductionAuditItem } from '../entities/ProductionAuditItem';
import { Product } from '../entities/Product';
import axios from 'axios';
import { ConfigurationService } from '../services/configuration.service';
import { CacheService } from '../services/cache.service';
import { ProductionPDFService } from '../services/production-pdf.service';
import { WhatsAppService } from '../services/whatsapp.service';
import * as fs from 'fs';

export class ProductionAuditController {
  /**
   * Listar todas as auditorias de produção
   */
  static async getAudits(req: AuthRequest, res: Response) {
    try {
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      const audits = await auditRepository.find({
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
   */
  static async getBakeryProducts(req: AuthRequest, res: Response) {
    try {
      const productRepository = AppDataSource.getRepository(Product);

      // Get active products from database with section info and foto
      const activeProducts = await productRepository.find({
        where: { active: true },
        select: ['erp_product_id', 'peso_medio_kg', 'production_days', 'section_name', 'foto_referencia'],
      });

      // Fetch products from ERP API
      // Em produção (VPS), usa localhost via túnel SSH
      // Em desenvolvimento (local), usa IP direto do banco de dados
      const isProduction = process.env.NODE_ENV === 'production';

      let erpApiUrl: string;
      if (isProduction) {
        // VPS: usar localhost (túnel SSH expõe a porta 3003 localmente)
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
        erpApiUrl = `http://127.0.0.1:3003${productsEndpoint}`;
        console.log('🔗 Produção: usando túnel SSH em', erpApiUrl);
      } else {
        // Local: usar configuração do banco de dados
        const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
        const port = await ConfigurationService.get('intersolid_port', null);
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
        const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
        erpApiUrl = baseUrl
          ? `${baseUrl}${productsEndpoint}`
          : process.env.ERP_PRODUCTS_API_URL || 'http://mock-erp-api.com';
        console.log('🔗 Desenvolvimento: usando configuração do banco em', erpApiUrl);
      }

      const erpProducts = await CacheService.executeWithCache(
        'erp-bakery-products',
        async () => {
          const response = await axios.get(`${erpApiUrl}`);
          return response.data;
        }
      );

      // Map active products with peso_medio_kg, production_days and foto_referencia
      const activeProductsMap = new Map(
        activeProducts.map((p: any) => [p.erp_product_id, { peso_medio_kg: p.peso_medio_kg, production_days: p.production_days, section_name: p.section_name, foto_referencia: p.foto_referencia }])
      );

      // Return ALL active products with full info
      const allProducts = erpProducts
        .filter((product: any) => activeProductsMap.has(product.codigo))
        .map((product: any) => {
          const productData = activeProductsMap.get(product.codigo);
          const pesoMedio = productData?.peso_medio_kg ? parseFloat(productData.peso_medio_kg) : null;
          const productionDays = productData?.production_days || 1;

          // Calcular venda média em unidades (kg / peso_medio)
          const vendaMediaKg = product.vendaMedia || 0;
          const vendaMediaUnd = pesoMedio && pesoMedio > 0 ? vendaMediaKg / pesoMedio : 0;

          // Campos financeiros
          const custo = product.valCustoRep || 0;
          const precoVenda = product.valvenda || product.valvendaloja || 0;
          const margemRef = product.margemRef || 0;
          // Calcular margem real: ((preço - custo) / preço) * 100
          const margemReal = precoVenda > 0 ? ((precoVenda - custo) / precoVenda) * 100 : 0;

          return {
            codigo: product.codigo,
            descricao: product.descricao,
            desReduzida: product.desReduzida,
            peso_medio_kg: pesoMedio,
            production_days: productionDays,
            vendaMedia: vendaMediaKg,
            vendaMediaUnd: vendaMediaUnd,
            pesavel: product.pesavel,
            tipoEvento: product.tipoEvento || 'DIRETA',
            desSecao: product.desSecao || productData?.section_name || 'SEM SEÇÃO',
            estoque: product.estoque || 0,
            // Campos financeiros
            custo: custo,
            precoVenda: precoVenda,
            margemRef: margemRef,
            margemReal: margemReal,
            // Foto do produto
            foto_referencia: productData?.foto_referencia || null,
            // Data última venda
            dtaUltMovVenda: product.dtaUltMovVenda || null,
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
   * Criar ou atualizar auditoria de produção
   */
  static async createOrUpdateAudit(req: AuthRequest, res: Response) {
    try {
      const { audit_date, items } = req.body;
      const userId = req.userId;
      const userType = req.user?.type;

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
          });
        } else {
          audit = auditRepository.create({
            audit_date: new Date(audit_date),
            user_id: userId!,
            employee_id: null,
            status: 'in_progress',
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
      const { audit_date, item } = req.body;
      const userId = req.userId;
      const userType = req.user?.type;

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
          });
        } else {
          audit = auditRepository.create({
            audit_date: auditDateObj,
            user_id: userId!,
            employee_id: null,
            status: 'in_progress',
          });
        }
        await auditRepository.save(audit);
        console.log('📅 Auditoria criada com ID:', audit.id);
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

      // Buscar dados do ERP para enriquecer os itens com última venda
      let erpProductsMap = new Map<string, any>();
      try {
        const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
        const port = await ConfigurationService.get('intersolid_port', null);
        const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
        const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
        const erpApiUrl = baseUrl ? `${baseUrl}${productsEndpoint}` : null;

        if (erpApiUrl) {
          const erpProducts = await CacheService.executeWithCache(
            'erp-bakery-products',
            async () => {
              const response = await axios.get(erpApiUrl);
              return response.data;
            }
          );
          erpProductsMap = new Map(erpProducts.map((p: any) => [p.codigo, p]));
        }
      } catch (erpError) {
        console.warn('⚠️ Não foi possível buscar dados do ERP para enriquecer PDF:', erpError);
      }

      // Enriquecer itens com dados do ERP (última venda)
      const enrichedItems = audit.items.map(item => {
        const erpProduct = erpProductsMap.get(item.product_code);
        return {
          ...item,
          last_sale_date: item.last_sale_date || erpProduct?.dtaUltMovVenda || null,
        };
      });

      // Gerar PDF
      console.log('🥖 Gerando PDF de produção...');
      const pdfPath = await ProductionPDFService.generateProductionPDF(audit, enrichedItems as any);

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
}
