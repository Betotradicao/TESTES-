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
   * Listar produtos ativos disponíveis para auditoria (com filtros opcionais)
   */
  static async getBakeryProducts(req: AuthRequest, res: Response) {
    try {
      const productRepository = AppDataSource.getRepository(Product);

      // Get active products from database with section info
      const activeProducts = await productRepository.find({
        where: { active: true },
        select: ['erp_product_id', 'peso_medio_kg', 'production_days', 'section_name'],
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

      // Map active products with peso_medio_kg and production_days
      const activeProductsMap = new Map(
        activeProducts.map((p: any) => [p.erp_product_id, { peso_medio_kg: p.peso_medio_kg, production_days: p.production_days, section_name: p.section_name }])
      );

      // Return ALL active products with full info
      const allProducts = erpProducts
        .filter((product: any) => activeProductsMap.has(product.codigo))
        .map((product: any) => {
          const productData = activeProductsMap.get(product.codigo);
          const pesoMedio = productData?.peso_medio_kg ? parseFloat(productData.peso_medio_kg) : null;
          const productionDays = productData?.production_days || 1;

          return {
            codigo: product.codigo,
            descricao: product.descricao,
            desReduzida: product.desReduzida,
            peso_medio_kg: pesoMedio,
            production_days: productionDays,
            vendaMedia: product.vendaMedia || 0,
            pesavel: product.pesavel,
            tipoEvento: product.tipoEvento || 'DIRETA',
            desSecao: product.desSecao || productData?.section_name || 'SEM SEÇÃO',
            estoque: product.estoque || 0,
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
        audit.user_id = userId!;
        audit.status = 'in_progress';

        // Delete existing items
        if (audit.items && audit.items.length > 0) {
          await itemRepository.remove(audit.items);
        }
      } else {
        // Create new audit
        audit = auditRepository.create({
          audit_date: new Date(audit_date),
          user_id: userId!,
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

      // Gerar PDF
      console.log('🥖 Gerando PDF de produção...');
      const pdfPath = await ProductionPDFService.generateProductionPDF(audit, audit.items);

      // Calcular estatísticas
      const totalProducts = audit.items.length;
      const withSuggestion = audit.items.filter(item =>
        (item.suggested_production_units || 0) > 0
      ).length;
      const withoutSuggestion = totalProducts - withSuggestion;

      // Enviar para WhatsApp
      const auditDate = new Date(audit.audit_date).toLocaleDateString('pt-BR');
      const success = await WhatsAppService.sendProductionReport(
        pdfPath,
        auditDate,
        totalProducts,
        withSuggestion,
        withoutSuggestion
      );

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
