import { WebhookPayload, EanFormatResult } from '../types/webhook.types';

export class EanFormatterService {
  /**
   * Formata e valida EAN-13 extraindo informações do código
   * Replica exatamente a lógica do N8N
   */
  static formatEan(payload: WebhookPayload, eanDigits: number = 5): EanFormatResult {
    const ean = String(payload.raw || '').replace(/\D+/g, '');

    // Validação do comprimento
    if (ean.length !== 13) {
      return {
        parse_ok: false,
        erro: 'EAN_INVALIDO',
        ean
      };
    }

    const d1 = ean[0];
    const plu = ean.slice(1, 1 + eanDigits);       // dígitos 2-6 (5 dig) ou 2-7 (6 dig)
    const varfield = ean.slice(1 + eanDigits, 12);  // restante até dígito 12

    let valor: string | null = null;
    let peso: string | null = null;
    let esquema: 'PRECO_EMB' | 'PESO_EMB' | 'DESCONHECIDO' = 'DESCONHECIDO';
    let sellPrice: string | null = null;

    if (d1 === '2') { // Preço embutido
      esquema = 'PRECO_EMB';
      valor = (Number(varfield) / 100).toFixed(2);
      sellPrice = valor; // Para esquema de preço, sell_price = valor calculado
    } else if (d1 === '1') { // Peso embutido
      esquema = 'PESO_EMB';
      peso = (Number(varfield) / 1000).toFixed(3);
      sellPrice = null; // Para esquema de peso, sell_price será calculado depois
    }

    // Data atual menos 3 horas (conforme N8N)
    const eventDate = new Date(new Date().getTime() - 3 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .split('.')[0];

    return {
      // Campos originais de validação
      parse_ok: true,
      esquema,
      produto_id: plu,
      valor,
      peso,
      ean,
      d1,

      // Campos adicionais para compatibilidade N8N
      sell_code: ean,           // Será usado como 'ean' na bipagem
      sell_price: sellPrice,    // Será usado como 'bip_price_cents' na bipagem
      sell_date: eventDate      // Fallback para event_date
    };
  }
}