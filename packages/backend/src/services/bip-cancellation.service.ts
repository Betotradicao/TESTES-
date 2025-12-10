import { AppDataSource } from '../config/database';
import { CancellationResult } from '../types/webhook.types';

export class BipCancellationService {
  /**
   * Verifica se deve cancelar bipagens do mesmo EAN (limite de 3 por dia)
   * Replica exatamente a lógica de cancelamento do N8N
   */
  static async checkCancellation(ean: string): Promise<CancellationResult> {
    try {
      console.log(`🔍 Verificando limite de bipagens para EAN: ${ean}`);

      // Query exata do N8N
      const result = await AppDataSource.query(`
        SELECT (COUNT(*) >= 3) AS cancel
        FROM bips
        WHERE ean = $1
          AND status = 'pending'
          AND event_date >= CURRENT_DATE
          AND event_date < CURRENT_DATE + INTERVAL '1 day'
      `, [ean]);

      const shouldCancel = result[0]?.cancel || false;

      if (shouldCancel) {
        console.log(`⚠️  Limite excedido para EAN ${ean}. Cancelando bipagens do dia...`);
        await this.cancelBipagesForEan(ean);
      } else {
        console.log(`✅ EAN ${ean} dentro do limite`);
      }

      return { cancel: shouldCancel };
    } catch (error) {
      console.error('❌ Erro ao verificar cancelamento:', error);
      throw error;
    }
  }

  /**
   * Cancela todas as bipagens do EAN para o dia atual
   * Replica exatamente a query de cancelamento do N8N
   */
  private static async cancelBipagesForEan(ean: string): Promise<void> {
    try {
      console.log(`🚫 Cancelando bipagens do EAN ${ean} para hoje...`);

      // Query exata do N8N
      const result = await AppDataSource.query(`
        UPDATE bips
        SET status = 'cancelled'
        WHERE ean = $1
          AND event_date >= CURRENT_DATE
          AND event_date < CURRENT_DATE + INTERVAL '1 day'
      `, [ean]);

      const affectedRows = result[1] || 0; // PostgreSQL retorna [result, affectedCount]
      console.log(`✅ ${affectedRows} bipagens canceladas para EAN ${ean}`);
    } catch (error) {
      console.error(`❌ Erro ao cancelar bipagens do EAN ${ean}:`, error);
      throw error;
    }
  }
}