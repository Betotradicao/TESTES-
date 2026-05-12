import { AppDataSource } from '../config/database';
import { Bip, BipStatus } from '../entities/Bip';
import { EanFormatResult, ErpProduct, BipWebhookData } from '../types/webhook.types';
import { OracleService } from './oracle.service';
import { PostgresErpService } from './postgres-erp.service';
import { MappingService } from './mapping.service';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';

export class BipWebhookService {
  /**
   * Detecta tipo do ERP ativo (oracle ou postgresql).
   */
  private static async getActiveErpType(): Promise<'oracle' | 'postgresql'> {
    const repo = AppDataSource.getRepository(DatabaseConnection);
    let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
    if (!conn) conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
    if (!conn) conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
    return conn?.type === DatabaseType.POSTGRESQL ? 'postgresql' : 'oracle';
  }

  /**
   * Busca produto no ERP usando PLU
   * Reutiliza lógica similar ao ProductsController
   * @param codLoja - Código da loja (1, 2, 3, 4) ou null para usar padrão 1
   */
  static async getProductFromERP(plu: string, codLoja?: number | null): Promise<ErpProduct | null> {
    try {
      const loja = codLoja || 1;
      console.log(`🔍 Buscando produto no ERP com PLU: ${plu} (Loja: ${loja})`);

      const erpProduct = await this.fetchProductFromERP(plu, loja);

      if (!erpProduct) {
        console.log(`⚠️ Produto PLU ${plu} não encontrado no ERP - bipagem será ignorada`);
        return null;
      }

      console.log(`✅ Produto encontrado no ERP: ${erpProduct.descricao}`);
      return {
        descricao: erpProduct.descricao,
        valvenda: erpProduct.valvenda,
        valoferta: erpProduct.valoferta || null
      };
    } catch (error) {
      console.error(`❌ Erro ao buscar produto ${plu} no ERP:`, error);
      return null;
    }
  }

  static async fetchProductFromERP(plu: string, codLoja: number = 1): Promise<ErpProduct | null> {
    const erpType = await this.getActiveErpType();
    return erpType === 'postgresql'
      ? this.fetchProductFromPostgres(plu, codLoja)
      : this.fetchProductFromOracle(plu, codLoja);
  }

  private static async fetchProductFromOracle(plu: string, codLoja: number): Promise<ErpProduct | null> {
    console.log(`🔍 [ORACLE] Buscando produto PLU ${plu} diretamente do Oracle (Loja ${codLoja})...`);

    try {
      const codProdutoNum = parseInt(plu, 10);
      console.log(`🔢 [ORACLE] PLU convertido: "${plu}" -> ${codProdutoNum}`);

      const schema = await MappingService.getSchema();
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const colValVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
      const colValOferta = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_oferta');
      const colCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');

      const sql = `
        SELECT
          p.${colCodProduto},
          p.${colDesProduto},
          NVL(pl.${colValVenda}, 0) as VAL_VENDA,
          NVL(pl.${colValOferta}, 0) as VAL_OFERTA
        FROM ${tabProduto} p
        INNER JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${colCodProdutoLoja}
        WHERE p.${colCodProduto} = :codProduto
        AND pl.${colCodLoja} = :codLoja
        AND ROWNUM = 1
      `;

      const rows = await OracleService.query(sql, { codProduto: codProdutoNum, codLoja });

      if (rows.length === 0) {
        console.log(`⚠️ [ORACLE] Produto PLU ${plu} não encontrado na loja ${codLoja}`);
        return null;
      }

      const row = rows[0];
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

  private static async fetchProductFromPostgres(plu: string, codLoja: number): Promise<ErpProduct | null> {
    console.log(`🔍 [POSTGRES] Buscando produto PLU ${plu} no PostgreSQL ERP (Loja ${codLoja})...`);

    try {
      const schema = await MappingService.getSchema();
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
      const colDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const colValVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
      const colCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');

      // Busca pelo EAN cadastrado (codigo_barras) — PLU da balança é embutido nele.
      // Ex: balança gera EAN "2 40075 003205 0" → PLU=40075 → busca por prod_codbarras='0000000040075'.
      const pluPadded = plu.padStart(13, '0');

      const sql = `
        SELECT
          p.${colCodProduto} as cod_produto,
          p.${colDesProduto} as des_produto,
          COALESCE(pl.${colValVenda}, 0) as val_venda
        FROM ${tabProduto} p
        INNER JOIN ${tabProdutoLoja} pl ON p.${colCodProduto} = pl.${colCodProdutoLoja}
        WHERE p.${colCodBarras} = $1
        AND pl.${colCodLoja}::int = $2::int
        LIMIT 1
      `;

      const rows = await PostgresErpService.query<any>(sql, [pluPadded, codLoja]);

      if (rows.length === 0) {
        console.log(`⚠️ [POSTGRES] Produto PLU ${plu} não encontrado na loja ${codLoja}`);
        return null;
      }

      const row = rows[0];
      const product: ErpProduct = {
        descricao: row.des_produto || `Produto ${plu}`,
        valvenda: String(row.val_venda || 0),
        valoferta: null
      };

      console.log(`✅ [POSTGRES] Produto encontrado: ${product.descricao}, Preço: R$ ${product.valvenda}`);
      return product;
    } catch (error) {
      console.error(`❌ [POSTGRES] Erro ao buscar produto PLU ${plu}:`, error);
      throw error;
    }
  }


  /**
   * Processa dados da bipagem conforme N8N
   * Implementa todos os cálculos exatos das imagens
   * @param codLoja - Código da loja do equipamento (null = Todas as Lojas)
   */
  static processBipData(
    formatResult: EanFormatResult,
    erpProduct: ErpProduct,
    eventDate?: string,
    equipmentId?: number | null,
    codLoja?: number | null
  ): BipWebhookData {
    console.log(`📊 Processando dados da bipagem...`);

    // === CÁLCULO DO BIP_PRICE_CENTS ===
    const sellPriceStr = formatResult.sell_price || '0';
    const bipPriceCents = Number(sellPriceStr.replace(/\D+/g, '')) || 0;

    // === CÁLCULO DO BIP_WEIGHT (fórmula exata do N8N) ===
    const erpValOferta = erpProduct.valoferta;
    const erpValVenda = erpProduct.valvenda;

    // Converter valores do ERP (em reais) para centavos
    // O ERP retorna valores como 44.9 (R$ 44,90), então multiplicamos por 100
    const productPriceCentsKg = erpValOferta && Number(erpValOferta) > 0
      ? Math.round(Number(erpValOferta) * 100)
      : Math.round(Number(erpValVenda) * 100);

    // Se produto não tem preço cadastrado no ERP, não dá pra calcular peso por divisão.
    // Cap numeric(12,3) é 999_999_999.999; Infinity quebra o INSERT.
    const weight = productPriceCentsKg > 0
      ? Math.min(bipPriceCents / productPriceCentsKg, 999_999_999.999)
      : 0;

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
      equipment_id: equipmentId || null,
      cod_loja: codLoja || null
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
      if (bipData.cod_loja) {
        console.log(`🏪 Loja da bipagem: ${bipData.cod_loja}`);
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
        employee_id: employeeId ?? undefined,
        cod_loja: bipData.cod_loja ?? undefined
      });
      const savedBip = await bipRepository.save(bip);

      console.log(`✅ Bipagem salva com sucesso: ID ${savedBip.id} (Loja: ${bipData.cod_loja || 'Todas'})`);
      return savedBip;
    } catch (error) {
      console.error('❌ Erro ao salvar bipagem:', error);
      throw error;
    }
  }
}