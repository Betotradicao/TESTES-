import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Bip, BipStatus, MotivoCancelamento } from '../entities/Bip';
import { Sell } from '../entities/Sell';
import { AuthRequest } from '../middleware/auth';
import { Between, IsNull } from 'typeorm';
import { uploadService } from '../services/upload.service';

export class BipsController {
  static async getBips(req: AuthRequest, res: Response) {
    try {
      const {
        page = '1',
        limit = '10',
        date,
        date_from,
        date_to,
        status,
        notified_filter,
        product_id,
        product_description,
        search,
        sector_id,
        employee_id,
        codLoja
      } = req.query;

      // LOG: Debug dos parâmetros recebidos
      console.log('📥 GET /bips - Parâmetros recebidos:', {
        page,
        limit,
        date,
        date_from,
        date_to,
        status,
        notified_filter,
        product_id,
        product_description,
        search,
        sector_id,
        employee_id
      });

      // Parse pagination
      const pageNumber = parseInt(page as string, 10);
      const limitNumber = parseInt(limit as string, 10);
      const offset = (pageNumber - 1) * limitNumber;

      // Validate pagination (sem limite máximo para suportar tela de Rankings)
      if (pageNumber < 1 || limitNumber < 1) {
        console.log('❌ Erro de paginação:', { pageNumber, limitNumber });
        return res.status(400).json({
          error: 'Invalid pagination parameters. Page must be >= 1, limit must be >= 1'
        });
      }

      // Validate required date filters
      if (!date_from || !date_to) {
        console.log('❌ Datas obrigatórias faltando:', { date_from, date_to });
        return res.status(400).json({
          error: 'As datas inicial e final são obrigatórias.'
        });
      }

      // Validate search length
      if (search && (search as string).length < 2) {
        return res.status(400).json({
          error: 'A busca deve ter pelo menos 2 caracteres.'
        });
      }

      const bipRepository = AppDataSource.getRepository(Bip);

      // Build query with joins
      let query = bipRepository
        .createQueryBuilder('bip')
        .leftJoinAndSelect('bip.equipment', 'equipment')
        .leftJoinAndSelect('equipment.sector', 'sector')
        .leftJoinAndSelect('bip.employee', 'employee')
        .leftJoinAndSelect('employee.sector', 'employeeSector')
        .leftJoinAndSelect('bip.employee_responsavel', 'employee_responsavel');

      // Date filter with range support
      if (date_from && date_to) {
        // Validate date range
        const dateFromObj = new Date(date_from as string);
        const dateToObj = new Date(date_to as string);

        if (isNaN(dateFromObj.getTime()) || isNaN(dateToObj.getTime())) {
          return res.status(400).json({ error: 'Formato de data inválido. Use o formato correto.' });
        }

        if (dateFromObj > dateToObj) {
          return res.status(400).json({ error: 'A data inicial não pode ser maior que a data final.' });
        }

        const startOfDay = new Date(dateFromObj);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(dateToObj);
        endOfDay.setUTCHours(23, 59, 59, 999);

        query = query.andWhere('bip.event_date BETWEEN :date_from AND :date_to', {
          date_from: startOfDay,
          date_to: endOfDay
        });
      } else if (date_from) {
        const dateFromObj = new Date(date_from as string);
        if (isNaN(dateFromObj.getTime())) {
          return res.status(400).json({ error: 'Formato de data inicial inválido.' });
        }
        const startOfDay = new Date(dateFromObj);
        startOfDay.setUTCHours(0, 0, 0, 0);
        query = query.andWhere('bip.event_date >= :date_from', { date_from: startOfDay });
      } else if (date_to) {
        const dateToObj = new Date(date_to as string);
        if (isNaN(dateToObj.getTime())) {
          return res.status(400).json({ error: 'Formato de data final inválido.' });
        }
        const endOfDay = new Date(dateToObj);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query = query.andWhere('bip.event_date <= :date_to', { date_to: endOfDay });
      } else if (date) {
        // Backward compatibility: single date filter
        const filterDate = new Date(date as string);
        if (isNaN(filterDate.getTime())) {
          return res.status(400).json({ error: 'Formato de data inválido.' });
        }
        const startOfDay = new Date(filterDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(filterDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query = query.andWhere('bip.event_date BETWEEN :start AND :end', {
          start: startOfDay,
          end: endOfDay
        });
      }

      // Status filter
      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        console.log('🔍 Validando status:', {
          statusRecebido: status,
          statusArray,
          valoresValidos: Object.values(BipStatus)
        });

        const validStatuses = statusArray.filter(s => Object.values(BipStatus).includes(s as BipStatus));
        console.log('✅ Status válidos após filtro:', validStatuses);

        if (validStatuses.length === 0) {
          console.log('❌ Nenhum status válido! Retornando erro 400');
          return res.status(400).json({
            error: 'Invalid status. Valid values: pending, verified, cancelled'
          });
        }

        query = query.andWhere('bip.status IN (:...statuses)', { statuses: validStatuses });
      }

      // Notified filter
      if (notified_filter === 'notified_only') {
        query = query.andWhere('bip.notified_at IS NOT NULL');
      }

      // Not found filter (produtos que voltaram do Oracle como [NÃO ENCONTRADO])
      if (req.query.not_found_only === 'true' || req.query.not_found_only === '1') {
        query = query.andWhere('bip.product_description LIKE :notFoundPat', {
          notFoundPat: '[NÃO ENCONTRADO]%'
        });
      }

      // Combined search filter (product_id OR product_description) - case insensitive
      if (search) {
        query = query.andWhere(
          '(bip.product_id ILIKE :search OR bip.product_description ILIKE :search)',
          { search: `%${search}%` }
        );
      } else {
        // Backward compatibility: individual filters
        if (product_id) {
          query = query.andWhere('bip.product_id = :product_id', { product_id });
        }

        if (product_description) {
          query = query.andWhere('bip.product_description ILIKE :product_description', {
            product_description: `%${product_description}%`
          });
        }
      }

      // Sector filter
      if (sector_id) {
        query = query.andWhere('equipment.sector_id = :sector_id', { sector_id: parseInt(sector_id as string, 10) });
      }

      // Employee filter
      if (employee_id) {
        query = query.andWhere('bip.employee_id = :employee_id', { employee_id });
      }

      // Filtro por loja (multi-loja)
      if (codLoja) {
        query = query.andWhere('bip.cod_loja = :codLoja', { codLoja: parseInt(codLoja as string, 10) });
      }

      // Get total count
      const total = await query.getCount();

      // Apply pagination and ordering
      query = query
        .orderBy('bip.event_date', 'DESC')
        .skip(offset)
        .take(limitNumber);

      // Get bipages
      const bips = await query.getMany();

      // Fetch sell data for each bip using a single query
      const bipIds = bips.map(b => b.id);
      const sellRepository = AppDataSource.getRepository(Sell);

      const sells = await sellRepository
        .createQueryBuilder('sell')
        .select(['sell.sellDate', 'sell.numCupomFiscal', 'sell.pointOfSaleCode', 'sell.operatorCode', 'sell.operatorName', 'sell.bipId'])
        .where('sell.bipId IN (:...bipIds)', { bipIds: bipIds.length > 0 ? bipIds : [-1] })
        .getMany();

      // Create a map of bip_id -> sell data for quick lookup
      // Formata a data sem converter para UTC (mantem horario de Brasilia)
      const formatDateWithoutTimezone = (date: Date | null): string | null => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const sellsMap = new Map(
        sells.map(sell => [sell.bipId, {
          sell_date: formatDateWithoutTimezone(sell.sellDate),
          sell_num_cupom_fiscal: sell.numCupomFiscal,
          sell_point_of_sale_code: sell.pointOfSaleCode,
          sell_operator_code: sell.operatorCode,
          sell_operator_name: sell.operatorName
        }])
      );

      // Fetch suspect_identifications for each bip using a single query
      const suspectIdentifications = bipIds.length > 0
        ? await AppDataSource.query(
            `SELECT id, identification_number, bip_id, notes, created_at
             FROM suspect_identifications
             WHERE bip_id = ANY($1)`,
            [bipIds]
          )
        : [];

      // Create a map of bip_id -> suspect_identification for quick lookup
      const identificationsMap = new Map(
        suspectIdentifications.map((si: any) => [si.bip_id, {
          id: si.id,
          identification_number: si.identification_number,
          notes: si.notes,
          created_at: si.created_at
        }])
      );

      // Map results to include sell data and suspect_identification
      const bipsWithSellData = bips.map((bip) => {
        const sellData = sellsMap.get(bip.id);
        const suspectIdentification = identificationsMap.get(bip.id);
        return {
          ...bip,
          sell_date: sellData?.sell_date || null,
          sell_num_cupom_fiscal: sellData?.sell_num_cupom_fiscal || null,
          sell_point_of_sale_code: sellData?.sell_point_of_sale_code || null,
          sell_operator_code: sellData?.sell_operator_code || null,
          sell_operator_name: sellData?.sell_operator_name || null,
          suspect_identification: suspectIdentification || null
        };
      });

      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNumber);
      const hasNextPage = pageNumber < totalPages;
      const hasPreviousPage = pageNumber > 1;

      res.json({
        data: bipsWithSellData,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages,
          hasNextPage,
          hasPreviousPage
        },
        filters: {
          date: date || null,
          date_from: date_from || null,
          date_to: date_to || null,
          status: status || null,
          notified_filter: notified_filter || 'all',
          product_id: product_id || null,
          product_description: product_description || null,
          search: search || null,
          sector_id: sector_id || null,
          employee_id: employee_id || null,
          codLoja: codLoja || null
        }
      });

    } catch (error) {
      console.error('Get bips error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async cancelBip(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { motivo_cancelamento, employee_responsavel_id } = req.body;

      // Validar motivo de cancelamento
      if (!motivo_cancelamento) {
        return res.status(400).json({ error: 'Motivo de cancelamento é obrigatório' });
      }

      if (!Object.values(MotivoCancelamento).includes(motivo_cancelamento)) {
        return res.status(400).json({
          error: 'Motivo de cancelamento inválido',
          motivos_validos: Object.values(MotivoCancelamento)
        });
      }

      // Validar se funcionário responsável é obrigatório para erros de operador/balconista
      const motivosQueRequeremFuncionario = [
        MotivoCancelamento.ERRO_OPERADOR,
        MotivoCancelamento.ERRO_BALCONISTA
      ];

      if (motivosQueRequeremFuncionario.includes(motivo_cancelamento) && !employee_responsavel_id) {
        return res.status(400).json({
          error: 'Funcionário responsável é obrigatório para este motivo de cancelamento'
        });
      }

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = await bipRepository.findOne({ where: { id: parseInt(id) } });

      if (!bip) {
        return res.status(404).json({ error: 'Bipagem não encontrada' });
      }

      if (bip.status !== BipStatus.PENDING) {
        return res.status(400).json({ error: 'Somente bipagens pendentes podem ser canceladas' });
      }

      // Buscar todas as bipagens com o mesmo EAN registradas no mesmo dia
      const bipDate = new Date(bip.event_date);
      const startOfDay = new Date(bipDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(bipDate);
      endOfDay.setHours(23, 59, 59, 999);

      const relatedBips = await bipRepository.find({
        where: {
          ean: bip.ean,
          event_date: Between(startOfDay, endOfDay),
          status: BipStatus.PENDING
        }
      });

      // Cancelar todas as bipagens relacionadas
      const cancelledBips = [];
      for (const relatedBip of relatedBips) {
        relatedBip.status = BipStatus.CANCELLED;
        relatedBip.motivo_cancelamento = motivo_cancelamento;
        relatedBip.employee_responsavel_id = employee_responsavel_id || null;
        const savedBip = await bipRepository.save(relatedBip);
        cancelledBips.push(savedBip);
      }

      const logMessage = employee_responsavel_id
        ? `✅ ${cancelledBips.length} bipagens canceladas com motivo: ${motivo_cancelamento} (Responsável: ${employee_responsavel_id})`
        : `✅ ${cancelledBips.length} bipagens canceladas com motivo: ${motivo_cancelamento}`;

      console.log(logMessage);

      res.json({
        success: true,
        cancelledCount: cancelledBips.length,
        cancelledBips
      });
    } catch (error) {
      console.error('Erro ao cancelar bipagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  static async reactivateBip(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = await bipRepository.findOne({ where: { id: parseInt(id) } });

      if (!bip) {
        return res.status(404).json({ error: 'Bipagem não encontrada' });
      }

      if (bip.status !== BipStatus.CANCELLED) {
        return res.status(400).json({ error: 'Somente bipagens canceladas podem ser reativadas' });
      }

      // Buscar todas as bipagens com o mesmo EAN registradas no mesmo dia
      const startOfDay = new Date(bip.event_date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(bip.event_date);
      endOfDay.setHours(23, 59, 59, 999);

      const relatedBips = await bipRepository.find({
        where: {
          ean: bip.ean,
          event_date: Between(startOfDay, endOfDay),
          status: BipStatus.CANCELLED
        }
      });

      // Reativar todas as bipagens relacionadas
      const sellRepository = AppDataSource.getRepository(Sell);
      const reactivatedBips = [];

      for (const relatedBip of relatedBips) {
        // Verificar se existe venda vinculada a esta bipagem
        const linkedSell = await sellRepository.findOne({
          where: { bipId: relatedBip.id }
        });

        // Se tiver venda vinculada, bipagem vai para 'verified'
        // Se não tiver venda, bipagem vai para 'pending'
        relatedBip.status = linkedSell ? BipStatus.VERIFIED : BipStatus.PENDING;

        const savedBip = await bipRepository.save(relatedBip);
        reactivatedBips.push(savedBip);
      }

      res.json({
        success: true,
        reactivatedCount: reactivatedBips.length,
        reactivatedBips
      });
    } catch (error) {
      console.error('Erro ao reativar bipagem:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Buscar funcionários que têm bipagens registradas
  static async getEmployeesWithBips(req: AuthRequest, res: Response) {
    try {
      const bipRepository = AppDataSource.getRepository(Bip);

      // Query para buscar funcionários únicos que têm bipagens
      const employeesWithBips = await bipRepository
        .createQueryBuilder('bip')
        .leftJoinAndSelect('bip.employee', 'employee')
        .where('bip.employee_id IS NOT NULL')
        .andWhere('employee.active = :active', { active: true })
        .select([
          'DISTINCT employee.id as id',
          'employee.name as name',
          'employee.avatar as avatar'
        ])
        .groupBy('employee.id, employee.name, employee.avatar')
        .orderBy('employee.name', 'ASC')
        .getRawMany();

      res.json(employeesWithBips);
    } catch (error) {
      console.error('Erro ao buscar funcionários com bipagens:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Upload de vídeo para uma bipagem
  static async uploadVideo(req: AuthRequest, res: Response) {
    try {
      const bipId = parseInt(req.params.id);
      const file = req.file;

      console.log(`🎥 [BIP ${bipId}] Requisição de upload de vídeo recebida`);
      console.log(`🎥 [BIP ${bipId}] Arquivo: ${file ? `${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB, ${file.mimetype})` : 'NENHUM'}`);

      if (!file) {
        console.error(`❌ [BIP ${bipId}] Nenhum arquivo foi enviado`);
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = await bipRepository.findOne({ where: { id: bipId } });

      if (!bip) {
        console.error(`❌ [BIP ${bipId}] Bipagem não encontrada no banco de dados`);
        return res.status(404).json({ error: 'Bipagem não encontrada' });
      }

      console.log(`✅ [BIP ${bipId}] Bipagem encontrada, iniciando processo de upload`);

      // Se já existe um vídeo, deletar o antigo do MinIO
      if (bip.video_url) {
        console.log(`🗑️ [BIP ${bipId}] Deletando vídeo antigo: ${bip.video_url}`);
        try {
          await uploadService.deleteFile(bip.video_url);
          console.log(`✅ [BIP ${bipId}] Vídeo antigo deletado com sucesso`);
        } catch (deleteError) {
          console.error(`⚠️ [BIP ${bipId}] Erro ao deletar vídeo antigo (continuando):`, deleteError);
        }
      }

      // Upload do novo vídeo para o MinIO
      console.log(`☁️ [BIP ${bipId}] Enviando vídeo para MinIO...`);

      try {
        const videoUrl = await uploadService.uploadVideo(file, bipId);
        console.log(`✅ [BIP ${bipId}] Vídeo enviado para MinIO com sucesso`);
        console.log(`🔗 [BIP ${bipId}] URL gerada: ${videoUrl}`);

        // Atualizar com novo vídeo (URL completa do MinIO)
        bip.video_url = videoUrl;
        await bipRepository.save(bip);
        console.log(`💾 [BIP ${bipId}] URL salva no banco de dados`);

        res.json({
          success: true,
          videoUrl: videoUrl,
          message: 'Vídeo enviado com sucesso'
        });
      } catch (uploadError) {
        console.error(`❌ [BIP ${bipId}] Erro no upload para MinIO:`, uploadError);
        return res.status(503).json({
          error: 'Serviço de armazenamento de vídeos indisponível',
          details: 'O MinIO não está configurado ou não está acessível. Configure o MinIO para habilitar upload de vídeos.'
        });
      }
    } catch (error) {
      console.error(`❌ [BIP ${req.params.id}] Erro ao processar upload de vídeo:`, error);
      console.error(`❌ [BIP ${req.params.id}] Stack trace:`, error instanceof Error ? error.stack : 'N/A');
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Deletar vídeo de uma bipagem
  static async deleteVideo(req: AuthRequest, res: Response) {
    try {
      const bipId = parseInt(req.params.id);

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = await bipRepository.findOne({ where: { id: bipId } });

      if (!bip) {
        return res.status(404).json({ error: 'Bipagem não encontrada' });
      }

      if (!bip.video_url) {
        return res.status(400).json({ error: 'Esta bipagem não possui vídeo' });
      }

      // Tentar deletar arquivo do MinIO (se falhar, apenas log o erro)
      try {
        await uploadService.deleteFile(bip.video_url);
        console.log(`✅ Arquivo deletado do MinIO: ${bip.video_url}`);
      } catch (deleteError) {
        console.warn(`⚠️ Falha ao deletar arquivo do MinIO (continuando):`, deleteError);
      }

      // Remover URL do banco
      bip.video_url = null;
      await bipRepository.save(bip);

      console.log(`🗑️ Vídeo removido da bipagem ${bipId}`);

      res.json({
        success: true,
        message: 'Vídeo deletado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar vídeo:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Upload de imagem para uma bipagem
  static async uploadImage(req: AuthRequest, res: Response) {
    try {
      const bipId = parseInt(req.params.id);
      const file = req.file;

      console.log(`📸 [BIP ${bipId}] Requisição de upload de imagem recebida`);
      console.log(`📸 [BIP ${bipId}] Arquivo: ${file ? `${file.originalname} (${(file.size / 1024).toFixed(2)} KB, ${file.mimetype})` : 'NENHUM'}`);

      if (!file) {
        console.error(`❌ [BIP ${bipId}] Nenhum arquivo foi enviado`);
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = await bipRepository.findOne({ where: { id: bipId } });

      if (!bip) {
        console.error(`❌ [BIP ${bipId}] Bipagem não encontrada no banco de dados`);
        return res.status(404).json({ error: 'Bipagem não encontrada' });
      }

      console.log(`✅ [BIP ${bipId}] Bipagem encontrada, iniciando processo de upload`);

      // Se já existe uma imagem, deletar a antiga do MinIO
      if (bip.image_url) {
        console.log(`🗑️ [BIP ${bipId}] Deletando imagem antiga: ${bip.image_url}`);
        try {
          await uploadService.deleteFile(bip.image_url);
          console.log(`✅ [BIP ${bipId}] Imagem antiga deletada com sucesso`);
        } catch (deleteError) {
          console.error(`⚠️ [BIP ${bipId}] Erro ao deletar imagem antiga (continuando):`, deleteError);
        }
      }

      // Upload da nova imagem para o MinIO
      console.log(`☁️ [BIP ${bipId}] Enviando imagem para MinIO...`);

      try {
        const imageUrl = await uploadService.uploadImage(file, bipId);
        console.log(`✅ [BIP ${bipId}] Imagem enviada para MinIO com sucesso`);
        console.log(`🔗 [BIP ${bipId}] URL gerada: ${imageUrl}`);

        // Atualizar com nova imagem (URL completa do MinIO)
        bip.image_url = imageUrl;
        await bipRepository.save(bip);
        console.log(`💾 [BIP ${bipId}] URL salva no banco de dados`);

        res.json({
          success: true,
          imageUrl: imageUrl,
          message: 'Imagem enviada com sucesso'
        });
      } catch (uploadError) {
        console.error(`❌ [BIP ${bipId}] Erro no upload para MinIO:`, uploadError);
        return res.status(503).json({
          error: 'Serviço de armazenamento de imagens indisponível',
          details: 'O MinIO não está configurado ou não está acessível. Configure o MinIO para habilitar upload de imagens.'
        });
      }
    } catch (error) {
      console.error(`❌ [BIP ${req.params.id}] Erro ao processar upload de imagem:`, error);
      console.error(`❌ [BIP ${req.params.id}] Stack trace:`, error instanceof Error ? error.stack : 'N/A');
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Deletar imagem de uma bipagem
  static async deleteImage(req: AuthRequest, res: Response) {
    try {
      const bipId = parseInt(req.params.id);

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = await bipRepository.findOne({ where: { id: bipId } });

      if (!bip) {
        return res.status(404).json({ error: 'Bipagem não encontrada' });
      }

      if (!bip.image_url) {
        return res.status(400).json({ error: 'Esta bipagem não possui imagem' });
      }

      // Tentar deletar arquivo do MinIO (se falhar, apenas log o erro)
      try {
        await uploadService.deleteFile(bip.image_url);
        console.log(`✅ Arquivo deletado do MinIO: ${bip.image_url}`);
      } catch (deleteError) {
        console.warn(`⚠️ Falha ao deletar arquivo do MinIO (continuando):`, deleteError);
      }

      // Remover URL do banco
      bip.image_url = null;
      await bipRepository.save(bip);

      console.log(`🗑️ Imagem removida da bipagem ${bipId}`);

      res.json({
        success: true,
        message: 'Imagem deletada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar imagem:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Atualizar motivo de cancelamento de uma bipagem já cancelada
   */
  static async updateMotivoCancelamento(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { motivo_cancelamento, employee_responsavel_id } = req.body;

      // Validar motivo de cancelamento
      if (!motivo_cancelamento) {
        return res.status(400).json({ error: 'Motivo de cancelamento é obrigatório' });
      }

      if (!Object.values(MotivoCancelamento).includes(motivo_cancelamento)) {
        return res.status(400).json({
          error: 'Motivo de cancelamento inválido',
          motivos_validos: Object.values(MotivoCancelamento)
        });
      }

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = await bipRepository.findOne({ where: { id: parseInt(id) } });

      if (!bip) {
        return res.status(404).json({ error: 'Bipagem não encontrada' });
      }

      if (bip.status !== BipStatus.CANCELLED) {
        return res.status(400).json({ error: 'Somente bipagens canceladas podem ter o motivo atualizado' });
      }

      // Validar se funcionário responsável é obrigatório para erros de operador/balconista
      const motivosQueRequeremFuncionario = [
        MotivoCancelamento.ERRO_OPERADOR,
        MotivoCancelamento.ERRO_BALCONISTA
      ];

      if (motivosQueRequeremFuncionario.includes(motivo_cancelamento) && !employee_responsavel_id) {
        return res.status(400).json({
          error: 'Funcionário responsável é obrigatório para este motivo de cancelamento'
        });
      }

      // Atualizar o motivo de cancelamento
      bip.motivo_cancelamento = motivo_cancelamento;
      bip.employee_responsavel_id = employee_responsavel_id || null;
      const updatedBip = await bipRepository.save(bip);

      console.log(`✅ Motivo de cancelamento atualizado para bipagem ${id}: ${motivo_cancelamento}`);

      res.json({
        success: true,
        bip: updatedBip
      });
    } catch (error) {
      console.error('Erro ao atualizar motivo de cancelamento:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  /**
   * Enviar PDF de bipagens pendentes (teste manual)
   */
  static async sendPendingBipsReport(req: AuthRequest, res: Response) {
    try {
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({ error: 'Data é obrigatória (formato YYYY-MM-DD)' });
      }

      // Validar formato da data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD' });
      }

      console.log(`📊 Teste manual: Buscando bipagens pendentes para ${date}`);

      // Buscar bipagens pendentes do dia
      const bipRepository = AppDataSource.getRepository(Bip);
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const pendingBips = await bipRepository.find({
        where: {
          status: BipStatus.PENDING,
          notified_at: IsNull(),
          event_date: Between(startOfDay, endOfDay)
        },
        relations: ['equipment', 'equipment.sector', 'employee'],
        order: {
          event_date: 'ASC'
        }
      });

      console.log(`📱 Encontradas ${pendingBips.length} bipagens pendentes`);

      if (pendingBips.length === 0) {
        return res.json({
          success: false,
          message: `Nenhuma bipagem pendente encontrada para ${date}`
        });
      }

      // Enviar PDF via WhatsApp
      const { WhatsAppService } = await import('../services/whatsapp.service');
      const pdfSent = await WhatsAppService.sendPendingBipsPDF(pendingBips, date);

      if (pdfSent) {
        // NÃO marcar como notificadas no teste manual
        console.log(`✅ PDF de teste enviado com sucesso (${pendingBips.length} bipagens)`);
        return res.json({
          success: true,
          message: `PDF enviado com ${pendingBips.length} bipagens pendentes`,
          bipsCount: pendingBips.length
        });
      } else {
        console.error(`❌ Falha ao enviar PDF de teste`);
        return res.status(500).json({
          success: false,
          error: 'Falha ao enviar PDF para WhatsApp'
        });
      }
    } catch (error) {
      console.error('Erro ao enviar relatório de bipagens pendentes:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
}