import axios from 'axios';
import { AppDataSource } from '../config/database';
import { Bip, BipStatus } from '../entities/Bip';
import { EanFormatResult, ErpProduct, BipWebhookData } from '../types/webhook.types';
import { CacheService } from './cache.service';
import { ConfigurationService } from './configuration.service';

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
    // Busca configurações do banco de dados (fallback para .env)
    const apiUrl = await ConfigurationService.get('intersolid_api_url', null);
    const port = await ConfigurationService.get('intersolid_port', null);
    const productsEndpoint = await ConfigurationService.get('intersolid_products_endpoint', '/v1/produtos');

    // Monta a URL completa
    const baseUrl = port ? `${apiUrl}:${port}` : apiUrl;
    const erpApiUrl = baseUrl
      ? `${baseUrl}${productsEndpoint}`
      : process.env.ERP_PRODUCTS_API_URL || 'http://mock-erp-api.com';

    console.log(`🌐 Fetching product data from ERP API at ${erpApiUrl} for PLU: ${plu}`);

    let response: any = null;

    console.log('Fetching products from ERP API for bipagem...');
    const params = { id: plu };
    if (process.env.NODE_ENV === 'development') {
      response = await axios.get(`${erpApiUrl}`, { params });
    } else {
      response = await axios.get(`${erpApiUrl}/${plu}`);
    }

    const products = response.data;

    if (!Array.isArray(products)) {
      console.error('Resposta da API do ERP não é um array:', products);
      return products
    }

    return products.find((p: any) => p.codigo.includes(plu)) || null;
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

    // === TRATAMENTO DE DATA (sem conversão de timezone) ===
    let finalEventDate: Date;
    if (eventDate) {
      // Se event_date vem no webhook, usar direto (já vem em horário de Brasília)
      finalEventDate = new Date(eventDate);
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