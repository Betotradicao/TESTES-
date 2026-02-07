import { AppDataSource } from '../config/database';
import { BipDataService } from './bip-data.service';
import { Bip } from '../entities/Bip';
import { SaleData } from '../types/verification.types';
import { BipVerificationService } from './bip-verification.service';

interface SyncStats {
  date: string;
  totalSales: number;
  totalBipages: number;
  verifiedCount: number;
  notVerifiedCount: number;
  cancelledCount: number;
  executionTimeMs: number;
}

/**
 * SellsSyncService - Sincroniza vendas do Oracle com bipagens
 *
 * Roda a cada 1 minuto dentro do backend (substitui o container cron separado).
 * Busca vendas do Oracle, cruza com bipagens e insere na tabela sells.
 */
export class SellsSyncService {
  private static isRunning = false;
  private static lastStats: SyncStats | null = null;

  /**
   * Retorna estatísticas da última execução
   */
  static getLastStats(): SyncStats | null {
    return this.lastStats;
  }

  /**
   * Executa o sync de vendas para a data atual (horário do Brasil)
   * Seguro para rodar via cron - nunca dá process.exit
   */
  static async syncToday(): Promise<void> {
    // Evita execução paralela
    if (this.isRunning) {
      console.log('[SellsSync] Já está em execução, pulando...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Data atual no horário do Brasil
      const brDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const year = brDate.getFullYear();
      const month = String(brDate.getMonth() + 1).padStart(2, '0');
      const day = String(brDate.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;

      console.log(`[SellsSync] Iniciando sync para ${date}...`);

      await this.syncForDate(date);

      const executionTimeMs = Date.now() - startTime;
      console.log(`[SellsSync] Sync concluído em ${Math.round(executionTimeMs / 1000)}s`);

    } catch (error) {
      console.error('[SellsSync] Erro no sync:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sincroniza vendas para uma data específica
   */
  static async syncForDate(date: string): Promise<SyncStats> {
    const startTime = Date.now();
    const stats: SyncStats = {
      date,
      totalSales: 0,
      totalBipages: 0,
      verifiedCount: 0,
      notVerifiedCount: 0,
      cancelledCount: 0,
      executionTimeMs: 0
    };

    try {
      // 1. Buscar vendas do Oracle
      const sales = await BipDataService.fetchSalesForDate(date);
      stats.totalSales = sales.length;

      if (sales.length === 0) {
        console.log('[SellsSync] Nenhuma venda encontrada no Oracle');
        stats.executionTimeMs = Date.now() - startTime;
        this.lastStats = stats;
        return stats;
      }

      // 2. Buscar bipagens do dia
      const bipages = await BipDataService.fetchAllBipagesForDate(date);
      stats.totalBipages = bipages.length;

      // 3. Buscar produtos ativos
      const activeProducts = await AppDataSource.query(`
        SELECT DISTINCT erp_product_id, id
        FROM products
        WHERE active = true
      `);

      const activeProductMap = new Map();
      activeProducts.forEach((product: any) => {
        activeProductMap.set(product.erp_product_id, product.id);
        const normalizedCode = String(parseInt(product.erp_product_id, 10));
        activeProductMap.set(normalizedCode, product.id);
      });

      // 4. Mapear bipagens por produto
      const bipagesMap = new Map<string, Bip[]>();
      bipages.forEach((bip: Bip) => {
        const normalizedProductId = String(parseInt(bip.product_id, 10));
        if (!bipagesMap.has(normalizedProductId)) {
          bipagesMap.set(normalizedProductId, []);
        }
        bipagesMap.get(normalizedProductId)!.push(bip);
      });

      // Set de produtos com bipagem
      const productsWithBipages = new Set<string>();
      bipages.forEach((bip: Bip) => {
        const normalizedProductId = String(parseInt(bip.product_id, 10));
        productsWithBipages.add(normalizedProductId);
        productsWithBipages.add(bip.product_id);
      });

      // 5. Filtrar vendas: só produtos ativos ou com bipagem
      const salesToProcess = activeProducts.length === 0
        ? sales
        : sales.filter((sale: SaleData) => {
            const normalizedCode = String(parseInt(sale.codProduto, 10));
            const isActiveProduct = activeProductMap.has(sale.codProduto) || activeProductMap.has(normalizedCode);
            const hasBipage = productsWithBipages.has(sale.codProduto) || productsWithBipages.has(normalizedCode);
            return isActiveProduct || hasBipage;
          });

      console.log(`[SellsSync] ${salesToProcess.length} vendas a processar (${sales.length} total, ${activeProducts.length} produtos ativos)`);

      // 6. Processar vendas e fazer matching com bipagens
      await this.processSales(salesToProcess, bipagesMap, activeProductMap, date, stats);

      // 7. Processar bipagens pendentes (verificar status)
      await this.processBipages(bipages, sales);

      stats.executionTimeMs = Date.now() - startTime;
      this.lastStats = stats;

      console.log(`[SellsSync] Resultado: ${stats.verifiedCount} verificadas, ${stats.notVerifiedCount} não verificadas, ${stats.cancelledCount} canceladas`);

      return stats;

    } catch (error) {
      stats.executionTimeMs = Date.now() - startTime;
      this.lastStats = stats;
      throw error;
    }
  }

  /**
   * Processa vendas: faz matching com bipagens e salva em sells
   */
  private static async processSales(
    activeSales: SaleData[],
    bipagesMap: Map<string, Bip[]>,
    activeProductMap: Map<string, number>,
    date: string,
    stats: SyncStats
  ): Promise<void> {
    const sellsToInsert: any[] = [];
    const positiveSalesMap = new Map();

    for (const sale of activeSales) {
      const activatedProductId = activeProductMap.get(sale.codProduto);
      const saleValueCents = Math.round(sale.valTotalProduto * 100);
      const normalizedProductCode = String(parseInt(sale.codProduto, 10));

      const isCancellation = saleValueCents < 0;

      let matchedBip: Bip | null = null;
      let status = 'not_verified';

      if (isCancellation) {
        const positiveValueCents = Math.abs(saleValueCents);
        const positiveWeight = Math.abs(sale.qtdTotalProduto);
        const saleKey = `${sale.codProduto}_${positiveValueCents}_${positiveWeight}`;

        const originalSale = positiveSalesMap.get(saleKey);
        if (originalSale && originalSale.bip_id) {
          matchedBip = { id: originalSale.bip_id } as Bip;
          status = 'cancelled';
        } else {
          status = 'cancelled';
        }

        stats.cancelledCount++;
      } else {
        const productBipages = bipagesMap.get(normalizedProductCode) || [];
        const PRICE_TOLERANCE_CENTS = 3;

        for (const bip of productBipages) {
          const priceDifference = Math.abs(bip.bip_price_cents - saleValueCents);
          if (priceDifference <= PRICE_TOLERANCE_CENTS) {
            matchedBip = bip;
            break;
          }
        }

        status = matchedBip ? 'verified' : 'not_verified';

        if (matchedBip) {
          stats.verifiedCount++;
        } else {
          stats.notVerifiedCount++;
        }

        const saleKey = `${sale.codProduto}_${saleValueCents}_${sale.qtdTotalProduto}`;
        positiveSalesMap.set(saleKey, {
          cupom_fiscal: sale.numCupomFiscal,
          bip_id: matchedBip ? matchedBip.id : null
        });
      }

      const sellDate = sale.dataHoraVenda
        ? sale.dataHoraVenda
        : `${date} 00:00:00`;

      const sellRecord = {
        activated_product_id: activatedProductId,
        product_id: sale.codProduto,
        product_description: sale.desProduto,
        sell_date: sellDate,
        sell_value_cents: saleValueCents,
        product_weight: sale.qtdTotalProduto,
        bip_id: matchedBip ? matchedBip.id : null,
        num_cupom_fiscal: sale.numCupomFiscal,
        point_of_sale_code: sale.codCaixa || null,
        operator_code: (sale as any).codOperador || null,
        operator_name: (sale as any).desOperador || null,
        status: status,
        discount_cents: sale.descontoAplicado ? Math.round(sale.descontoAplicado * 100) : 0
      };

      sellsToInsert.push(sellRecord);
    }

    if (sellsToInsert.length > 0) {
      // Deduplicar por (product_id, product_weight, num_cupom_fiscal)
      const uniqueSells = new Map<string, any>();
      for (const record of sellsToInsert) {
        const key = `${record.product_id}_${record.product_weight}_${record.num_cupom_fiscal}`;
        if (!uniqueSells.has(key) || (record.bip_id && !uniqueSells.get(key)?.bip_id)) {
          uniqueSells.set(key, record);
        }
      }
      const dedupedSells = Array.from(uniqueSells.values());

      const values = dedupedSells.map(record =>
        `(${record.activated_product_id || 'NULL'}, '${record.product_id}', '${record.product_description.replace(/'/g, "''")}', '${record.sell_date}', ${record.sell_value_cents}, ${record.product_weight}, ${record.bip_id || 'NULL'}, '${record.num_cupom_fiscal}', ${record.point_of_sale_code || 'NULL'}, ${record.operator_code || 'NULL'}, ${record.operator_name ? `'${record.operator_name.replace(/'/g, "''")}'` : 'NULL'}, '${record.status}', ${record.discount_cents})`
      ).join(',');

      await AppDataSource.query(`
          INSERT INTO sells (activated_product_id, product_id, product_description, sell_date, sell_value_cents, product_weight, bip_id, num_cupom_fiscal, point_of_sale_code, operator_code, operator_name, status, discount_cents)
          VALUES ${values}
          ON CONFLICT (product_id, product_weight, num_cupom_fiscal) DO UPDATE SET
            operator_code = COALESCE(EXCLUDED.operator_code, sells.operator_code),
            operator_name = COALESCE(EXCLUDED.operator_name, sells.operator_name),
            point_of_sale_code = COALESCE(EXCLUDED.point_of_sale_code, sells.point_of_sale_code),
            bip_id = COALESCE(EXCLUDED.bip_id, sells.bip_id),
            status = CASE WHEN EXCLUDED.bip_id IS NOT NULL THEN 'verified' ELSE sells.status END
        `);
    }

    // Cancelar bipagens de vendas canceladas
    const cancelledSalesWithBips = sellsToInsert.filter(s => s.status === 'cancelled' && s.bip_id);
    if (cancelledSalesWithBips.length > 0) {
      const bipIdsToCancel = cancelledSalesWithBips.map(s => s.bip_id);
      await AppDataSource.query(`
          UPDATE bips
          SET status = 'cancelled'
          WHERE id = ANY($1::int[])
        `, [bipIdsToCancel]);
    }
  }

  /**
   * Processa bipagens: verifica pendentes contra vendas
   */
  private static async processBipages(allBipages: Bip[], sales: SaleData[]): Promise<void> {
    const pendingBipages = allBipages.filter(
      bip => bip.status === 'pending' && bip.notified_at === null
    );

    if (pendingBipages.length === 0) return;

    const verificationResult = BipVerificationService.processVerificationAndNotification(
      pendingBipages,
      sales
    );

    if (verificationResult.to_verify.length > 0) {
      await BipVerificationService.processVerifications(verificationResult.to_verify);
    }
  }
}
