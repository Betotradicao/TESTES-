import { Bip } from '../entities/Bip';
import { SaleData, VerificationResult } from '../types/verification.types';
import { ConfigurationService } from './configuration.service';

export class BipVerificationService {
  private static toleranceCache: number | null = null;
  private static toleranceCacheTime: number = 0;

  private static async getTolerance(): Promise<number> {
    // Cache por 5 minutos
    if (this.toleranceCache !== null && Date.now() - this.toleranceCacheTime < 300000) {
      return this.toleranceCache;
    }
    try {
      const val: any = await ConfigurationService.get('bip_price_tolerance', '0.03');
      this.toleranceCache = parseFloat(String(val || '0.03')) || 0.03;
      this.toleranceCacheTime = Date.now();
    } catch {
      this.toleranceCache = 0.03;
    }
    return this.toleranceCache;
  }

  /**
   * Implementa a lógica de matching do N8N
   * Compara bipagens com vendas para determinar quais verificar e quais notificar
   */
  static async processVerificationAndNotification(bips: Bip[], vendas: SaleData[]): Promise<VerificationResult> {
    const tolerance = await this.getTolerance();
    const to_verify: Array<{ bip: Bip; venda: SaleData }> = [];
    const to_notify: Bip[] = [];

    for (const bip of bips) {
      const precoBip = bip.bip_price_cents / 100;
      const productIdInt = parseInt(bip.product_id, 10);

      const match = vendas.find(venda => {
        const codProdutoInt = parseInt(venda.codProduto, 10);
        const valProduto = Number(venda.valTotalProduto);
        const desconto = Number(venda.descontoAplicado) || 0;

        // A bipagem guarda o valor da ETIQUETA (peso x preco cheio). Se o caixa deu
        // desconto, VAL_TOTAL_PRODUTO vem MENOR e o item ficava eternamente "Pendente"
        // — parecia produto que saiu sem passar no caixa, mas tinha passado.
        //
        // Caso real (Tradicao, 20/08/2026): PEITO DE FRANGO SEM OSSO, 5,650 kg.
        //   bipagem ............. R$ 112,94   (5,650 x R$ 19,99 da etiqueta)
        //   venda no caixa ...... R$ 101,64   (cupom 647185, PDV 1)
        //   VAL_DESCONTO ........ R$  11,30
        //   101,64 + 11,30 = 112,94  -> bate no centavo
        //
        // Entao aceita o casamento pelo valor LIQUIDO (venda sem desconto) ou pelo
        // BRUTO (liquido + desconto). A tolerancia continua a mesma nos dois.
        const precoOk =
          Math.abs(valProduto - precoBip) <= tolerance ||
          Math.abs((valProduto + desconto) - precoBip) <= tolerance;

        // Filtro por loja: se a bipagem tem cod_loja, só aceita venda da mesma loja
        const lojaOk = !bip.cod_loja || !venda.codLoja || bip.cod_loja === venda.codLoja;

        return productIdInt === codProdutoInt && precoOk && lojaOk;
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
        // Dados da venda que casou: valor cobrado, desconto e margem real.
        // Tudo em centavos (inteiro) pra nao acumular erro de ponto flutuante.
        const valorLiquido = Number(venda.valTotalProduto) || 0;
        const desconto = Number(venda.descontoAplicado) || 0;
        const qtd = Number(venda.qtdTotalProduto) || 0;
        const custoUnit = Number(venda.valCustoRep) || 0;
        const custoTotal = custoUnit * qtd;

        // Margem sobre o que foi REALMENTE cobrado — e o numero honesto: o desconto
        // dado no caixa sai do bolso da margem.
        const margemPct = valorLiquido > 0
          ? ((valorLiquido - custoTotal) / valorLiquido) * 100
          : null;

        await bipRepository.update(bip.id, {
          status: 'verified' as any, // Cast needed due to enum typing
          tax_cupon: venda.numCupomFiscal?.toString() || null,
          venda_valor_cents: Math.round(valorLiquido * 100),
          venda_desconto_cents: Math.round(desconto * 100),
          venda_custo_cents: custoTotal > 0 ? Math.round(custoTotal * 100) : null,
          venda_margem_pct: margemPct !== null && custoTotal > 0
            ? Math.round(margemPct * 100) / 100
            : null,
        } as any);

        const aviso = desconto > 0 ? ` (desconto de R$ ${desconto.toFixed(2)} no caixa)` : '';
        console.log(`✅ Bipagem ${bip.id} verificada com cupom ${venda.numCupomFiscal || 'N/A'}${aviso}`);
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