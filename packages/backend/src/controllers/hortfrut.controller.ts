import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { HortFrutBox } from '../entities/HortFrutBox';
import { HortFrutConference } from '../entities/HortFrutConference';
import { HortFrutConferenceItem } from '../entities/HortFrutConferenceItem';
import { AuthRequest } from '../middleware/auth';
import { Between } from 'typeorm';
import { minioService } from '../services/minio.service';

export class HortFrutController {
  // ==================== CAIXAS ====================

  static async getBoxes(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || undefined;
      const onlyActive = req.query.active === 'true';

      const boxRepository = AppDataSource.getRepository(HortFrutBox);

      const where: any = { company_id: companyId };
      if (onlyActive) {
        where.active = true;
      }

      const boxes = await boxRepository.find({
        where,
        order: { name: 'ASC' },
      });

      res.json(boxes);
    } catch (error) {
      console.error('Erro ao buscar caixas:', error);
      res.status(500).json({ error: 'Erro ao buscar caixas' });
    }
  }

  static async createBox(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId || undefined;
      const { name, description, weight, photoUrl } = req.body;

      if (!name || weight === undefined) {
        return res.status(400).json({ error: 'Nome e peso são obrigatórios' });
      }

      const boxRepository = AppDataSource.getRepository(HortFrutBox);

      const box = boxRepository.create({
        company_id: companyId!,
        name,
        description,
        weight: parseFloat(weight),
        photoUrl,
        active: true,
      });

      await boxRepository.save(box);

      res.status(201).json(box);
    } catch (error) {
      console.error('Erro ao criar caixa:', error);
      res.status(500).json({ error: 'Erro ao criar caixa' });
    }
  }

  static async updateBox(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, weight, active, photoUrl } = req.body;

      const boxRepository = AppDataSource.getRepository(HortFrutBox);

      const box = await boxRepository.findOne({ where: { id: parseInt(id) } });

      if (!box) {
        return res.status(404).json({ error: 'Caixa não encontrada' });
      }

      if (name !== undefined) box.name = name;
      if (description !== undefined) box.description = description;
      if (weight !== undefined) box.weight = parseFloat(weight);
      if (active !== undefined) box.active = active;
      if (photoUrl !== undefined) box.photoUrl = photoUrl;

      await boxRepository.save(box);

      res.json(box);
    } catch (error) {
      console.error('Erro ao atualizar caixa:', error);
      res.status(500).json({ error: 'Erro ao atualizar caixa' });
    }
  }

  static async deleteBox(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const boxRepository = AppDataSource.getRepository(HortFrutBox);

      const result = await boxRepository.delete(parseInt(id));

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Caixa não encontrada' });
      }

      res.json({ message: 'Caixa excluída com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir caixa:', error);
      res.status(500).json({ error: 'Erro ao excluir caixa' });
    }
  }

  // ==================== CONFERÊNCIAS ====================

  static async getConferences(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId ?? undefined;
      const { startDate, endDate, status } = req.query;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      const where: any = { company_id: companyId };

      if (startDate && endDate) {
        where.conferenceDate = Between(new Date(startDate as string), new Date(endDate as string));
      }

      if (status) {
        where.status = status;
      }

      const conferences = await conferenceRepository.find({
        where,
        order: { conferenceDate: 'DESC', createdAt: 'DESC' },
        relations: ['user'],
      });

      res.json(conferences);
    } catch (error) {
      console.error('Erro ao buscar conferências:', error);
      res.status(500).json({ error: 'Erro ao buscar conferências' });
    }
  }

  static async getConferenceById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      const conference = await conferenceRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['user', 'items', 'items.box'],
      });

      if (!conference) {
        return res.status(404).json({ error: 'Conferência não encontrada' });
      }

      res.json(conference);
    } catch (error) {
      console.error('Erro ao buscar conferência:', error);
      res.status(500).json({ error: 'Erro ao buscar conferência' });
    }
  }

  static async createConference(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId ?? undefined;
      const userId = req.userId;
      const { conferenceDate, supplierName, invoiceNumber, observations } = req.body;

      if (!conferenceDate) {
        return res.status(400).json({ error: 'Data da conferência é obrigatória' });
      }

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      const conference = conferenceRepository.create({
        company_id: companyId as string,
        user_id: userId,
        conferenceDate: new Date(conferenceDate),
        supplierName,
        invoiceNumber,
        observations,
        status: 'pending',
      });

      await conferenceRepository.save(conference);

      res.status(201).json(conference);
    } catch (error) {
      console.error('Erro ao criar conferência:', error);
      res.status(500).json({ error: 'Erro ao criar conferência' });
    }
  }

  static async updateConference(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { supplierName, invoiceNumber, observations, status } = req.body;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      const conference = await conferenceRepository.findOne({ where: { id: parseInt(id) } });

      if (!conference) {
        return res.status(404).json({ error: 'Conferência não encontrada' });
      }

      if (supplierName !== undefined) conference.supplierName = supplierName;
      if (invoiceNumber !== undefined) conference.invoiceNumber = invoiceNumber;
      if (observations !== undefined) conference.observations = observations;
      if (status !== undefined) conference.status = status;

      await conferenceRepository.save(conference);

      res.json(conference);
    } catch (error) {
      console.error('Erro ao atualizar conferência:', error);
      res.status(500).json({ error: 'Erro ao atualizar conferência' });
    }
  }

  static async deleteConference(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      const result = await conferenceRepository.delete(parseInt(id));

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Conferência não encontrada' });
      }

      res.json({ message: 'Conferência excluída com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir conferência:', error);
      res.status(500).json({ error: 'Erro ao excluir conferência' });
    }
  }

  // ==================== ITENS DA CONFERÊNCIA ====================

  static async importItems(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item para importar' });
      }

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);
      const itemRepository = AppDataSource.getRepository(HortFrutConferenceItem);

      const conference = await conferenceRepository.findOne({ where: { id: parseInt(id) } });

      if (!conference) {
        return res.status(404).json({ error: 'Conferência não encontrada' });
      }

      // Criar itens
      const createdItems: HortFrutConferenceItem[] = [];
      for (const item of items) {
        const conferenceItem = new HortFrutConferenceItem();
        conferenceItem.conference_id = parseInt(id);
        conferenceItem.barcode = item.barcode;
        conferenceItem.productName = item.productName;
        conferenceItem.curve = item.curve;
        conferenceItem.section = item.section;
        conferenceItem.productGroup = item.productGroup;
        conferenceItem.subGroup = item.subGroup;
        conferenceItem.currentCost = item.currentCost ? parseFloat(item.currentCost) : undefined;
        conferenceItem.currentSalePrice = item.currentSalePrice ? parseFloat(item.currentSalePrice) : undefined;
        conferenceItem.referenceMargin = item.referenceMargin ? parseFloat(item.referenceMargin) : undefined;
        conferenceItem.currentMargin = item.currentMargin ? parseFloat(item.currentMargin) : undefined;
        conferenceItem.checked = false;

        await itemRepository.save(conferenceItem);
        createdItems.push(conferenceItem);
      }

      // Atualizar status da conferência
      conference.status = 'in_progress';
      await conferenceRepository.save(conference);

      res.status(201).json({
        message: `${createdItems.length} itens importados com sucesso`,
        items: createdItems
      });
    } catch (error) {
      console.error('Erro ao importar itens:', error);
      res.status(500).json({ error: 'Erro ao importar itens' });
    }
  }

  static async updateItem(req: AuthRequest, res: Response) {
    try {
      const { id, itemId } = req.params;
      const {
        newCost,
        box_id,
        boxQuantity,
        grossWeight,
        quality,
        photoUrl,
        observations,
        checked
      } = req.body;

      const itemRepository = AppDataSource.getRepository(HortFrutConferenceItem);
      const boxRepository = AppDataSource.getRepository(HortFrutBox);

      const item = await itemRepository.findOne({
        where: { id: parseInt(itemId), conference_id: parseInt(id) }
      });

      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }

      // Atualizar campos
      if (newCost !== undefined) item.newCost = parseFloat(newCost);
      if (box_id !== undefined) item.box_id = box_id;
      if (boxQuantity !== undefined) item.boxQuantity = parseInt(boxQuantity);
      if (grossWeight !== undefined) item.grossWeight = parseFloat(grossWeight);
      if (quality !== undefined) item.quality = quality;
      if (photoUrl !== undefined) item.photoUrl = photoUrl;
      if (observations !== undefined) item.observations = observations;
      if (checked !== undefined) item.checked = checked;

      // Calcular peso líquido se tiver peso bruto e caixa
      if (item.grossWeight && item.box_id && item.boxQuantity) {
        const box = await boxRepository.findOne({ where: { id: item.box_id } });
        if (box) {
          const boxTotalWeight = parseFloat(box.weight.toString()) * item.boxQuantity;
          item.netWeight = item.grossWeight - boxTotalWeight;
        }
      }

      // Calcular preço sugerido se tiver novo custo e margem de referência
      if (item.newCost && item.referenceMargin) {
        const margin = parseFloat(item.referenceMargin.toString()) / 100;
        item.suggestedPrice = item.newCost / (1 - margin);
      }

      // Calcular margem se mantiver preço atual
      if (item.newCost && item.currentSalePrice) {
        const cost = parseFloat(item.newCost.toString());
        const price = parseFloat(item.currentSalePrice.toString());
        item.marginIfKeepPrice = ((price - cost) / price) * 100;
      }

      await itemRepository.save(item);

      res.json(item);
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      res.status(500).json({ error: 'Erro ao atualizar item' });
    }
  }

  static async getConferencesByDate(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId ?? undefined;
      const { year, month } = req.query;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      // Buscar conferências do mês
      const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const endDate = new Date(parseInt(year as string), parseInt(month as string), 0);

      const conferences = await conferenceRepository.find({
        where: {
          company_id: companyId as string,
          conferenceDate: Between(startDate, endDate),
        },
        order: { conferenceDate: 'DESC' },
      });

      // Agrupar por data
      const grouped: { [key: string]: any[] } = {};
      for (const conf of conferences) {
        const dateKey = conf.conferenceDate.toISOString().split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(conf);
      }

      res.json(grouped);
    } catch (error) {
      console.error('Erro ao buscar conferências por data:', error);
      res.status(500).json({ error: 'Erro ao buscar conferências' });
    }
  }

  static async finalizeConference(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);
      const itemRepository = AppDataSource.getRepository(HortFrutConferenceItem);

      const conference = await conferenceRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['items']
      });

      if (!conference) {
        return res.status(404).json({ error: 'Conferência não encontrada' });
      }

      // Calcular totais
      let totalExpected = 0;
      let totalActual = 0;
      let totalCost = 0;

      if (conference.items) {
        for (const item of conference.items) {
          if (item.expectedWeight) totalExpected += parseFloat(item.expectedWeight.toString());
          if (item.netWeight) totalActual += parseFloat(item.netWeight.toString());
          if (item.newCost && item.netWeight) {
            totalCost += parseFloat(item.newCost.toString()) * parseFloat(item.netWeight.toString());
          }
        }
      }

      conference.totalExpectedWeight = totalExpected;
      conference.totalActualWeight = totalActual;
      conference.totalCost = totalCost;
      conference.status = 'completed';

      await conferenceRepository.save(conference);

      res.json(conference);
    } catch (error) {
      console.error('Erro ao finalizar conferência:', error);
      res.status(500).json({ error: 'Erro ao finalizar conferência' });
    }
  }

  // ==================== UPLOAD DE IMAGEM ====================

  static async uploadImage(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Tipo de arquivo inválido. Apenas JPEG, PNG, GIF e WebP são permitidos' });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB' });
      }

      // Upload to MinIO
      const fileName = `hortfrut-${Date.now()}.${req.file.mimetype.split('/')[1]}`;
      const url = await minioService.uploadFile(fileName, req.file.buffer, req.file.mimetype);

      res.json({ url });
    } catch (error) {
      console.error('Erro ao fazer upload de imagem:', error);
      res.status(500).json({ error: 'Erro ao fazer upload de imagem' });
    }
  }
}
