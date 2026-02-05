import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { HortFrutBox } from '../entities/HortFrutBox';
import { HortFrutConference } from '../entities/HortFrutConference';
import { HortFrutConferenceItem } from '../entities/HortFrutConferenceItem';
import { Product } from '../entities/Product';
import { AuthRequest } from '../middleware/auth';
import { Between, In, Not, IsNull } from 'typeorm';
import { minioService } from '../services/minio.service';
import { Company } from '../entities/Company';

// Helper para obter companyId (busca primeira empresa se usuário MASTER não tiver companyId)
async function getEffectiveCompanyId(req: AuthRequest): Promise<string | undefined> {
  let companyId = req.user?.companyId;

  // Se usuário é MASTER e não tem companyId, buscar a primeira empresa
  if (!companyId && req.user?.isMaster) {
    const companyRepository = AppDataSource.getRepository(Company);
    const companies = await companyRepository.find({
      order: { createdAt: 'ASC' },
      take: 1
    });
    if (companies.length > 0) {
      companyId = companies[0].id;
    }
  }

  return companyId || undefined;
}

export class HortFrutController {
  // ==================== CAIXAS ====================

  static async getBoxes(req: AuthRequest, res: Response) {
    try {
      const companyId = await getEffectiveCompanyId(req);
      const onlyActive = req.query.active === 'true';
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;

      const boxRepository = AppDataSource.getRepository(HortFrutBox);

      const where: any = { company_id: companyId };
      if (onlyActive) {
        where.active = true;
      }
      // Filtrar por loja se especificado
      if (codLoja !== undefined) {
        where.cod_loja = codLoja;
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
      const companyId = await getEffectiveCompanyId(req);
      const { name, description, weight, photoUrl, cod_loja } = req.body;

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
        cod_loja: cod_loja ? parseInt(cod_loja) : null,
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
      const { name, description, weight, active, photoUrl, cod_loja } = req.body;

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
      if (cod_loja !== undefined) box.cod_loja = cod_loja ? parseInt(cod_loja) : null;

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
      const { startDate, endDate, status, codLoja } = req.query;
      const codLojaNum = codLoja ? parseInt(codLoja as string) : undefined;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      const where: any = { company_id: companyId };

      // Filtro por loja se especificado
      if (codLojaNum) {
        where.codLoja = codLojaNum;
      }

      if (startDate && endDate) {
        // Ajustar datas para incluir o dia inteiro independente do timezone
        // Criar datas em UTC explicitamente para evitar problemas de timezone
        const startDateStr = startDate as string; // formato YYYY-MM-DD
        const endDateStr = endDate as string;

        // startDate: início do dia em UTC
        const startDateObj = new Date(`${startDateStr}T00:00:00.000Z`);
        // endDate: final do dia em UTC (23:59:59.999)
        const endDateObj = new Date(`${endDateStr}T23:59:59.999Z`);

        console.log(`[HortFrut] Filtro de datas: ${startDateObj.toISOString()} até ${endDateObj.toISOString()}`);

        where.conferenceDate = Between(startDateObj, endDateObj);
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
        relations: ['user', 'items', 'items.box', 'items.supplier'],
      });

      if (!conference) {
        return res.status(404).json({ error: 'Conferência não encontrada' });
      }

      // Buscar fotos dos produtos cadastrados (baseado no barcode)
      if (conference.items && conference.items.length > 0) {
        // Buscar TODOS os produtos com foto (independente de ativo)
        const productRepository = AppDataSource.getRepository(Product);
        const productsWithPhotos = await productRepository.find({
          where: { foto_referencia: Not(IsNull()) },
          select: ['ean', 'erp_product_id', 'foto_referencia']
        });

        // Criar mapa de barcode -> foto com múltiplos formatos de chave
        const photoMap = new Map<string, string>();
        for (const product of productsWithPhotos) {
          if (product.foto_referencia) {
            // Adicionar com formato original
            if (product.ean) {
              photoMap.set(product.ean, product.foto_referencia);
              // Também adicionar versão sem zeros à esquerda e com zeros à esquerda
              const stripped = product.ean.replace(/^0+/, '');
              photoMap.set(stripped, product.foto_referencia);
              photoMap.set(stripped.padStart(13, '0'), product.foto_referencia);
            }
            if (product.erp_product_id) {
              photoMap.set(product.erp_product_id, product.foto_referencia);
              const stripped = product.erp_product_id.replace(/^0+/, '');
              photoMap.set(stripped, product.foto_referencia);
              photoMap.set(stripped.padStart(13, '0'), product.foto_referencia);
            }
          }
        }

        // Adicionar foto aos itens
        for (const item of conference.items) {
          if (item.barcode) {
            // Tentar encontrar foto com o barcode original
            let foto = photoMap.get(item.barcode);
            // Se não encontrar, tentar sem zeros à esquerda
            if (!foto) {
              const stripped = item.barcode.replace(/^0+/, '');
              foto = photoMap.get(stripped);
            }
            if (foto) {
              (item as any).productPhotoUrl = foto;
            }
          }
        }
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
      const { conferenceDate, supplierName, invoiceNumber, observations, codLoja } = req.body;
      const codLojaNum = codLoja ? parseInt(codLoja) : undefined;

      if (!conferenceDate) {
        return res.status(400).json({ error: 'Data da conferência é obrigatória' });
      }

      // Para campo tipo 'date' no PostgreSQL, passar a string diretamente
      // evita problemas de conversão de timezone do JavaScript Date
      console.log(`[HortFrut] Criando conferência - Data recebida: ${conferenceDate}`);

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      const conference = conferenceRepository.create({
        company_id: companyId as string,
        user_id: userId,
        conferenceDate: conferenceDate as any, // String "YYYY-MM-DD" direto para o banco
        supplierName,
        invoiceNumber,
        observations,
        status: 'pending',
        codLoja: codLojaNum,
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

      console.log(`[HortFrut] Importando itens para conferência ${id}, total: ${items?.length || 0}`);

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item para importar' });
      }

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);
      const itemRepository = AppDataSource.getRepository(HortFrutConferenceItem);

      const conference = await conferenceRepository.findOne({ where: { id: parseInt(id) } });

      if (!conference) {
        return res.status(404).json({ error: 'Conferência não encontrada' });
      }

      // Helper para parsear números com segurança
      const safeParseFloat = (value: any): number | undefined => {
        if (value === null || value === undefined || value === '') return undefined;
        const num = parseFloat(String(value).replace(',', '.'));
        return isNaN(num) ? undefined : num;
      };

      // Criar itens
      const createdItems: HortFrutConferenceItem[] = [];
      for (const item of items) {
        const conferenceItem = new HortFrutConferenceItem();
        conferenceItem.conference_id = parseInt(id);
        conferenceItem.barcode = item.barcode || undefined;
        conferenceItem.productName = item.productName || 'Sem nome';
        conferenceItem.curve = item.curve || undefined;
        conferenceItem.section = item.section || undefined;
        conferenceItem.productGroup = item.productGroup || undefined;
        conferenceItem.subGroup = item.subGroup || undefined;
        conferenceItem.currentCost = safeParseFloat(item.currentCost);
        conferenceItem.currentSalePrice = safeParseFloat(item.currentSalePrice);
        conferenceItem.referenceMargin = safeParseFloat(item.referenceMargin);
        conferenceItem.currentMargin = safeParseFloat(item.currentMargin);
        conferenceItem.checked = false;

        await itemRepository.save(conferenceItem);
        createdItems.push(conferenceItem);
      }

      // Atualizar status da conferência
      conference.status = 'in_progress';
      await conferenceRepository.save(conference);

      console.log(`[HortFrut] ${createdItems.length} itens importados com sucesso para conferência ${id}`);

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
        productType,
        totalPaidValue,
        newCost,
        invoiceBoxQuantity,
        invoiceStatus,
        unitsPerBox,
        totalUnits,
        box_id,
        boxQuantity,
        grossWeight,
        quality,
        photoUrl,
        observations,
        checked,
        supplier_id
      } = req.body;

      console.log(`[HortFrut] Atualizando item ${itemId} da conferência ${id}:`, req.body);

      const itemRepository = AppDataSource.getRepository(HortFrutConferenceItem);
      const boxRepository = AppDataSource.getRepository(HortFrutBox);

      const item = await itemRepository.findOne({
        where: { id: parseInt(itemId), conference_id: parseInt(id) }
      });

      if (!item) {
        return res.status(404).json({ error: 'Item não encontrado' });
      }

      // Atualizar campos básicos (com tratamento de valores nulos/vazios)
      if (productType !== undefined) item.productType = productType || undefined;
      if (totalPaidValue !== undefined && totalPaidValue !== null) {
        item.totalPaidValue = parseFloat(totalPaidValue);
      }
      if (newCost !== undefined && newCost !== null) {
        item.newCost = parseFloat(newCost);
      }
      if (invoiceBoxQuantity !== undefined && invoiceBoxQuantity !== null) {
        item.invoiceBoxQuantity = parseInt(invoiceBoxQuantity);
      }
      if (invoiceStatus !== undefined) item.invoiceStatus = invoiceStatus || undefined;
      if (unitsPerBox !== undefined && unitsPerBox !== null) {
        item.unitsPerBox = parseInt(unitsPerBox);
      }
      if (totalUnits !== undefined && totalUnits !== null) {
        item.totalUnits = parseInt(totalUnits);
      }
      if (box_id !== undefined) {
        item.box_id = box_id ? parseInt(box_id) : undefined;
      }
      if (boxQuantity !== undefined && boxQuantity !== null) {
        item.boxQuantity = parseInt(boxQuantity);
      }
      if (grossWeight !== undefined && grossWeight !== null) {
        item.grossWeight = parseFloat(grossWeight);
      }
      if (quality !== undefined) item.quality = quality || undefined;
      if (photoUrl !== undefined) item.photoUrl = photoUrl || undefined;
      if (observations !== undefined) item.observations = observations || undefined;
      if (checked !== undefined) item.checked = checked;
      if (supplier_id !== undefined) {
        item.supplier_id = supplier_id ? parseInt(supplier_id) : undefined;
      }

      // Calcular peso líquido se tiver peso bruto e caixa (modo KG)
      if (item.grossWeight && item.box_id && item.boxQuantity) {
        const box = await boxRepository.findOne({ where: { id: item.box_id } });
        if (box) {
          const boxTotalWeight = parseFloat(box.weight.toString()) * item.boxQuantity;
          item.netWeight = item.grossWeight - boxTotalWeight;
        }
      }

      // Calcular novo custo baseado no tipo de produto
      if (item.totalPaidValue) {
        if (item.productType === 'kg' && item.netWeight && item.netWeight > 0) {
          // Modo KG: Preço por kg = Valor Total / Peso Líquido
          item.newCost = item.totalPaidValue / item.netWeight;
        } else if (item.productType === 'unit' && item.totalUnits && item.totalUnits > 0) {
          // Modo Unidade: Preço por unidade = Valor Total / Total de Unidades
          item.newCost = item.totalPaidValue / item.totalUnits;
        }
      }

      // Calcular preço sugerido se tiver novo custo e margem de referência
      if (item.newCost && item.referenceMargin) {
        const margin = parseFloat(item.referenceMargin.toString()) / 100;
        item.suggestedPrice = item.newCost / (1 - margin);
      }

      // Calcular margem ATUAL (baseada no custo anterior e preço de venda atual)
      if (item.currentCost && item.currentSalePrice) {
        const custoAtual = parseFloat(item.currentCost.toString());
        const precoVenda = parseFloat(item.currentSalePrice.toString());
        if (precoVenda > 0) {
          item.currentMargin = ((precoVenda - custoAtual) / precoVenda) * 100;
        }
      }

      // Calcular margem FUTURA (se mantiver preço atual com novo custo)
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
      const { year, month, codLoja } = req.query;
      const codLojaNum = codLoja ? parseInt(codLoja as string) : undefined;

      const conferenceRepository = AppDataSource.getRepository(HortFrutConference);

      // Buscar conferências do mês
      const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const endDate = new Date(parseInt(year as string), parseInt(month as string), 0);

      const whereCondition: any = {
        company_id: companyId as string,
        conferenceDate: Between(startDate, endDate),
      };

      // Filtro por loja se especificado
      if (codLojaNum) {
        whereCondition.codLoja = codLojaNum;
      }

      const conferences = await conferenceRepository.find({
        where: whereCondition,
        order: { conferenceDate: 'DESC' },
      });

      // Agrupar por data - extrair string da data diretamente sem conversão de timezone
      const grouped: { [key: string]: any[] } = {};
      for (const conf of conferences) {
        // conferenceDate pode vir como Date ou string do banco
        // Converter para string e pegar apenas a parte da data (YYYY-MM-DD)
        let dateKey: string;
        if (conf.conferenceDate instanceof Date) {
          // Se for Date, usar toISOString mas pegar só a parte da data
          dateKey = conf.conferenceDate.toISOString().split('T')[0];
        } else {
          // Se for string, pegar só a parte da data
          dateKey = String(conf.conferenceDate).split('T')[0];
        }

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
