import { Request, Response } from 'express';
import { LabelAuditService } from '../services/label-audit.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'label-audits');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `audit-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV ou Excel são permitidos'));
    }
  }
});

export class LabelAuditController {
  /**
   * POST /api/label-audits/upload
   * Upload de arquivo CSV e criação de auditoria
   */
  static async uploadAndCreateAudit(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const { titulo, data_referencia } = req.body;
      const userId = (req as any).user?.id || 'system';

      if (!titulo || !data_referencia) {
        return res.status(400).json({ error: 'Título e data de referência são obrigatórios' });
      }

      const audit = await LabelAuditService.createAuditFromFile(
        req.file.path,
        titulo,
        new Date(data_referencia),
        userId
      );

      // Deletar arquivo após processamento
      fs.unlinkSync(req.file.path);

      // Buscar a auditoria completa com contagem de itens
      const auditComplete = await LabelAuditService.getAuditById(audit.id);

      return res.status(201).json({
        message: 'Auditoria criada com sucesso',
        audit: auditComplete
      });
    } catch (error: any) {
      console.error('Erro ao criar auditoria:', error);
      return res.status(500).json({ error: error.message || 'Erro ao processar arquivo' });
    }
  }

  /**
   * GET /api/label-audits
   * Listar todas as auditorias
   */
  static async getAllAudits(req: Request, res: Response) {
    try {
      const audits = await LabelAuditService.getAllAudits();
      return res.json(audits);
    } catch (error: any) {
      console.error('Erro ao listar auditorias:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/label-audits/:id
   * Buscar auditoria por ID com itens
   */
  static async getAuditById(req: Request, res: Response) {
    try {
      const auditId = parseInt(req.params.id);

      if (isNaN(auditId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const audit = await LabelAuditService.getAuditById(auditId);

      if (!audit) {
        return res.status(404).json({ error: 'Auditoria não encontrada' });
      }

      return res.json(audit);
    } catch (error: any) {
      console.error('Erro ao buscar auditoria:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/label-audits/:id/pending-items
   * Buscar itens pendentes da auditoria
   */
  static async getPendingItems(req: Request, res: Response) {
    try {
      const auditId = parseInt(req.params.id);

      if (isNaN(auditId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const items = await LabelAuditService.getPendingItems(auditId);

      return res.json(items);
    } catch (error: any) {
      console.error('Erro ao buscar itens pendentes:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/label-audits/items/:itemId/verify
   * Verificar item (marcar como correto ou divergente)
   */
  static async verifyItem(req: Request, res: Response) {
    try {
      const itemId = parseInt(req.params.itemId);
      const { status_verificacao, observacao } = req.body;
      const verificadoPor = (req as any).user?.nome || (req as any).user?.email || 'Auditor';

      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      if (!status_verificacao || !['preco_correto', 'preco_divergente'].includes(status_verificacao)) {
        return res.status(400).json({ error: 'Status de verificação inválido' });
      }

      const item = await LabelAuditService.verifyItem(
        itemId,
        status_verificacao,
        verificadoPor,
        observacao
      );

      return res.json({
        message: 'Item verificado com sucesso',
        item
      });
    } catch (error: any) {
      console.error('Erro ao verificar item:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/label-audits/:id/send-report
   * Gerar e enviar relatório de divergentes via WhatsApp
   */
  static async sendReport(req: Request, res: Response) {
    try {
      const auditId = parseInt(req.params.id);

      if (isNaN(auditId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      await LabelAuditService.sendDivergentReportToWhatsApp(auditId);

      // Marcar auditoria como concluída
      await LabelAuditService.markAsCompleted(auditId);

      return res.json({
        success: true,
        message: 'Relatório enviado via WhatsApp com sucesso'
      });
    } catch (error: any) {
      console.error('Erro ao enviar relatório:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/label-audits/:id/report-pdf
   * Gerar PDF de divergentes para download
   */
  static async downloadReport(req: Request, res: Response) {
    try {
      const auditId = parseInt(req.params.id);

      if (isNaN(auditId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const pdfBuffer = await LabelAuditService.generateDivergentReport(auditId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=etiquetas_divergentes_${auditId}.pdf`);

      return res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/label-audits/agregado
   * Buscar resultados agregados com filtros
   */
  static async getAgregated(req: Request, res: Response) {
    try {
      const { data_inicio, data_fim, produto, fornecedor, auditor } = req.query;

      console.log('📊 Filtros recebidos:', { data_inicio, data_fim, produto, fornecedor, auditor });

      if (!data_inicio || !data_fim) {
        return res.status(400).json({
          error: 'data_inicio e data_fim são obrigatórios',
        });
      }

      const results = await LabelAuditService.getAgregatedResults({
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        produto: produto as string | undefined,
        fornecedor: fornecedor as string | undefined,
        auditor: auditor as string | undefined,
      });

      console.log('✅ Resultados agregados calculados com sucesso');
      res.json(results);
    } catch (error: any) {
      console.error('❌ Erro ao buscar resultados agregados:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/label-audits/:id
   * Deletar auditoria
   */
  static async deleteAudit(req: Request, res: Response) {
    try {
      const auditId = parseInt(req.params.id);

      if (isNaN(auditId)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      await LabelAuditService.deleteAudit(auditId);

      return res.json({ message: 'Auditoria deletada com sucesso' });
    } catch (error: any) {
      console.error('Erro ao deletar auditoria:', error);
      return res.status(500).json({ error: error.message });
    }
  }
}
