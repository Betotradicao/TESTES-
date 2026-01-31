import { AppDataSource } from '../config/database';
import { Bip, BipStatus } from '../entities/Bip';
import { EanFormatResult, ErpProduct, BipWebhookData } from '../types/webhook.types';
import { OracleService } from './oracle.service';

export class BipWebhookService {
  /**
   * Busca produto no ERP usando PLU
   * Reutiliza lógica similar ao ProductsController
   */
  static async getProductFromERP(plu: string): Promise<ErpProduct | null> {
    try {
      console.log(`🔍 Buscando produto no ERP com PLU: ${plu}`);

      // Use cache similar ao ProductsController
      const erpProduct = await this.fetchProductFromERP(plu);

      if (!erpProduct) {
        console.log(`⚠️  Produto com PLU ${plu} não encontrado no ERP`);
        console.log(`🎭 Criando produto mock para simulação/teste`);

        // Retorna produto mock para permitir simulação sem ERP configurado
        return {
          descricao: `Produto Teste PLU ${plu}`,
          valvenda: '10.99',
          valoferta: null
        };
      }

      console.log(`✅ Produto encontrado no ERP: ${erpProduct.descricao}`);
      return {
        descricao: erpProduct.descricao,
        valvenda: erpProduct.valvenda,
        valoferta: erpProduct.valoferta || null
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar produto ${plu} no ERP:`, error);
      console.log(`🎭 Criando produto mock para simulação/teste (erro no ERP)`);

      // Fallback para produto mock em caso de erro de conexão com ERP
      return {
        descricao: `Produto Teste PLU ${plu}`,
        valvenda: '10.99',
        valoferta: null
      };
    }
  }

  static async fetchProductFromERP(plu: string): Promise<ErpProduct | null> {
    // MIGRADO: Busca diretamente do Oracle ao invés da API Intersolid
    console.log(`🔍 [ORACLE] Buscando produto PLU ${plu} diretamente do Oracle...`);

    try {
      // Converter PLU para número (remove zeros à esquerda)
      // Ex: "04688" -> 4688 (Oracle armazena COD_PRODUTO como NUMBER)
      const codProdutoNum = parseInt(plu, 10);
      console.log(`🔢 [ORACLE] PLU convertido: "${plu}" -> ${codProdutoNum}`);

      // Query para buscar produto pelo código (PLU)
      // COD_LOJA = 1 como padrão (pode ser configurável no futuro)
      const sql = `
        SELECT
          p.COD_PRODUTO,
          p.DES_PRODUTO,
          NVL(pl.VAL_VENDA, 0) as VAL_VENDA,
          NVL(pl.VAL_OFERTA, 0) as VAL_OFERTA
        FROM INTERSOLID.TAB_PRODUTO p
        INNER JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON p.COD_PRODUTO = pl.COD_PRODUTO
        WHERE p.COD_PRODUTO = :codProduto
        AND pl.COD_LOJA = 1
        AND ROWNUM = 1
      `;

      const rows = await OracleService.query(sql, { codProduto: codProdutoNum });

      if (rows.length === 0) {
        console.log(`⚠️ [ORACLE] Produto PLU ${plu} não encontrado`);
        return null;
      }

      const row = rows[0];

      // Mapear para formato esperado pelo sistema (ErpProduct)
      const product: ErpProduct = {
        descricao: row.DES_PRODUTO || `Produto ${plu}`,
        valvenda: String(row.VAL_VENDA || 0),
        valoferta: row.VAL_OFERTA > 0 ? String(row.VAL_OFERTA) : null
      };

      console.log(`✅ [ORACLE] Produto encontrado: ${product.descricao}, Preço: R$ ${product.valvenda}, Oferta: ${product.valoferta ? 'R$ ' + product.valoferta : 'N/A'}`);

      return product;
    } catch (error) {
      console.error(`❌ [ORACLE] Erro ao buscar produto PLU ${plu}:`, error);
      throw error;
    }
  }


  /**
   * Processa dados da bipagem conforme N8N
   * Implementa todos os cálculos exatos das imagens
   */
  static processBipData(
    formatResult: EanFormatResult,
    erpProduct: ErpProduct,
    eventDate?: string,
    equipmentId?: number | null
  ): BipWebhookData {
    console.log(`📊 Processando dados da bipagem...`);

    // === CÁLCULO DO BIP_PRICE_CENTS ===
    const bipPriceCents = Number(formatResult.sell_price!.replace(/\D+/g, ''));

    // === CÁLCULO DO BIP_WEIGHT (fórmula exata do N8N) ===
    const erpValOferta = erpProduct.valoferta;
    const erpValVenda = erpProduct.valvenda;

    // Converter valores do ERP (em reais) para centavos
    // O ERP retorna valores como 44.9 (R$ 44,90), então multiplicamos por 100
    const productPriceCentsKg = erpValOferta && Number(erpValOferta) > 0
      ? Math.round(Number(erpValOferta) * 100)
      : Math.round(Number(erpValVenda) * 100);

    const weight = bipPriceCents / productPriceCentsKg;

    // === OUTROS CAMPOS DO PRODUTO ===
    const fullPrice = Math.round(Number(erpProduct.valvenda) * 100);
    const discountPrice = erpProduct.valoferta && Number(erpProduct.valoferta) > 0
      ? Math.round(Number(erpProduct.valoferta) * 100)
      : 0;

    // === TRATAMENTO DE DATA ===
    let finalEventDate: Date;
    if (eventDate) {
      // Se event_date vem no webhook em UTC, converter para horário de Brasília (UTC-3)
      const utcDate = new Date(eventDate);

      // Ajustar para timezone de Brasília (UTC-3 = -180 minutos)
      const brazilOffsetMinutes = 180; // UTC-3
      const localDate = new Date(utcDate.getTime() - brazilOffsetMinutes * 60 * 1000);

      finalEventDate = localDate;
    } else {
      // Senão, usar sell_date do formatador
      finalEventDate = new Date(formatResult.sell_date!);
    }

    return {
      ean: formatResult.sell_code!,
      bip_price_cents: bipPriceCents,
      product_id: formatResult.produto_id!,
      product_description: erpProduct.descricao,
      product_full_price_cents_kg: fullPrice,
      bip_weight: weight,
      product_discount_price_cents_kg: discountPrice,
      event_date: finalEventDate,
      status: 'pending',
      equipment_id: equipmentId || null
    };
  }

  /**
   * Salva bipagem no banco de dados
   */
  static async saveBipagem(bipData: BipWebhookData, employeeId?: string): Promise<Bip> {
    try {
      console.log(`💾 Salvando bipagem no banco...`);
      if (employeeId) {
        console.log(`👤 Associando bipagem ao colaborador: ${employeeId}`);
      }

      const bipRepository = AppDataSource.getRepository(Bip);
      const bip = bipRepository.create({
        ean: bipData.ean,
        bip_price_cents: bipData.bip_price_cents,
        product_id: bipData.product_id,
        product_description: bipData.product_description,
        product_full_price_cents_kg: bipData.product_full_price_cents_kg,
        bip_weight: bipData.bip_weight,
        product_discount_price_cents_kg: bipData.product_discount_price_cents_kg,
        event_date: bipData.event_date,
        status: BipStatus.PENDING,
        equipment_id: bipData.equipment_id ?? undefined,
        employee_id: employeeId ?? undefined
      });
      const savedBip = await bipRepository.save(bip);

      console.log(`✅ Bipagem salva com sucesso: ID ${savedBip.id}`);
      return savedBip;
    } catch (error) {
      console.error('❌ Erro ao salvar bipagem:', error);
      throw error;
    }
  }
}