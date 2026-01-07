import { AppDataSource } from '../config/database';
import { BipDataService } from '../services/bip-data.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { Bip } from '../entities/Bip';
import { CacheService } from '../services/cache.service';
import { BipVerificationService } from '../services/bip-verification.service';
import { SaleData } from '../types/verification.types';

interface CommandArgs {
  notify: boolean;
  date: string;
  runYesterday: boolean;
}

interface ProcessingStats {
  date: string;
  totalSales: number;

  totalBipages: number;
  bipsPending: number;
  bipsToVerify: number;
  bipsToNotify: number;
  endTimeBips?: Date;
  executionTimeBips?: string;
  notifyBips: boolean;

  verifiedCount: number;
  notVerifiedCount: number;
  cancelledCount: number;
  notifiedCount: number;
  endTimeSells?: Date;
  executionTimeSells?: string;

  startTime: Date;
  endTime?: Date;
  executionTime?: string;
}

/**
 * Comando unificado de verificação diária
 *
 * Combina validação de vendas + verificação de bipagens + notificações
 * em um único fluxo otimizado
 */
export class DailyVerificationCommand {
  static async execute(args: string[]): Promise<void> {
    const stats: ProcessingStats = {
      date: '',

      totalBipages: 0,
      bipsPending: 0,
      bipsToVerify: 0,
      bipsToNotify: 0,
      notifyBips: false,

      totalSales: 0,
      verifiedCount: 0,
      notVerifiedCount: 0,
      cancelledCount: 0,
      notifiedCount: 0,
      startTime: new Date()
    };

    try {
      console.log('🚀 Iniciando verificação diária unificada...\n');

      const parsedArgs = this.parseArguments(args);

      stats.notifyBips = parsedArgs.notify;

      this.validateArguments(parsedArgs);

      stats.date = parsedArgs.date;

      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      const sales = await BipDataService.fetchSalesForDate(parsedArgs.date);
      stats.totalSales = sales.length;

      if (sales.length === 0) {
        this.printFinalReport(stats);
        return;
      }

      // Buscar TODAS as bipagens do dia (para matching com vendas)
      const bipages = await BipDataService.fetchAllBipagesForDate(parsedArgs.date!);

      stats.totalBipages = bipages.length;

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

      // BUGFIX: Se NÃO houver produtos ativos, processar TODAS as vendas
      // Se houver produtos ativos, processar APENAS as vendas de produtos ativos
      const activeSales = activeProducts.length === 0
        ? sales
        : sales.filter(sale => activeProductMap.has(sale.codProduto));

      const bipagesMap = new Map<string, Bip[]>();

      bipages.forEach((bip: Bip) => {
        const normalizedProductId = String(parseInt(bip.product_id, 10));
        if (!bipagesMap.has(normalizedProductId)) {
          bipagesMap.set(normalizedProductId, []);
        }
        bipagesMap.get(normalizedProductId)!.push(bip);
      });

      // FASE 3: PROCESSAR VENDAS
      await this.processSales(activeSales, bipagesMap, activeProductMap, parsedArgs.date, stats);

      // FASE 4: PROCESSAR BIPAGENS
      await this.processBipages(bipages, sales, parsedArgs.notify, stats);

      stats.endTime = new Date();

      this.printFinalReport(stats);

    } catch (error) {
      console.error('❌ Erro na execução:', error);
      stats.endTime = new Date();
      this.printFinalReport(stats);
      process.exit(1);
    }
  }

  /**
   * Processa bipagens: identifica as que não tiveram venda e notifica (se notify=true)
   */
  private static async processBipages(
    allBipages: Bip[],
    sales: SaleData[],
    notify: boolean,
    stats: ProcessingStats
  ): Promise<void> {
    const pendingBipages = allBipages.filter(
      bip => bip.status === 'pending' && bip.notified_at === null
    );

    const verificationResult = BipVerificationService.processVerificationAndNotification(
      pendingBipages,
      sales
    );

    stats.bipsPending = pendingBipages.length;
    stats.bipsToVerify = verificationResult.to_verify.length;
    stats.bipsToNotify = verificationResult.to_notify.length;

    if (verificationResult.to_verify.length > 0) {
      await BipVerificationService.processVerifications(verificationResult.to_verify);
    }

    if (notify && verificationResult.to_notify.length > 0) {
      // Ao invés de enviar mensagens individuais, enviar um PDF consolidado
      console.log(`📄 Enviando PDF com ${verificationResult.to_notify.length} bipagens pendentes...`);
      const pdfSent = await WhatsAppService.sendPendingBipsPDF(verificationResult.to_notify, stats.date);

      if (pdfSent) {
        console.log(`✅ PDF de bipagens pendentes enviado com sucesso`);
        // Marcar todas as bipagens como notificadas
        await BipVerificationService.processNotifications(verificationResult.to_notify);
        stats.notifiedCount = verificationResult.to_notify.length;
      } else {
        console.error(`❌ Falha ao enviar PDF de bipagens pendentes`);
        stats.notifiedCount = 0;
      }
    }

    stats.endTimeBips = new Date();
  }


  /**
   * Processa vendas: faz matching com bipagens e salva em sells
   */
  private static async processSales(
    activeSales: any[],
    bipagesMap: Map<string, Bip[]>,
    activeProductMap: Map<string, number>,
    date: string,
    stats: ProcessingStats
  ): Promise<void> {
    const sellsToInsert = [];
    const positiveSalesMap = new Map();

    for (const sale of activeSales) {
      const activatedProductId = activeProductMap.get(sale.codProduto);
      const saleValueCents = Math.round(sale.valTotalProduto * 100);
      const normalizedProductCode = String(parseInt(sale.codProduto, 10));

      const isCancellation = saleValueCents < 0;

      let matchedBip = null;
      let status = 'not_verified';

      if (isCancellation) {
        const positiveValueCents = Math.abs(saleValueCents);
        const positiveWeight = Math.abs(sale.qtdTotalProduto);
        const saleKey = `${sale.codProduto}_${positiveValueCents}_${positiveWeight}`;

        const originalSale = positiveSalesMap.get(saleKey);
        if (originalSale && originalSale.bip_id) {
          matchedBip = { id: originalSale.bip_id };
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

      // Usa a data/hora que vem do ERP sem conversão adicional
      const sellDate = sale.dataHoraVenda
        ? sale.dataHoraVenda // Já vem no horário correto do ERP
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
        status: status,
        discount_cents: sale.descontoAplicado ? Math.round(sale.descontoAplicado * 100) : 0
      };

      sellsToInsert.push(sellRecord);
    }

    if (sellsToInsert.length > 0) {
      const values = sellsToInsert.map(record =>
        `(${record.activated_product_id || 'NULL'}, '${record.product_id}', '${record.product_description.replace(/'/g, "''")}', '${record.sell_date}', ${record.sell_value_cents}, ${record.product_weight}, ${record.bip_id || 'NULL'}, '${record.num_cupom_fiscal}', ${record.point_of_sale_code || 'NULL'}, '${record.status}', ${record.discount_cents})`
      ).join(',');

      await AppDataSource.query(`
          INSERT INTO sells (activated_product_id, product_id, product_description, sell_date, sell_value_cents, product_weight, bip_id, num_cupom_fiscal, point_of_sale_code, status, discount_cents)
          VALUES ${values}
          ON CONFLICT (product_id, product_weight, num_cupom_fiscal) DO NOTHING
        `);
    }

    const cancelledSalesWithBips = sellsToInsert.filter(s => s.status === 'cancelled' && s.bip_id);

    if (cancelledSalesWithBips.length > 0) {
      const bipIdsToCancel = cancelledSalesWithBips.map(s => s.bip_id);
      await AppDataSource.query(`
          UPDATE bips
          SET status = 'cancelled'
          WHERE id = ANY($1::int[])
        `, [bipIdsToCancel]);
    }

    stats.endTimeSells = new Date();
  }

  private static parseArguments(args: string[]): CommandArgs {
    const parsedArgs: CommandArgs = {
      notify: false,
      date: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        .split('/').reverse().join('-'),
      runYesterday: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--notify') {
        const value = args[i + 1];
        parsedArgs.notify = value === 'true';
        i++;
      }

      if (arg === '--date') {
        parsedArgs.date = args[i + 1];
        i++;
      }

      if (arg === '--runYesterday') {
        parsedArgs.runYesterday = true;
        parsedArgs.notify = true;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        parsedArgs.date = yesterday.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          .split('/').reverse().join('-');
      }
    }

    return parsedArgs;
  }

  private static validateArguments(args: CommandArgs): void {
    if (args.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(args.date)) {
        throw new Error('Formato de data inválido. Use YYYY-MM-DD');
      }
    }
  }

  private static printFinalReport(stats: ProcessingStats): void {
    if (stats.endTimeSells) {
      const ms = stats.endTimeSells.getTime() - stats.startTime.getTime();
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      stats.executionTimeSells = `${minutes}m ${seconds}s`;
    }

    if (stats.endTimeBips) {
      const ms = stats.endTimeBips.getTime() - stats.startTime.getTime();
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      stats.executionTimeBips = `${minutes}m ${seconds}s`;
    }

    if (stats.endTime) {
      const ms = stats.endTime.getTime() - stats.startTime.getTime();
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      stats.executionTime = `${minutes}m ${seconds}s`;
    }

    console.log('='.repeat(60));
    console.log('📊 RELATÓRIO DE VERIFICAÇÃO DIÁRIA');
    console.log('='.repeat(60));
    console.log(`📅 Data: ${stats.date} `);

    console.log(`\n🛒 Vendas ERP: ${stats.totalSales}`);
    console.log(`✅ Verificadas: ${stats.verifiedCount}`);
    console.log(`⚠️  Não verificadas: ${stats.notVerifiedCount}`);
    console.log(`🚫 Canceladas: ${stats.cancelledCount}`);
    if (stats.executionTimeSells) {
      console.log(`⏱️  Tempo vendas: ${stats.executionTimeSells}`);
    }

    console.log(`\n📱 Total de bipagens: ${stats.totalBipages}`);
    console.log(`📱 Bipagens pendente: ${stats.bipsPending}`);
    console.log(`⚙️ Notificar: ${stats.notifyBips ? 'Sim' : 'Não'}`);
    console.log(`✅ Bipagens para verificar: ${stats.bipsToVerify}`);
    console.log(`📢 Bipagens para notificar: ${stats.bipsToNotify}`);
    if (stats.executionTimeBips) {
      console.log(`⏱️  Tempo bipagens: ${stats.executionTimeBips}`);
    }
    if (stats.executionTime) {
      console.log(`\n⏱️  Tempo total: ${stats.executionTime}`);
    }
    console.log('='.repeat(60));
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  DailyVerificationCommand.execute(args)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
