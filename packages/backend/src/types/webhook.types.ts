export interface WebhookPayload {
  raw: string;
  event_date?: string;
  scanner_id?: string;
  machine_id?: string;
  device_path?: string;
}

export interface EanFormatResult {
  parse_ok: boolean;
  erro?: string;
  esquema?: 'PRECO_EMB' | 'PESO_EMB' | 'DESCONHECIDO';
  produto_id?: string;
  valor?: string | null;
  peso?: string | null;
  ean?: string;
  d1?: string;
  sell_code?: string;
  sell_price?: string | null;
  sell_date?: string;
}

export interface ErpProduct {
  descricao: string;
  valvenda: string;
  valoferta?: string | null;
}

export interface CancellationResult {
  cancel: boolean;
}

export interface BipWebhookData {
  ean: string;
  bip_price_cents: number;
  product_id: string;
  product_description: string | null;
  product_full_price_cents_kg: number | null;
  bip_weight: number | null;
  product_discount_price_cents_kg: number | null;
  event_date: Date;
  status: 'pending';
  equipment_id?: number | null;
}