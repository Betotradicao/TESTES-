import { Bip } from '../entities/Bip';
import { SaleData, VerificationResult } from '../types/verification.types';

export class BipVerificationService {
  /**
   * Implementa a lógica de matching do N8N
   * Compara bipagens com vendas para determinar quais verificar e quais notificar
   */
  static processVerificationAndNotification(bips: Bip[], vendas: SaleData[]): VerificationResult {
    const to_verify: Array<{ bip: Bip; venda: SaleData }> = [];
    const to_notify: Bip[] = [];

    for (const bip of bips) {
      const precoBip = bip.bip_price_cents / 100;
      const productIdInt = parseInt(bip.product_id, 10);

      const match = vendas.find(venda => {
        const codProdutoInt = parseInt(venda.codProduto, 10);
        const valProduto = Number(venda.valTotalProduto);

        // Tolerance of R$ 0.03 as specified in the N8N code
        const precoOk = Math.abs(valProduto - precoBip) <= 0.03;

        return productIdInt === codProdutoInt && precoOk;
      });

      if (match) {
        to_verify.push({
          bip,
          venda: match
        });
      } else {
        to_notify.push(bip);
      }
    }

    return {
      to_verify,
      to_notify
    };
  }

  /**
   * Processa verificações - atualiza status das bipagens para verified
   * e adiciona tax_cupon da venda correspondente
   */
  static async processVerifications(verifications: Array<{ bip: Bip; venda: SaleData }>): Promise<void> {
    console.log(`✅ Processando ${verifications.length} verificações...`);

    const { AppDataSource } = await import('../config/database');
    const bipRepository = AppDataSource.getRepository(Bip);

    for (const { bip, venda } of verifications) {
      try {
        // Update bip status to verified and add tax_cupon
        await bipRepository.update(bip.id, {
          status: 'verified' as any, // Cast needed due to enum typing
          tax_cupon: venda.numCupomFiscal?.toString() || null
        });

        console.log(`✅ Bipagem ${bip.id} verificada com cupom ${venda.numCupomFiscal || 'N/A'}`);
      } catch (error) {
        console.error(`❌ Erro ao verificar bipagem ${bip.id}:`, error);
      }
    }

    console.log(`🎉 ${verifications.length} bipagens verificadas com sucesso!`);
  }

  /**
   * Processa notificações - atualiza notified_at das bipagens
   */
  static async processNotifications(notifications: Bip[]): Promise<void> {
    console.log(`📢 Processando ${notifications.length} notificações...`);

    const { AppDataSource } = await import('../config/database');
    const bipRepository = AppDataSource.getRepository(Bip);

    for (const bip of notifications) {
      try {
        // Update notified_at to current timestamp
        await bipRepository.update(bip.id, {
          notified_at: new Date()
        });

        console.log(`📬 Bipagem ${bip.id} marcada como notificada`);
      } catch (error) {
        console.error(`❌ Erro ao marcar notificação da bipagem ${bip.id}:`, error);
      }
    }

    console.log(`🎉 ${notifications.length} bipagens marcadas como notificadas!`);
  }
}