import { Request, Response, RequestHandler } from 'express';
import { AppDataSource } from '../config/database';
import { ErpTemplate } from '../entities/ErpTemplate';
import { minioService } from '../services/minio.service';
import multer from 'multer';

const templateRepository = AppDataSource.getRepository(ErpTemplate);

// Configurar multer para upload em memória
const storage = multer.memoryStorage();
export const uploadLogoMiddleware: RequestHandler = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
}).single('logo');

export class ErpTemplatesController {
  /**
   * GET /api/erp-templates
   * Lista todos os templates de ERP
   */
  async index(req: Request, res: Response) {
    try {
      const templates = await templateRepository.find({
        where: { is_active: true },
        order: { name: 'ASC' }
      });

      return res.json(templates);
    } catch (error) {
      console.error('Error fetching ERP templates:', error);
      return res.status(500).json({ error: 'Failed to fetch ERP templates' });
    }
  }

  /**
   * GET /api/erp-templates/:id
   * Busca template específico
   */
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const template = await templateRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      return res.json(template);
    } catch (error) {
      console.error('Error fetching ERP template:', error);
      return res.status(500).json({ error: 'Failed to fetch ERP template' });
    }
  }

  /**
   * POST /api/erp-templates
   * Cria novo template de ERP
   */
  async create(req: Request, res: Response) {
    try {
      const { name, description, database_type, mappings } = req.body;

      if (!name || !database_type || !mappings) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, database_type, mappings'
        });
      }

      // Verificar se já existe um template com esse nome
      const existing = await templateRepository.findOne({
        where: { name }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          error: `Já existe um template com o nome "${name}"`
        });
      }

      const template = templateRepository.create({
        name,
        description,
        database_type,
        mappings: typeof mappings === 'string' ? mappings : JSON.stringify(mappings),
        is_active: true
      });

      const saved = await templateRepository.save(template);

      console.log(`✅ ERP Template created: ${saved.name} (${saved.database_type})`);

      return res.status(201).json({
        success: true,
        message: 'Template criado com sucesso!',
        data: saved
      });
    } catch (error: any) {
      console.error('Error creating ERP template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create ERP template',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/erp-templates/:id
   * Atualiza template existente
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, database_type, mappings, is_active, logo_url } = req.body;

      const template = await templateRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Atualizar campos
      if (name) template.name = name;
      if (description !== undefined) template.description = description;
      if (database_type) template.database_type = database_type;
      if (mappings) template.mappings = typeof mappings === 'string' ? mappings : JSON.stringify(mappings);
      if (is_active !== undefined) template.is_active = is_active;
      if (logo_url !== undefined) template.logo_url = logo_url;

      const saved = await templateRepository.save(template);

      console.log(`✅ ERP Template updated: ${saved.name}`);

      return res.json({
        success: true,
        message: 'Template atualizado com sucesso!',
        data: saved
      });
    } catch (error: any) {
      console.error('Error updating ERP template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update ERP template',
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/erp-templates/:id
   * Remove template (soft delete - marca como inativo)
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const template = await templateRepository.findOne({
        where: { id: parseInt(id) }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Soft delete - apenas marca como inativo
      template.is_active = false;
      await templateRepository.save(template);

      console.log(`✅ ERP Template deleted (soft): ${template.name}`);

      return res.json({
        success: true,
        message: 'Template removido com sucesso!'
      });
    } catch (error: any) {
      console.error('Error deleting ERP template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete ERP template',
        message: error.message
      });
    }
  }

  /**
   * POST /api/erp-templates/upload-logo
   * Faz upload do logo do ERP
   */
  async uploadLogo(req: Request, res: Response) {
    try {
      const templateId = req.body.templateId;
      const file = req.file;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'templateId é obrigatório'
        });
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado'
        });
      }

      // Buscar o template
      const template = await templateRepository.findOne({
        where: { id: parseInt(templateId) }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template não encontrado'
        });
      }

      // Gerar nome único para o arquivo
      const extension = file.originalname.split('.').pop() || 'png';
      const fileName = `erp-logos/erp-${templateId}-${Date.now()}.${extension}`;

      // Upload para MinIO
      const logoUrl = await minioService.uploadFile(
        fileName,
        file.buffer,
        file.mimetype
      );

      // Atualizar template com URL do logo
      template.logo_url = logoUrl;
      await templateRepository.save(template);

      console.log(`✅ Logo uploaded for ERP Template: ${template.name}`);

      return res.json({
        success: true,
        message: 'Logo enviado com sucesso!',
        logo_url: logoUrl
      });
    } catch (error: any) {
      console.error('Error uploading ERP logo:', error);
      return res.status(500).json({
        success: false,
        error: 'Falha ao fazer upload do logo',
        message: error.message
      });
    }
  }
}
