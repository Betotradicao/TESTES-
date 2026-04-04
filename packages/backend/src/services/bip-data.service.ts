import { AppDataSource } from '../config/database';
import { Bip } from '../entities/Bip';
import { SalesService } from './sales.service';
import { SaleData } from '../types/verification.types';

export class BipDataService {
  /**
   * Busca vendas para uma data específica
   * Reutiliza a lógica existente do SalesService
   */
  static async fetchSalesForDate(date: string): Promise<SaleData[]> {
    try {
      const formattedDate = SalesService.formatDateToERP(date);

      const sales = await SalesService.fetchSalesFromERP(formattedDate, formattedDate);

      // Garantir que codLoja está presente no SaleData para matching por loja
      return sales.map(s => ({
        ...s,
        codLoja: (s as any).codLoja || undefined,
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar vendas:', error);
      throw error;
    }
  }

  /**
   * Busca bipagens pendentes com notified_at nulo para uma data específica
   */
  static async fetchPendingBipagesForDate(date: string): Promise<Bip[]> {
    try {
      console.log(`🔍 Buscando bipagens pendentes para ${date}...`);

      const bipRepository = AppDataSource.getRepository(Bip);

      const bips = await bipRepository
        .createQueryBuilder('bip')
        .where('DATE(bip.event_date) = :date', { date })
        .andWhere('bip.status = :status', { status: 'pending' })
        .andWhere('bip.notified_at IS NULL')
        .getMany();

      console.log(`✅ Encontradas ${bips.length} bipagens pendentes`);
      return bips;
    } catch (error) {
      console.error('❌ Erro ao buscar bipagens:', error);
      throw error;
    }
  }

  /**
   * Busca TODAS as bipagens de uma data específica (para matching com vendas)
   */
  static async fetchAllBipagesForDate(date: string): Promise<Bip[]> {
    try {
      const bipRepository = AppDataSource.getRepository(Bip);

      const bips = await bipRepository
        .createQueryBuilder('bip')
        .where('DATE(bip.event_date) = :date', { date })
        .getMany();

      return bips;
    } catch (error) {
      console.error('❌ Erro ao buscar bipagens:', error);
      throw error;
    }
  }

}