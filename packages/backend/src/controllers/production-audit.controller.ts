import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { ProductionAudit } from '../entities/ProductionAudit';
import { ProductionAuditItem } from '../entities/ProductionAuditItem';
import { Product } from '../entities/Product';
import axios from 'axios';
import { ConfigurationService } from '../services/configuration.service';
import { CacheService } from '../services/cache.service';

export class ProductionAuditController {
  /**
   * Listar todas as auditorias de produção
   */
  static async getAudits(req: AuthRequest, res: Response) {
    try {
      const auditRepository = AppDataSource.getRepository(ProductionAudit);

      const audits = await auditRepository.find({
        relations: ['user', 'items'],
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
        relations: ['user', 'items'],
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
        relations: ['user', 'items'],
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
   * Listar produtos de padaria disponíveis para auditoria
   */
  static async getBakeryProducts(req: AuthRequest, res: Response) {
    try {
      // Buscar produtos ativos com tipoEvento = "PRODUÇÃO" e que sejam da seção de padaria
      const productRepository = AppDataSource.getRepository(Product);

      // Get active products from database
      const activeProducts = await productRepository.find({
        where: { active: true },
        select: ['erp_product_id', 'peso_medio_kg'],
      });

      // Fetch products from ERP API
      const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
      const port = await ConfigurationService.get('intersolid_port', null);
      const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');
      const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
      const erpApiUrl = baseUrl
        ? `${baseUrl}${productsEndpoint}`
        : process.env.ERP_PRODUCTS_API_URL || 'http://mock-erp-api.com';

      const erpProducts = await CacheService.executeWithCache(
        'erp-bakery-products',
        async () => {
          const response = await axios.get(`${erpApiUrl}`);
          return response.data;
        }
      );

      // Filter products: tipoEvento = "PRODUÇÃO" and active
      const activeProductsMap = new Map(
        activeProducts.map((p: any) => [p.erp_product_id, p.peso_medio_kg])
      );

      const bakeryProducts = erpProducts
        .filter((product: any) => {
          const isActive = activeProductsMap.has(product.codigo);
          const isProduction = product.tipoEvento === 'PRODUÇÃO';
          return isActive && isProduction;
        })
        .map((product: any) => ({
          codigo: product.codigo,
          descricao: product.descricao,
          desReduzida: product.desReduzida,
          peso_medio_kg: activeProductsMap.get(product.codigo) || null,
          vendaMedia: product.vendaMedia || 0,
          pesavel: product.pesavel,
        }));

      res.json(bakeryProducts);
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
        audit.user_id = parseInt(userId!);
        audit.status = 'in_progress';

        // Delete existing items
        if (audit.items && audit.items.length > 0) {
          await itemRepository.remove(audit.items);
        }
      } else {
        // Create new audit
        audit = auditRepository.create({
          audit_date: new Date(audit_date),
          user_id: parseInt(userId!),
          status: 'in_progress',
        });
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
}
