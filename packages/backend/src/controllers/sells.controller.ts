import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { Sell } from '../entities/Sell';
import { ILike, Like, Between } from 'typeorm';

export class SellsController {
  static async getSells(req: AuthRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 20,
        date_from,
        date_to,
        status,
        product,
        sector_id,
        employee_id
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
      const skip = (pageNum - 1) * limitNum;

      // Validate required date filters
      if (!date_from || !date_to) {
        return res.status(400).json({
          error: 'As datas inicial e final são obrigatórias.'
        });
      }

      const sellRepository = AppDataSource.getRepository(Sell);

      // Build query with joins
      let query = sellRepository
        .createQueryBuilder('sell')
        .leftJoinAndSelect('sell.activatedProduct', 'activatedProduct')
        .leftJoinAndSelect('sell.bip', 'bip')
        .leftJoinAndSelect('bip.equipment', 'equipment')
        .leftJoinAndSelect('equipment.sector', 'sector')
        .leftJoinAndSelect('bip.employee', 'employee')
        .leftJoinAndSelect('employee.sector', 'employeeSector');

      // Date filter with range support
      if (date_from && date_to) {
        // Parse dates in Brazil timezone (UTC-3)
        // Input format: YYYY-MM-DD
        const dateFromStr = date_from as string;
        const dateToStr = date_to as string;

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(dateToStr)) {
          return res.status(400).json({ error: 'Formato de data inválido. Use o formato YYYY-MM-DD.' });
        }

        // Create dates in Brazil timezone by parsing the string with timezone offset
        // This ensures 2025-12-10 means 2025-12-10 00:00:00 in São Paulo time, not UTC
        const startOfDay = new Date(`${dateFromStr}T00:00:00-03:00`);
        const endOfDay = new Date(`${dateToStr}T23:59:59.999-03:00`);

        if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
          return res.status(400).json({ error: 'Formato de data inválido. Use o formato YYYY-MM-DD.' });
        }

        if (startOfDay > endOfDay) {
          return res.status(400).json({ error: 'A data inicial não pode ser maior que a data final.' });
        }

        query = query.andWhere('sell.sellDate BETWEEN :date_from AND :date_to', {
          date_from: startOfDay,
          date_to: endOfDay
        });
      }

      // Filter by status
      if (status && ['verified', 'not_verified', 'cancelled'].includes(status as string)) {
        query = query.andWhere('sell.status = :status', { status });
      }

      // Filter by product - search in both product_id and product_description
      if (product) {
        const productSearch = String(product);
        query = query.andWhere(
          '(sell.productId LIKE :productSearch OR sell.productDescription ILIKE :productSearch)',
          { productSearch: `%${productSearch}%` }
        );
      }

      // Filter by sector
      if (sector_id) {
        query = query.andWhere('equipment.sector_id = :sector_id', { sector_id: parseInt(sector_id as string) });
      }

      // Filter by employee
      if (employee_id) {
        query = query.andWhere('bip.employee_id = :employee_id', { employee_id });
      }

      // Get total count
      const total = await query.getCount();

      // Calculate metrics for ALL filtered results (not just paginated)
      const allFilteredSells = await query.getMany();

      // Helper function to get price (with discount if available)
      const getPrice = (sell: Sell) => {
        const finalPrice = sell.sellValueCents - sell.discountCents;
        return finalPrice || sell.sellValueCents || 0;
      };

      // Calculate metrics using ALL filtered sells
      const totalAll = allFilteredSells.reduce((sum, sell) => sum + getPrice(sell), 0);
      const totalVerified = allFilteredSells
        .filter(sell => sell.status === 'verified')
        .reduce((sum, sell) => sum + getPrice(sell), 0);
      const totalNotVerified = allFilteredSells
        .filter(sell => sell.status !== 'verified') // pending + cancelled
        .reduce((sum, sell) => sum + getPrice(sell), 0);

      const countAll = allFilteredSells.length;
      const countVerified = allFilteredSells.filter(sell => sell.status === 'verified').length;
      const countNotVerified = allFilteredSells.filter(sell => sell.status !== 'verified').length;

      // Get paginated results
      const sells = await query
        .orderBy('sell.createdAt', 'DESC')
        .skip(skip)
        .take(limitNum)
        .getMany();

      // Format response data
      const formattedSells = sells.map(sell => ({
        id: sell.id,
        activated_product_id: sell.activatedProductId,
        product_id: sell.productId,
        product_description: sell.productDescription,
        sell_date: sell.sellDate,
        sell_value: sell.sellValue,
        sell_value_cents: sell.sellValueCents,
        discount_cents: sell.discountCents,
        discount_value: sell.discountValue,
        final_value_cents: sell.sellValueCents - sell.discountCents,
        final_value: sell.finalValue,
        product_weight: Number(sell.productWeight),
        bip_id: sell.bipId,
        bip_ean: sell.bip?.ean || null,
        num_cupom_fiscal: sell.numCupomFiscal,
        status: sell.status,
        status_description: sell.statusDescription,
        created_at: sell.createdAt,
        updated_at: sell.updatedAt,
        activated_product: sell.activatedProduct ? {
          id: sell.activatedProduct.id,
          erp_product_id: sell.activatedProduct.erp_product_id,
          description: sell.activatedProduct.description
        } : null,
        equipment: sell.bip?.equipment ? {
          id: sell.bip.equipment.id,
          scanner_machine_id: sell.bip.equipment.scanner_machine_id,
          sector: sell.bip.equipment.sector ? {
            id: sell.bip.equipment.sector.id,
            name: sell.bip.equipment.sector.name,
            color: sell.bip.equipment.sector.color_hash
          } : null
        } : null,
        bip: sell.bip ? {
          id: sell.bip.id,
          ean: sell.bip.ean,
          employee: sell.bip.employee ? {
            id: sell.bip.employee.id,
            name: sell.bip.employee.name,
            username: sell.bip.employee.username,
            avatar: sell.bip.employee.avatar,
            sector: sell.bip.employee.sector ? {
              id: sell.bip.employee.sector.id,
              name: sell.bip.employee.sector.name,
              color_hash: sell.bip.employee.sector.color_hash
            } : null
          } : null
        } : null
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({
        data: formattedSells,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          date_from: date_from || null,
          date_to: date_to || null,
          status: status || null,
          product: product || null,
          sector_id: sector_id || null,
          employee_id: employee_id || null
        },
        metrics: {
          total_value_cents: totalAll,
          total_verified_cents: totalVerified,
          total_not_verified_cents: totalNotVerified,
          count_all: countAll,
          count_verified: countVerified,
          count_not_verified: countNotVerified
        },
        summary: {
          total_sells: total,
          verified_count: countVerified,
          not_verified_count: countNotVerified,
          cancelled_count: sells.filter(sell => sell.status === 'cancelled').length
        }
      });

    } catch (error) {
      console.error('Get sells error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}